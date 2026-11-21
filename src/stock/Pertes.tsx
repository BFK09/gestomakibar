import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import type { Article } from '../db/types'
import { enregistrerPerte } from '../db/vente'
import { stockParArticle } from '../db/stock'
import { fcfa, lireEntier } from '../outils/format'
import { sansAccents } from '../outils/texte'
import { texteRecherche } from '../outils/codeBarre'

const MOTIFS = ['Casse', 'Vol', 'Abîmé / périmé', 'Usage interne (boutique)', 'Cadeau / don', 'Autre']

// Pertes : une sortie de stock sans vente (casse, vol…). Elle apparaît dans le rapport des mouvements.
export default function Pertes() {
  const [recherche, setRecherche] = useState('')
  const [article, setArticle] = useState<Article | null>(null)
  const [quantite, setQuantite] = useState('1')
  const [motif, setMotif] = useState(MOTIFS[0])
  const [precision, setPrecision] = useState('')
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')

  const articles = useLiveQuery(() => db.articles.orderBy('code').filter((a) => a.actif).toArray(), [])
  const stocks = useLiveQuery(() => stockParArticle(), [])
  const recentes = useLiveQuery(async () => {
    const depuis = new Date(); depuis.setDate(depuis.getDate() - 30)
    const pertes = await db.mouvementsStock.where('date').aboveOrEqual(depuis.toISOString()).filter((m) => m.type === 'perte').reverse().sortBy('date')
    const arts = new Map((await db.articles.toArray()).map((a) => [a.id, a]))
    return pertes.map((m) => ({ ...m, article: arts.get(m.articleId) }))
  }, [])
  if (!articles || !stocks || !recentes) return <p>Chargement…</p>

  const texte = sansAccents(recherche.trim())
  const suggestions = texte ? articles.filter((a) => sansAccents(texteRecherche(a)).includes(texte)).slice(0, 8) : []
  const q = lireEntier(quantite)
  const valeur = article && q && !Number.isNaN(q) ? q * (article.coutMoyen ?? 0) : 0
  const totalMois = recentes.reduce((s, m) => s + -m.quantite * (m.article?.coutMoyen ?? 0), 0)

  async function enregistrer() {
    setErreur(''); setMessage('')
    if (!article) return setErreur('Choisis un produit.')
    try {
      const texteMotif = precision.trim() ? `${motif} – ${precision.trim()}` : motif
      await enregistrerPerte(article.id, q ?? 0, texteMotif)
      setMessage(`Perte enregistrée : ${q} × ${article.designation} (${texteMotif}).`)
      setArticle(null); setQuantite('1'); setPrecision('')
    } catch (x) {
      setErreur((x as Error).message)
    }
  }

  return (
    <div className="caisse">
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}
      <div className="carte">
        {article ? (
          <p className="article-choisi">
            <span><span className="code">{article.code}</span> {article.designation}<small>Stock actuel : {stocks.get(article.id) ?? 0}</small></span>
            <button onClick={() => setArticle(null)}>Changer</button>
          </p>
        ) : (
          <label className="recherche-article">
            Article perdu ou abîmé
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Tape un code ou un nom…" />
            {suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map((a) => (
                  <li key={a.id}><button type="button" onClick={() => { setArticle(a); setRecherche('') }}><span className="code">{a.code}</span> {a.designation}</button></li>
                ))}
              </ul>
            )}
          </label>
        )}
        <div className="deux">
          <label>Quantité<input inputMode="numeric" value={quantite} onChange={(e) => setQuantite(e.target.value)} /></label>
          <label>Motif
            <select value={motif} onChange={(e) => setMotif(e.target.value)}>{MOTIFS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
        </div>
        <label>Précision (facultatif)<input value={precision} onChange={(e) => setPrecision(e.target.value)} placeholder="ex. tombé pendant le rangement" /></label>
        {valeur > 0 && <p className="info">Valeur perdue (au coût d'achat) : <strong>{fcfa(valeur)}</strong></p>}
        <div className="boutons gauche"><button className="principal" onClick={enregistrer}>Enregistrer la perte</button></div>
      </div>

      <div className="carte">
        <strong>Pertes des 30 derniers jours</strong>
        {recentes.length === 0 ? <p className="info">Aucune perte.</p> : (
          <table className="tableau-simple">
            <tbody>
              {recentes.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                  <td>{m.article?.designation}<br /><small>{m.motif}</small></td>
                  <td>{-m.quantite}</td>
                  <td>{fcfa(-m.quantite * (m.article?.coutMoyen ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalMois > 0 && <p className="info">Total perdu sur 30 jours : <strong>{fcfa(totalMois)}</strong></p>}
      </div>
    </div>
  )
}
