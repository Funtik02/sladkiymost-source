import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(ROOT, 'server', 'server.js'))
const server = require(path.join(ROOT, 'server', 'lib', 'delivery.js'))
const { syncWaves } = require(path.join(ROOT, 'server', 'lib', 'waves.js'))
const client = await import(pathToFileURL(path.join(ROOT, 'client', 'src', 'utils', 'delivery.js')).href)

let failures = 0
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg) } }

const months = ['01', '03', '05', '07', '10', '11', '12']
for (let i = 0; i < 5000; i++) {
    const items = Array.from({ length: 1 + (i % 4) }, (_, k) => ({
        weight_g: 50 + ((i * 37 + k * 101) % 2000),
        qty: 1 + ((i + k) % 30),
        temp_sensitive: (i + k) % 3 === 0,
    }))
    const wave = { departureDate: `2026-${months[i % months.length]}-15`, currentWeightKg: (i * 7.3) % 300, maxWeightKg: 300 }
    const thermoChosen = i % 5 === 0
    const a = server.calcDelivery({ items, wave, thermoChosen })
    const b = client.calcDelivery({ items, wave, thermoChosen })
    check(JSON.stringify(a) === JSON.stringify(b), `calcDelivery mismatch #${i}`)
}

const at = (current, weightKg) =>
    server.calcDelivery({ items: [{ weight_g: weightKg * 1000, qty: 1, temp_sensitive: false }], wave: { departureDate: '2026-10-24', currentWeightKg: current, maxWeightKg: 300 } })
check(at(149, 1).discount === 0, '150 кг ровно — скидки ещё нет (строго больше 50 %)')
check(at(149, 1.001).discount === 0.2, '150,001 кг — скидка 20 %')
check(at(239, 1.001).discount === 0.35, '240,001 кг — скидка 35 %')
check(at(100, 10).total === 5000, '10 кг без скидки = 5000 ₽')
check(at(200, 10).total === 4000, '10 кг при заполнении 70 % = 4000 ₽')
check(at(295, 10).fits === false, 'переполнение волны')
check(server.isThermoRequired([{ temp_sensitive: true }], 1) && server.isThermoRequired([{ temp_sensitive: true }], 7), 'зима/лето — термо обязательна')
check(!server.isThermoRequired([{ temp_sensitive: true }], 4) && !server.isThermoRequired([{ temp_sensitive: false }], 12), 'весна — по желанию; нечувствительные — не нужна')
check(server.getDeliveryDays(11).max === 21 && server.getDeliveryDays(5).min === 17, 'межсезонье +7 дней')
check(!server.isShelfLifeOk(20, 10) && server.isShelfLifeOk(21, 10) && !server.isShelfLifeOk(25, 11), 'срок годности: 21 обычно, 28 в межсезонье')
const tier = client.getNextDiscountTier(140)
check(tier.discount === 0.2 && tier.neededKg === 10.1, `подсказка: при 140 кг нужно 10,1 кг (получено ${tier.neededKg})`)
check(client.getDiscount((140 + tier.neededKg) / 300) === 0.2, 'после добавления подсказанного веса скидка действительно есть')

const mk = (id, date, cutoff, kg) => ({ id, direction: 'YKT_DNR', departureDate: date, cutoffDate: cutoff, currentWeightKg: kg, maxWeightKg: 300, minWeightKg: 50, status: 'open', postponedFrom: [], mergedInto: null, history: [] })
const waves = [
    mk('A', '2026-10-17', '2026-10-14', 120),
    mk('B', '2026-10-31', '2026-10-28', 30),
    { ...mk('C', '2026-10-24', '2026-10-21', 10), direction: 'DNR_YKT' },
    { ...mk('D', '2026-11-07', '2026-11-04', 100), direction: 'DNR_YKT' },
]
const orders = [
    { id: '1', waveId: 'A', status: 'accepted', statusHistory: [], postponements: [] },
    { id: '2', waveId: 'B', status: 'accepted', statusHistory: [], postponements: [] },
    { id: '3', waveId: 'C', status: 'accepted', statusHistory: [], postponements: [] },
]
const changed = syncWaves(waves, orders, '2026-10-30')
const byId = (id) => waves.find((w) => w.id === id)
check(changed, 'syncWaves сообщает об изменениях')
check(byId('A').status === 'closed' && orders[0].status === 'assembling', 'A закрыта, заказ в сборке')
check(byId('B').status === 'open' && byId('B').departureDate === '2026-11-14' && byId('B').postponedFrom[0] === '2026-10-31', 'B сдвинута на 14 ноября')
check(orders[1].postponements[0]?.to === '2026-11-14', 'заказ B видит перенос')
check(byId('C').status === 'merged' && byId('C').mergedInto === 'D' && orders[2].waveId === 'D' && byId('D').currentWeightKg === 110, 'C объединена с D')
const open = (dir) => waves.filter((w) => w.direction === dir && w.status === 'open' && w.cutoffDate >= '2026-10-30').length
check(open('YKT_DNR') >= 4 && open('DNR_YKT') >= 4, 'расписание достроено до 4 открытых волн')

console.log(failures === 0 ? 'Все проверки пройдены' : `Провалено: ${failures}`)
process.exit(failures ? 1 : 0)
