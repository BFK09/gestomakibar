import { useState } from 'react'
import { db } from '../db/base'
import { telechargerSauvegarde } from '../db/sauvegarde'

const MOT = 'EFFACER'

// Efface TOUTES les données de cet appareil pour repartir de zéro (après des essais, par exemple).
// Par sécurité : une sauvegarde est téléchargée d'abord, et il faut taper le mot EFFACER.
export default function Reinitialiser() {
  const [mot, setMot] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function reinitialiser() {
    setEnCours(true)
    await telechargerSauvegarde()
    await db.delete() // supprime la base entière
    window.location.reload() // l'application redémarre sur l'assistant de configuration
  }

  return (
    <div className="carte zone-danger">
      <strong>Repartir de zéro</strong>
      <p className="info">
        Tous les produits, ventes, réceptions, clients et réglages de cet appareil seront effacés,
        et l'assistant de configuration s'ouvrira. Une sauvegarde est d'abord téléchargée :
        tu pourras la restaurer si tu changes d'avis.
      </p>
      <label>Pour confirmer, tape <strong>{MOT}</strong> :
        <input value={mot} onChange={(e) => setMot(e.target.value.toUpperCase())} autoComplete="off" />
      </label>
      <div className="boutons gauche">
        <button className="danger" disabled={mot !== MOT || enCours} onClick={reinitialiser}>
          {enCours ? 'Effacement…' : 'Tout effacer et recommencer'}
        </button>
      </div>
    </div>
  )
}
