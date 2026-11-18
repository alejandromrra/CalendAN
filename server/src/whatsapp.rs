//! Envío de WhatsApp con CallMeBot (gratis para avisos a tu propio número).
//! La configuración se guarda desde Ajustes; WHATSAPP_PHONE / CALLMEBOT_APIKEY sirven de respaldo.

use serde_json::{json, Value};
use sqlx::Row;

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

pub async fn config(st: &AppState) -> anyhow::Result<Option<Config>> {
    let saved = sqlx::query("SELECT value FROM settings WHERE key = 'whatsapp'").fetch_optional(&st.db).await?;
    let (phone, apikey) = match saved {
        Some(r) => {
            let v: Value = r.get("value");
            (v["phone"].as_str().unwrap_or_default().to_string(), v["apikey"].as_str().unwrap_or_default().to_string())
        }
        None => (
            normalize_phone(&std::env::var("WHATSAPP_PHONE").unwrap_or_default()),
            std::env::var("CALLMEBOT_APIKEY").unwrap_or_default(),
        ),
    };
    Ok((!phone.is_empty() && !apikey.is_empty()).then_some(Config { phone, apikey }))
}

pub async fn status(st: &AppState) -> anyhow::Result<Value> {
    Ok(match config(st).await? {
        Some(c) => {
            let n = c.phone.len();
            let masked = format!("{}•••{}", &c.phone[..3.min(n)], &c.phone[n.saturating_sub(3)..]);
            json!({ "provider": "callmebot", "configured": true, "phone": masked })
        }
        None => json!({ "provider": "callmebot", "configured": false, "phone": null }),
    })
}

pub async fn send(st: &AppState, text: &str) -> anyhow::Result<()> {
    let c = config(st).await?.ok_or_else(|| anyhow::anyhow!("WhatsApp no está configurado (Ajustes)"))?;
    let res = st
        .http
        .get("https://api.callmebot.com/whatsapp.php")
        .query(&[("phone", c.phone.as_str()), ("text", text), ("apikey", c.apikey.as_str())])
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("No se pudo conectar con CallMeBot: {}", e.without_url()))?;
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() || body.to_lowercase().contains("error") {
        let snippet: String = body.chars().take(200).collect();
        anyhow::bail!("CallMeBot respondió {status}: {snippet}");
    }
    Ok(())
}
