import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Briefcase, Crown } from 'lucide-react'
import { db } from '../db/base'
import { activerProfils, desactiverProfils, enregistrerProfil, supprimerProfil } from '../db/profils'
import type { Profil } from '../db/types'

const DELAIS: [number, string][] = [[5, '5 min'], [10, '10 min'], [30, '30 min'], [0, 'Jamais']]

const chiffres = (v: string) => v.replace(/\D/g, '').slice(0, 4)

// Paramètres → Profils : codes PIN pour le patron, les gérants et (via l'écran Serveurs) les serveurs.
// Sans profils, l'application reste ouverte à tous, comme avant.
export default function Profils() {
  const d = useLiveQuery(async () => ({
    boutique: await db.boutique.get('principale'),
    profils: await db.profils.orderBy('nom').toArray(),
    serveursSansCode: (await db.serveurs.toArray()).filter((s) => s.actif && !s.code).length,
  }), [])
  if (!d?.boutique) return <p>Chargement…</p>
  const patron = d.profils.find((p) => p.role === 'patron')
  return d.boutique.profilsActifs
    ? <ProfilsActifs patron={patron!} gerants={d.profils.filter((p) => p.role === 'gerant')} verrou={d.boutique.verrouMinutes ?? 10} serveursSansCode={d.serveursSansCode} />
    : <Activation nomDepart={patron?.nom ?? ''} />
}

function Activation({ nomDepart }: { nomDepart: string }) {
  const [nom, setNom] = useState(nomDepart)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [secours, setSecours] = useState('')
  const [erreur, setErreur] = useState('')

  async function activer() {
    setErreur('')
    if (pin !== pin2) return setErreur('Les deux codes PIN ne sont pas pareils.')
    try { await activerProfils(nom, pin, secours) } catch (e) { setErreur((e as Error).message) }
  }

  return (
    <div className="carte">
      <strong>Profils avec code PIN</strong>
      <p className="info">
        Chacun se connecte avec son code à 4 chiffres. Le <strong>patron</strong> voit tout. Le <strong>gérant</strong> fait
        tourner la caisse, le stock et la clôture, sans voir les prix d'achat ni le bénéfice. Le <strong>serveur</strong> ne
        voit que la caisse et ses propres ventes.
      </p>
      <p className="info">Commence par créer le profil du patron (toi). Ensuite l'application demandera « Qui êtes-vous ? » à chaque ouverture.</p>
      <label>Nom du patron<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Franck" /></label>
      <div className="deux">
        <label>Code PIN (4 chiffres)<input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(chiffres(e.target.value))} /></label>
        <label>Retape le code<input type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={(e) => setPin2(chiffres(e.target.value))} /></label>
      </div>
      <label>
        Phrase de secours
        <input value={secours} onChange={(e) => setSecours(e.target.value)} placeholder="ex. le nom de mon premier maquis" />
        <small className="info">Si tu oublies ton code, cette phrase permet d'en choisir un nouveau. Note-la quelque part.</small>
      </label>
      {erreur && <p className="erreurs">{erreur}</p>}
      <div className="boutons gauche"><button className="principal" onClick={activer}>Activer les profils</button></div>
    </div>
  )
}

interface Edition { id: string | null; nom: string; pin: string; actif: boolean }

