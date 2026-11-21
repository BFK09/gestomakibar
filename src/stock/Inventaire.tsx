import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { stockParArticle } from '../db/stock'
import { enregistrerInventaire } from '../db/inventaire'
import { lireEntier } from '../outils/format'
import { monnaie } from '../outils/pays'
import { sansAccents } from '../outils/texte'
import { texteRecherche } from '../outils/codeBarre'

// Écran Inventaire : on compte ce qu'il y a sur les étagères et on le saisit.
// On peut compter une catégorie à la fois ; seuls les produits remplis sont enregistrés.
export default function Inventaire() {
  const [recherche, setRecherche] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [comptes, setComptes] = useState<Record<string, string>>({}) // articleId → quantité tapée
  const [couts, setCouts] = useState<Record<string, string>>({})
  const [erreurs, setErreurs] = useState<string[]>([])
  const [message, setMessage] = useState('')

  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  const articles = useLiveQuery(() => db.articles.orderBy('code').filter((a) => a.actif).toArray(), [])
  const stocks = useLiveQuery(() => stockParArticle(), [])
  if (!categories || !articles || !stocks) return <p>Chargement…</p>

  const texte = sansAccents(recherche.trim())
  const visibles = articles.filter((a) =>
    (!categorieId || a.categorieId === categorieId) &&
    (!texte || sansAccents(texteRecherche(a)).includes(texte)))
  const remplis = Object.entries(comptes).filter(([, v]) => v.trim() !== '')

  async function enregistrer() {
    const pb: string[] = []
    const lignes = remplis.map(([articleId, v]) => {
      const a = articles!.find((x) => x.id === articleId)!
      const q = lireEntier(v)
      const c = lireEntier(couts[articleId] ?? '')
      if (q === null || Number.isNaN(q)) pb.push(`${a.code} : la quantité doit être un nombre entier.`)
      if (Number.isNaN(c)) pb.push(`${a.code} : le coût doit être un nombre entier.`)
      return { articleId, quantiteComptee: q ?? 0, coutUnitaire: c ?? undefined }
    })
    setErreurs(pb)
    if (pb.length > 0) return
    const ecarts = await enregistrerInventaire(lignes)
    setMessage(`Inventaire enregistré : ${lignes.length} produit(s) compté(s), ${ecarts} stock(s) corrigé(s).`)
    setComptes({}); setCouts({})
  }

  return (
    <section>
      <div className="entete-ecran"><h2>Inventaire</h2></div>
      <p className="info">
        Compte les produits sur les étagères et tape la quantité trouvée. L'application corrige
        le stock en ajoutant l'écart au journal. Tu peux faire une catégorie à la fois.
      </p>
      {message && <p className="succes">{message}</p>}

      <div className="filtres">
        <input type="search" placeholder="Rechercher un code ou un nom…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <ul className="liste-inventaire">
        {visibles.map((a) => {
          const stock = stocks.get(a.id) ?? 0
          const q = lireEntier(comptes[a.id] ?? '')
          const ecart = q !== null && !Number.isNaN(q) ? q - stock : null
          return (
            <li key={a.id}>
              <span className="nom">
                <span className="code">{a.code}</span> {a.designation}
                <small>
                  Stock calculé : {stock}
                  {ecart !== null && ecart !== 0 && <strong className={ecart < 0 ? 'alerte' : 'positif'}> · écart {ecart > 0 ? '+' : ''}{ecart}</strong>}
                </small>
              </span>
              <span className="champs-inventaire">
                <label>Compté<input inputMode="numeric" value={comptes[a.id] ?? ''} onChange={(e) => setComptes({ ...comptes, [a.id]: e.target.value })} /></label>
                {a.coutMoyen === null && (
                  <label>Coût unit.<input inputMode="numeric" value={couts[a.id] ?? ''} onChange={(e) => setCouts({ ...couts, [a.id]: e.target.value })} placeholder={monnaie()} /></label>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {erreurs.length > 0 && <ul className="erreurs">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>}

      <div className="pied-reception pied-collant">
        <span>{remplis.length} produit(s) compté(s)</span>
        <button className="principal" onClick={enregistrer} disabled={remplis.length === 0}>Enregistrer l'inventaire</button>
      </div>
    </section>
  )
}
