const fs = require('fs/promises')
const path = require('path')

const SEED_DIR = path.join(__dirname, 'data')
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : SEED_DIR
const COLLECTIONS = ['products', 'waves', 'orders', 'pickup-points', 'users', 'sessions', 'carts']

function filePath(name, dir = DATA_DIR) {
    if (!COLLECTIONS.includes(name)) {
        throw new Error(`Неизвестная коллекция: ${name}`)
    }

    return path.join(dir, `${name}.json`)
}

async function readRaw(name) {
    const dirs = DATA_DIR === SEED_DIR ? [DATA_DIR] : [DATA_DIR, SEED_DIR]

    for (const dir of dirs) {
        try {
            return await fs.readFile(filePath(name, dir), 'utf8')
        } catch (error) {
            if (error.code !== 'ENOENT') throw error
        }
    }

    return null
}

async function read(name) {
    const raw = await readRaw(name)
    if (raw === null) return []

    try {
        return JSON.parse(raw)
    } catch {
        throw new Error(`Файл data/${name}.json повреждён: некорректный JSON`)
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function write(name, data) {
    const target = filePath(name)
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`

    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')

    for (let attempt = 0; ; attempt += 1) {
        try {
            await fs.rename(tmp, target)
            return
        } catch (error) {
            const busy = ['EPERM', 'EBUSY', 'EACCES'].includes(error.code)

            if (!busy || attempt >= 5) {
                await fs.rm(tmp, { force: true })
                throw error
            }

            await sleep(30 * (attempt + 1))
        }
    }
}

let queue = Promise.resolve()

function transaction(fn) {
    const run = queue.then(() => fn({ read, write }))
    queue = run.catch(() => {})
    return run
}

module.exports = {
    DATA_DIR,
    read,
    write,
    transaction,
}
