const REQUEST_TIMEOUT_MS = 15000

const STATUS_HINTS = {
    400: 'RuSender не принял письмо — проверьте MAIL_FROM_EMAIL и адрес получателя',
    401: 'RUSENDER_API_KEY недействителен или отозван',
    402: 'на балансе RuSender закончились средства или лимит тарифа',
    403: 'у API-ключа нет разрешения external_mail.send или ключ отправки неактивен',
    404: 'не найден ключ отправки (RUSENDER_KEY_ID) или домен MAIL_FROM_EMAIL не совпадает с доменом ключа',
    422: 'адрес получателя недоступен, отписан или жаловался на спам',
    429: 'превышен лимит запросов RuSender',
}

function config() {
    return {
        apiKey: (process.env.RUSENDER_API_KEY ?? '').trim(),
        keyId: (process.env.RUSENDER_KEY_ID ?? '').trim(),
        apiUrl: (process.env.RUSENDER_API_URL || 'https://api.rusender.ru').trim().replace(/\/+$/, ''),
        fromEmail: (process.env.MAIL_FROM_EMAIL ?? '').trim(),
        fromName: (process.env.MAIL_FROM_NAME || 'Сладкий мост').trim(),
        siteUrl: (process.env.SITE_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),
    }
}

function isEnabled() {
    const { apiKey, fromEmail } = config()
    return Boolean(apiKey && fromEmail)
}

function request({ apiKey, keyId, apiUrl }) {
    if (keyId) {
        return {
            url: `${apiUrl}/api/v1/external-mails/send/${encodeURIComponent(keyId)}`,
            headers: { Authorization: `Bearer ${apiKey}` },
        }
    }

    return { url: `${apiUrl}/api/v1/external-mails/send`, headers: { 'X-Api-Key': apiKey } }
}

async function sendMail({ to, subject, html, text, previewTitle, idempotencyKey }) {
    const settings = config()
    const { url, headers } = request(settings)

    const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            idempotencyKey,
            mail: {
                to,
                from: { email: settings.fromEmail, name: settings.fromName },
                subject,
                previewTitle,
                html,
                text,
            },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
        const reason = data.error?.message || data.message || (typeof data.error === 'string' ? data.error : '') || `HTTP ${response.status}`
        const hint = STATUS_HINTS[response.status]
        const error = new Error(hint ? `${reason} (${hint})` : reason)
        error.status = response.status
        throw error
    }

    return data
}

const escapeHtml = (value) =>
    String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function verificationEmail({ name, code, link }) {
    const subject = `${code} — код подтверждения «Сладкого моста»`
    const previewTitle = `Ваш код: ${code}. Он действует 30 минут`
    const spacedCode = code.split('').join(' ')

    const text = [
        `Здравствуйте, ${name}!`,
        '',
        'Вы регистрируетесь на «Сладком мосту» — маркетплейсе сладостей Якутии и Донбасса.',
        `Код подтверждения почты: ${code}`,
        '',
        `Или откройте ссылку: ${link}`,
        '',
        'Код и ссылка действуют 30 минут. Если вы не регистрировались — просто проигнорируйте письмо.',
    ].join('\n')

    const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:0;background:#FDF8F1;font-family:Manrope,'Segoe UI',Arial,sans-serif;color:#2B1D14;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF8F1;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E4DAD0;">
<tr><td style="height:6px;background:linear-gradient(90deg,#2E6DA4 0%,#9FD3F3 28%,#F8E9D7 50%,#F28E8E 72%,#C23B3B 100%);background-color:#2E6DA4;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2E6DA4;">сладкий мост</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Подтвердите почту</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;">Здравствуйте, ${escapeHtml(name)}! Введите этот код на сайте, чтобы закончить регистрацию:</p>
<p style="margin:0 0 24px;padding:16px;border-radius:12px;background:#E6F3FC;text-align:center;font-size:32px;font-weight:800;letter-spacing:.3em;color:#235683;">${spacedCode}</p>
<p style="margin:0 0 24px;text-align:center;">
<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#2E6DA4;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Подтвердить одним нажатием</a>
</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#7A6A5E;">Код и кнопка действуют 30 минут. Если вы не регистрировались на «Сладком мосту», просто проигнорируйте это письмо.</p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #E4DAD0;font-size:12px;line-height:1.5;color:#7A6A5E;">Маркетплейс сладостей Якутии и Донбасса. Доставляем сборными волнами раз в 14 дней.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

    return { subject, previewTitle, html, text }
}

async function sendVerificationEmail({ user, code, token, idempotencyKey }) {
    const link = `${config().siteUrl}/verify-email?token=${token}`

    if (!isEnabled()) {
        console.log(`[почта не настроена] Код для ${user.email}: ${code}  ·  ссылка: ${link}`)
        return { delivered: false }
    }

    await sendMail({
        to: { email: user.email, name: user.name },
        idempotencyKey,
        ...verificationEmail({ name: user.name, code, link }),
    })

    return { delivered: true }
}

module.exports = {
    config,
    isEnabled,
    sendMail,
    sendVerificationEmail,
    verificationEmail,
}
