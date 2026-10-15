require('../lib/env')
const db = require('../db')
const { callApi, config, newOrderMessage } = require('../lib/telegram')

function chatTitle(chat) {
    const name = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ')
    return chat.username ? `${name} (@${chat.username})` : name
}

async function resendOrders(ids, chatIds) {
    const [orders, waves] = await Promise.all([db.read('orders'), db.read('waves')])

    for (const id of ids) {
        const order = orders.find((o) => o.id === id)
        if (!order) {
            console.log(`Заказ №${id} не найден`)
            continue
        }

        const text = newOrderMessage(order, waves.find((w) => w.id === order.waveId))
        for (const chatId of chatIds) {
            await callApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
        }
        console.log(`Уведомление о заказе №${id} отправлено`)
    }
}

async function main() {
    const { token, chatIds } = config()
    const orderIds = process.argv.slice(2).filter((arg) => /^\d{6}$/.test(arg))

    if (!token) {
        console.log('Нет токена. Создайте файл server/.env и впишите в него TELEGRAM_BOT_TOKEN.')
        process.exitCode = 1
        return
    }

    const bot = await callApi('getMe')
    console.log(`Бот найден: @${bot.username}`)

    const ownId = chatIds.find((id) => id === String(bot.id))
    if (ownId) {
        console.log(`В TELEGRAM_CHAT_ID указан id самого бота (${ownId}) — это цифры из начала токена. Нужен id вашего чата.`)
    }

    if (chatIds.length === 0 || ownId) {
        const updates = await callApi('getUpdates')
        const chats = new Map()
        for (const update of updates) {
            const chat = (update.message ?? update.channel_post ?? update.my_chat_member)?.chat
            if (chat) chats.set(chat.id, chat)
        }

        if (chats.size === 0) {
            console.log(`Напишите боту @${bot.username} любое сообщение (например, /start) и запустите команду ещё раз.`)
            return
        }

        console.log('Чаты, которые писали боту. Впишите нужный id в TELEGRAM_CHAT_ID:')
        for (const chat of chats.values()) console.log(`  ${chat.id} — ${chatTitle(chat)}`)
        return
    }

    if (orderIds.length > 0) {
        await resendOrders(orderIds, chatIds)
        return
    }

    for (const chatId of chatIds) {
        await callApi('sendMessage', {
            chat_id: chatId,
            text: '✅ «Сладкий мост» подключён. Сюда будут приходить новые заказы и смена их статусов.',
        })
        console.log(`Тестовое сообщение отправлено в чат ${chatId}`)
    }
}

main().catch((error) => {
    console.error(`Ошибка Telegram: ${error.message}`)
    process.exitCode = 1
})
