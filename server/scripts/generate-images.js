const fs = require('fs/promises')
const path = require('path')
const db = require('../db')

const OUT_DIR = path.join(__dirname, '..', 'public', 'images')
const PHOTOS_DIR = path.join(__dirname, '..', 'assets', 'photos')

const C = {
    choc: '#5A3420',
    chocLight: '#7A4A2E',
    milkChoc: '#9A6440',
    dough: '#E2AE6C',
    doughDark: '#C98B4E',
    waffle: '#E3AA55',
    waffleDark: '#C98A35',
    cream: '#FFF8EE',
    foil: '#E6DCCB',
    honey: '#E2A43B',
    flame: '#F2B544',
    text: '#2B1D14',
}

const THEMES = {
    Якутия: { bg: '#EAF4FC', accent: '#2E6DA4', tone: '#4F8FC8' },
    ДНР: { bg: '#EAF4FC', accent: '#2E6DA4', tone: '#C23B3B' },
}

const TONES = [
    [/брусни/i, '#B8233A'],
    [/голуби/i, '#5B6FB5'],
    [/сияни/i, '#3FA796'],
    [/кедров|орех/i, '#9A6440'],
    [/абрикос/i, '#F0A04B'],
    [/вишн/i, '#A3182F'],
    [/лимон/i, '#F2C94C'],
    [/курага/i, '#E8954A'],
    [/черносл|ночь/i, '#4A2A3A'],
    [/розы/i, '#E06C86'],
    [/медов|медовик|таёжн/i, C.honey],
    [/морозко/i, '#7FA7D9'],
    [/ванил|белые ночи/i, '#F7E7C6'],
    [/подсолнух|семечк/i, '#3D3530'],
    [/ленские|терриконы|горьк|тёмн/i, C.choc],
]

const escape = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function wrap(text, maxChars, maxLines) {
    const lines = []
    let line = ''

    for (const word of text.split(' ')) {
        if ((line + ' ' + word).trim().length > maxChars && line) {
            lines.push(line)
            line = word
        } else {
            line = (line + ' ' + word).trim()
        }
    }
    lines.push(line)

    if (lines.length > maxLines) {
        lines.length = maxLines
        lines[maxLines - 1] += '…'
    }

    return lines
}

const DEFAULT_TONES = { Печенье: C.choc }

function toneFor(product, category, theme) {
    const match = TONES.find(([re]) => re.test(product.name))
    return match ? match[1] : DEFAULT_TONES[category] ?? theme.tone
}

const sugar = (points) => points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#FFFFFF" opacity="0.85"/>`).join('')

