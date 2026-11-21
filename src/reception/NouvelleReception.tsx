import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import type { Article } from '../db/types'
import { enregistrerReception } from '../db/reception'
import { fcfa, lireEntier } from '../outils/format'
import { monnaie } from '../outils/pays'
import { articleScanne, texteRecherche } from '../outils/codeBarre'
import ScanCamera from '../scan/ScanCamera'
import { ScanBarcode } from 'lucide-react'

// Une ligne en cours de saisie (les nombres restent du texte jusqu'à l'enregistrement).
interface LigneSaisie {
  article: Article
  quantite: string
  cout: string
  prixVente: string
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)

export default function NouvelleReception() {
  const [fournisseur, setFournisseur] = useState('')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [recherche, setRecherche] = useState('')
  const [scan, setScan] = useState(false)
  const [erreurScan, setErreurScan] = useState('')
  const [lignes, setLignes] = useState<LigneSaisie[]>([])
  const [erreurs, setErreurs] = useState<string[]>([])
  const [message, setMessage] = useState('')

  const fournisseurs = useLiveQuery(() => db.fournisseurs.orderBy('nom').toArray(), [])
  const articles = useLiveQuery(() => db.articles.orderBy('code').filter((a) => a.actif).toArray(), [])
  if (!fournisseurs || !articles) return <p>Chargement…</p>

  // Suggestions : les 8 premiers articles qui correspondent au texte tapé.
  const texte = sansAccents(recherche.trim())
  const suggestions = texte
    ? articles.filter((a) => sansAccents(texteRecherche(a)).includes(texte)).slice(0, 8)
    : []

  function ajouter(a: Article) {
    const deja = lignes.findIndex((l) => l.article.id === a.id)
    if (deja >= 0) {
      // Déjà dans la liste : on ajoute 1 à la quantité.
      const copie = [...lignes]
      copie[deja] = { ...copie[deja], quantite: String((lireEntier(copie[deja].quantite) || 0) + 1) }
      setLignes(copie)
    } else {
      // Le coût est pré-rempli avec le dernier coût moyen connu.
      setLignes([...lignes, { article: a, quantite: '1', cout: a.coutMoyen?.toString() ?? '', prixVente: '' }])
    }
    setRecherche('')
    setMessage('')
  }

  function changer(i: number, champ: 'quantite' | 'cout' | 'prixVente', valeur: string) {
    const copie = [...lignes]
    copie[i] = { ...copie[i], [champ]: valeur }
    setLignes(copie)
  }

  const total = lignes.reduce((s, l) => s + (lireEntier(l.quantite) || 0) * (lireEntier(l.cout) || 0), 0)

  async function enregistrer() {
    const pb: string[] = []
    if (lignes.length === 0) pb.push('Ajoute au moins un article.')
    const propres = lignes.map((l) => {
      const q = lireEntier(l.quantite)
      const c = lireEntier(l.cout)
      const p = lireEntier(l.prixVente)
      if (!q || Number.isNaN(q)) pb.push(`${l.article.code} : la quantité doit être un nombre entier supérieur à 0.`)
      if (c === null || Number.isNaN(c)) pb.push(`${l.article.code} : indique le coût d'achat unitaire.`)
      if (Number.isNaN(p)) pb.push(`${l.article.code} : le prix de vente doit être un nombre entier.`)
      return { articleId: l.article.id, quantite: q ?? 0, coutUnitaire: c ?? 0, prixVente: p ?? undefined }
    })
    setErreurs(pb)
    if (pb.length > 0) return

    // Date du jour : on garde l'heure exacte. Autre date : midi, pour éviter les décalages.
    const quand = date === aujourdhui() ? new Date() : new Date(date + 'T12:00:00')
    await enregistrerReception({ date: quand.toISOString(), fournisseurNom: fournisseur, reference, lignes: propres })
    setMessage(`Réception enregistrée : ${lignes.length} article(s), ${fcfa(total)}. Le stock est à jour.`)
    setLignes([])
    setReference('')
  }

  return (
    <div className="reception">
      {message && <p className="succes">{message}</p>}

      <div className="deux">
        <label>
          Fournisseur
          <input list="fournisseurs" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} placeholder="Choisir ou taper un nom" />
          <datalist id="fournisseurs">{fournisseurs.map((f) => <option key={f.id} value={f.nom} />)}</datalist>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label>
        Référence (n° de bon de livraison ou de facture, facultatif)
        <input value={reference} onChange={(e) => setReference(e.target.value)} />
      </label>

      <label className="recherche-article">
        Ajouter un article
        <span className="avec-scan">
          <input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setErreurScan('') }} placeholder="Tape ou scanne un code, ou un nom…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const a = articleScanne(articles!, recherche, suggestions); if (a) ajouter(a); else if (recherche.trim()) setErreurScan(`Aucun article ne correspond à « ${recherche.trim()} ».`) } }} />
          <button type="button" className="bouton-scan" onClick={() => setScan(true)} aria-label="Scanner avec la caméra"><ScanBarcode size={20} /></button>
        </span>
        {erreurScan && <small className="alerte">{erreurScan}</small>}
        {scan && (
          <ScanCamera
            onFermer={() => setScan(false)}
            onCode={(c) => {
              setScan(false)
              const a = articleScanne(articles!, c, [])
              if (a) ajouter(a)
              else setErreurScan(`Aucun article n'a le code-barres ${c}. Ajoute-le dans la fiche de l'article (Catalogue).`)
            }}
          />
        )}
        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => ajouter(a)}>
                  <span className="code">{a.code}</span> {a.designation}
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>

      {lignes.length > 0 && (
        <ul className="lignes-reception">
          {lignes.map((l, i) => {
            const sousTotal = (lireEntier(l.quantite) || 0) * (lireEntier(l.cout) || 0)
            return (
              <li key={l.article.id}>
                <div className="ligne-titre">
                  <span><span className="code">{l.article.code}</span> {l.article.designation}</span>
                  <button type="button" className="retirer" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>
                </div>
                <div className="ligne-champs">
                  <label>Quantité<input inputMode="numeric" value={l.quantite} onChange={(e) => changer(i, 'quantite', e.target.value)} /></label>
                  <label>Coût unitaire<input inputMode="numeric" value={l.cout} onChange={(e) => changer(i, 'cout', e.target.value)} placeholder={monnaie()} /></label>
                  {l.article.prixVente === null ? (
                    <label>Prix de vente<input inputMode="numeric" value={l.prixVente} onChange={(e) => changer(i, 'prixVente', e.target.value)} placeholder="à saisir" /></label>
                  ) : (
                    <span className="info">Vendu {fcfa(l.article.prixVente)}</span>
                  )}
                  <span className="sous-total">{fcfa(sousTotal)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {erreurs.length > 0 && <ul className="erreurs">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>}

      <div className="pied-reception">
        <strong>Total : {fcfa(total)}</strong>
        <button className="principal" onClick={enregistrer} disabled={lignes.length === 0}>
          Enregistrer la réception
        </button>
      </div>
    </div>
  )
}

function sansAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
