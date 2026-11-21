import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { stockParArticle } from '../db/stock'
import { fcfa } from '../outils/format'
import { texteRecherche } from '../outils/codeBarre'
import FicheArticle from './FicheArticle'

// Écran Catalogue : la liste des articles, avec recherche et filtres.
export default function Catalogue() {
  const [recherche, setRecherche] = useState('')
  const [categorieId, setCategorieId] = useState('') // '' = toutes
  const [seulementSansPrix, setSeulementSansPrix] = useState(false)
  const [voirInactifs, setVoirInactifs] = useState(false)
  // Article ouvert dans la fiche : un id, 'nouveau', ou null (fiche fermée).
  const [ouvert, setOuvert] = useState<string | null>(null)

  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  const articles = useLiveQuery(() => db.articles.orderBy('code').toArray(), [])
  const stocks = useLiveQuery(() => stockParArticle(), [])

  if (!categories || !articles || !stocks) return <p>Chargement…</p>

  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]))
  const texte = sansAccents(recherche.trim())
  const sansPrix = articles.filter((a) => a.actif && a.prixVente === null).length

  // On garde seulement les articles qui correspondent aux filtres choisis.
  const visibles = articles.filter((a) => {
    if (!voirInactifs && !a.actif) return false
    if (categorieId && a.categorieId !== categorieId) return false
    if (seulementSansPrix && a.prixVente !== null) return false
    if (texte && !sansAccents(texteRecherche(a)).includes(texte)) return false
    return true
  })

  return (
    <section>
      <div className="entete-ecran">
        <h2>Catalogue</h2>
        <button className="principal" onClick={() => setOuvert('nouveau')}>
          + Nouvel article
        </button>
      </div>

      <div className="filtres">
        <input
          type="search"
          placeholder="Rechercher un code ou un nom…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <label className="case">
          <input
            type="checkbox"
            checked={seulementSansPrix}
            onChange={(e) => setSeulementSansPrix(e.target.checked)}
          />
          Sans prix ({sansPrix})
        </label>
        <label className="case">
          <input
            type="checkbox"
            checked={voirInactifs}
            onChange={(e) => setVoirInactifs(e.target.checked)}
          />
          Voir les inactifs
        </label>
      </div>

      <p className="compte">{visibles.length} article(s)</p>

      <ul className="liste-articles">
        {visibles.map((a) => {
          const stock = stocks.get(a.id) ?? 0
          const alerte = a.seuilAlerte !== null && stock <= a.seuilAlerte
          return (
            <li key={a.id}>
              <button className={a.actif ? '' : 'inactif'} onClick={() => setOuvert(a.id)}>
                <span className="code">{a.code}</span>
                <span className="nom">
                  {a.designation}
                  <small>{nomCategorie.get(a.categorieId)} · {a.unite}{a.format ? ` ${a.format}` : ''}{a.tailleCasier ? ` · casier de ${a.tailleCasier}` : ''}</small>
                </span>
                <span className="chiffres">
                  {a.prixVente === null ? <em className="a-saisir">Prix à saisir</em> : fcfa(a.prixVente)}
                  <small className={alerte ? 'alerte' : ''}>Stock : {stock}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {ouvert && <FicheArticle articleId={ouvert} onFermer={() => setOuvert(null)} />}
    </section>
  )
}

// Pour que "écriture" trouve aussi "Écriture".
function sansAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
