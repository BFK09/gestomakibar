import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'

const JOURS = 7

// Petit bandeau qui rappelle de sauvegarder si la dernière sauvegarde date de plus de 7 jours
// (ou s'il n'y en a jamais eu alors que des ventes existent).
export default function RappelSauvegarde({ onOuvrir }: { onOuvrir: () => void }) {
  const besoin = useLiveQuery(async () => {
    const b = await db.boutique.get('principale')
    if (!b) return false
    if (!b.derniereSauvegarde) return (await db.ventes.count()) > 0
    return Date.now() - new Date(b.derniereSauvegarde).getTime() > JOURS * 24 * 3600 * 1000
  }, [])
  if (!besoin) return null
  return (
    <div className="rappel">
      Pense à sauvegarder tes données.
      <button onClick={onOuvrir}>Sauvegarder</button>
    </div>
  )
}
