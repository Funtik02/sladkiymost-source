import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/variables.css'
import './styles/global.css'
import './styles/components.css'
import './styles/pages.css'
import './styles/admin.css'
import { enableUiSounds } from './utils/sound.js'

enableUiSounds()

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
)
