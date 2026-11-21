import { useState } from 'react'
import { UserRound } from 'lucide-react'
import type { Serveur } from '../db/types'

interface Props {
  serveurs: Serveur[] // serveurs actifs
  onChoisir: (s: Serveur) => void
  onAllerAuxServeurs: () => void
}

// « Qui encaisse ? » : chaque serveur touche son nom avant de vendre.
// S'il a un code, il le tape : personne ne peut vendre au nom d'un autre.
export default function ChoixServeur({ serveurs, onChoisir, onAllerAuxServeurs }: Props) {
  const [enAttente, setEnAttente] = useState<Serveur | null>(null)
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')

  if (serveurs.length === 0) {
    return (
      <div className="carte bientot">
        <UserRound size={28} />
        <p><strong>Aucun serveur enregistré.</strong></p>
        <p>Ajoute d'abord la ou les personnes qui encaissent (toi-même si tu es seul).</p>
        <button className="principal" onClick={onAllerAuxServeurs}>Ajouter un serveur</button>
      </div>
    )
  }

  function choisir(s: Serveur) {
    setErreur(''); setCode('')
    if (s.code) setEnAttente(s)
    else onChoisir(s)
  }

  function verifier(valeur: string) {
    setCode(valeur)
    if (valeur.length < 4) return
    if (valeur === enAttente!.code) onChoisir(enAttente!)
    else { setErreur('Code incorrect.'); setCode('') }
  }

  if (enAttente) {
    return (
      <div className="carte choix-serveur">
        <p><strong>{enAttente.nom}</strong>, tape ton code :</p>
        <input className="code-serveur" type="password" inputMode="numeric" maxLength={4} autoFocus value={code} onChange={(e) => verifier(e.target.value.replace(/\D/g, ''))} />
        {erreur && <p className="erreurs">{erreur}</p>}
        <button onClick={() => setEnAttente(null)}>Retour</button>
      </div>
    )
  }

  return (
    <div className="carte choix-serveur">
      <p><strong>Qui encaisse ?</strong></p>
      <div className="grille-serveurs">
        {serveurs.map((s) => (
          <button key={s.id} onClick={() => choisir(s)}>
            <UserRound size={26} />
            <span>{s.nom}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