const ART = {
    Конфеты: ({ accent, tone }) => `
    <g transform="translate(200 100)">
      <path d="M-30 0 L-80 -28 Q-70 0 -80 28 Z" fill="${tone}" stroke="${tone}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M30 0 L80 -28 Q70 0 80 28 Z" fill="${tone}" stroke="${tone}" stroke-width="6" stroke-linejoin="round"/>
      <ellipse rx="46" ry="36" fill="${accent}"/>
      <path d="M-16 -33 Q-30 0 -16 33" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.35"/>
      <path d="M12 -35 Q-2 0 12 35" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.35"/>
      <ellipse cx="-18" cy="-16" rx="10" ry="6" fill="#FFFFFF" opacity="0.4" transform="rotate(-25 -18 -16)"/>
    </g>`,

    Шоколад: ({ accent, tone, body }) => {
        const squares = [0, 1, 2]
            .flatMap((col) => [0, 1].map((row) => `<rect x="${-42 + col * 29}" y="${-54 + row * 27}" width="25" height="23" rx="5" fill="#FFFFFF" opacity="0.14"/>`))
            .join('')
        return `
    <g transform="translate(200 100) rotate(-8)">
      <rect x="-50" y="-62" width="100" height="124" rx="10" fill="${body}"/>
      ${squares}
      <path d="M-50 -2 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6 V6 H-50 Z" fill="${C.foil}"/>
      <path d="M-50 4 H50 V52 a10 10 0 0 1 -10 10 H-40 a10 10 0 0 1 -10 -10 Z" fill="${accent}"/>
      <rect x="-32" y="22" width="64" height="20" rx="10" fill="#FFFFFF" opacity="0.92"/>
      <circle cx="0" cy="32" r="6" fill="${tone}"/>
    </g>`
    },

    Пряники: ({ tone }) => `
    <g transform="translate(200 100)">
      <rect x="-72" y="-50" width="144" height="100" rx="32" fill="${C.doughDark}"/>
      <rect x="-58" y="-36" width="116" height="72" rx="22" fill="none" stroke="${C.cream}" stroke-width="5" stroke-dasharray="0.1 11" stroke-linecap="round"/>
      <ellipse cx="-26" cy="0" rx="14" ry="7" fill="${C.cream}" transform="rotate(-30 -26 0)"/>
      <ellipse cx="26" cy="0" rx="14" ry="7" fill="${C.cream}" transform="rotate(30 26 0)"/>
      <circle r="13" fill="${tone}"/>
      <circle r="5" fill="${C.cream}"/>
    </g>`,

    Печенье: ({ bg, tone }) => {
        const chips = [[-22, -20, 7], [14, -8, 6], [-8, 22, 7], [26, 26, 5], [-36, 8, 5], [2, -36, 5], [-26, 36, 4]]
            .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${tone}"/>`)
            .join('')
        return `
    <g transform="translate(200 100)">
      <circle r="58" fill="${C.dough}"/>
      <circle r="58" fill="none" stroke="${C.doughDark}" stroke-width="4" opacity="0.5"/>
      ${chips}
      <circle cx="50" cy="-42" r="20" fill="${bg}"/>
      <circle cx="62" cy="-20" r="14" fill="${bg}"/>
      <circle cx="74" cy="-50" r="4" fill="${C.dough}"/>
      <circle cx="84" cy="-34" r="3" fill="${C.dough}"/>
    </g>`
    },

    Зефир: ({ tone }) => {
        const ridges = (cx, cy, color) =>
            [-18, 0, 18].map((dx) => `<path d="M${cx + dx - 6} ${cy - 30} Q${cx + dx + 8} ${cy} ${cx + dx - 6} ${cy + 30}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>`).join('')
        return `
    <g transform="translate(200 102)">
      <ellipse cx="-28" cy="8" rx="46" ry="40" fill="${tone}"/>
      ${ridges(-28, 8, '#FFFFFF')}
      <ellipse cx="30" cy="2" rx="44" ry="38" fill="#FFFFFF"/>
      ${ridges(30, 2, '#C9B8A6')}
    </g>`
    },

    Торты: ({ tone, body }) => `
    <g transform="translate(200 112)">
      <rect x="-66" y="-22" width="132" height="64" rx="12" fill="${body}"/>
      <rect x="-66" y="8" width="132" height="8" fill="${C.cream}" opacity="0.9"/>
      <path d="M-66 -22 a12 12 0 0 1 12 -12 H54 a12 12 0 0 1 12 12 v6 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 q-8.25 10 -16.5 0 Z" fill="${C.cream}"/>
      <rect x="-4" y="-64" width="8" height="30" rx="3" fill="${tone}"/>
      <path d="M0 -82 q9 11 0 15 q-9 -4 0 -15 z" fill="${C.flame}"/>
      <circle cx="-38" cy="-38" r="7" fill="${tone}"/>
      <circle cx="38" cy="-38" r="7" fill="${tone}"/>
    </g>`,

    Карамель: ({ accent, tone }) => `
    <g transform="translate(200 88)">
      <rect x="-4" y="34" width="8" height="44" rx="4" fill="${C.foil}"/>
      <circle r="48" fill="${tone}"/>
      <path d="M-6 0 a6 6 0 1 1 12 0 a12 12 0 1 1 -24 0 a18 18 0 1 1 36 0 a24 24 0 1 1 -48 0 a30 30 0 1 1 60 0 a36 36 0 1 1 -72 0" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
      <path d="M0 56 L-16 46 V66 Z M0 56 L16 46 V66 Z" fill="${accent}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
    </g>`,

    Вафли: ({ tone }) => {
        const cells = [0, 1, 2, 3]
            .flatMap((col) => [0, 1, 2].map((row) => `<rect x="${-57 + col * 30}" y="${-39 + row * 28}" width="24" height="22" rx="4" fill="${C.waffleDark}"/>`))
            .join('')
        return `
    <g transform="translate(200 100) rotate(-6)">
      <rect x="-52" y="-36" width="124" height="100" rx="14" fill="${C.waffleDark}"/>
      <rect x="-56" y="-44" width="124" height="100" rx="14" fill="${tone}"/>
      <rect x="-62" y="-50" width="124" height="100" rx="14" fill="${C.waffle}"/>
      ${cells}
    </g>`
    },

    Мармелад: ({ accent, tone }) => {
        const dome = (cx, w, h, color) =>
            `<path d="M${cx - w / 2} 40 C${cx - w / 2} ${40 - h} ${cx - w / 4} ${40 - h - 8} ${cx} ${40 - h - 8} C${cx + w / 4} ${40 - h - 8} ${cx + w / 2} ${40 - h} ${cx + w / 2} 40 Z" fill="${color}"/>`
        return `
    <g transform="translate(200 104)">
      ${dome(-46, 58, 44, '#F2C94C')}
      ${dome(46, 58, 44, accent)}
      ${dome(0, 70, 58, tone)}
      ${sugar([[-60, 18], [-40, 6], [-52, 30], [36, 10], [56, 22], [44, 32], [-10, -6], [12, 6], [-4, 24], [18, 28]])}
    </g>`
    },
}

