import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App.tsx'
import { appliquerAffichage } from './outils/affichage'

// Demande au navigateur de ne pas effacer la base quand l'appareil manque de place.
navigator.storage?.persist?.()

// Thème (clair / sombre) et taille du texte choisis sur cet appareil.
appliquerAffichage()
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => appliquerAffichage())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
