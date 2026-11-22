import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/base'
import Configuration from './configuration/Configuration'
import Catalogue from './catalogue/Catalogue'
import Reception from './reception/Reception'
import Vente from './vente/Vente'
import Stock from './stock/Stock'
import Sauvegarde from './sauvegarde/Sauvegarde'
import RappelSauvegarde from './sauvegarde/RappelSauvegarde'
import MiseAJour from './commun/MiseAJour'
import TableauDeBord from './tableau/TableauDeBord'
import Rapports from './rapports/Rapports'
import Clients from './clients/Clients'
import Parametres from './parametres/Parametres'
import Serveurs from './serveurs/Serveurs'
import Emballages from './emballages/Emballages'
import Livraisons from './livraisons/Livraisons'
import Cloture from './cloture/Cloture'
import Navigation from './navigation/Navigation'
import { definirPays } from './outils/pays'
import type { Ecran } from './navigation/ecrans'
import Connexion from './acces/Connexion'
import { ContexteAcces, construireAcces, type Utilisateur } from './acces/acces'

// Le composant principal : la navigation, puis l'écran choisi.
function App() {
  const [ecran, setEcran] = useState<Ecran>('vente')
  // Toucher un onglet du menu (même celui déjà ouvert) ramène à la page d'accueil de cet écran.
  const [visite, setVisite] = useState(0)
  // Profils : qui est connecté (null = personne). Gardé en mémoire seulement : à la réouverture, on redemande le code.
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  // null = pas encore configurée ; undefined = lecture en cours.
  const boutique = useLiveQuery(async () => (await db.boutique.get('principale')) ?? null, [])
  const actif = !!boutique?.profilsActifs
  const acces = useMemo(() => construireAcces(actif, utilisateur, () => setUtilisateur(null)), [actif, utilisateur])

  // Verrouillage automatique : après N minutes sans toucher l'écran, on revient à « Qui êtes-vous ? ».
  const minutes = boutique?.verrouMinutes ?? 10
  useEffect(() => {
    if (!actif || !utilisateur || !minutes) return
    let minuterie = window.setTimeout(() => setUtilisateur(null), minutes * 60000)
    const relancer = () => { window.clearTimeout(minuterie); minuterie = window.setTimeout(() => setUtilisateur(null), minutes * 60000) }
    const evenements = ['pointerdown', 'keydown', 'scroll'] as const
    evenements.forEach((e) => window.addEventListener(e, relancer, { passive: true }))
    return () => { window.clearTimeout(minuterie); evenements.forEach((e) => window.removeEventListener(e, relancer)) }
  }, [actif, utilisateur, minutes])

  // Lecture de la base : on garde l'écran de démarrage (le même que dans index.html), sans flash blanc.
  if (boutique === undefined) return <div className="demarrage"><img src={`${import.meta.env.BASE_URL}icone.svg`} alt="" /></div>
  // Tant que l'établissement n'est pas configuré, on affiche l'assistant de démarrage.
  if (boutique === null) return <Configuration />
  // Le pays et la monnaie de l'établissement, utilisés pour afficher les montants et les numéros WhatsApp.
  definirPays(boutique.pays, boutique.monnaie)
  // Profils activés et personne de connecté : « Qui êtes-vous ? ».
  if (actif && !utilisateur) return <Connexion nomBoutique={boutique.nom} onConnecte={(u) => { setUtilisateur(u); setEcran('vente'); setVisite((v) => v + 1) }} />
  // Un écran non autorisé pour ce profil (par exemple après un changement d'utilisateur) : on revient à la caisse.
  const affiche: Ecran = acces.peutEcran(ecran) ? ecran : 'vente'

  return (
    <ContexteAcces.Provider value={acces}>
      <Navigation nomBoutique={boutique.nom} ecran={affiche} onChoisir={(e) => { setEcran(e); setVisite((v) => v + 1); window.scrollTo(0, 0) }} />
      <main className="page" key={`${affiche}-${visite}`}>
        <MiseAJour />
        {affiche !== 'sauvegarde' && affiche !== 'rapports' && acces.peutEcran('sauvegarde') && <RappelSauvegarde onOuvrir={() => setEcran('sauvegarde')} />}
        {affiche === 'tableau' && <TableauDeBord onVoirCatalogue={() => setEcran('catalogue')} />}
        {affiche === 'vente' && <Vente onAllerAuxServeurs={() => setEcran('serveurs')} />}
        {affiche === 'catalogue' && <Catalogue />}
        {affiche === 'reception' && <Reception />}
        {affiche === 'inventaire' && <Stock />}
        {affiche === 'clients' && <Clients />}
        {affiche === 'serveurs' && <Serveurs />}
        {affiche === 'emballages' && <Emballages />}
        {affiche === 'livraisons' && <Livraisons />}
        {affiche === 'cloture' && <Cloture />}
        {affiche === 'rapports' && <Rapports />}
        {affiche === 'sauvegarde' && <Sauvegarde />}
        {affiche === 'parametres' && <Parametres />}
      </main>
    </ContexteAcces.Provider>
  )
}

export default App
