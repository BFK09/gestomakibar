import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { etatDuStock, resumePeriode, ventesSeptJours } from '../db/statistiques'
import { fcfa } from '../outils/format'
import { bilansJournee, debutJournee } from '../db/cloture'
import { bornesJournee, journeeDe } from '../db/journee'
import { useAcces } from '../acces/acces'

type Periode = 'jour' | 'semaine' | 'mois'
const NOMS: Record<Periode, string> = { jour: "Aujourd'hui", semaine: '7 derniers jours', mois: 'Ce mois-ci' }

// Bornes de la période choisie, en journées commerciales (de l'heure de début à la même heure
// le lendemain), comme la clôture de caisse : les deux écrans donnent donc les mêmes chiffres.
function bornes(p: Periode, heure: number) {
  const journee = journeeDe(new Date(), heure)
  const { au } = bornesJournee(journee, heure)
  const [a, m, j] = journee.split('-').map(Number)
  const premier = p === 'jour' ? new Date(a, m - 1, j) : p === 'semaine' ? new Date(a, m - 1, j - 6) : new Date(a, m - 1, 1)
  const cle = `${premier.getFullYear()}-${String(premier.getMonth() + 1).padStart(2, '0')}-${String(premier.getDate()).padStart(2, '0')}`
  return [bornesJournee(cle, heure).du, au] as const
}

export default function TableauDeBord({ onVoirCatalogue }: { onVoirCatalogue: () => void }) {
  const [periode, setPeriode] = useState<Periode>('jour')
  const { voitCouts } = useAcces()
  const resume = useLiveQuery(async () => resumePeriode(...bornes(periode, await debutJournee())), [periode])
  const jours = useLiveQuery(async () => ventesSeptJours(await debutJournee()), [])
  const stock = useLiveQuery(() => etatDuStock(), [])
  // Ventes de la journée commerciale en cours, serveur par serveur.
  const serveurs = useLiveQuery(async () => bilansJournee(journeeDe(new Date(), await debutJournee())), [])
  if (!resume || !jours || !stock || !serveurs) return <p>Chargement…</p>

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
        {voitCouts && <div className="tuile"><small>Marge</small><strong>{fcfa(resume.marge)}</strong><small>{tauxMarge} % des ventes</small></div>}
        <div className="tuile"><small>Tickets</small><strong>{resume.tickets}</strong></div>
        <div className="tuile"><small>Panier moyen</small><strong>{fcfa(resume.panierMoyen)}</strong></div>
      </div>

      <div className="carte">
        <strong>Encaissements par mode de paiement</strong>
        <table className="tableau-simple">
          <tbody>
            {resume.parMode.map((m) => (
              <tr key={m.nom}><td>{m.nom}{m.remboursements > 0 && <small> (dont {fcfa(m.remboursements)} de crédits remboursés)</small>}{m.consignes !== 0 && <small> ({m.consignes > 0 ? 'dont' : 'moins'} {fcfa(Math.abs(m.consignes))} de consignes)</small>}</td><td>{fcfa(m.montant)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="info">Ventes, crédits remboursés et consignes, comme à la clôture de caisse. « Crédit » = montant vendu à crédit, pas encore encaissé.{resume.remboursements > 0 && <> Crédits remboursés sur la période : <strong>{fcfa(resume.remboursements)}</strong>.</>}</p>
      </div>

      {serveurs.some((b) => b.tickets > 0) && (
        <div className="carte">
          <strong>Serveurs, journée en cours</strong>
          <table className="tableau-simple">
            <tbody>
              {serveurs.filter((b) => b.tickets > 0 || b.especes !== 0).map((b) => (
                <tr key={b.serveurId}><td>{b.nom} ({b.tickets} ticket{b.tickets > 1 ? 's' : ''})</td><td>{fcfa(b.chiffreAffaires)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="info">Espèces encore à remettre : <strong>{fcfa(serveurs.reduce((x, b) => x + b.attendu, 0))}</strong> (voir Clôture).</p>
        </div>
      )}

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
            {stock.sansSeuil} produit(s) utilisent le seuil par défaut (un casier, ou 10).{' '}
            <button className="lien-bouton" onClick={onVoirCatalogue}>Régler les seuils dans Produits</button>
          </p>
        )}
        {voitCouts && <p className="info">Valeur du stock (au prix d'achat) : <strong>{fcfa(stock.valeurAchat)}</strong></p>}
      </div>
    </section>
  )
}
