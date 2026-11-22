import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db } from '../db/base'
import { debutJournee } from '../db/cloture'
import { bornesJournee, journeeDe } from '../db/journee'
import { ajouterDepense, CATEGORIES_DEPENSES, depensesEntre, peutSupprimerDepense, supprimerDepense, totalDepenses } from '../db/depenses'
import { fcfa, lireEntier } from '../outils/format'
import { monnaie } from '../outils/pays'
import { useAcces } from '../acces/acces'

type Periode = 'jour' | 'mois' | 'annee'
const NOMS: Record<Periode, string> = { jour: "Aujourd'hui", mois: 'Ce mois-ci', annee: 'Cette année' }

// Bornes d'une période en journées commerciales (comme le tableau de bord et la clôture).
function bornes(p: Periode, heure: number) {
  const journee = journeeDe(new Date(), heure)
  const { au } = bornesJournee(journee, heure)
  const [a, m] = journee.split('-')
  const premier = p === 'jour' ? journee : p === 'mois' ? `${a}-${m}-01` : `${a}-01-01`
  return { du: bornesJournee(premier, heure).du, au, journee }
}

// Dépenses : loyer, électricité, glace… Le gérant les saisit, mais seul le patron voit les totaux.
export default function Depenses() {
  const acces = useAcces()
  const patron = acces.voitCouts
  const [periode, setPeriode] = useState<Periode>('jour')
  const [categorie, setCategorie] = useState('')
  const [montant, setMontant] = useState('')
  const [serveurId, setServeurId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('') // vide = maintenant
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')

  const d = useLiveQuery(async () => {
    const heure = await debutJournee()
    const b = bornes(patron ? periode : 'jour', heure)
    const liste = (await depensesEntre(b.du, b.au)).sort((x, y) => y.date.localeCompare(x.date))
    const supprimables = new Set<string>()
    for (const x of liste) if (await peutSupprimerDepense(x)) supprimables.add(x.id)
    const serveurs = await db.serveurs.orderBy('nom').toArray()
    return { liste, supprimables, serveurs, journee: b.journee }
  }, [periode, patron])
  if (!d) return <p>Chargement…</p>

  const nomServeur = new Map(d.serveurs.map((s) => [s.id, s.nom]))
  const actifs = d.serveurs.filter((s) => s.actif)
  const autreJour = !!date && date !== d.journee
  const parCategorie = Object.entries(d.liste.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.categorie]: (acc[x.categorie] ?? 0) + x.montant }), {}))
    .sort((a, b) => b[1] - a[1])

  async function enregistrer() {
    setErreur(''); setMessage('')
    try {
      const m = lireEntier(montant)
      // Une dépense d'un autre jour est rangée à midi ce jour-là ; elle ne touche pas la caisse d'un serveur.
      const iso = autreJour ? new Date(`${date}T12:00:00`).toISOString() : undefined
      const x = await ajouterDepense({ categorie, montant: m ?? NaN, serveurId: autreJour ? undefined : serveurId, note, saisiPar: acces.utilisateur?.nom, date: iso })
      setMessage(`Dépense enregistrée : ${x.categorie}, ${fcfa(x.montant)}${x.serveurId ? `, retirée des espèces de ${nomServeur.get(x.serveurId)}` : ''}.`)
      setMontant(''); setNote(''); setCategorie(''); setServeurId(''); setDate('')
    } catch (e) { setErreur((e as Error).message) }
  }

  async function supprimer(id: string) {
    setErreur(''); setMessage('')
    try { await supprimerDepense(id); setMessage('Dépense supprimée.') } catch (e) { setErreur((e as Error).message) }
  }

  return (
    <section>
      <div className="entete-ecran"><h2>Dépenses</h2></div>
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}

      <div className="carte">
        <strong>Nouvelle dépense</strong>
        <div className="puces envelopper">
          {CATEGORIES_DEPENSES.map((c) => <button key={c} className={categorie === c ? 'choisi' : ''} onClick={() => setCategorie(c)}>{c}</button>)}
        </div>
        <div className="deux">
          <label>Montant<input inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder={monnaie()} /></label>
          {patron && <label>Date<input type="date" value={date || d.journee} max={d.journee} onChange={(e) => setDate(e.target.value)} /></label>}
        </div>
        {!autreJour && (
          <label>
            Payée avec
            <select value={serveurId} onChange={(e) => setServeurId(e.target.value)}>
              <option value="">Hors caisse (argent du patron)</option>
              {actifs.map((s) => <option key={s.id} value={s.id}>Les espèces de {s.nom}</option>)}
            </select>
            {serveurId && <small className="info">Ce montant sera retiré de ce que {nomServeur.get(serveurId)} doit remettre à la clôture.</small>}
          </label>
        )}
        <label>Précision (facultatif)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. 2 sacs de glace" /></label>
        <div className="boutons gauche"><button className="principal" onClick={enregistrer}>Enregistrer la dépense</button></div>
        <p className="info">Les achats de boissons ne sont pas des dépenses : ils passent par Réception.</p>
      </div>

      {patron && (
        <div className="onglets">
          {(Object.keys(NOMS) as Periode[]).map((p) => <button key={p} className={periode === p ? 'choisi' : ''} onClick={() => setPeriode(p)}>{NOMS[p]}</button>)}
        </div>
      )}

      {patron && d.liste.length > 0 && (
        <div className="carte">
          <div className="tuiles"><div className="tuile"><small>Total des dépenses</small><strong>{fcfa(totalDepenses(d.liste))}</strong></div></div>
          <table className="tableau-simple">
            <tbody>{parCategorie.map(([c, m]) => <tr key={c}><td>{c}</td><td>{fcfa(m)}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      <div className="carte">
        <strong>{patron ? `Détail, ${NOMS[periode].toLowerCase()}` : "Dépenses saisies aujourd'hui"}</strong>
        {d.liste.length === 0 ? <p className="info">Aucune dépense.</p> : (
          <table className="tableau-simple">
            <tbody>
              {d.liste.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.categorie}{x.note && <small> · {x.note}</small>}
                    <br /><small>{new Date(x.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {x.serveurId && <> · espèces de {nomServeur.get(x.serveurId)}</>}{x.saisiPar && <> · saisie par {x.saisiPar}</>}</small>
                  </td>
                  <td>{fcfa(x.montant)}</td>
                  <td>{d.supprimables.has(x.id) && <button className="icone-seule" aria-label="Supprimer" onClick={() => supprimer(x.id)}><Trash2 size={18} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
