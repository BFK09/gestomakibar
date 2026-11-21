import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Adresse de base de l'application en ligne.
// Sur GitHub Pages elle est publiée dans un sous-dossier (ex. /gestomakibar/) ;
// en local et sur Netlify c'est simplement '/'.
const base = process.env.BASE_URL_APP ?? '/'

// Configuration de Vite, l'outil qui construit l'application.
export default defineConfig({
  base,
  plugins: [
    react(),
    // Rend l'application installable et utilisable hors ligne.
    VitePWA({
      registerType: 'prompt', // nouvelle version : un bouton « Mettre à jour » (voir MiseAJour.tsx)
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'GESTOMAKIBAR',
        short_name: 'Makibar',
        description: 'Gestion de maquis et bar : caisse, serveurs, stock de boissons, crédits.',
        lang: 'fr',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        categories: ['business', 'productivity'],
        background_color: '#1f0f07', // écran de démarrage Android, aux couleurs du logo
        theme_color: '#1f0f07',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-masque-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
