import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { definirPays, PAYS } from '../outils/pays'
import type { TypeEtablissement } from '../db/types'

// Nom, responsable et coordonnées de l'établissement (affichés sur les tickets et les rapports).
export default function Identite() {
  const boutique = useLiveQuery(() => db.boutique.get('principale'), [])
  const [s, setS] = useState({ nom: '', responsable: '', telephone: '', adresse: '', pays: 'CI', monnaie: '', debutJournee: '6', type: 'maquis' as TypeEtablissement, venteEnGros: false })
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (boutique) setS({ nom: boutique.nom, responsable: boutique.responsable, telephone: boutique.telephone ?? '', adresse: boutique.adresse ?? '', pays: boutique.pays ?? 'CI', monnaie: boutique.monnaie ?? '', debutJournee: String(boutique.debutJournee ?? 6), type: boutique.type ?? 'maquis', venteEnGros: !!boutique.venteEnGros })
  }, [boutique])

  async function enregistrer() {
    setMessage(''); setErreur('')
    if (!s.nom.trim() || !s.responsable.trim()) return setErreur('Le nom et le responsable sont obligatoires.')
    const heure = Number(s.debutJournee)
    if (!Number.isInteger(heure) || heure < 0 || heure > 12) return setErreur("L'heure de début de journée doit être un nombre entre 0 et 12.")
    await db.boutique.update('principale', {
      nom: s.nom.trim(), responsable: s.responsable.trim(),
      telephone: s.telephone.trim() || undefined, adresse: s.adresse.trim() || undefined,
      pays: s.pays, monnaie: s.monnaie.trim() || undefined, debutJournee: heure,
      type: s.type, venteEnGros: s.type !== 'depot' && s.venteEnGros,
    })
    definirPays(s.pays, s.monnaie)
    setMessage('Informations enregistrées.')
  }

  return (
    <div className="carte">
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}
      <label>Nom de l'établissement *<input value={s.nom} onChange={(e) => setS({ ...s, nom: e.target.value })} /></label>
      <label>Type d'établissement
        <select value={s.type} onChange={(e) => setS({ ...s, type: e.target.value as TypeEtablissement })}>
          <option value="maquis">Maquis</option><option value="bar">Bar</option><option value="depot">Dépôt de boissons</option>
        </select>
      </label>
      {s.type !== 'depot' && (
        <label className="case"><input type="checkbox" checked={s.venteEnGros} onChange={(e) => setS({ ...s, venteEnGros: e.target.checked })} /> Je vends aussi en gros aux revendeurs (prix de gros, casiers, livraisons)</label>
      )}
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
      <label>Début de la journée (heure)
        <select value={s.debutJournee} onChange={(e) => setS({ ...s, debutJournee: e.target.value })}>
          {Array.from({ length: 13 }, (_, h) => <option key={h} value={h}>{h} h</option>)}
        </select>
      </label>
      <p className="info">La journée commerciale va de cette heure jusqu'au lendemain même heure : avec 6 h, une vente faite à 2 h du matin compte dans la soirée de la veille (clôture de caisse).</p>
      <p className="info">Le pays sert pour WhatsApp : un numéro tapé sans indicatif reçoit celui du pays. Un client d'un autre pays : écris son numéro avec + (ex. +33 6 12 34 56 78). Laisse « Monnaie » vide pour celle du pays. Les montants sont en nombres entiers (sans centimes).</p>
      <div className="boutons gauche"><button className="principal" onClick={enregistrer}>Enregistrer</button></div>
    </div>
  )
}
