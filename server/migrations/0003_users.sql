-- Cuentas de usuario: cada persona tiene sus propios datos.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,      -- en minúsculas; el admin inicial puede ser "admin"
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajustes de cada usuario (WhatsApp, apariencia…)
CREATE TABLE user_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   JSONB NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Los datos existentes se asignan al administrador al arrancar (ver users::bootstrap)
ALTER TABLE sessions           ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tasks              ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE projects           ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE files              ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE push_subscriptions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX tasks_user_idx    ON tasks (user_id, start_at);
CREATE INDEX projects_user_idx ON projects (user_id);

-- Los elementos de proyecto se identifican dentro de su proyecto
ALTER TABLE project_items DROP CONSTRAINT project_items_pkey;
ALTER TABLE project_items ADD PRIMARY KEY (project_id, id);
