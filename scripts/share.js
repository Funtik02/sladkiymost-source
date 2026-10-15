const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const isWindows = process.platform === 'win32'
const port = Number(process.env.SHARE_PORT) || 8080
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

function findCloudflared() {
    const candidates = [
        process.env.CLOUDFLARED_PATH,
        isWindows && path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'cloudflared', 'cloudflared.exe'),
    ].filter(Boolean)

    const found = candidates.find((file) => fs.existsSync(file))
    if (found) return found

    const which = spawnSync(isWindows ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8' })
    return which.status === 0 ? which.stdout.split(/\r?\n/)[0].trim() : null
}

function run(command, cwd) {
    const result = spawnSync(command, { cwd, stdio: 'inherit', shell: true })
    if (result.status !== 0) process.exit(result.status ?? 1)
}

const cloudflared = findCloudflared()
if (!cloudflared) {
    console.log('Не найден cloudflared. Скачайте его: https://github.com/cloudflare/cloudflared/releases/latest')
    console.log(`и положите в ${isWindows ? '%LOCALAPPDATA%\\cloudflared\\cloudflared.exe' : 'PATH'} (или укажите путь в CLOUDFLARED_PATH).`)
    process.exit(1)
}

for (const app of ['server', 'client']) {
    if (!fs.existsSync(path.join(root, app, 'node_modules'))) run('npm install', path.join(root, app))
}

console.log('Собираю сайт…')
run('npm run build', path.join(root, 'client'))

const children = []
let stopping = false

function shutdown(code = 0) {
    if (stopping) return
    stopping = true
    for (const child of children) {
        if (child.exitCode !== null) continue
        if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        else child.kill('SIGTERM')
    }
    process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

function startServer(siteUrl) {
    const { PORT: _ignored, ...env } = process.env
    const server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(root, 'server'),
        env: { ...env, NODE_ENV: 'production', PORT: String(port), SITE_URL: siteUrl },
        stdio: 'inherit',
    })
    server.on('exit', (code) => {
        console.log(`Сервер остановился (код ${code})`)
        shutdown(code ?? 1)
    })
    children.push(server)
}

console.log('Открываю туннель Cloudflare…')
const tunnel = spawn(cloudflared, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] })
children.push(tunnel)

let publicUrl = null
const onOutput = (chunk) => {
    if (publicUrl) return
    const match = URL_RE.exec(chunk.toString())
    if (!match) return

    publicUrl = match[0]
    startServer(publicUrl)
    console.log(`\n  Сайт открыт для всех: ${publicUrl}\n  Остановить — Ctrl+C. Ссылка работает, пока включён компьютер и запущена эта команда.\n`)
}

tunnel.stdout.on('data', onOutput)
tunnel.stderr.on('data', onOutput)
tunnel.on('exit', (code) => {
    console.log(`Туннель закрылся (код ${code}). Запустите npm run share ещё раз.`)
    shutdown(code ?? 1)
})

setTimeout(() => {
    if (!publicUrl) {
        console.log('Cloudflare не выдал адрес за 60 секунд. Проверьте интернет и запустите ещё раз.')
        shutdown(1)
    }
}, 60000)
