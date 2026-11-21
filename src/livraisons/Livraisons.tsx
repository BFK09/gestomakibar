import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listeLivraisons, marquerLivree } from '../db/livraisons'
import { fcfa } from '../outils/format'
import { lienWhatsApp } from '../outils/whatsapp'

// Écran Livraisons (mode dépôt) : les commandes à apporter chez les clients, et celles déjà livrées.
export default function Livraisons() {
  const liste = useLiveQuery(() => listeLivraisons(), [])
  const [livreur, setLivreur] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState('')
  if (!liste) return <p>Chargement…</p>
  const aFaire = liste.filter((l) => l.statut === 'a_livrer')
  const faites = liste.filter((l) => l.statut === 'livree').reverse().slice(0, 30)

  async function livree(id: string) {
    setErreur('')
    try { await marquerLivree(id, livreur[id] ?? '') } catch (x) { setErreur((x as Error).message) }
  }

  return (
    <section>
      <div className="entete-ecran"><h2>Livraisons</h2></div>
      {erreur && <p className="erreurs">{erreur}</p>}
      <div className="carte">
        <strong>À livrer ({aFaire.length})</strong>
        {aFaire.length === 0 && <p className="info">Aucune livraison en attente. Pour en créer une, coche « À livrer chez le client » au moment de la vente.</p>}
        {aFaire.map((l) => (
          <div className="livraison" key={l.id}>
            <div className="entete-ecran">
              <span><strong>{l.client}</strong> · ticket n° {l.numero}</span>
              <span>{fcfa(l.total)}</span>
            </div>
            <p>{l.adresse}{l.note && <><br /><small>{l.note}</small></>}<br /><small>Commandé le {new Date(l.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small></p>
            <div className="boutons gauche">
              <input value={livreur[l.id] ?? ''} onChange={(e) => setLivreur({ ...livreur, [l.id]: e.target.value })} placeholder="Livreur (facultatif)" />
              {l.telephoneClient && <a className="bouton" href={`tel:${l.telephoneClient}`}>Appeler</a>}
              {l.telephoneClient && <a className="bouton" href={lienWhatsApp(`Bonjour ${l.client}, votre commande (ticket n° ${l.numero}, ${fcfa(l.total)}) est en route.`, l.telephoneClient)} target="_blank" rel="noreferrer">WhatsApp</a>}
              <button className="principal" onClick={() => livree(l.id)}>Livrée</button>
            </div>
          </div>
        ))}
      </div>
      {faites.length > 0 && (
        <div className="carte">
          <strong>Déjà livrées</strong>
          <table className="tableau-simple"><tbody>
            {faites.map((l) => (
              <tr key={l.id}><td>{l.client} · n° {l.numero}<br /><small>{l.adresse}</small></td><td>{l.livreeLe && new Date(l.livreeLe).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}{l.livreur && <><br /><small>{l.livreur}</small></>}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </section>
  )
}
