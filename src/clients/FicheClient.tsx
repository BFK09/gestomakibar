import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nouvelId } from '../db/base'
import { debutDeLaDette, DELAI_RELANCE, detteClient, enregistrerRemboursement, historiqueClient, joursDepuis, messageRelance } from '../db/clients'
import { ouvrirWhatsApp } from '../outils/whatsapp'
import { MessageCircle } from 'lucide-react'
import type { Client, Encaissement } from '../db/types'
import { fcfa, lireEntier } from '../outils/format'
import { monnaie } from '../outils/pays'

interface Props { clientId: string; onFermer: () => void }

// Fiche d'un client : ses coordonnées, sa dette, son historique, et les remboursements.
export default function FicheClient({ clientId, onFermer }: Props) {
  const estNouveau = clientId === 'nouveau'
  const [saisie, setSaisie] = useState({ nom: '', type: 'particulier' as Client['type'], telephone: '', plafond: '', note: '' })
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [montant, setMontant] = useState('')
  const [modeId, setModeId] = useState('')
  const [recu, setRecu] = useState<Encaissement | null>(null)

  const d = useLiveQuery(async () => ({
    client: estNouveau ? undefined : await db.clients.get(clientId),
    dette: estNouveau ? 0 : await detteClient(clientId),
    historique: estNouveau ? [] : await historiqueClient(clientId),
    depuis: estNouveau ? null : await debutDeLaDette(clientId),
    modes: (await db.modesPaiement.toCollection().sortBy('ordre')).filter((m) => m.actif && m.nature !== 'credit'),
    boutique: await db.boutique.get('principale'),
  }), [clientId])

  useEffect(() => {
    const c = d?.client
    if (c) setSaisie({ nom: c.nom, type: c.type, telephone: c.telephone ?? '', plafond: c.plafondCredit ? String(c.plafondCredit) : '', note: c.note ?? '' })
    // On ne recharge le formulaire que quand on ouvre un autre client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.client?.id])

  if (!d) return <p>Chargement…</p>
  const { client, dette, historique, modes, boutique, depuis } = d
  const jours = depuis ? joursDepuis(depuis) : 0

  async function enregistrer() {
    setErreur(''); setMessage('')
    const nom = saisie.nom.trim()
    const plafond = lireEntier(saisie.plafond)
    if (!nom) return setErreur('Le nom est obligatoire.')
    if (Number.isNaN(plafond)) return setErreur('Le plafond doit être un nombre entier (0 ou vide = sans limite).')
    const doublon = (await db.clients.toArray()).find((c) => c.nom.toLowerCase() === nom.toLowerCase() && c.id !== client?.id)
    if (doublon) return setErreur(`Un client s'appelle déjà « ${doublon.nom} ».`)
    const donnees = { nom, type: saisie.type, telephone: saisie.telephone.trim() || undefined, plafondCredit: plafond ?? 0, note: saisie.note.trim() || undefined }
    if (client) {
      await db.clients.update(client.id, donnees)
      setMessage('Client enregistré.')
    } else {
      await db.clients.add({ id: nouvelId(), ...donnees })
      onFermer()
    }
  }

  async function rembourser() {
    setErreur(''); setMessage('')
    const m = lireEntier(montant)
    try {
      const e = await enregistrerRemboursement(clientId, m ?? 0, modeId || modes[0]?.id)
      setMontant('')
      setRecu(e)
    } catch (x) {
      setErreur((x as Error).message)
    }
  }

  // Le reçu de remboursement, imprimable comme un ticket.
  if (recu && client) {
    return (
      <div className="zone-ticket">
        <div className="ticket">
          <p className="ticket-titre">{boutique?.nom.toUpperCase()}{boutique?.telephone && <><br /><small>Tél. {boutique.telephone}</small></>}</p>
          <p className="ticket-annulation" style={{ color: 'inherit' }}>REÇU DE REMBOURSEMENT</p>
          <p>{new Date(recu.date).toLocaleString('fr-FR')}<br />Client : {client.nom}</p>
          <p className="ticket-total">MONTANT REÇU <span>{fcfa(recu.montant)}</span></p>
          <p className="ticket-ligne">{modes.find((m) => m.id === recu.modePaiementId)?.nom} <span>{fcfa(recu.montant)}</span></p>
          <p className="ticket-ligne">Reste à payer <span>{fcfa(dette)}</span></p>
          <p className="ticket-merci">Merci !</p>
        </div>
        <div className="boutons sans-impression">
          <button onClick={() => window.print()}>Imprimer</button>
          <button className="principal" onClick={() => setRecu(null)}>Retour à la fiche</button>
        </div>
      </div>
    )
  }

  return (
    <section className="fiche-client">
      <div className="entete-ecran">
        <h2>{estNouveau ? 'Nouveau client' : client?.nom}</h2>
        <button onClick={onFermer}>← Liste des clients</button>
      </div>
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}

      {!estNouveau && (
        <div className="carte">
          <div className="tuiles">
            <div className="tuile"><small>Doit actuellement</small><strong className={dette > 0 ? 'alerte' : ''}>{fcfa(dette)}</strong>{dette > 0 && depuis && <small>depuis {jours} jour{jours > 1 ? 's' : ''}</small>}</div>
            <div className="tuile"><small>Plafond de crédit</small><strong>{client?.plafondCredit ? fcfa(client.plafondCredit) : 'Sans limite'}</strong></div>
          </div>
          {dette > 0 && (
            <>
              <div className={`relance ${jours >= DELAI_RELANCE ? 'urgente' : ''}`}>
                <span>{jours >= DELAI_RELANCE ? `Crédit en retard (plus de ${DELAI_RELANCE} jours).` : 'Envoyer un rappel au client ?'}</span>
                <button onClick={() => ouvrirWhatsApp(messageRelance(client!.nom, dette, boutique?.nom ?? 'le maquis', depuis), client?.telephone)}>
                  <MessageCircle size={18} /> Rappel WhatsApp
                </button>
              </div>
              {!client?.telephone && <p className="info">Pas de téléphone enregistré : WhatsApp te demandera à qui envoyer. Ajoute le numéro plus bas.</p>}
              <strong>Enregistrer un remboursement</strong>
              <div className="ligne-paiement">
                <select value={modeId || modes[0]?.id} onChange={(e) => setModeId(e.target.value)}>
                  {modes.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
                <input inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder={`max ${dette}`} />
              </div>
              <div className="boutons gauche">
                <button onClick={() => setMontant(String(dette))}>Tout ({fcfa(dette)})</button>
                <button className="principal" onClick={rembourser}>Encaisser</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="carte">
        <strong>Coordonnées</strong>
        <label>Nom *<input value={saisie.nom} onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })} /></label>
        <div className="deux">
          <label>Type
            <select value={saisie.type} onChange={(e) => setSaisie({ ...saisie, type: e.target.value as Client['type'] })}>
              <option value="particulier">Particulier</option><option value="revendeur">Revendeur</option><option value="entreprise">Entreprise</option>
            </select>
          </label>
          <label>Téléphone<input inputMode="tel" value={saisie.telephone} onChange={(e) => setSaisie({ ...saisie, telephone: e.target.value })} /></label>
        </div>
        <label>Plafond de crédit ({monnaie()}, vide = sans limite)<input inputMode="numeric" value={saisie.plafond} onChange={(e) => setSaisie({ ...saisie, plafond: e.target.value })} /></label>
        <label>Note<input value={saisie.note} onChange={(e) => setSaisie({ ...saisie, note: e.target.value })} placeholder="ex. paie en fin de mois" /></label>
        <div className="boutons gauche"><button className="principal" onClick={enregistrer}>Enregistrer</button></div>
      </div>

      {!estNouveau && (
        <div className="carte">
          <strong>Historique du compte</strong>
          {historique.length === 0 ? <p className="info">Aucun achat à crédit.</p> : (
            <table className="table-rapport">
              <thead><tr><th>Date</th><th>Opération</th><th className="nombre">Crédit</th><th className="nombre">Payé</th></tr></thead>
              <tbody>
                {historique.map((h) => (
                  <tr key={h.id}>
                    <td className="date">{new Date(h.date).toLocaleDateString('fr-FR')}</td>
                    <td>{h.libelle}</td>
                    <td className="nombre sortie">{h.credit ? fcfa(h.credit) : ''}</td>
                    <td className="nombre entree">{h.remboursement ? fcfa(h.remboursement) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}>Reste à payer</td><td className="nombre" colSpan={2}>{fcfa(dette)}</td></tr></tfoot>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
