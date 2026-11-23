//! Cada 30 s busca tareas cuyo aviso ya toca y envía el WhatsApp (una sola vez).

use std::time::Duration;

use chrono::{DateTime, Datelike, Utc};
use sqlx::Row;

use serde_json::json;

use crate::{push, whatsapp, AppState, Live};

/// Si el servidor estuvo caído, no se envían avisos con más de 1 h de retraso
const MAX_LATE_MINUTES: i64 = 60;

pub async fn run(st: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(30));
    loop {
        tick.tick().await;
        if let Err(e) = check(&st).await {
            tracing::error!("recordatorios: {e:#}");
        }
    }
}

#[derive(Clone, Copy)]
enum Channel {
    WhatsApp,
    Push,
    Desktop,
}

impl Channel {
    fn name(self) -> &'static str {
        match self {
            Channel::WhatsApp => "whatsapp",
            Channel::Push => "push",
            Channel::Desktop => "desktop",
        }
    }
}

async fn check(st: &AppState) -> anyhow::Result<()> {
    // Limpieza: imágenes subidas que nunca se llegaron a guardar en un proyecto
    sqlx::query("DELETE FROM files WHERE project_id IS NULL AND created_at < now() - interval '1 day'")
        .execute(&st.db)
        .await?;

    check_channel(st, Channel::WhatsApp, &[]).await?;
    check_channel(st, Channel::Push, &[]).await?;
    // Solo se marca como enviado a escritorio si el usuario tiene alguna app abierta en ese momento
    let desktops: Vec<String> = st.desktops.lock().unwrap().keys().cloned().collect();
    if !desktops.is_empty() {
        check_channel(st, Channel::Desktop, &desktops).await?;
    }
    Ok(())
}

async fn check_channel(st: &AppState, ch: Channel, desktop_users: &[String]) -> anyhow::Result<()> {
    // Cada canal solo para los usuarios que lo tienen configurado
    let channel_filter = match ch {
        Channel::WhatsApp => "EXISTS (SELECT 1 FROM user_settings s WHERE s.user_id = t.user_id AND s.key = 'whatsapp')",
        Channel::Push => "EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = t.user_id)",
        Channel::Desktop => "t.user_id = ANY($3::text[])",
    };
    let sql = format!(
        "SELECT t.id, t.user_id, t.title, t.description, t.start_at, t.all_day, t.reminder,
                t.start_at - make_interval(mins => t.reminder) AS remind_at
         FROM tasks t
         WHERE {channel_filter} AND $3::text[] IS NOT NULL AND t.reminder IS NOT NULL AND NOT t.done
           AND t.start_at - make_interval(mins => t.reminder) <= now()
           AND t.start_at - make_interval(mins => t.reminder) > now() - make_interval(mins => $1)
           AND NOT EXISTS (SELECT 1 FROM reminders_sent r
                           WHERE r.task_id = t.id AND r.channel = $2
                             AND r.remind_at = t.start_at - make_interval(mins => t.reminder))"
    );
    let due = sqlx::query(&sql)
    .bind(MAX_LATE_MINUTES as i32)
    .bind(ch.name())
    .bind(desktop_users)
    .fetch_all(&st.db)
    .await?;

    for row in due {
        let id: String = row.get("id");
        let user: String = row.get("user_id");
        let remind_at: DateTime<Utc> = row.get("remind_at");
        // Se marca antes de enviar para no duplicar si hay varias instancias
        let claimed = sqlx::query(
            "INSERT INTO reminders_sent (task_id, remind_at, channel) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        )
        .bind(&id)
        .bind(remind_at)
        .bind(ch.name())
        .execute(&st.db)
        .await?
        .rows_affected();
        if claimed == 0 {
            continue;
        }

        let title: String = row.get("title");
        let r = Reminder {
            title: &title,
            description: row.get("description"),
            start: row.get("start_at"),
            all_day: row.get("all_day"),
            minutes: row.get("reminder"),
        };
        let result = match ch {
            Channel::WhatsApp => whatsapp::send(st, &user, &whatsapp_message(st, &r)).await,
            Channel::Desktop => {
                let _ = st.events.send(Live::Reminder(user.clone(), json!({
                    "title": "Notificación",
                    "body": push_body(st, &r),
                    "tag": id,
                })));
                Ok(())
            }
            Channel::Push => {
                let payload = json!({
                    "title": "Notificación",
                    "body": push_body(st, &r),
                    "tag": id,
                    "url": "/",
                });
                match push::send_all(st, &user, payload).await? {
                    (0, Some(e)) => Err(anyhow::anyhow!(e)),
                    _ => Ok(()),
                }
            }
        };
        match result {
            Ok(()) => tracing::info!("aviso {} enviado: {title}", ch.name()),
            Err(e) => {
                tracing::warn!("aviso {} falló ({e:#}); se reintentará", ch.name());
                sqlx::query("DELETE FROM reminders_sent WHERE task_id = $1 AND remind_at = $2 AND channel = $3")
                    .bind(&id)
                    .bind(remind_at)
                    .bind(ch.name())
                    .execute(&st.db)
                    .await?;
            }
        }
    }
    Ok(())
}

struct Reminder<'a> {
    title: &'a str,
    description: String,
    start: DateTime<Utc>,
    all_day: bool,
    minutes: i32,
}

const DAYS: [&str; 7] = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTHS: [&str; 12] = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

fn lead(minutes: i32) -> String {
    match minutes {
        0 => "ahora".to_string(),
        m if m % 1440 == 0 => format!("en {} día(s)", m / 1440),
        m if m % 60 == 0 => format!("en {} h", m / 60),
        m => format!("en {m} min"),
    }
}

fn when(st: &AppState, r: &Reminder) -> String {
    let local = r.start.with_timezone(&st.tz);
    let day = format!(
        "{} {} de {}",
        DAYS[local.weekday().num_days_from_monday() as usize],
        local.day(),
        MONTHS[local.month0() as usize]
    );
    if r.all_day { day } else { format!("{day}, {}", local.format("%H:%M")) }
}

fn whatsapp_message(st: &AppState, r: &Reminder) -> String {
    let mut msg = format!("⏰ *{}* — {}\n🗓 {}", r.title, lead(r.minutes), when(st, r));
    if !r.description.is_empty() {
        msg.push_str("\n\n");
        msg.push_str(&r.description);
    }
    msg
}

fn push_body(st: &AppState, r: &Reminder) -> String {
    let mut body = format!("⏰ {} — {} · {}", r.title, lead(r.minutes), when(st, r));
    if !r.description.is_empty() {
        body.push('\n');
        body.push_str(&r.description);
    }
    body
}
