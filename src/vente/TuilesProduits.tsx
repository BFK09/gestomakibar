import { useState } from 'react'
import type { Article, Categorie } from '../db/types'
import { fcfa } from '../outils/format'

interface Props {
  articles: Article[] // produits actifs
  categories: Categorie[]
  quantites: Map<string, number> // quantité déjà dans le panier, affichée sur la tuile
  onAjouter: (a: Article) => void
}

// Les boissons en grandes tuiles : un toucher = une bouteille de plus dans le panier.
// Les puces du haut filtrent par catégorie (Bières, Sucreries…).
export default function TuilesProduits({ articles, categories, quantites, onAjouter }: Props) {
  const [categorieId, setCategorieId] = useState('')
  const utilisees = categories.filter((c) => articles.some((a) => a.categorieId === c.id))
  const visibles = articles.filter((a) => !categorieId || a.categorieId === categorieId)

  return (
    <div className="tuiles-zone">
      <div className="puces">
        <button className={categorieId === '' ? 'choisi' : ''} onClick={() => setCategorieId('')}>Tout</button>
        {utilisees.map((c) => (
          <button key={c.id} className={categorieId === c.id ? 'choisi' : ''} onClick={() => setCategorieId(c.id)}>{c.nom}</button>
        ))}
      </div>
      <div className="tuiles">
        {visibles.map((a) => {
          const q = quantites.get(a.id)
          return (
            <button key={a.id} className={`tuile${a.prixVente === null ? ' sans-prix' : ''}`} onClick={() => onAjouter(a)}>
              {q ? <span className="pastille-qte">{q}</span> : null}
              <span className="tuile-nom">{a.designation}</span>
              <span className="tuile-prix">{a.prixVente === null ? 'sans prix' : fcfa(a.prixVente)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
