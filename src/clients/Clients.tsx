import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { debutDeLaDette, DELAI_RELANCE, dettesParClient, joursDepuis } from '../db/clients'
import { fcfa } from '../outils/format'
import { sansAccents } from '../outils/texte'
import FicheClient from './FicheClient'

// Écran Clients : la liste des clients avec ce que chacun doit.
export default function Clients() {
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'dettes' | 'relance'>('tous')
  const [ouvert, setOuvert] = useState<string | null>(null) // id, 'nouveau' ou null

  const clients = useLiveQuery(() => db.clients.orderBy('nom').toArray(), [])
  const dettes = useLiveQuery(() => dettesParClient(), [])
  // Ancienneté de la dette de chaque client qui doit (en jours).
  const anciennete = useLiveQuery(async () => {
    const m = new Map<string, number>()
    for (const [id, d] of await dettesParClient()) {
      if (d <= 0) continue
      const depuis = await debutDeLaDette(id)
      if (depuis) m.set(id, joursDepuis(depuis))
    }
    return m
  }, [])
  if (!clients || !dettes || !anciennete) return <p>Chargement…</p>
  if (ouvert) return <FicheClient clientId={ouvert} onFermer={() => setOuvert(null)} />

  const texte = sansAccents(recherche.trim())
  const visibles = clients.filter((c) =>
    (!texte || sansAccents(`${c.nom} ${c.telephone ?? ''}`).includes(texte)) &&
    (filtre === 'tous' || (dettes.get(c.id) ?? 0) > 0) &&
    (filtre !== 'relance' || (anciennete.get(c.id) ?? 0) >= DELAI_RELANCE))
    .sort((a, b) => (filtre === 'tous' ? 0 : (anciennete.get(b.id) ?? 0) - (anciennete.get(a.id) ?? 0)))
  const totalDettes = [...dettes.values()].reduce((s, d) => s + Math.max(d, 0), 0)
  const nbDebiteurs = [...dettes.values()].filter((d) => d > 0).length
  const nbRelance = [...anciennete.values()].filter((j) => j >= DELAI_RELANCE).length

  return (
    <section>
      <div className="entete-ecran">
        <h2>Crédits clients</h2>
        <button className="principal" onClick={() => setOuvert('nouveau')}>+ Nouveau client</button>
      </div>
      <div className="tuiles">
        <div className="tuile"><small>Total des crédits à recouvrer</small><strong>{fcfa(totalDettes)}</strong></div>
        <div className="tuile"><small>Clients qui doivent</small><strong>{nbDebiteurs}</strong></div>
        <button className={`tuile tuile-bouton ${nbRelance ? 'tuile-alerte' : ''}`} onClick={() => setFiltre('relance')}><small>À relancer (plus de {DELAI_RELANCE} jours)</small><strong>{nbRelance}</strong></button>
      </div>
      <div className="filtres">
        <input type="search" placeholder="Nom ou téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <div className="onglets">
          <button className={filtre === 'tous' ? 'choisi' : ''} onClick={() => setFiltre('tous')}>Tous</button>
          <button className={filtre === 'dettes' ? 'choisi' : ''} onClick={() => setFiltre('dettes')}>Qui doivent</button>
          <button className={filtre === 'relance' ? 'choisi' : ''} onClick={() => setFiltre('relance')}>À relancer</button>
        </div>
      </div>
      {visibles.length === 0 ? <p className="info">Aucun client. Les clients sont aussi créés automatiquement lors d'une vente à crédit.</p> : (
        <ul className="liste-articles">
          {visibles.map((c) => {
            const d = dettes.get(c.id) ?? 0
            const depasse = c.plafondCredit > 0 && d > c.plafondCredit
            return (
              <li key={c.id}>
                <button onClick={() => setOuvert(c.id)}>
                  <span className="code">{c.type === 'revendeur' ? 'Revendeur' : c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</span>
                  <span className="nom">{c.nom}<small>{c.telephone ?? 'Pas de téléphone'}{c.plafondCredit > 0 && ` · plafond ${fcfa(c.plafondCredit)}`}</small></span>
                  <span className="chiffres">
                    {d > 0 ? <strong className={depasse ? 'alerte' : ''}>doit {fcfa(d)}</strong> : <small>à jour</small>}
                    {d > 0 && anciennete.has(c.id) && <small className={(anciennete.get(c.id) ?? 0) >= DELAI_RELANCE ? 'alerte' : ''}>depuis {anciennete.get(c.id)} j</small>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
