-- Lista de tareas pendientes (independiente del calendario)
CREATE TABLE todos (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  priority   SMALLINT NOT NULL DEFAULT 0,   -- 0 sin prioridad · 1 baja · 2 media · 3 alta
  done       BOOLEAN NOT NULL DEFAULT false,
  done_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX todos_user_idx ON todos (user_id, done);

-- Resumen diario por WhatsApp ya enviado (uno por usuario y día)
CREATE TABLE daily_digests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
