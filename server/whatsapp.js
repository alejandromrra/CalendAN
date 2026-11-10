// Envío de WhatsApp. Dos proveedores:
//  - CallMeBot: gratis, ideal para avisos a tu propio número.
//  - Twilio: oficial (WhatsApp Business API), de pago.

const env = () => ({
  provider: (process.env.WHATSAPP_PROVIDER || 'callmebot').toLowerCase(),
  phone: (process.env.WHATSAPP_PHONE || '').replace(/\s/g, ''),
  callmebotKey: process.env.CALLMEBOT_APIKEY,
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
  const res = await fetch(url)
  const out = await res.text()
  if (!res.ok || /error/i.test(out)) throw new Error(`CallMeBot ${res.status}: ${out.slice(0, 200)}`)
}
