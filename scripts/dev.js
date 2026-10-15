const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const isWindows = process.platform === 'win32'
const lan = process.argv.includes('--lan')
const VIRTUAL_ADAPTER = /vpn|radmin|hamachi|zerotier|tun|tap|virtual|vethernet|wsl|docker|vmware|vbox/i

const apps = [
    { name: 'server', color: '\x1b[35m' },
    { name: 'client', color: '\x1b[36m' },
]

for (const app of apps) {
    const cwd = path.join(root, app.name)
    if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
        console.log(`Устанавливаю зависимости в ${app.name}/ …`)
        const result = spawnSync('npm install', { cwd, stdio: 'inherit', shell: true })
        if (result.status !== 0) process.exit(result.status ?? 1)
    }
}

const { PORT: _hostingPort, ...baseEnv } = process.env

const children = apps.map((app) => {
    const child = spawn('npm run dev', {
        cwd: path.join(root, app.name),
        shell: true,
        env: { ...baseEnv, FORCE_COLOR: '1', ...(lan ? { LAN: '1' } : {}) },
    })

    const prefix = `${app.color}[${app.name}]\x1b[0m `
    const pipe = (stream, target) => {
        let buffer = ''
        stream.on('data', (chunk) => {
            buffer += chunk.toString()
            const lines = buffer.split(/\r?\n/)
            buffer = lines.pop()
            lines.forEach((line) => target.write(`${prefix}${line}\n`))
        })
    }

    pipe(child.stdout, process.stdout)
    pipe(child.stderr, process.stderr)

    child.on('exit', (code) => {
        console.log(`${prefix}процесс завершился с кодом ${code}`)
        shutdown(code ?? 0)
    })

    return child
})

console.log('\nСладкий мост: клиент — http://localhost:5173, API — http://localhost:3001')

if (lan) {
    const addresses = Object.entries(os.networkInterfaces())
        .filter(([name]) => !VIRTUAL_ADAPTER.test(name))
        .flatMap(([, list]) => list ?? [])
        .filter((item) => item.family === 'IPv4' && !item.internal)
        .map((item) => `http://${item.address}:5173`)

    console.log(
        addresses.length > 0
            ? `С телефона в той же сети откройте: ${addresses.join('  или  ')}`
            : 'Не нашёл подключения к сети: проверьте, что компьютер подключён к Wi-Fi'
    )
}

console.log('')

let stopping = false

function shutdown(code) {
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
