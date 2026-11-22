import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Crown, Briefcase, UserRound } from 'lucide-react'
import { db } from '../db/base'
import { nouveauPinParSecours, verifierPin } from '../db/profils'
import type { Utilisateur } from './acces'

const LOGO = `${import.meta.env.BASE_URL}icone.svg`

interface Choix { utilisateur: Utilisateur; verifier: (pin: string) => Promise<boolean> }

// « Qui êtes-vous ? » : écran affiché à l'ouverture quand les profils sont activés.
// On touche son nom, puis on tape son code PIN à 4 chiffres.
export default function Connexion({ nomBoutique, onConnecte }: { nomBoutique: string; onConnecte: (u: Utilisateur) => void }) {
  const [enAttente, setEnAttente] = useState<Choix | null>(null)
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [oubli, setOubli] = useState(false)
  const [secours, setSecours] = useState('')
  const [nouveau, setNouveau] = useState('')

  const d = useLiveQuery(async () => {
    const profils = (await db.profils.toArray()).filter((p) => p.actif)
    const serveurs = (await db.serveurs.orderBy('nom').toArray()).filter((s) => s.actif && s.code)
    return { profils, serveurs }
  }, [])
  if (!d) return null

  const ordre = { patron: 0, gerant: 1 }
  const choix: (Choix & { icone: typeof Crown; libelle: string })[] = [
    ...d.profils.sort((a, b) => ordre[a.role] - ordre[b.role] || a.nom.localeCompare(b.nom)).map((p) => ({
      utilisateur: { role: p.role, id: p.id, nom: p.nom } as Utilisateur,
      verifier: (x: string) => verifierPin(p, x),
      icone: p.role === 'patron' ? Crown : Briefcase,
      libelle: p.role === 'patron' ? 'Patron' : 'Gérant',
    })),
    ...d.serveurs.map((s) => ({
      utilisateur: { role: 'serveur', id: s.id, nom: s.nom } as Utilisateur,
      verifier: async (x: string) => x === s.code,
      icone: UserRound,
      libelle: 'Serveur',
    })),
  ]

  async function taper(valeur: string) {
    setPin(valeur); setErreur('')
    if (valeur.length < 4) return
    if (await enAttente!.verifier(valeur)) onConnecte(enAttente!.utilisateur)
    else { setErreur('Code incorrect.'); setPin('') }
  }

  async function reinitialiser() {
    try {
      const p = await nouveauPinParSecours(secours, nouveau)
      onConnecte({ role: 'patron', id: p.id, nom: p.nom })
    } catch (e) { setErreur((e as Error).message) }
  }

  return (
    <div className="connexion">
      <img className="logo-connexion" src={LOGO} alt="" />
      <h1>{nomBoutique}</h1>
      {!enAttente ? (
        <>
          <p className="info">Qui êtes-vous ?</p>
          <div className="grille-serveurs">
            {choix.map((c) => (
              <button key={c.utilisateur.id} onClick={() => { setEnAttente(c); setPin(''); setErreur(''); setOubli(false) }}>
                <c.icone size={26} />
                <span>{c.utilisateur.nom}</span>
                <small>{c.libelle}</small>
              </button>
            ))}
          </div>
          {d.serveurs.length === 0 && <p className="info">Un serveur sans code ne peut pas se connecter : le patron lui donne un code dans l’écran Serveurs.</p>}
        </>
      ) : !oubli ? (
        <div className="carte choix-serveur">
          <p><strong>{enAttente.utilisateur.nom}</strong>, tape ton code :</p>
          <input className="code-serveur" type="password" inputMode="numeric" maxLength={4} autoFocus value={pin} onChange={(e) => taper(e.target.value.replace(/\D/g, ''))} aria-label="Code PIN" />
          {erreur && <p className="erreurs">{erreur}</p>}
          <div className="boutons">
            <button onClick={() => setEnAttente(null)}>Retour</button>
            {enAttente.utilisateur.role === 'patron' && <button className="lien" onClick={() => { setOubli(true); setErreur('') }}>Code oublié ?</button>}
          </div>
        </div>
      ) : (
        <div className="carte choix-serveur">
          <p>Tape ta <strong>phrase de secours</strong>, puis un nouveau code PIN.</p>
          <label>Phrase de secours<input value={secours} onChange={(e) => setSecours(e.target.value)} autoFocus /></label>
          <label>Nouveau code PIN (4 chiffres)<input type="password" inputMode="numeric" maxLength={4} value={nouveau} onChange={(e) => setNouveau(e.target.value.replace(/\D/g, ''))} /></label>
          {erreur && <p className="erreurs">{erreur}</p>}
          <div className="boutons">
            <button onClick={() => setOubli(false)}>Retour</button>
            <button className="principal" onClick={reinitialiser}>Valider</button>
          </div>
        </div>
      )}
    </div>
  )
}
