import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'sweet-bridge:sound'
const CLICKABLE =
    'button, .btn, .header__icon, .segmented__option, [role="button"], [role="tab"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], [data-sound]'
const MIN_INTERVAL_MS = 50
const MASTER_VOLUME = 0.9

const NOTES = { C4: 261.63, E4: 329.63, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.51, G6: 1567.98, B6: 1975.53, C7: 2093 }

let context = null
let master = null
let enabled = readJSON(localStorage, STORAGE_KEY, true) !== false
let pendingClick = null
let lastClickAt = 0
const listeners = new Set()

function audio() {
    if (!context) {
        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return null
        context = new AudioContextClass()
        master = context.createGain()
        master.gain.value = MASTER_VOLUME
        master.connect(context.destination)
    }
    if (context.state === 'suspended') context.resume().catch(() => {})
    return context
}

function envelope(ctx, at, peak, attack, decay) {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
    gain.connect(master)
    return gain
}

function tone(ctx, { type = 'sine', from, to = from, at, peak, attack = 0.004, decay, glide = decay }) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, at)
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + glide)
    osc.connect(envelope(ctx, at, peak, attack, decay))
    osc.start(at)
    osc.stop(at + attack + decay + 0.03)
}

function chime(ctx, freq, at, peak = 0.07, decay = 0.55) {
    tone(ctx, { from: freq, at, peak, attack: 0.002, decay })
    tone(ctx, { from: freq * 3, at, peak: peak * 0.22, attack: 0.002, decay: decay * 0.3 })
}

const SOUNDS = {
    tap: (ctx, t) => tone(ctx, { from: 420, to: 820, at: t, peak: 0.1, decay: 0.08, glide: 0.035 }),
    tick: (ctx, t) => tone(ctx, { from: 900, to: 1300, at: t, peak: 0.05, decay: 0.05, glide: 0.02 }),
    add: (ctx, t) => {
        tone(ctx, { from: 500, to: 950, at: t, peak: 0.08, decay: 0.07, glide: 0.03 })
        chime(ctx, NOTES.E6, t + 0.05, 0.07, 0.4)
        chime(ctx, NOTES.B6, t + 0.13, 0.06, 0.6)
    },
    remove: (ctx, t) => tone(ctx, { from: 700, to: 300, at: t, peak: 0.09, decay: 0.12, glide: 0.08 }),
    favorite: (ctx, t) => {
        tone(ctx, { type: 'triangle', from: NOTES.G5, to: NOTES.C6, at: t, peak: 0.06, decay: 0.16, glide: 0.08 })
        chime(ctx, NOTES.G6, t + 0.08, 0.04, 0.45)
    },
    unfavorite: (ctx, t) => tone(ctx, { type: 'triangle', from: NOTES.A5, to: 440, at: t, peak: 0.05, decay: 0.16, glide: 0.1 }),
    success: (ctx, t) => {
        ;[NOTES.C6, NOTES.E6, NOTES.G6].forEach((freq, i) => chime(ctx, freq, t + i * 0.09, 0.06, 0.5))
        chime(ctx, NOTES.C7, t + 0.27, 0.07, 1.1)
    },
    error: (ctx, t) => {
        tone(ctx, { type: 'triangle', from: NOTES.E4, at: t, peak: 0.09, decay: 0.14 })
        tone(ctx, { type: 'triangle', from: NOTES.C4, at: t + 0.12, peak: 0.09, decay: 0.22 })
    },
}

export function playSound(name) {
    clearTimeout(pendingClick)
    pendingClick = null

    if (!enabled || !SOUNDS[name]) return
    const ctx = audio()
    if (!ctx) return
    SOUNDS[name](ctx, ctx.currentTime + 0.005)
}

function isDisabled(element) {
    return element.disabled || element.getAttribute('aria-disabled') === 'true'
}

function soundFor(element) {
    const marked = element.closest('[data-sound]')?.dataset.sound
    if (marked) return marked
    return element.matches('[role="tab"], .segmented__option, input[type="checkbox"], input[type="radio"]') ? 'tick' : 'tap'
}

export function enableUiSounds() {
    const onClick = (event) => {
        if (!enabled || !(event.target instanceof Element)) return
        const element = event.target.closest(CLICKABLE)
        if (!element || isDisabled(element)) return

        const sound = soundFor(element)
        if (sound === 'none') return

        const now = performance.now()
        if (now - lastClickAt < MIN_INTERVAL_MS) return
        lastClickAt = now

        clearTimeout(pendingClick)
        pendingClick = setTimeout(() => playSound(sound), 0)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
}

export function isSoundEnabled() {
    return enabled
}

export function setSoundEnabled(value) {
    enabled = Boolean(value)
    writeJSON(localStorage, STORAGE_KEY, enabled)
    listeners.forEach((listener) => listener(enabled))
    if (enabled) playSound('tick')
}

export function subscribeSound(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
