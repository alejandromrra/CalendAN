//! Envío de WhatsApp con CallMeBot (gratis para avisos a tu propio número).
//! Cada usuario configura su número y su apikey desde Ajustes.

use serde_json::{json, Value};

use crate::AppState;

pub struct Config {
    pub phone: String,
    pub apikey: String,
}

/// "665 85 15 21" / "0034665851521" → "+34665851521"
pub fn normalize_phone(raw: &str) -> String {
    let mut p: String = raw.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect();
    if let Some(rest) = p.strip_prefix("00") {
        p = format!("+{rest}");
    }
    if !p.starts_with('+') && !p.is_empty() {
        let spanish_mobile = p.len() == 9 && matches!(p.as_bytes()[0], b'6' | b'7' | b'8' | b'9');
        p = if spanish_mobile { format!("+34{p}") } else { format!("+{p}") };
    }
    p
}

/// Número y apikey de CallMeBot de un usuario (se configuran en Ajustes)
pub async fn config(st: &AppState, user: &str) -> anyhow::Result<Option<Config>> {
    let v = crate::users::get_setting(&st.db, user, "whatsapp").await?.unwrap_or(Value::Null);
    let phone = v["phone"].as_str().unwrap_or_default().to_string();
    let apikey = v["apikey"].as_str().unwrap_or_default().to_string();
    Ok((!phone.is_empty() && !apikey.is_empty()).then_some(Config { phone, apikey }))
}

pub async fn status(st: &AppState, user: &str) -> anyhow::Result<Value> {
    Ok(match config(st, user).await? {
        Some(c) => {
            let n = c.phone.len();
            let masked = format!("{}•••{}", &c.phone[..3.min(n)], &c.phone[n.saturating_sub(3)..]);
            json!({ "provider": "callmebot", "configured": true, "phone": masked })
        }
        None => json!({ "provider": "callmebot", "configured": false, "phone": null }),
    })
}

pub async fn send(st: &AppState, user: &str, text: &str) -> anyhow::Result<()> {
    let c = config(st, user).await?.ok_or_else(|| anyhow::anyhow!("WhatsApp no está configurado (Ajustes)"))?;
    let res = st
        .http
        .get(std::env::var("CALLMEBOT_URL").unwrap_or_else(|_| "https://api.callmebot.com/whatsapp.php".into()))
        .query(&[("phone", c.phone.as_str()), ("text", text), ("apikey", c.apikey.as_str())])
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("No se pudo conectar con CallMeBot: {}", e.without_url()))?;
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    let text = plain_text(&body);
    let lower = text.to_lowercase();
    // CallMeBot responde 200 incluso cuando falla: solo es éxito si confirma el envío
    let ok = status.is_success()
        && (lower.contains("queued") || lower.contains("message sent") || lower.contains("mensaje enviado"))
        && !lower.contains("not sent");
    if !ok {
        let snippet: String = text.chars().take(250).collect();
        let hint = if lower.contains("apikey") || lower.contains("api key") {
            " — revisa la apikey en Ajustes"
        } else if lower.contains("phone") {
            " — revisa el número (formato +34600000000)"
        } else {
            ""
        };
        anyhow::bail!("CallMeBot no envió el mensaje ({status}): {snippet}{hint}");
    }
    tracing::info!("CallMeBot: {}", text.chars().take(120).collect::<String>());
    Ok(())
}

/// Quita las etiquetas HTML de la respuesta de CallMeBot y deja el texto limpio
fn plain_text(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => { in_tag = false; out.push(' ') }
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phone() {
        assert_eq!(normalize_phone("665851521"), "+34665851521");
        assert_eq!(normalize_phone("+34 665 85 15 21"), "+34665851521");
        assert_eq!(normalize_phone("0034665851521"), "+34665851521");
        assert_eq!(normalize_phone("34665851521"), "+34665851521");
    }

    #[test]
    fn html() {
        assert_eq!(plain_text("<p><b>APIKey is invalid.</b></p>\n<br>Try again"), "APIKey is invalid. Try again");
    }
}
