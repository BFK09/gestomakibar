import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nouvelId } from '../db/base'
import type { ModePaiement } from '../db/types'

const NATURES: Record<ModePaiement['nature'], string> = {
  especes: 'Espèces', mobile_money: 'Mobile money', credit: 'Crédit (dette du client)', autre: 'Autre (chèque, virement…)',
}

// Les modes de paiement proposés à la caisse. On peut en ajouter (ex. « Orange Money », « Wave »),
// les renommer, les masquer, ou changer leur ordre. Le mode « crédit » est unique et ne se crée pas.
export default function ModesPaiement() {
  const modes = useLiveQuery(() => db.modesPaiement.toCollection().sortBy('ordre'), [])
  const [nouveau, setNouveau] = useState({ nom: '', nature: 'mobile_money' as ModePaiement['nature'] })
  const [erreur, setErreur] = useState('')
  if (!modes) return <p>Chargement…</p>

  async function ajouter() {
    setErreur('')
    const nom = nouveau.nom.trim()
    if (!nom) return setErreur('Indique le nom du mode de paiement.')
    if (modes!.some((m) => m.nom.toLowerCase() === nom.toLowerCase())) return setErreur(`« ${nom} » existe déjà.`)
    await db.modesPaiement.add({ id: nouvelId(), nom, nature: nouveau.nature, ordre: modes!.length + 1, actif: true })
    setNouveau({ nom: '', nature: 'mobile_money' })
  }

  async function renommer(m: ModePaiement, nom: string) {
    setErreur('')
    nom = nom.trim()
    if (!nom || nom === m.nom) return
    if (modes!.some((x) => x.nom.toLowerCase() === nom.toLowerCase() && x.id !== m.id)) return setErreur(`« ${nom} » existe déjà.`)
    await db.modesPaiement.update(m.id, { nom })
  }

  // Échange la place de deux modes dans la liste.
  async function deplacer(i: number, sens: -1 | 1) {
    const a = modes![i], b = modes![i + sens]
    if (!b) return
    await db.transaction('rw', db.modesPaiement, async () => {
      await db.modesPaiement.update(a.id, { ordre: b.ordre })
      await db.modesPaiement.update(b.id, { ordre: a.ordre })
    })
  }

  return (
    <div className="carte">
      <p className="info">Un mode masqué n'apparaît plus à la caisse, mais reste dans l'historique.</p>
      {erreur && <p className="erreurs">{erreur}</p>}
      <ul className="liste-modes">
        {modes.map((m, i) => (
          <li key={m.id} className={m.actif ? '' : 'inactif'}>
            <input defaultValue={m.nom} onBlur={(e) => renommer(m, e.target.value)} aria-label="Nom du mode" />
            <small>{NATURES[m.nature]}</small>
            <span className="boutons-mode">
              <button onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter">↑</button>
              <button onClick={() => deplacer(i, 1)} disabled={i === modes.length - 1} aria-label="Descendre">↓</button>
              <button onClick={() => db.modesPaiement.update(m.id, { actif: !m.actif })}>{m.actif ? 'Masquer' : 'Afficher'}</button>
            </span>
          </li>
        ))}
      </ul>
      <strong>Ajouter un mode</strong>
      <div className="ligne-paiement">
        <input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} placeholder="ex. Orange Money, Wave…" />
        <select value={nouveau.nature} onChange={(e) => setNouveau({ ...nouveau, nature: e.target.value as ModePaiement['nature'] })}>
          <option value="mobile_money">Mobile money</option><option value="especes">Espèces</option><option value="autre">Autre</option>
        </select>
      </div>
      <div className="boutons gauche"><button className="principal" onClick={ajouter}>+ Ajouter</button></div>
    </div>
  )
}
