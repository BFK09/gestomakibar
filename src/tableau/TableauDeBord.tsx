import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { debutDuJour, etatDuStock, resumePeriode, ventesSeptJours } from '../db/statistiques'
import { fcfa } from '../outils/format'

type Periode = 'jour' | 'semaine' | 'mois'
const NOMS: Record<Periode, string> = { jour: "Aujourd'hui", semaine: '7 derniers jours', mois: 'Ce mois-ci' }

// Calcule le début de la période choisie ; la fin est toujours demain à 0 h.
function bornes(p: Periode) {
  const fin = debutDuJour(); fin.setDate(fin.getDate() + 1)
  const debut = debutDuJour()
  if (p === 'semaine') debut.setDate(debut.getDate() - 6)
  if (p === 'mois') debut.setDate(1)
  return [debut.toISOString(), fin.toISOString()] as const
}

export default function TableauDeBord({ onVoirCatalogue }: { onVoirCatalogue: () => void }) {
  const [periode, setPeriode] = useState<Periode>('jour')
  const resume = useLiveQuery(() => resumePeriode(...bornes(periode)), [periode])
  const jours = useLiveQuery(() => ventesSeptJours(), [])
  const stock = useLiveQuery(() => etatDuStock(), [])
  if (!resume || !jours || !stock) return <p>Chargement…</p>

  const max = Math.max(...jours.map((j) => j.montant), 1)
  const tauxMarge = resume.chiffreAffaires ? Math.round((resume.marge / resume.chiffreAffaires) * 100) : 0

  return (
    <section className="tableau">
      <div className="entete-ecran"><h2>Tableau de bord</h2></div>

      <div className="onglets">
        {(Object.keys(NOMS) as Periode[]).map((p) => (
          <button key={p} className={periode === p ? 'choisi' : ''} onClick={() => setPeriode(p)}>{NOMS[p]}</button>
        ))}
      </div>

      <div className="tuiles">
        <div className="tuile"><small>Chiffre d'affaires</small><strong>{fcfa(resume.chiffreAffaires)}</strong></div>
        <div className="tuile"><small>Marge</small><strong>{fcfa(resume.marge)}</strong><small>{tauxMarge} % des ventes</small></div>
        <div className="tuile"><small>Tickets</small><strong>{resume.tickets}</strong></div>
        <div className="tuile"><small>Panier moyen</small><strong>{fcfa(resume.panierMoyen)}</strong></div>
      </div>

      <div className="carte">
        <strong>Encaissements par mode de paiement</strong>
        <table className="tableau-simple">
          <tbody>
            {resume.parMode.map((m) => (
              <tr key={m.nom}><td>{m.nom}</td><td>{fcfa(m.montant)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="info">« Crédit » = montant vendu à crédit, pas encore encaissé.</p>
        {resume.remboursements > 0 && <p className="info">Remboursements de crédit reçus sur la période : <strong>{fcfa(resume.remboursements)}</strong></p>}
      </div>

      <div className="carte">
        <strong>Ventes des 7 derniers jours</strong>
        <div className="histogramme" role="img" aria-label="Chiffre d'affaires par jour sur 7 jours">
          {jours.map((j) => {
            const nom = j.jour.toLocaleDateString('fr-FR', { weekday: 'short' })
            const titre = `${j.jour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${fcfa(j.montant)}`
            return (
              <div className="colonne" key={j.jour.toISOString()} tabIndex={0}>
                <span className="info-bulle">{titre}</span>
                <div className="barre-zone">
                  <div className="barre-valeur" style={{ height: `${Math.max((j.montant / max) * 100, j.montant > 0 ? 2 : 0)}%` }} />
                </div>
                <small>{nom}</small>
              </div>
            )
          })}
        </div>
        <details>
          <summary>Voir les chiffres</summary>
          <table className="tableau-simple">
            <tbody>
              {jours.map((j) => (
                <tr key={j.jour.toISOString()}><td>{j.jour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</td><td>{fcfa(j.montant)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="carte">
        <strong>Meilleurs produits ({NOMS[periode].toLowerCase()})</strong>
        {resume.meilleurs.length === 0 ? <p className="info">Aucune vente sur cette période.</p> : (
          <table className="tableau-simple">
            <tbody>
              {resume.meilleurs.map((m) => (
                <tr key={m.designation}><td>{m.designation}</td><td>{m.quantite} vendu(s)</td><td>{fcfa(m.montant)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="carte">
        <strong>Alertes de stock</strong>
        {stock.alertes.length === 0 ? (
          <p className="info">Aucun produit sous son seuil d'alerte.</p>
        ) : (
          <table className="tableau-simple">
            <tbody>
              {stock.alertes.map((a) => (
                <tr key={a.code}>
                  <td><span className="code">{a.code}</span> {a.designation}</td>
                  <td className="alerte">⚠ {a.stock < 0 ? `stock négatif (${a.stock})` : `reste ${a.stock}`}</td>
                  <td>{a.seuil !== null ? `seuil ${a.seuil}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {stock.sansSeuil > 0 && (
          <p className="info">
            {stock.sansSeuil} produit(s) n'ont pas de seuil d'alerte et ne seront jamais signalés.{' '}
            <button className="lien-bouton" onClick={onVoirCatalogue}>Les régler dans le Catalogue</button>
          </p>
        )}
        <p className="info">Valeur du stock (au prix d'achat) : <strong>{fcfa(stock.valeurAchat)}</strong></p>
      </div>
    </section>
  )
}
