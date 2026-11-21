import { useState } from 'react'
import Caisse, { type LignePanier } from './Caisse'
import VentesDuJour from './VentesDuJour'

// Écran Vente : la caisse, ou la liste des tickets du jour.
export default function Vente({ onAllerAuxServeurs }: { onAllerAuxServeurs: () => void }) {
  const [onglet, setOnglet] = useState<'caisse' | 'jour'>('caisse')
  // Panier à recharger quand on « refait » un ticket annulé.
  const [panierARefaire, setPanierARefaire] = useState<LignePanier[] | null>(null)
  // Change à chaque « refaire » pour que la caisse reparte de zéro avec ce panier.
  const [cle, setCle] = useState(0)

  function refaire(lignes: LignePanier[]) {
    setPanierARefaire(lignes)
    setCle(cle + 1)
    setOnglet('caisse')
  }

  return (
    <section>
      <div className="entete-ecran"><h2>Caisse</h2></div>
      <div className="onglets">
        <button className={onglet === 'caisse' ? 'choisi' : ''} onClick={() => setOnglet('caisse')}>Vendre</button>
        <button className={onglet === 'jour' ? 'choisi' : ''} onClick={() => setOnglet('jour')}>Ventes du jour</button>
      </div>
      {onglet === 'caisse'
        ? <Caisse key={cle} panierDepart={panierARefaire ?? []} onRefaire={refaire} onAllerAuxServeurs={onAllerAuxServeurs} />
        : <VentesDuJour onRefaire={refaire} />}
    </section>
  )
}
