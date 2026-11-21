import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { definirPays, PAYS } from '../outils/pays'

// Nom, responsable et coordonnées de l'établissement (affichés sur les tickets et les rapports).
export default function Identite() {
  const boutique = useLiveQuery(() => db.boutique.get('principale'), [])
  const [s, setS] = useState({ nom: '', responsable: '', telephone: '', adresse: '', pays: 'CI', monnaie: '' })
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (boutique) setS({ nom: boutique.nom, responsable: boutique.responsable, telephone: boutique.telephone ?? '', adresse: boutique.adresse ?? '', pays: boutique.pays ?? 'CI', monnaie: boutique.monnaie ?? '' })
  }, [boutique])

  async function enregistrer() {
    setMessage(''); setErreur('')
    if (!s.nom.trim() || !s.responsable.trim()) return setErreur('Le nom et le responsable sont obligatoires.')
    await db.boutique.update('principale', {
      nom: s.nom.trim(), responsable: s.responsable.trim(),
      telephone: s.telephone.trim() || undefined, adresse: s.adresse.trim() || undefined,
      pays: s.pays, monnaie: s.monnaie.trim() || undefined,
    })
    definirPays(s.pays, s.monnaie)
    setMessage('Informations enregistrées.')
  }

  return (
    <div className="carte">
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}
      <label>Nom de l'établissement *<input value={s.nom} onChange={(e) => setS({ ...s, nom: e.target.value })} /></label>
      <label>Responsable *<input value={s.responsable} onChange={(e) => setS({ ...s, responsable: e.target.value })} /></label>
      <label>Téléphone<input inputMode="tel" value={s.telephone} onChange={(e) => setS({ ...s, telephone: e.target.value })} /></label>
      <label>Adresse / ville<input value={s.adresse} onChange={(e) => setS({ ...s, adresse: e.target.value })} /></label>
      <div className="deux">
        <label>Pays
          <select value={s.pays} onChange={(e) => setS({ ...s, pays: e.target.value })}>
            {PAYS.map((p) => <option key={p.code} value={p.code}>{p.nom} (+{p.indicatif})</option>)}
          </select>
        </label>
        <label>Monnaie affichée<input value={s.monnaie} placeholder={PAYS.find((p) => p.code === s.pays)?.monnaie} onChange={(e) => setS({ ...s, monnaie: e.target.value })} /></label>
      </div>
      <p className="info">Le pays sert pour WhatsApp : un numéro tapé sans indicatif reçoit celui du pays. Un client d'un autre pays : écris son numéro avec + (ex. +33 6 12 34 56 78). Laisse « Monnaie » vide pour celle du pays. Les montants sont en nombres entiers (sans centimes).</p>
      <div className="boutons gauche"><button className="principal" onClick={enregistrer}>Enregistrer</button></div>
    </div>
  )
}
