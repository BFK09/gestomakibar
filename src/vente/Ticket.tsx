import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { emballagesDusParClient } from '../db/emballages'
import { db } from '../db/base'
import { annulerVente, quantitesRetournees, retournerArticles } from '../db/vente'
import { lireEntier } from '../outils/format'
import { fcfa } from '../outils/format'
import type { LignePanier } from './Caisse'
import { ouvrirWhatsApp } from '../outils/whatsapp'
import { MessageCircle, Printer } from 'lucide-react'

interface Props {
  venteId: string
  onNouvelleVente?: () => void
  onRefaire?: (lignes: LignePanier[]) => void // recharge les produits dans la caisse
}

// Le ticket d'une vente, prêt à être imprimé, avec la possibilité de l'annuler.
export default function Ticket({ venteId: venteIdDepart, onNouvelleVente, onRefaire }: Props) {
  // Le ticket affiché : au départ celui demandé, puis éventuellement le ticket de retour créé.
  const [venteId, setVenteId] = useState(venteIdDepart)
  const [confirmer, setConfirmer] = useState(false)
  const [retour, setRetour] = useState<Record<string, string> | null>(null) // articleId → quantité tapée
  const [modeRetour, setModeRetour] = useState('')
  const [erreur, setErreur] = useState('')
  const d = useLiveQuery(async () => {
    const vente = await db.ventes.get(venteId)
    const lignes = await db.lignesVente.where('venteId').equals(venteId).toArray()
    const encaissements = await db.encaissements.where('venteId').equals(venteId).toArray()
    const modes = new Map((await db.modesPaiement.toArray()).map((m) => [m.id, m.nom]))
    const boutique = await db.boutique.get('principale')
    const client = vente?.clientId ? await db.clients.get(vente.clientId) : undefined
    const serveur = vente?.serveurId ? await db.serveurs.get(vente.serveurId) : undefined
    // Liens entre un ticket et son annulation, dans les deux sens.
    const annulePar = await db.ventes.where('annuleVenteId').equals(venteId).first()
    const original = vente?.annuleVenteId ? await db.ventes.get(vente.annuleVenteId) : vente?.retourVenteId ? await db.ventes.get(vente.retourVenteId) : undefined
    const retours = await db.ventes.where('retourVenteId').equals(venteId).toArray()
    const dejaRetourne = await quantitesRetournees(venteId)
    const tousModes = await db.modesPaiement.toCollection().sortBy('ordre')
    // Casiers emportés / rapportés avec ce ticket, et ce que le client doit encore en emballages.
    const nomsEmb = new Map((await db.emballages.toArray()).map((e) => [e.id, e.nom]))
    const casiers = (await db.mouvementsEmballage.where('documentId').equals(venteId).toArray())
      .map((m) => `${m.nature === 'emporte_client' ? 'Casiers emportés' : m.nature === 'rendu_client' ? 'Vides rapportés' : 'Casiers'} : ${Math.abs(m.du)} ${nomsEmb.get(m.emballageId) ?? ''}`)
    const dusClient = vente?.clientId ? [...(await emballagesDusParClient(vente.clientId))].filter(([, q]) => q > 0).map(([id, q]) => `${q} ${nomsEmb.get(id) ?? ''}`) : []
    return { casiers, dusClient, vente, lignes, encaissements, modes, client, serveur, annulePar, original, boutique, retours, dejaRetourne, tousModes }
  }, [venteId])
  if (!d?.vente) return <p>Chargement…</p>
  const { casiers, dusClient, vente, lignes, encaissements, modes, client, serveur, annulePar, original, boutique, retours, dejaRetourne, tousModes } = d
  const estAnnulation = !!vente.annuleVenteId
  const estRetour = !!vente.retourVenteId
  const peutRetourner = !estAnnulation && !estRetour && !annulePar
  // Modes proposés pour rembourser : tous ceux qui sont actifs ; le crédit seulement s'il y a un client.
  const modesRetour = tousModes.filter((m) => m.actif && (m.nature !== 'credit' || !!vente.clientId))

  async function validerRetour() {
    setErreur('')
    try {
      const id = await retournerArticles(
        venteId,
        Object.entries(retour!).map(([articleId, q]) => ({ articleId, quantite: lireEntier(q) || 0 })),
        modeRetour || modesRetour[0]?.id,
      )
      setRetour(null)
      setVenteId(id)
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  // Le ticket en texte, pour l'envoyer par WhatsApp.
  function texteTicket() {
    const l = [
      `*${boutique?.nom ?? 'Maquis'}*`,
      estAnnulation ? `ANNULATION du ticket n° ${original?.numero}` : estRetour ? `RETOUR sur le ticket n° ${original?.numero}` : '',
      `Ticket n° ${vente!.numero} du ${new Date(vente!.date).toLocaleString('fr-FR')}`,
      serveur ? `Servi par : ${serveur.nom}${vente!.table ? ` · Table ${vente!.table}` : ''}` : '',
      client ? `Client : ${client.nom}` : '',
      '',
      ...lignes.map((x) => `${x.designation}\n   ${x.quantite} × ${fcfa(x.prixUnitaire)} = ${fcfa(x.quantite * x.prixUnitaire)}`),
      '',
      `*TOTAL : ${fcfa(vente!.total)}*`,
      ...encaissements.map((e) => `${e.type === 'rendu' ? 'Rendu ' : ''}${modes.get(e.modePaiementId)} : ${fcfa(e.montant)}`),
      ...(casiers.length ? ['', ...casiers] : []),
      dusClient.length ? `Emballages à rapporter : ${dusClient.join(', ')}` : '',
      '',
      'Merci de votre visite !',
    ]
    return l.filter((x, i) => x !== '' || l[i - 1] !== '').join('\n').replace(/^\n+/, '')
  }

  async function annuler(puisRefaire: boolean) {
    setErreur('')
    try {
      await annulerVente(venteId)
      setConfirmer(false)
      if (puisRefaire && onRefaire) {
        // On recharge les produits actuels (avec leur prix du moment) dans la caisse.
        const articles = await db.articles.bulkGet(lignes.map((l) => l.articleId))
        onRefaire(lignes.flatMap((l, i) => (articles[i] ? [{ article: articles[i]!, quantite: l.quantite }] : [])))
      }
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  return (
    <div className="zone-ticket">
      <div className={`ticket ${annulePar ? 'ticket-annule' : ''}`}>
        <p className="ticket-titre">
          {boutique?.nom.toUpperCase() ?? 'MAQUIS'}
          {boutique?.adresse && <><br /><small>{boutique.adresse}</small></>}
          {boutique?.telephone && <><br /><small>Tél. {boutique.telephone}</small></>}
        </p>
        {estAnnulation && <p className="ticket-annulation">ANNULATION du ticket n° {original?.numero}</p>}
        {estRetour && <p className="ticket-annulation">RETOUR sur le ticket n° {original?.numero}</p>}
        <p>Ticket n° {vente.numero}<br />{new Date(vente.date).toLocaleString('fr-FR')}</p>
        {serveur && <p>Servi par : {serveur.nom}{vente.table && <> · Table {vente.table}</>}</p>}
        {client && <p>Client : {client.nom}</p>}
        <table>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td>{l.designation}<br /><small>{l.quantite} × {fcfa(l.prixUnitaire)}</small></td>
                <td>{fcfa(l.quantite * l.prixUnitaire)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ticket-total">TOTAL <span>{fcfa(vente.total)}</span></p>
        {encaissements.map((e) => (
          <p key={e.id} className="ticket-ligne">
            {e.type === 'rendu' ? 'Rendu ' : ''}{modes.get(e.modePaiementId)} <span>{fcfa(e.montant)}</span>
          </p>
        ))}
        {casiers.map((c) => <p key={c} className="ticket-ligne">{c}</p>)}
        {dusClient.length > 0 && <p><small>Emballages à rapporter : {dusClient.join(', ')}</small></p>}
        {annulePar && <p className="ticket-annulation">ANNULÉ (ticket n° {annulePar.numero})</p>}
        {retours.length > 0 && <p className="ticket-annulation">Retour(s) : ticket n° {retours.map((r) => r.numero).join(', ')}</p>}
        {!estAnnulation && !estRetour && <p className="ticket-merci">Merci de votre visite !</p>}
      </div>

      {erreur && <p className="erreurs">{erreur}</p>}

      {retour ? (
        <div className="confirmation sans-impression">
          <p><strong>Retour de produits</strong> : indique combien le client rapporte. Le stock revient et l'argent lui est rendu.</p>
          <table className="tableau-simple">
            <tbody>
              {lignes.map((l) => {
                const max = l.quantite - (dejaRetourne.get(l.articleId) ?? 0)
                return (
                  <tr key={l.id}>
                    <td>{l.designation}<br /><small>acheté {l.quantite}{dejaRetourne.get(l.articleId) ? `, déjà rendu ${dejaRetourne.get(l.articleId)}` : ''}</small></td>
                    <td><input className="petit" inputMode="numeric" disabled={max <= 0} placeholder={`0 à ${max}`}
                      value={retour[l.articleId] ?? ''} onChange={(e) => setRetour({ ...retour, [l.articleId]: e.target.value })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <label className="recu">Rembourser en
            <select value={modeRetour || modesRetour[0]?.id} onChange={(e) => setModeRetour(e.target.value)}>
              {modesRetour.map((m) => <option key={m.id} value={m.id}>{m.nature === 'credit' ? 'Déduire de sa dette (crédit)' : m.nom}</option>)}
            </select>
          </label>
          <div className="boutons">
            <button onClick={() => setRetour(null)}>Fermer</button>
            <button className="principal" onClick={validerRetour}>Valider le retour</button>
          </div>
        </div>
      ) : confirmer ? (
        <div className="confirmation sans-impression">
          <p>
            Annuler le ticket n° {vente.numero} ({fcfa(vente.total)}) ? Les produits reviennent en stock
            et le montant est compté comme rendu au client. Le ticket reste visible, marqué « annulé ».
          </p>
          <div className="boutons">
            <button onClick={() => setConfirmer(false)}>Non, garder</button>
            <button className="danger" onClick={() => annuler(false)}>Annuler le ticket</button>
            {onRefaire && <button className="principal" onClick={() => annuler(true)}>Annuler et refaire</button>}
          </div>
        </div>
      ) : (
        <div className="boutons sans-impression">
          <button onClick={() => window.print()}><Printer size={18} /> Imprimer</button>
          <button onClick={() => ouvrirWhatsApp(texteTicket(), client?.telephone)}><MessageCircle size={18} /> WhatsApp</button>
          {peutRetourner && <button onClick={() => { setErreur(''); setRetour({}) }}>Retour de produits…</button>}
          {peutRetourner && retours.length === 0 && <button className="danger" onClick={() => setConfirmer(true)}>Annuler ce ticket…</button>}
          {onNouvelleVente && <button className="principal" onClick={onNouvelleVente}>Nouvelle vente</button>}
        </div>
      )}
    </div>
  )
}
