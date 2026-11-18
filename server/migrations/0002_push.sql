CREATE TABLE push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  device     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada canal (whatsapp, push) se marca por separado para no repetir ni perder avisos
ALTER TABLE reminders_sent ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE reminders_sent DROP CONSTRAINT reminders_sent_pkey;
ALTER TABLE reminders_sent ADD PRIMARY KEY (task_id, remind_at, channel);
