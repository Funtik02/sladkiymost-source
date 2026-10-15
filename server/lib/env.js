const fs = require('fs')
const path = require('path')

const ENV_FILE = path.join(__dirname, '..', '.env')

function loadEnv(file = ENV_FILE) {
    let text
    try {
        text = fs.readFileSync(file, 'utf8')
    } catch {
        return
    }

    for (const line of text.split(/\r?\n/)) {
        if (line.trim().startsWith('#')) continue

        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
        if (!match) continue

        const [, key, raw] = match
        if (process.env[key] === undefined) process.env[key] = raw.replace(/^(['"])(.*)\1$/, '$2')
    }
}

loadEnv()

module.exports = { loadEnv }
