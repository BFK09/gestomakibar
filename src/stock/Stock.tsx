import { useState } from 'react'
import Inventaire from './Inventaire'
import Pertes from './Pertes'

// Écran Stock : l'inventaire physique (recompter) et les pertes (casse, vol…).
export default function Stock() {
  const [onglet, setOnglet] = useState<'inventaire' | 'pertes'>('inventaire')
  return (
    <>
      <div className="onglets">
        <button className={onglet === 'inventaire' ? 'choisi' : ''} onClick={() => setOnglet('inventaire')}>Inventaire</button>
        <button className={onglet === 'pertes' ? 'choisi' : ''} onClick={() => setOnglet('pertes')}>Pertes et casse</button>
      </div>
      {onglet === 'inventaire' ? <Inventaire /> : <section><div className="entete-ecran"><h2>Pertes et casse</h2></div><Pertes /></section>}
    </>
  )
}
