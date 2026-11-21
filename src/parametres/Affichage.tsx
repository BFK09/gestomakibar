import { useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { changerTaille, changerTheme, tailleActuelle, themeActuel, type TailleTexte, type Theme } from '../outils/affichage'

// Paramètres → Affichage : mode clair / sombre et taille du texte (pour cet appareil).
export default function Affichage() {
  const [theme, setTheme] = useState<Theme>(themeActuel())
  const [taille, setTaille] = useState<TailleTexte>(tailleActuelle())
  const themes: { id: Theme; nom: string; icone: typeof Sun }[] = [
    { id: 'auto', nom: 'Automatique', icone: Monitor },
    { id: 'light', nom: 'Clair', icone: Sun },
    { id: 'dark', nom: 'Sombre', icone: Moon },
  ]
  return (
    <div className="carte">
      <strong>Thème</strong>
      <p className="info">« Automatique » suit le réglage du téléphone ou de l'ordinateur (sombre le soir si tu l'as activé).</p>
      <div className="choix-cartes">
        {themes.map((t) => (
          <button key={t.id} className={theme === t.id ? 'choisi' : ''} onClick={() => { setTheme(t.id); changerTheme(t.id) }}>
            <t.icone size={22} /><span>{t.nom}</span>
          </button>
        ))}
      </div>
      <strong>Taille du texte</strong>
      <div className="onglets">
        {([['normal', 'Normale'], ['grand', 'Grande'], ['tres-grand', 'Très grande']] as [TailleTexte, string][]).map(([id, nom]) => (
          <button key={id} className={taille === id ? 'choisi' : ''} onClick={() => { setTaille(id); changerTaille(id) }}>{nom}</button>
        ))}
      </div>
      <p className="info">Ces réglages concernent seulement cet appareil.</p>
    </div>
  )
}
