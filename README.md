# ΛИ — AN

Calendario minimalista con avisos por **WhatsApp** y un espacio de **proyectos** con carpetas estilo Apple.
Los datos viven en tu servidor y se sincronizan al momento entre todos tus dispositivos.

- **Web**: React · Tailwind CSS · Vite (`src/`)
- **Servidor**: Rust · Axum · Postgres (`server/`)

## Publicar en Easypanel

1. **Base de datos** — En tu proyecto de Easypanel: *+ Service → Postgres*. Llámalo `an-db`.
   Copia su **Internal Connection URL** (empieza por `postgres://`).
2. **App** — *+ Service → App*, llámala `an`.
   - *Source*: GitHub → este repositorio y la rama a desplegar.
     (Si el repositorio es privado, conecta antes tu GitHub en *Settings → GitHub* de Easypanel.)
   - *Build*: **Dockerfile** (ruta `Dockerfile`).
   - *Environment*:
     ```
     DATABASE_URL=<la Internal Connection URL del paso 1>
     AN_PASSWORD=<una contraseña larga para entrar en la app>
     TIMEZONE=Europe/Madrid
     ```
   - *Domains*: deja el dominio que te propone Easypanel y pon el puerto **3001**.
   - Pulsa **Deploy**.
3. Abre la URL, entra con tu contraseña y en **Ajustes**:
   - pulsa «Importar al servidor» si tenías datos de la versión anterior en ese navegador,
   - pega tu número y tu apikey de CallMeBot y envía el mensaje de prueba.

Para actualizar, sube los cambios a GitHub y pulsa *Deploy* (o activa el auto-deploy).

## Desarrollo local

Necesitas Node 20+, Rust y un Postgres (por ejemplo con Docker):

```bash
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env        # pon AN_PASSWORD
npm install
npm run dev                 # web en http://localhost:5173 + servidor en :3001
```

## Cómo funciona

- **Sesión**: una sola contraseña (`AN_PASSWORD`). Cada dispositivo tiene su propia sesión; 10 intentos fallidos bloquean el login 15 min.
- **Sincronización**: cada cambio se guarda en Postgres y el servidor avisa al resto de dispositivos (Server-Sent Events), que se actualizan solos.
- **Avisos**: cada 30 s el servidor busca tareas cuyo aviso toca y envía el WhatsApp una sola vez. Si el servidor estuvo apagado, los avisos con más de 1 h de retraso se descartan.
- **Imágenes**: se guardan en Postgres y solo se pueden ver con sesión iniciada.

## API

| Método | Ruta | |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | Sesión (cookie y token `Bearer`) |
| GET/PUT/DELETE | `/api/tasks` · `/api/tasks/{id}` | Tareas |
| GET/PUT/DELETE | `/api/projects` · `/api/projects/{id}` | Proyectos con sus elementos |
| POST/GET | `/api/files` · `/api/files/{id}` | Imágenes |
| GET/PUT | `/api/settings/whatsapp` | Número y apikey de CallMeBot |
| POST | `/api/whatsapp/test` | Mensaje de prueba |
| GET | `/api/events` | Cambios en tiempo real |
