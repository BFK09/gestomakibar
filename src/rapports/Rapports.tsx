import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import JournalMouvements from './JournalMouvements'
import EtatDuStock from './EtatDuStock'
import RapportVentes from './RapportVentes'

// Écran Rapports : documents à consulter et à « tirer » en PDF.
export default function Rapports() {
  const [onglet, setOnglet] = useState<'ventes' | 'mouvements' | 'stock'>('ventes')
  const boutique = useLiveQuery(() => db.boutique.get('principale'), [])
  return (
    <section className="rapports">
      <div className="entete-ecran sans-impression"><h2>Rapports</h2></div>
      <div className="onglets sans-impression">
        <button className={onglet === 'ventes' ? 'choisi' : ''} onClick={() => setOnglet('ventes')}>Ventes</button>
        <button className={onglet === 'mouvements' ? 'choisi' : ''} onClick={() => setOnglet('mouvements')}>Mouvements de stock</button>
        <button className={onglet === 'stock' ? 'choisi' : ''} onClick={() => setOnglet('stock')}>État du stock</button>
      </div>
      {onglet === 'ventes' && <RapportVentes nomBoutique={boutique?.nom ?? ''} />}
      {onglet === 'mouvements' && <JournalMouvements nomBoutique={boutique?.nom ?? ''} />}
      {onglet === 'stock' && <EtatDuStock nomBoutique={boutique?.nom ?? ''} />}
    </section>
  )
}

// Pour obtenir un PDF : la fenêtre d'impression propose « Enregistrer au format PDF ».
export function BoutonPdf() {
  return (
    <button className="principal sans-impression" onClick={() => window.print()}>
      Imprimer / Enregistrer en PDF
    </button>
  )
}
