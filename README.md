# ΛИ — CalendAN

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
     ADMIN_EMAIL=<tu email (cuenta de administrador)>
     AN_PASSWORD=<contraseña inicial del administrador>
     TIMEZONE=Europe/Madrid
     ```
   - *Domains*: deja el dominio que te propone Easypanel y pon el puerto **3001**.
   - Pulsa **Deploy**.
3. Abre la URL, entra con tu email y contraseña y en **Ajustes**:
   - pulsa «Importar al servidor» si tenías datos de la versión anterior en ese navegador,
   - pega tu número y tu apikey de CallMeBot y envía el mensaje de prueba.

Para actualizar, sube los cambios a GitHub y pulsa *Deploy* (o activa el auto-deploy).

### Si pierdes el acceso a la cuenta de administrador

1. En Easypanel → *Entorno*, comprueba `AN_PASSWORD` y añade `RESET_ADMIN_PASSWORD=true`.
2. Pulsa *Implementar*: la contraseña del administrador pasa a ser la de `AN_PASSWORD`.
3. Entra (el email es el de `ADMIN_EMAIL`, o `admin` si no lo definiste) y **quita** `RESET_ADMIN_PASSWORD`.

## Instalar en el iPhone

1. Abre la URL de la app en **Safari** e inicia sesión.
2. *Compartir → Añadir a pantalla de inicio*.
3. Abre **AN** desde el icono, inicia sesión otra vez (la app instalada tiene su propia sesión)
   y en **Ajustes → Notificaciones** pulsa «Activar notificaciones».

Funciona igual en Android y en Chrome/Edge de escritorio. Los avisos llegan por notificación y por WhatsApp.


## App de escritorio (Windows y Linux)

Hecha con **Tauri** (Rust): la misma interfaz empaquetada en una app nativa que se conecta a tu servidor.

- Vive en la **bandeja del sistema**: al cerrar la ventana sigue abierta y te avisa de las tareas con notificaciones nativas.
- Se abre sola al **iniciar el ordenador** (se puede desactivar en Ajustes).
- La primera vez pide la dirección de tu servidor y tu contraseña.

**Descargar los instaladores**: en GitHub → *Actions* → **App de escritorio** → *Run workflow*.
Cuando termine (~15 min) aparecerán en *Releases*:

| Sistema | Archivo |
|---|---|
| Windows | `CalendAN_x.y.z_x64-setup.exe` (o `.msi`) |
| Ubuntu / Debian | `CalendAN_x.y.z_amd64.deb` |
| Fedora | `CalendAN-x.y.z-1.x86_64.rpm` |
| Cualquier Linux | `CalendAN_x.y.z_amd64.AppImage` |

Compilar en local: `npm run desktop` (desarrollo) o `npm run desktop:build` (instalador).
En Linux necesitas `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`.

## Desarrollo local

Necesitas Node 20+, Rust y un Postgres (por ejemplo con Docker):

```bash
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env        # pon AN_PASSWORD
npm install
npm run dev                 # web en http://localhost:5173 + servidor en :3001
```

## Cómo funciona

- **Cuentas**: cada persona entra con email y contraseña y tiene sus propias tareas, proyectos, imágenes, avisos y color. No hay registro público: el administrador crea las cuentas en *Ajustes → Usuarios*. La primera vez que arranca, el servidor crea el administrador con `ADMIN_EMAIL` (por defecto `admin`) y `AN_PASSWORD`, y le asigna los datos que ya hubiera. Contraseñas con Argon2; 10 intentos fallidos bloquean el login 15 min.
- **Sincronización**: cada cambio se guarda en Postgres y el servidor avisa al resto de dispositivos (Server-Sent Events), que se actualizan solos.
- **Avisos**: cada 30 s el servidor busca tareas cuyo aviso toca y envía el WhatsApp una sola vez. Si el servidor estuvo apagado, los avisos con más de 1 h de retraso se descartan.
- **Notificaciones push**: Web Push estándar (VAPID + cifrado aes128gcm) implementado en Rust; las claves se generan solas la primera vez. Opcional: `VAPID_SUBJECT=mailto:tu@correo`.
- **Escritorio**: la app de escritorio escucha `/api/events?client=desktop` y el servidor le manda los avisos en directo; solo se marcan como enviados si hay alguna app abierta.
- **Imágenes**: se guardan en Postgres y solo se pueden ver con sesión iniciada.

## API

| Método | Ruta | |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | Sesión (cookie y token `Bearer`) |
| GET | `/api/auth/me` | Usuario actual |
| PUT | `/api/account` · `/api/account/password` | Nombre y contraseña propios |
| GET/POST/DELETE | `/api/users` · `/api/users/{id}` · `/api/users/{id}/password` | Gestión de cuentas (solo admin) |
| GET/PUT | `/api/settings/appearance` | Color principal |
| GET/PUT/DELETE | `/api/tasks` · `/api/tasks/{id}` | Tareas |
| GET/PUT/DELETE | `/api/projects` · `/api/projects/{id}` | Proyectos con sus elementos |
| POST/GET | `/api/files` · `/api/files/{id}` | Imágenes |
| GET/PUT | `/api/settings/whatsapp` | Número y apikey de CallMeBot |
| POST | `/api/whatsapp/test` | Mensaje de prueba |
| GET/POST/DELETE | `/api/push` | Clave pública y suscripciones push |
| POST | `/api/push/test` | Notificación de prueba |
| GET/DELETE · PUT/DELETE | `/api/todos` · `/api/todos/{id}` | Lista de tareas (DELETE en la lista borra las completadas) |
| GET/PUT · POST | `/api/settings/digest` · `/api/digest/test` | Resumen diario por WhatsApp |
| GET | `/api/events` | Cambios en tiempo real |
