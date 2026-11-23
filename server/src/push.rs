//! Notificaciones Web Push (iPhone con la app en la pantalla de inicio, Android, escritorio).
//!
//! Implementa el estándar sin dependencias de OpenSSL:
//!  - VAPID (RFC 8292): el servidor firma un JWT ES256 para identificarse.
//!  - Cifrado del mensaje "aes128gcm" (RFC 8291 + RFC 8188).

use aes_gcm::{aead::Aead, Aes128Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use hkdf::Hkdf;
use p256::{
    ecdh::EphemeralSecret,
    ecdsa::{signature::Signer, Signature, SigningKey},
    elliptic_curve::{rand_core::OsRng, sec1::ToEncodedPoint},
    PublicKey, SecretKey,
};
use rand::RngCore;
use serde_json::json;
use sha2::Sha256;
use sqlx::Row;

use crate::AppState;

pub struct Vapid {
    key: SigningKey,
    /// Clave pública en base64url (la usa el navegador al suscribirse)
    pub public: String,
    subject: String,
}

impl Vapid {
    /// Carga las claves VAPID de la base de datos o las crea la primera vez
    pub async fn load(db: &sqlx::PgPool) -> anyhow::Result<Self> {
        let saved = sqlx::query("SELECT value FROM settings WHERE key = 'vapid'").fetch_optional(db).await?;
        let secret = match saved {
            Some(r) => {
                let v: serde_json::Value = r.get("value");
                let bytes = B64.decode(v["private"].as_str().unwrap_or_default())?;
                SecretKey::from_slice(&bytes)?
            }
            None => {
                let s = SecretKey::random(&mut OsRng);
                sqlx::query("INSERT INTO settings (key, value) VALUES ('vapid', $1) ON CONFLICT (key) DO NOTHING")
                    .bind(json!({ "private": B64.encode(s.to_bytes()) }))
                    .execute(db)
                    .await?;
                s
            }
        };
        let public = B64.encode(secret.public_key().to_encoded_point(false).as_bytes());
        let subject = std::env::var("VAPID_SUBJECT").ok().filter(|s| !s.is_empty()).unwrap_or_else(|| "mailto:avisos@example.com".into());
        Ok(Self { key: SigningKey::from(secret), public, subject })
    }

    fn jwt(&self, endpoint: &str) -> anyhow::Result<String> {
        let url = reqwest::Url::parse(endpoint)?;
        let aud = url.origin().ascii_serialization();
        let exp = chrono::Utc::now().timestamp() + 12 * 3600;
        let header = B64.encode(br#"{"typ":"JWT","alg":"ES256"}"#);
        let claims = B64.encode(json!({ "aud": aud, "exp": exp, "sub": self.subject }).to_string());
        let unsigned = format!("{header}.{claims}");
        let sig: Signature = self.key.sign(unsigned.as_bytes());
        Ok(format!("{unsigned}.{}", B64.encode(sig.to_bytes())))
    }
}

/// Cifra `payload` para una suscripción (RFC 8291, una sola "record")
pub fn encrypt(p256dh: &str, auth: &str, payload: &[u8]) -> anyhow::Result<Vec<u8>> {
    let ua_public_bytes = B64.decode(p256dh.trim_end_matches('='))?;
    let auth_secret = B64.decode(auth.trim_end_matches('='))?;
    let ua_public = PublicKey::from_sec1_bytes(&ua_public_bytes)?;

    let as_secret = EphemeralSecret::random(&mut OsRng);
    let as_public = as_secret.public_key().to_encoded_point(false);
    let shared = as_secret.diffie_hellman(&ua_public);

    // IKM = HKDF(auth_secret, ecdh, "WebPush: info" || 0 || ua_public || as_public)
    let mut key_info = b"WebPush: info\0".to_vec();
    key_info.extend_from_slice(&ua_public_bytes);
    key_info.extend_from_slice(as_public.as_bytes());
    let mut ikm = [0u8; 32];
    Hkdf::<Sha256>::new(Some(&auth_secret), shared.raw_secret_bytes())
        .expand(&key_info, &mut ikm)
        .map_err(|_| anyhow::anyhow!("hkdf"))?;

    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let hk = Hkdf::<Sha256>::new(Some(&salt), &ikm);
    let mut cek = [0u8; 16];
    let mut nonce = [0u8; 12];
    hk.expand(b"Content-Encoding: aes128gcm\0", &mut cek).map_err(|_| anyhow::anyhow!("hkdf"))?;
    hk.expand(b"Content-Encoding: nonce\0", &mut nonce).map_err(|_| anyhow::anyhow!("hkdf"))?;

    let mut plain = payload.to_vec();
    plain.push(0x02); // delimitador de última "record"
    let cipher = Aes128Gcm::new_from_slice(&cek)?
        .encrypt(Nonce::from_slice(&nonce), plain.as_ref())
        .map_err(|_| anyhow::anyhow!("aes-gcm"))?;

    let mut body = Vec::with_capacity(86 + cipher.len());
    body.extend_from_slice(&salt);
    body.extend_from_slice(&4096u32.to_be_bytes());
    body.push(as_public.as_bytes().len() as u8);
    body.extend_from_slice(as_public.as_bytes());
    body.extend_from_slice(&cipher);
    Ok(body)
}

pub enum Outcome {
    Sent,
    /// La suscripción ya no existe (app desinstalada, permiso retirado…)
    Gone,
    Failed(String),
}

pub async fn send_one(st: &AppState, endpoint: &str, p256dh: &str, auth: &str, payload: &serde_json::Value) -> Outcome {
    let result = async {
        let body = encrypt(p256dh, auth, payload.to_string().as_bytes())?;
        let res = st
            .http
            .post(endpoint)
            .header("TTL", "86400")
            .header("Urgency", "high")
            .header("Content-Encoding", "aes128gcm")
            .header("Content-Type", "application/octet-stream")
            .header("Authorization", format!("vapid t={}, k={}", st.vapid.jwt(endpoint)?, st.vapid.public))
            .body(body)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("{}", e.without_url()))?;
        anyhow::Ok((res.status(), res.text().await.unwrap_or_default()))
    }
    .await;
    match result {
        Ok((s, _)) if s.is_success() => Outcome::Sent,
        Ok((s, _)) if s.as_u16() == 404 || s.as_u16() == 410 => Outcome::Gone,
        Ok((s, body)) => Outcome::Failed(format!("{s}: {}", body.chars().take(200).collect::<String>())),
        Err(e) => Outcome::Failed(e.to_string()),
    }
}

/// Envía a todos los dispositivos suscritos de un usuario. Devuelve cuántos lo recibieron
/// y el primer error (si ninguno lo recibió).
pub async fn send_all(st: &AppState, user: &str, payload: serde_json::Value) -> anyhow::Result<(usize, Option<String>)> {
    let subs = sqlx::query("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1")
        .bind(user)
        .fetch_all(&st.db)
        .await?;
    let mut ok = 0;
    let mut first_err = None;
    for s in subs {
        let endpoint: String = s.get("endpoint");
        match send_one(st, &endpoint, s.get("p256dh"), s.get("auth"), &payload).await {
            Outcome::Sent => ok += 1,
            Outcome::Gone => {
                tracing::info!("suscripción push caducada, se elimina");
                sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = $1").bind(&endpoint).execute(&st.db).await?;
            }
            Outcome::Failed(e) => {
                tracing::warn!("push falló: {e}");
                first_err.get_or_insert(e);
            }
        }
    }
    Ok((ok, if ok == 0 { first_err } else { None }))
}

pub async fn subscription_count(db: &sqlx::PgPool, user: &str) -> anyhow::Result<i64> {
    Ok(sqlx::query("SELECT count(*) AS n FROM push_subscriptions WHERE user_id = $1").bind(user).fetch_one(db).await?.get("n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Descifra como lo haría el navegador y comprueba que recupera el mensaje
    #[test]
    fn roundtrip() {
        let ua_secret = SecretKey::random(&mut OsRng);
        let ua_public = ua_secret.public_key().to_encoded_point(false);
        let mut auth = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut auth);

        let body = encrypt(&B64.encode(ua_public.as_bytes()), &B64.encode(auth), b"hola").unwrap();
        let (salt, rest) = body.split_at(16);
        assert_eq!(&rest[..4], &4096u32.to_be_bytes());
        let idlen = rest[4] as usize;
        let as_public = PublicKey::from_sec1_bytes(&rest[5..5 + idlen]).unwrap();
        let cipher = &rest[5 + idlen..];

        let shared = p256::ecdh::diffie_hellman(ua_secret.to_nonzero_scalar(), as_public.as_affine());
        let mut info = b"WebPush: info\0".to_vec();
        info.extend_from_slice(ua_public.as_bytes());
        info.extend_from_slice(&rest[5..5 + idlen]);
        let mut ikm = [0u8; 32];
        Hkdf::<Sha256>::new(Some(&auth), shared.raw_secret_bytes()).expand(&info, &mut ikm).unwrap();
        let hk = Hkdf::<Sha256>::new(Some(salt), &ikm);
        let (mut cek, mut nonce) = ([0u8; 16], [0u8; 12]);
        hk.expand(b"Content-Encoding: aes128gcm\0", &mut cek).unwrap();
        hk.expand(b"Content-Encoding: nonce\0", &mut nonce).unwrap();
        let plain = Aes128Gcm::new_from_slice(&cek).unwrap().decrypt(Nonce::from_slice(&nonce), cipher).unwrap();
        assert_eq!(plain, b"hola\x02");
    }
}
