import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const LOGO = `${import.meta.env.BASE_URL}icone.svg`
import { ECRANS, infoEcran, PRINCIPAUX, type Ecran } from './ecrans'

interface Props {
  nomBoutique: string
  ecran: Ecran
  onChoisir: (e: Ecran) => void
}

// La navigation de l'application :
// - sur téléphone : une barre d'onglets en bas de l'écran (4 écrans + « Plus ») ;
// - sur ordinateur : un menu vertical à gauche avec tous les écrans.
export default function Navigation({ nomBoutique, ecran, onChoisir }: Props) {
  const [plusOuvert, setPlusOuvert] = useState(false)
  const choisir = (e: Ecran) => { setPlusOuvert(false); onChoisir(e) }
  const dansPlus = !PRINCIPAUX.includes(ecran)
  const actuel = infoEcran(ecran)

  // Fermer le panneau « Plus » avec Échap.
  useEffect(() => {
    if (!plusOuvert) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlusOuvert(false) }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [plusOuvert])

  return (
    <>
      <header className="barre">
        <img className="logo" src={LOGO} alt="" />
        <div className="barre-titres">
          <strong>{nomBoutique}</strong>
          <small>{actuel.nom}</small>
        </div>
      </header>

      {/* Ordinateur : menu à gauche */}
      <nav className="menu-cote" aria-label="Menu principal">
        <div className="menu-cote-tete"><img className="logo" src={LOGO} alt="" /><strong>{nomBoutique}</strong></div>
        {ECRANS.map((e) => (
          <button key={e.id} className={ecran === e.id ? 'actif' : ''} aria-current={ecran === e.id ? 'page' : undefined} onClick={() => choisir(e.id)}>
            <e.icone size={20} strokeWidth={ecran === e.id ? 2.4 : 1.9} />
            <span>{e.nom}</span>
          </button>
        ))}
      </nav>

      {/* Téléphone : barre d'onglets en bas */}
      <nav className="menu-bas" aria-label="Menu">
        {PRINCIPAUX.map((id) => {
          const e = infoEcran(id)
          return (
            <button key={id} className={ecran === id ? 'actif' : ''} aria-current={ecran === id ? 'page' : undefined} onClick={() => choisir(id)}>
              <span className="pastille"><e.icone size={22} strokeWidth={ecran === id ? 2.4 : 1.9} /></span>
              <span>{e.court}</span>
            </button>
          )
        })}
        <button className={dansPlus || plusOuvert ? 'actif' : ''} onClick={() => setPlusOuvert(!plusOuvert)} aria-expanded={plusOuvert}>
          <span className="pastille">{dansPlus ? <actuel.icone size={22} strokeWidth={2.4} /> : <Menu size={22} strokeWidth={1.9} />}</span>
          <span>{dansPlus ? actuel.court : 'Plus'}</span>
        </button>
      </nav>

      {plusOuvert && (
        <div className="voile" onClick={() => setPlusOuvert(false)}>
          <div className="panneau-plus" role="dialog" aria-label="Tous les écrans" onClick={(e) => e.stopPropagation()}>
            <div className="poignee" />
            <div className="panneau-tete">
              <strong>Tous les écrans</strong>
              <button className="icone-seule" onClick={() => setPlusOuvert(false)} aria-label="Fermer"><X size={20} /></button>
            </div>
            <div className="grille-ecrans">
              {ECRANS.map((e) => (
                <button key={e.id} className={ecran === e.id ? 'actif' : ''} onClick={() => choisir(e.id)}>
                  <span className="pastille"><e.icone size={22} /></span>
                  <strong>{e.nom}</strong>
                  <small>{e.description}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
