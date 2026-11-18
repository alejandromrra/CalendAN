// Envío de WhatsApp. Dos proveedores:
//  - CallMeBot: gratis, ideal para avisos a tu propio número.
//  - Twilio: oficial (WhatsApp Business API), de pago.

// La configuración guardada desde Ajustes tiene prioridad sobre el .env
let getSaved = () => ({})
export const useSavedConfig = (fn) => (getSaved = fn)

// Acepta "665 85 15 21", "0034665851521"... y lo deja como +34665851521
export function normalizePhone(raw) {
  let p = String(raw || '').replace(/[\s\-().]/g, '')
  if (!p) return ''
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (!p.startsWith('+')) p = (/^[6789]\d{8}$/.test(p) ? '+34' : '+') + p
  return p
}

const env = () => ({
  provider: (getSaved().provider || process.env.WHATSAPP_PROVIDER || 'callmebot').toLowerCase(),
  phone: normalizePhone(getSaved().phone || process.env.WHATSAPP_PHONE),
  callmebotKey: getSaved().apikey || process.env.CALLMEBOT_APIKEY,
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioFrom: process.env.TWILIO_WHATSAPP_FROM,
})

export function providerStatus() {
  const e = env()
  const configured =
    !!e.phone &&
    (e.provider === 'twilio' ? !!(e.twilioSid && e.twilioToken && e.twilioFrom) : !!e.callmebotKey)
  const masked = e.phone ? e.phone.slice(0, 3) + '•••' + e.phone.slice(-3) : null
  return { provider: e.provider, configured, phone: masked }
}

export async function sendWhatsApp(text) {
  const e = env()
  if (!providerStatus().configured) {
    throw new Error('WhatsApp no está configurado. Rellena el archivo .env (ver .env.example).')
  }

  if (e.provider === 'twilio') {
    const body = new URLSearchParams({
      From: `whatsapp:${e.twilioFrom}`,
      To: `whatsapp:${e.phone}`,
      Body: text,
    })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${e.twilioSid}:${e.twilioToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`)
    return
  }

  const url = new URL('https://api.callmebot.com/whatsapp.php')
  url.searchParams.set('phone', e.phone)
  url.searchParams.set('text', text)
  url.searchParams.set('apikey', e.callmebotKey)
  const res = await fetch(url).catch((err) => {
    throw new Error(`No se pudo conectar con CallMeBot (${err.cause?.code || err.message}). ¿Hay conexión a internet?`)
  })
  const out = await res.text()
  if (!res.ok || /error/i.test(out)) throw new Error(`CallMeBot ${res.status}: ${out.slice(0, 200)}`)
}
