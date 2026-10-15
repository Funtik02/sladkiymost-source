import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react()],
    server: {
        host: process.env.LAN === '1' ? '0.0.0.0' : '127.0.0.1',
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': 'http://localhost:3001',
            '/images': 'http://localhost:3001',
        },
    },
})
