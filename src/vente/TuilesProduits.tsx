import { useState } from 'react'
import type { Article, Categorie } from '../db/types'
import { fcfa } from '../outils/format'

interface Props {
  articles: Article[] // produits actifs
  categories: Categorie[]
  quantites: Map<string, number> // quantité déjà dans le panier, affichée sur la tuile
  onAjouter: (a: Article) => void
  prixDe?: (a: Article) => number // prix affiché (détail ou gros)
}

// Une couleur par famille de boissons, pour repérer les tuiles d'un coup d'œil.
const COULEURS: [RegExp, string][] = [
  [/bi[eè]re/i, '#d97706'], [/sucrerie|soda/i, '#dc2626'], [/eau/i, '#0284c7'], [/jus/i, '#16a34a'],
  [/vin/i, '#9333ea'], [/spiritueux|liqueur|whisky/i, '#78350f'], [/[ée]nergi/i, '#ca8a04'],
]
export const couleurCategorie = (nom = '') => COULEURS.find(([r]) => r.test(nom))?.[1] ?? '#64748b'

// Le nom sans la contenance (affichée à part, en petit) : « Flag Spéciale 65 cl » → « Flag Spéciale ».
const nomCourt = (a: Article) => {
  const f = a.format?.trim()
  if (!f) return a.designation
  const i = a.designation.toLowerCase().lastIndexOf(f.toLowerCase())
  return i > 0 ? a.designation.slice(0, i).trim() + a.designation.slice(i + f.length) : a.designation
}

// Les boissons en grandes tuiles : un toucher = une bouteille de plus dans le panier.
// Les puces du haut filtrent par catégorie (Bières, Sucreries…).
export default function TuilesProduits({ articles, categories, quantites, onAjouter, prixDe }: Props) {
  const [categorieId, setCategorieId] = useState('')
  const utilisees = categories.filter((c) => articles.some((a) => a.categorieId === c.id))
  const visibles = articles.filter((a) => !categorieId || a.categorieId === categorieId)
  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]))

  return (
    <div className="tuiles-zone">
      <div className="puces">
        <button className={categorieId === '' ? 'choisi' : ''} onClick={() => setCategorieId('')}>Tout</button>
        {utilisees.map((c) => (
          <button key={c.id} className={categorieId === c.id ? 'choisi' : ''} style={{ '--cat': couleurCategorie(c.nom) } as React.CSSProperties} onClick={() => setCategorieId(c.id)}><span className="point-cat" />{c.nom}</button>
        ))}
      </div>
      <div className="tuiles-boissons">
        {visibles.map((a) => {
          const q = quantites.get(a.id)
          return (
            <button key={a.id} className={`tuile-boisson${a.prixVente === null ? ' sans-prix' : ''}`} style={{ '--cat': couleurCategorie(nomCategorie.get(a.categorieId)) } as React.CSSProperties} onClick={() => onAjouter(a)}>
              {q ? <span className="pastille-qte">{q}</span> : null}
              <span className="tuile-boisson-nom">{nomCourt(a)}</span>
              {a.format && <span className="tuile-boisson-format">{a.format}</span>}
              <span className="tuile-boisson-prix">{a.prixVente === null ? 'sans prix' : fcfa(prixDe ? prixDe(a) : a.prixVente)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
