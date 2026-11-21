import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessageCircle } from 'lucide-react'
import { db } from '../db/base'
import { bilansJournee, cloturer, debutJournee, type BilanServeur } from '../db/cloture'
import { journeeDe, nomJournee } from '../db/journee'
import { fcfa, lireEntier } from '../outils/format'
import { ouvrirWhatsApp } from '../outils/whatsapp'

// Écran Clôture de caisse : en fin de service, chaque serveur remet ses espèces.
// L'application calcule ce qu'il doit remettre (espèces encaissées moins rendues),
// on saisit ce qu'il remet, et l'écart est enregistré (jamais modifié ensuite).
export default function Cloture() {
  const [journee, setJournee] = useState<string | null>(null)
  useEffect(() => { debutJournee().then((h) => setJournee(journeeDe(new Date(), h))) }, [])
  const bilans = useLiveQuery(() => (journee ? bilansJournee(journee) : undefined), [journee])
  const boutique = useLiveQuery(() => db.boutique.get('principale'), [])
  if (!journee || !bilans) return <p>Chargement…</p>

  const total = (f: (b: BilanServeur) => number) => bilans.reduce((x, b) => x + f(b), 0)
  const ecartTotal = bilans.flatMap((b) => b.clotures).reduce((x, c) => x + c.ecart, 0)

  function resumeWhatsApp() {
    if (!bilans) return
    const lignes = [
      `*${boutique?.nom ?? 'Maquis'}* — Clôture du ${nomJournee(journee!)}`,
      '',
      ...bilans.map((b) => {
        const remis = b.clotures.reduce((x, c) => x + c.remis, 0)
        const ecart = b.clotures.reduce((x, c) => x + c.ecart, 0)
        return `*${b.nom}* : ${b.tickets} ticket(s), CA ${fcfa(b.chiffreAffaires)}\n   Espèces attendues ${fcfa(b.especes)}, remises ${fcfa(remis)}${ecart ? `, écart ${fcfa(ecart)}` : ''}${b.attendu ? ` (reste à clôturer ${fcfa(b.attendu)})` : ''}\n   Mobile money ${fcfa(b.mobileMoney)} · Crédit ${fcfa(b.credit)}${b.remboursements ? `\n   Dont crédits remboursés ${fcfa(b.remboursements)}` : ''}`
      }),
      '',
      `Total CA : ${fcfa(total((b) => b.chiffreAffaires))}`,
      `Écart total : ${fcfa(ecartTotal)}`,
    ]
    ouvrirWhatsApp(lignes.join('\n'))
  }

  return (
    <section>
      <div className="entete-ecran"><h2>Clôture de caisse</h2></div>
      <div className="carte">
        <label className="choix-journee">
          Journée
          <input type="date" value={journee} onChange={(e) => e.target.value && setJournee(e.target.value)} />
        </label>
        <p className="info">
          Journée du {nomJournee(journee)}, de {boutique?.debutJournee ?? 6} h jusqu'au lendemain même heure
          (une vente faite à 2 h du matin compte dans la soirée de la veille).
        </p>
        <div className="resume-jour">
          <div><small>Chiffre d'affaires</small><strong>{fcfa(total((b) => b.chiffreAffaires))}</strong></div>
          <div><small>Espèces</small><strong>{fcfa(total((b) => b.especes))}</strong></div>
          <div><small>Mobile money</small><strong>{fcfa(total((b) => b.mobileMoney))}</strong></div>
          <div><small>Crédit</small><strong>{fcfa(total((b) => b.credit))}</strong></div>
          <div><small>Écart des clôtures</small><strong className={ecartTotal < 0 ? 'alerte' : ''}>{fcfa(ecartTotal)}</strong></div>
        </div>
        {bilans.length > 0 && <button onClick={resumeWhatsApp}><MessageCircle size={18} /> Envoyer le résumé par WhatsApp</button>}
      </div>

      {bilans.length === 0 && <p className="info">Aucun serveur. Ajoute-les dans l'écran Serveurs.</p>}
      {bilans.map((b) => <CarteServeur key={b.serveurId} journee={journee} bilan={b} />)}
    </section>
  )
}

function CarteServeur({ journee, bilan: b }: { journee: string; bilan: BilanServeur }) {
  const [remis, setRemis] = useState('')
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState('')
  const [confirmer, setConfirmer] = useState(false)
  const montant = lireEntier(remis)
  const ecart = montant !== null && !Number.isNaN(montant) ? montant - b.attendu : null

  async function valider() {
    setErreur('')
    try {
      await cloturer(journee, b.serveurId, montant ?? NaN, note)
      setRemis(''); setNote(''); setConfirmer(false)
    } catch (x) { setErreur((x as Error).message); setConfirmer(false) }
  }

  const aFaire = b.attendu !== 0 || (b.tickets > 0 && b.clotures.length === 0)
  return (
    <div className="carte carte-cloture">
      <div className="entete-ecran">
        <strong>{b.nom}</strong>
        <span className="info">{b.tickets} ticket(s) · {fcfa(b.chiffreAffaires)}</span>
      </div>
      <div className="resume-jour">
        <div><small>Espèces encaissées</small><strong>{fcfa(b.especes)}</strong></div>
        <div><small>Mobile money</small><strong>{fcfa(b.mobileMoney)}</strong></div>
        <div><small>Crédit</small><strong>{fcfa(b.credit)}</strong></div>
      </div>
      {b.remboursements > 0 && <p className="info">Dont {fcfa(b.remboursements)} de crédits remboursés par des clients.</p>}

      {b.clotures.map((c) => (
        <p key={c.id} className={c.ecart < 0 ? 'alerte' : 'succes'}>
          Clôturé à {new Date(c.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} :
          attendu {fcfa(c.attendu)}, remis {fcfa(c.remis)}
          {c.ecart === 0 ? ' — compte juste' : c.ecart < 0 ? ` — manque ${fcfa(-c.ecart)}` : ` — surplus ${fcfa(c.ecart)}`}
          {c.note && <><br /><small>{c.note}</small></>}
        </p>
      ))}

      {aFaire ? (
        <>
          <p><strong>Espèces à remettre : {fcfa(b.attendu)}</strong>{b.dejaCloture ? <small> (en plus des {fcfa(b.dejaCloture)} déjà clôturés)</small> : null}</p>
          <div className="deux">
            <label>Espèces remises<input inputMode="numeric" value={remis} onChange={(e) => { setRemis(e.target.value); setConfirmer(false) }} placeholder={String(b.attendu)} /></label>
            <label>Remarque (facultatif)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. billet abîmé" /></label>
          </div>
          {ecart !== null && (
            <p className={ecart < 0 ? 'alerte' : ecart > 0 ? 'info' : 'succes'}>
              {ecart === 0 ? 'Le compte est juste.' : ecart < 0 ? `Il manque ${fcfa(-ecart)}.` : `Surplus de ${fcfa(ecart)}.`}
            </p>
          )}
          {erreur && <p className="erreurs">{erreur}</p>}
          {confirmer ? (
            <div className="boutons gauche">
              <span className="info">La clôture ne pourra plus être modifiée. Confirmer ?</span>
              <button onClick={() => setConfirmer(false)}>Non</button>
              <button className="principal" onClick={valider}>Oui, clôturer</button>
            </div>
          ) : (
            <div className="boutons gauche"><button className="principal" disabled={remis.trim() === ''} onClick={() => setConfirmer(true)}>Clôturer {b.nom}</button></div>
          )}
        </>
      ) : (
        <p className="info">{b.clotures.length ? 'Rien de nouveau depuis la dernière clôture.' : 'Aucune vente pour cette journée.'}</p>
      )}
    </div>
  )
}
