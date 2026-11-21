import { useState } from 'react'
import NouvelleReception from './NouvelleReception'
import HistoriqueReceptions from './HistoriqueReceptions'

// Écran Réception : saisir une livraison, ou consulter les précédentes.
export default function Reception() {
  const [onglet, setOnglet] = useState<'nouvelle' | 'historique'>('nouvelle')
  return (
    <section>
      <div className="entete-ecran">
        <h2>Réception de marchandise</h2>
      </div>
      <div className="onglets">
        <button className={onglet === 'nouvelle' ? 'choisi' : ''} onClick={() => setOnglet('nouvelle')}>
          Nouvelle réception
        </button>
        <button className={onglet === 'historique' ? 'choisi' : ''} onClick={() => setOnglet('historique')}>
          Historique
        </button>
      </div>
      {onglet === 'nouvelle' ? <NouvelleReception /> : <HistoriqueReceptions />}
    </section>
  )
}