const BODY = [
    [/молочн/i, C.milkChoc],
    [/птичье/i, C.choc],
    [/каштан/i, C.milkChoc],
    [/медовик/i, '#D08A3E'],
    [/вафельн/i, C.waffle],
]

function render(product) {
    const theme = THEMES[product.region]
    const category = product.category === 'Шоколадные конфеты' ? 'Конфеты' : product.category
    const draw = ART[category] ?? ART.Конфеты
    const body = (BODY.find(([re]) => re.test(product.name)) ?? [null, category === 'Шоколад' ? C.choc : C.doughDark])[1]
    const art = draw({ bg: theme.bg, accent: theme.accent, tone: toneFor(product, category, theme), body })
    const lines = wrap(product.name, 26, 2)
    const firstLineY = lines.length === 1 ? 226 : 214

    const title = lines
        .map((line, i) => `<text x="200" y="${firstLineY + i * 22}" text-anchor="middle">${escape(line)}</text>`)
        .join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="${escape(product.name)}">
  <rect width="400" height="300" fill="${theme.bg}"/>
  <g transform="translate(200 104) scale(1.15) translate(-200 -104)">
    <ellipse cx="200" cy="174" rx="74" ry="8" fill="${theme.accent}" opacity="0.1"/>${art}
  </g>
  <g font-family="Manrope, 'Segoe UI', Arial, sans-serif" font-size="18" font-weight="700" fill="${C.text}">${title}</g>
</svg>
`
}

function renderPhoto(product, jpeg) {
    const lines = wrap(product.name, 24, 2)

    const title = lines
        .map((line, i) => `<text x="20" y="${36 + i * 23}">${escape(line)}</text>`)
        .join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="${escape(product.name)}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <image width="400" height="300" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${jpeg.toString('base64')}"/>
  <rect width="400" height="${lines.length === 1 ? 70 : 92}" fill="url(#fade)"/>
  <g font-family="Manrope, 'Segoe UI', Arial, sans-serif" font-size="19" font-weight="700" fill="${C.text}">${title}</g>
</svg>
`
}

async function readPhoto(product) {
    try {
        return await fs.readFile(path.join(PHOTOS_DIR, `${product.id.toLowerCase()}.jpg`))
    } catch (error) {
        if (error.code === 'ENOENT') return null
        throw error
    }
}

async function main() {
    const products = await db.read('products')
    await fs.mkdir(OUT_DIR, { recursive: true })

    const local = products.filter((p) => /^[\w.-]+\.svg$/i.test(p.photo))

    let photos = 0

    for (const product of local) {
        const jpeg = await readPhoto(product)
        if (jpeg) photos += 1
        await fs.writeFile(path.join(OUT_DIR, product.photo), jpeg ? renderPhoto(product, jpeg) : render(product), 'utf8')
    }

    console.log(`Готово: ${local.length} изображений в public/images, из них с фото: ${photos}`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
