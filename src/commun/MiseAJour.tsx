import { useRegisterSW } from 'virtual:pwa-register/react'

// Une nouvelle version de l'application est en ligne : on ne recharge PAS tout seul
// (un panier en cours serait perdu). On propose un bouton ; la mise à jour se fait quand on veut.
export default function MiseAJour() {
  const { needRefresh: [aMettreAJour], updateServiceWorker } = useRegisterSW({
    // Vérifie s'il y a une nouvelle version toutes les heures (l'appli reste souvent ouverte toute la soirée).
    onRegisteredSW(_url, sw) { if (sw) setInterval(() => sw.update(), 60 * 60 * 1000) },
  })
  if (!aMettreAJour) return null
  return (
    <div className="rappel mise-a-jour">
      <span>Une nouvelle version de l'appli est prête.</span>
      <button className="principal" onClick={() => updateServiceWorker(true)}>Mettre à jour</button>
    </div>
  )
}
