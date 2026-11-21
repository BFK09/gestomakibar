import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { fcfa } from '../outils/format'
import Ticket from './Ticket'
import type { LignePanier } from './Caisse'

// Les tickets d'aujourd'hui, avec le total par mode de paiement.
export default function VentesDuJour({ onRefaire }: { onRefaire: (lignes: LignePanier[]) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const d = useLiveQuery(async () => {
    const debut = new Date(); debut.setHours(0, 0, 0, 0)
    const depuis = debut.toISOString()
    const ventes = await db.ventes.where('date').aboveOrEqual(depuis).reverse().sortBy('date')
    const encaissements = await db.encaissements.where('date').aboveOrEqual(depuis).toArray()
    const modes = await db.modesPaiement.toCollection().sortBy('ordre')
    return { ventes, encaissements, modes }
  }, [])
  if (!d) return <p>Chargement…</p>
  if (ouvert) return (
    <div>
      <button onClick={() => setOuvert(null)}>← Retour à la liste</button>
      <Ticket venteId={ouvert} onRefaire={onRefaire} />
    </div>
  )

  // Le chiffre d'affaires est net : les contre-tickets (négatifs) annulent les ventes.
  const total = d.ventes.reduce((s, v) => s + v.total, 0)
  const annulees = new Set(d.ventes.map((v) => v.annuleVenteId).filter(Boolean))
  const numeros = new Map(d.ventes.map((v) => [v.id, v.numero]))
  const nbTickets = d.ventes.filter((v) => !v.annuleVenteId && !v.retourVenteId && !annulees.has(v.id)).length
  return (
    <div className="caisse">
      <div className="resume-jour">
        <div><small>Tickets valides</small><strong>{nbTickets}</strong></div>
        <div><small>Chiffre d'affaires</small><strong>{fcfa(total)}</strong></div>
        {d.modes.map((m) => {
          const s = d.encaissements.filter((e) => e.modePaiementId === m.id).reduce((x, e) => x + e.montant, 0)
          return <div key={m.id}><small>{m.nom}</small><strong>{fcfa(s)}</strong></div>
        })}
      </div>
      {d.ventes.length === 0 ? <p className="info">Aucune vente aujourd'hui.</p> : (
        <ul className="liste-articles">
          {d.ventes.map((v) => (
            <li key={v.id}>
              <button onClick={() => setOuvert(v.id)} className={annulees.has(v.id) ? 'inactif' : ''}>
                <span className="code">n° {v.numero}</span>
                <span className="nom">
                  {new Date(v.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {v.annuleVenteId && <small>Annulation du n° {numeros.get(v.annuleVenteId) ?? '?'}</small>}
                  {v.retourVenteId && <small>Retour sur le n° {numeros.get(v.retourVenteId) ?? '?'}</small>}
                  {annulees.has(v.id) && <small>Annulé</small>}
                </span>
                <span className="chiffres">{fcfa(v.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
