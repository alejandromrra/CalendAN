//! Cada 30 s busca tareas cuyo aviso ya toca y envía el WhatsApp (una sola vez).

use std::time::Duration;

use chrono::{DateTime, Datelike, Utc};
use sqlx::Row;

use crate::{whatsapp, AppState};

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

async fn check(st: &AppState) -> anyhow::Result<()> {
    // Limpieza: imágenes subidas que nunca se llegaron a guardar en un proyecto
    sqlx::query("DELETE FROM files WHERE project_id IS NULL AND created_at < now() - interval '1 day'")
        .execute(&st.db)
        .await?;

    if whatsapp::config(st).await?.is_none() {
        return Ok(());
    }

    let due = sqlx::query(
        "SELECT t.id, t.title, t.description, t.start_at, t.all_day, t.reminder,
                t.start_at - make_interval(mins => t.reminder) AS remind_at
         FROM tasks t
         WHERE t.reminder IS NOT NULL AND NOT t.done
           AND t.start_at - make_interval(mins => t.reminder) <= now()
           AND t.start_at - make_interval(mins => t.reminder) > now() - make_interval(mins => $1)
           AND NOT EXISTS (SELECT 1 FROM reminders_sent r
                           WHERE r.task_id = t.id AND r.remind_at = t.start_at - make_interval(mins => t.reminder))",
    )
    .bind(MAX_LATE_MINUTES as i32)
    .fetch_all(&st.db)
    .await?;

    for row in due {
        let id: String = row.get("id");
        let remind_at: DateTime<Utc> = row.get("remind_at");
        // Se marca antes de enviar para no duplicar si hay varias instancias
        let claimed = sqlx::query("INSERT INTO reminders_sent (task_id, remind_at) VALUES ($1,$2) ON CONFLICT DO NOTHING")
            .bind(&id)
            .bind(remind_at)
            .execute(&st.db)
            .await?
            .rows_affected();
        if claimed == 0 {
            continue;
        }

        let msg = message(
            st,
            row.get("title"),
            row.get("description"),
            row.get("start_at"),
            row.get("all_day"),
            row.get("reminder"),
        );
        match whatsapp::send(st, &msg).await {
            Ok(()) => tracing::info!("WhatsApp enviado: {}", row.get::<String, _>("title")),
            Err(e) => {
                tracing::warn!("WhatsApp falló ({e:#}); se reintentará");
                sqlx::query("DELETE FROM reminders_sent WHERE task_id = $1 AND remind_at = $2")
                    .bind(&id)
                    .bind(remind_at)
                    .execute(&st.db)
                    .await?;
            }
        }
    }
    Ok(())
}

const DAYS: [&str; 7] = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTHS: [&str; 12] = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

fn message(st: &AppState, title: String, description: String, start: DateTime<Utc>, all_day: bool, reminder: i32) -> String {
    let local = start.with_timezone(&st.tz);
    let lead = match reminder {
        0 => "ahora".to_string(),
        m if m % 1440 == 0 => format!("en {} día(s)", m / 1440),
        m if m % 60 == 0 => format!("en {} h", m / 60),
        m => format!("en {m} min"),
    };
    let day = format!(
        "{} {} de {}",
        DAYS[local.weekday().num_days_from_monday() as usize],
        local.day(),
        MONTHS[local.month0() as usize]
    );
    let when = if all_day { day } else { format!("{day}, {}", local.format("%H:%M")) };
    let mut msg = format!("⏰ *{title}* — {lead}\n🗓 {when}");
    if !description.is_empty() {
        msg.push_str("\n\n");
        msg.push_str(&description);
    }
    msg
}
