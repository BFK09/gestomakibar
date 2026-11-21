import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import type { Article } from '../db/types'
import { stockParArticle } from '../db/stock'
import { enregistrerVente } from '../db/vente'
import { fcfa, lireEntier } from '../outils/format'
import { sansAccents } from '../outils/texte'
import { articleScanne, texteRecherche } from '../outils/codeBarre'
import ScanCamera from '../scan/ScanCamera'
import { ScanBarcode } from 'lucide-react'
import Ticket from './Ticket'

export interface LignePanier { article: Article; quantite: number }
interface PaiementSaisi { modePaiementId: string; montant: string }

interface Props {
  panierDepart: LignePanier[] // vide, ou les articles d'un ticket annulé à refaire
  onRefaire: (lignes: LignePanier[]) => void
}

export default function Caisse({ panierDepart, onRefaire }: Props) {
  const [recherche, setRecherche] = useState('')
  const [scan, setScan] = useState(false)
  const [erreurScan, setErreurScan] = useState('')
  const [panier, setPanier] = useState<LignePanier[]>(panierDepart)
  const [paiements, setPaiements] = useState<PaiementSaisi[]>([])
  const [recu, setRecu] = useState('') // espèces données par le client, pour calculer la monnaie
  const [client, setClient] = useState('')
  const [telephone, setTelephone] = useState('')
  const [erreur, setErreur] = useState('')
  const [ticketId, setTicketId] = useState<string | null>(null)

  const articles = useLiveQuery(() => db.articles.orderBy('code').filter((a) => a.actif).toArray(), [])
  const modes = useLiveQuery(() => db.modesPaiement.filter((m) => m.actif).sortBy('ordre'), [])
  const clients = useLiveQuery(() => db.clients.orderBy('nom').toArray(), [])
  const stocks = useLiveQuery(() => stockParArticle(), [])
  if (!articles || !modes || !clients || !stocks) return <p>Chargement…</p>

  // Après une vente : on affiche le ticket, puis on repart sur un panier vide.
  if (ticketId) return <Ticket venteId={ticketId} onNouvelleVente={() => setTicketId(null)} onRefaire={onRefaire} />

  const especes = modes.find((m) => m.nature === 'especes')
  const credit = modes.find((m) => m.nature === 'credit')
  const total = panier.reduce((s, l) => s + l.quantite * (l.article.prixVente ?? 0), 0)

  // Sans paiement saisi, tout est payé en espèces par défaut.
  const paiementsEffectifs: PaiementSaisi[] =
    paiements.length > 0 ? paiements : especes ? [{ modePaiementId: especes.id, montant: String(total) }] : []
  const paye = paiementsEffectifs.reduce((s, p) => s + (lireEntier(p.montant) || 0), 0)
  const reste = total - paye
  const montantEspeces = paiementsEffectifs.filter((p) => p.modePaiementId === especes?.id).reduce((s, p) => s + (lireEntier(p.montant) || 0), 0)
  const recuNombre = lireEntier(recu)
  const monnaie = recuNombre && !Number.isNaN(recuNombre) ? recuNombre - montantEspeces : null
  const aCredit = paiementsEffectifs.some((p) => p.modePaiementId === credit?.id && (lireEntier(p.montant) || 0) > 0)

  const texte = sansAccents(recherche.trim())
  const suggestions = texte
    ? articles.filter((a) => sansAccents(texteRecherche(a)).includes(texte)).slice(0, 8)
    : []

  function ajouter(a: Article) {
    if (a.prixVente === null) {
      setErreur(`${a.code} n'a pas de prix de vente : saisis-le d'abord dans le Catalogue.`)
      return
    }
    setErreur('')
    const i = panier.findIndex((l) => l.article.id === a.id)
    if (i >= 0) changerQuantite(i, panier[i].quantite + 1)
    else setPanier([...panier, { article: a, quantite: 1 }])
    setRecherche('')
  }



  function changerQuantite(i: number, q: number) {
    if (q <= 0) setPanier(panier.filter((_, j) => j !== i))
    else setPanier(panier.map((l, j) => (j === i ? { ...l, quantite: q } : l)))
  }

  // Paiement partagé : on ajoute un second mode, avec le reste à payer pré-rempli.
  function ajouterPaiement() {
    const base = paiements.length > 0 ? paiements : paiementsEffectifs
    const utilises = new Set(base.map((p) => p.modePaiementId))
    const libre = modes!.find((m) => !utilises.has(m.id))
    if (!libre) return
    setPaiements([...base, { modePaiementId: libre.id, montant: String(Math.max(reste, 0)) }])
  }

  function changerPaiement(i: number, champ: keyof PaiementSaisi, valeur: string) {
    const base = paiements.length > 0 ? paiements : paiementsEffectifs
    setPaiements(base.map((p, j) => (j === i ? { ...p, [champ]: valeur } : p)))
  }

  async function valider() {
    setErreur('')
    if (reste !== 0) {
      setErreur(reste > 0 ? `Il manque ${fcfa(reste)} dans les paiements.` : `Les paiements dépassent le total de ${fcfa(-reste)}.`)
      return
    }
    if (aCredit && !client.trim()) {
      setErreur('Pour un paiement à crédit, indique le nom du client.')
      return
    }
    try {
      const id = await enregistrerVente({
        lignes: panier.map((l) => ({ articleId: l.article.id, quantite: l.quantite })),
        paiements: paiementsEffectifs.map((p) => ({ modePaiementId: p.modePaiementId, montant: lireEntier(p.montant) || 0 })),
        clientNom: client,
        clientTelephone: telephone,
      })
      setPanier([]); setPaiements([]); setRecu(''); setClient(''); setTelephone('')
      setTicketId(id)
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  return (
    <div className="caisse">
      <label className="recherche-article">
        Ajouter un article
        <span className="avec-scan">
          <input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setErreurScan('') }} placeholder="Tape ou scanne un code, ou un nom…" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const a = articleScanne(articles!, recherche, suggestions); if (a) ajouter(a); else if (recherche.trim()) setErreurScan(`Aucun article ne correspond à « ${recherche.trim()} ».`) } }} />
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
                  <span className="prix-suggestion">{a.prixVente === null ? 'sans prix' : fcfa(a.prixVente)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>


      {panierDepart.length > 0 && panier === panierDepart && (
        <p className="succes">Ticket annulé. Ses articles sont remis dans le panier : corrige-les puis valide la nouvelle vente.</p>
      )}

      {panier.length === 0 ? (
        <p className="info">Le panier est vide.</p>
      ) : (
        <ul className="panier">
          {panier.map((l, i) => {
            const stock = stocks.get(l.article.id) ?? 0
            return (
              <li key={l.article.id}>
                <span className="nom">
                  {l.article.designation}
                  <small>{fcfa(l.article.prixVente)} l'unité{l.quantite > stock && <span className="alerte"> · stock affiché : {stock}</span>}</small>
                </span>
                <span className="quantite">
                  <button type="button" onClick={() => changerQuantite(i, l.quantite - 1)} aria-label="Moins">−</button>
                  <span>{l.quantite}</span>
                  <button type="button" onClick={() => changerQuantite(i, l.quantite + 1)} aria-label="Plus">+</button>
                </span>
                <strong className="sous-total">{fcfa(l.quantite * (l.article.prixVente ?? 0))}</strong>
              </li>
            )
          })}
        </ul>
      )}

      <div className="total-caisse">Total <strong>{fcfa(total)}</strong></div>

      {panier.length > 0 && (
        <div className="paiements">
          <h3>Paiement</h3>
          {paiementsEffectifs.map((p, i) => (
            <div className="ligne-paiement" key={i}>
              <select value={p.modePaiementId} onChange={(e) => changerPaiement(i, 'modePaiementId', e.target.value)}>
                {modes.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <input inputMode="numeric" value={p.montant} onChange={(e) => changerPaiement(i, 'montant', e.target.value)} />
              {paiementsEffectifs.length > 1 && (
                <button type="button" className="retirer" onClick={() => setPaiements(paiementsEffectifs.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>
              )}
            </div>
          ))}
          {paiementsEffectifs.length < modes.length && (
            <button type="button" onClick={ajouterPaiement}>+ Partager le paiement</button>
          )}
          {reste !== 0 && <p className="alerte">{reste > 0 ? `Reste à répartir : ${fcfa(reste)}` : `Trop payé : ${fcfa(-reste)}`}</p>}

          {montantEspeces > 0 && (
            <label className="recu">
              Espèces reçues du client (pour calculer la monnaie)
              <input inputMode="numeric" value={recu} onChange={(e) => setRecu(e.target.value)} placeholder={String(montantEspeces)} />
              {monnaie !== null && (monnaie >= 0
                ? <span className="monnaie">Monnaie à rendre : <strong>{fcfa(monnaie)}</strong></span>
                : <span className="alerte">Il manque {fcfa(-monnaie)}</span>)}
            </label>
          )}

          <div className="deux">
            <label>
              Client {aCredit ? '(obligatoire pour un crédit)' : '(facultatif)'}
              <input list="clients" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nom du client" />
              <datalist id="clients">{clients.map((c) => <option key={c.id} value={c.nom} />)}</datalist>
            </label>
            <label>
              Téléphone
              <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {erreur && <p className="erreurs">{erreur}</p>}

      <div className="pied-reception">
        <button type="button" onClick={() => { setPanier([]); setPaiements([]); setErreur('') }} disabled={panier.length === 0}>Vider</button>
        <button className="principal" onClick={valider} disabled={panier.length === 0}>Valider la vente</button>
      </div>
    </div>
  )
}
