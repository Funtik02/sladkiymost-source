require('../lib/env')
const { config, isEnabled, sendMail, verificationEmail } = require('../lib/mailer')

async function main() {
    const to = process.argv[2]
    const { apiKey, keyId, fromEmail, siteUrl } = config()

    if (!isEnabled()) {
        console.log('Почта не настроена. Впишите в server/.env RUSENDER_API_KEY и MAIL_FROM_EMAIL (см. server/.env.example).')
        process.exitCode = 1
        return
    }

    if (apiKey.startsWith('rs_ck_') && !keyId) {
        console.log('Для ключа rs_ck_… нужен RUSENDER_KEY_ID — числовой id ключа отправки из раздела «Транзакционные отправки».')
        process.exitCode = 1
        return
    }

    if (!to) {
        console.log('Укажите, куда отправить тестовое письмо: npm run mail -- you@example.com')
        process.exitCode = 1
        return
    }

    const result = await sendMail({
        to: { email: to },
        idempotencyKey: `mail-check-${Date.now()}`,
        ...verificationEmail({ name: 'тест', code: '123456', link: `${siteUrl}/verify-email?token=test` }),
    })

    console.log(`Письмо от ${fromEmail} отправлено на ${to} (uuid ${result.uuid ?? '—'}). Проверьте входящие и «Спам».`)
}

main().catch((error) => {
    console.error(`Ошибка RuSender: ${error.message}`)
    process.exitCode = 1
})
