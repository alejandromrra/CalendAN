# ΛИ — AN

Calendario minimalista con avisos por **WhatsApp** y un espacio de **proyectos** con carpetas estilo Apple.

React · Tailwind CSS · Vite · Node (Express)

## Arrancar

```bash
npm install
cp .env.example .env   # rellena tu número y tu apikey (ver abajo)
npm run dev            # web en http://localhost:5173 + servidor de avisos en :3001
```

## Funciones

- **Calendario**: vistas Día / Semana / Mes, mini calendario, próximas tareas, colores y tareas de todo el día.
- **Avisos por WhatsApp**: cada tarea puede avisarte a la hora, 5/15/30/60 min antes o 1 día antes.
- **Proyectos**: cada proyecto es una carpeta tipo macOS con previews de lo que contiene (web, diseños, notas, GitHub, informe).
  Dentro: descripción, informe en Markdown, enlace a GitHub, preview en vivo de la web (escritorio / móvil) y diseños por arrastrar y soltar.
- **Modo claro y oscuro**, color corporativo índigo `#635BF5`.

## WhatsApp

El navegador no puede enviar WhatsApp por sí solo y los avisos tienen que llegar aunque la web esté cerrada,
así que un pequeño servidor (`server/`) guarda las tareas y revisa cada 30 s cuáles toca avisar.

**CallMeBot (gratis, recomendado para uso personal)**
1. Añade a tus contactos el número que aparece en https://www.callmebot.com/blog/free-api-whatsapp-messages/
2. Envíale `I allow callmebot to send me messages` y te responderá con tu apikey.
3. En la app → Ajustes, pega tu número y la apikey y pulsa «Guardar» (también vale ponerlos en `.env`).
4. Pulsa «Enviar mensaje de prueba».

**Twilio**: `WHATSAPP_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`.

> Para que los avisos lleguen siempre, el servidor tiene que estar encendido (tu ordenador, una Raspberry, Railway, Render…).
> En producción: `npm run build && npm start` sirve la web y el servidor juntos.

## Datos

Las tareas y proyectos se guardan en el navegador (`localStorage`); las tareas se copian al servidor (`server/data.json`) para los avisos.
