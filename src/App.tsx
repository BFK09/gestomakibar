import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/base'
import Configuration from './configuration/Configuration'
import Catalogue from './catalogue/Catalogue'
import Reception from './reception/Reception'
import Vente from './vente/Vente'
import Stock from './stock/Stock'
import Sauvegarde from './sauvegarde/Sauvegarde'
import RappelSauvegarde from './sauvegarde/RappelSauvegarde'
import TableauDeBord from './tableau/TableauDeBord'
import Rapports from './rapports/Rapports'
import Clients from './clients/Clients'
import Parametres from './parametres/Parametres'
import BientotDisponible from './commun/BientotDisponible'
import Navigation from './navigation/Navigation'
import { definirPays } from './outils/pays'
import type { Ecran } from './navigation/ecrans'

// Le composant principal : la navigation, puis l'écran choisi.
function App() {
  const [ecran, setEcran] = useState<Ecran>('vente')
  // Toucher un onglet du menu (même celui déjà ouvert) ramène à la page d'accueil de cet écran.
  const [visite, setVisite] = useState(0)
  // null = pas encore configurée ; undefined = lecture en cours.
  const boutique = useLiveQuery(async () => (await db.boutique.get('principale')) ?? null, [])
  if (boutique === undefined) return null
  // Tant que l'établissement n'est pas configuré, on affiche l'assistant de démarrage.
  if (boutique === null) return <Configuration />
  // Le pays et la monnaie de l'établissement, utilisés pour afficher les montants et les numéros WhatsApp.
  definirPays(boutique.pays, boutique.monnaie)

  return (
    <>
      <Navigation nomBoutique={boutique.nom} ecran={ecran} onChoisir={(e) => { setEcran(e); setVisite((v) => v + 1); window.scrollTo(0, 0) }} />
      <main className="page" key={`${ecran}-${visite}`}>
        {ecran !== 'sauvegarde' && ecran !== 'rapports' && <RappelSauvegarde onOuvrir={() => setEcran('sauvegarde')} />}
        {ecran === 'tableau' && <TableauDeBord onVoirCatalogue={() => setEcran('catalogue')} />}
        {ecran === 'vente' && <Vente />}
        {ecran === 'catalogue' && <Catalogue />}
        {ecran === 'reception' && <Reception />}
        {ecran === 'inventaire' && <Stock />}
        {ecran === 'clients' && <Clients />}
        {ecran === 'serveurs' && <BientotDisponible titre="Serveurs" etape="étape 3" contenu="Ici tu créeras la liste de tes serveurs, avec un code à 4 chiffres pour chacun. À la caisse, chaque vente sera notée au nom du serveur." />}
        {ecran === 'cloture' && <BientotDisponible titre="Clôture de caisse" etape="étape 4" contenu="En fin de service : pour chaque serveur, l'argent attendu, l'argent remis et l'écart." />}
        {ecran === 'rapports' && <Rapports />}
        {ecran === 'sauvegarde' && <Sauvegarde />}
        {ecran === 'parametres' && <Parametres />}
      </main>
    </>
  )
}

export default App