function ProfilsActifs({ patron, gerants, verrou, serveursSansCode }: { patron: Profil; gerants: Profil[]; verrou: number; serveursSansCode: number }) {
  const [edition, setEdition] = useState<Edition | null>(null)
  const [codePatron, setCodePatron] = useState<{ pin: string; secours: string } | null>(null)
  const [confirmer, setConfirmer] = useState(false)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')

  async function action(f: () => Promise<unknown>, texte: string) {
    setErreur(''); setMessage('')
    try { await f(); setMessage(texte); return true } catch (e) { setErreur((e as Error).message); return false }
  }

  return (
    <>
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}

      <div className="carte">
        <strong>Patron</strong>
        <p className="role-ligne"><Crown size={18} /> {patron.nom}</p>
        {codePatron ? (
          <>
            <label>Nouveau code PIN (vide = garder l'ancien)<input type="password" inputMode="numeric" maxLength={4} value={codePatron.pin} onChange={(e) => setCodePatron({ ...codePatron, pin: chiffres(e.target.value) })} /></label>
            <label>Nouvelle phrase de secours (vide = garder l'ancienne)<input value={codePatron.secours} onChange={(e) => setCodePatron({ ...codePatron, secours: e.target.value })} /></label>
            <div className="boutons gauche">
              <button onClick={() => setCodePatron(null)}>Annuler</button>
              <button className="principal" onClick={async () => {
                if (await action(() => enregistrerProfil(patron.id, patron.nom, 'patron', codePatron.pin, true, codePatron.secours || undefined), 'Profil du patron modifié.')) setCodePatron(null)
              }}>Enregistrer</button>
            </div>
          </>
        ) : (
          <div className="boutons gauche"><button onClick={() => setCodePatron({ pin: '', secours: '' })}>Changer mon code ou ma phrase de secours</button></div>
        )}
      </div>

      <div className="carte">
        <strong>Gérants</strong>
        <p className="info">Le gérant voit la caisse, le stock, les réceptions, la clôture et les rapports, mais ni les prix d'achat, ni la marge, ni le bénéfice.</p>
        {gerants.length === 0 && <p className="info">Aucun gérant pour l'instant.</p>}
        <ul className="liste-simple">
          {gerants.map((g) => (
            <li key={g.id}>
              <span className="role-ligne"><Briefcase size={18} /> {g.nom}{!g.actif && <small> (désactivé)</small>}</span>
              <button onClick={() => setEdition({ id: g.id, nom: g.nom, pin: '', actif: g.actif })}>Modifier</button>
            </li>
          ))}
        </ul>
        {edition ? (
          <div className="confirmation">
            <label>Nom<input value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} autoFocus /></label>
            <label>Code PIN (4 chiffres){edition.id && ' — vide = garder l’ancien'}<input type="password" inputMode="numeric" maxLength={4} value={edition.pin} onChange={(e) => setEdition({ ...edition, pin: chiffres(e.target.value) })} /></label>
            {edition.id && (
              <label className="case"><input type="checkbox" checked={edition.actif} onChange={(e) => setEdition({ ...edition, actif: e.target.checked })} />Profil actif (décocher pour bloquer ce gérant)</label>
            )}
            <div className="boutons gauche">
              <button onClick={() => setEdition(null)}>Annuler</button>
              {edition.id && <button className="danger" onClick={async () => { if (await action(() => supprimerProfil(edition.id!), `Profil « ${edition.nom} » supprimé.`)) setEdition(null) }}>Supprimer</button>}
              <button className="principal" onClick={async () => {
                if (await action(() => enregistrerProfil(edition.id, edition.nom, 'gerant', edition.pin, edition.actif), `Profil « ${edition.nom.trim()} » enregistré.`)) setEdition(null)
              }}>Enregistrer</button>
            </div>
          </div>
        ) : (
          <div className="boutons gauche"><button onClick={() => { setMessage(''); setErreur(''); setEdition({ id: null, nom: '', pin: '', actif: true }) }}>Ajouter un gérant</button></div>
        )}
      </div>

      <div className="carte">
        <strong>Serveurs</strong>
        <p className="info">Les serveurs se connectent avec le code à 4 chiffres donné dans l'écran Serveurs. Ils ne voient que la caisse et leurs propres ventes.</p>
        {serveursSansCode > 0 && <p className="erreurs">{serveursSansCode} serveur(s) actif(s) n'ont pas de code : ils ne peuvent pas se connecter.</p>}
      </div>

      <div className="carte">
        <strong>Verrouillage automatique</strong>
        <p className="info">Sans toucher l'écran pendant ce temps, l'application revient à « Qui êtes-vous ? ».</p>
        <div className="onglets">
          {DELAIS.map(([m, nom]) => (
            <button key={m} className={verrou === m ? 'choisi' : ''} onClick={() => db.boutique.update('principale', { verrouMinutes: m })}>{nom}</button>
          ))}
        </div>
      </div>

      <div className="carte">
        <strong>Désactiver les profils</strong>
        <p className="info">L'application redevient ouverte à tous, sans code. Les profils restent enregistrés pour plus tard.</p>
        {confirmer ? (
          <div className="boutons gauche">
            <button onClick={() => setConfirmer(false)}>Non, garder</button>
            <button className="danger" onClick={() => desactiverProfils()}>Oui, désactiver</button>
          </div>
        ) : (
          <div className="boutons gauche"><button onClick={() => setConfirmer(true)}>Désactiver les profils…</button></div>
        )}
      </div>
    </>
  )
}
