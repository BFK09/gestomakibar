import { createContext, useContext } from 'react'
import type { Ecran } from '../navigation/ecrans'

// Qui utilise l'application en ce moment.
export type Role = 'patron' | 'gerant' | 'serveur'
export interface Utilisateur { role: Role; id: string; nom: string }

export interface Acces {
  actif: boolean // profils activés ?
  utilisateur: Utilisateur | null
  role: Role // sans profils : « patron » (tout est visible, comme avant)
  voitCouts: boolean // prix d'achat, coût moyen, marge, bénéfice, dépenses (totaux)
  peutEcran: (e: Ecran) => boolean
  peutRestaurer: boolean
  changerUtilisateur: () => void
}

// Écrans autorisés pour chaque rôle. Le patron voit tout.
const ECRANS_GERANT: Ecran[] = ['tableau', 'vente', 'catalogue', 'reception', 'inventaire', 'clients', 'emballages', 'livraisons', 'cloture', 'rapports', 'sauvegarde']
const ECRANS_SERVEUR: Ecran[] = ['vente']

export function construireAcces(actif: boolean, utilisateur: Utilisateur | null, changerUtilisateur: () => void): Acces {
  const role: Role = actif && utilisateur ? utilisateur.role : 'patron'
  return {
    actif, utilisateur, role,
    voitCouts: role === 'patron',
    peutEcran: (e) => role === 'patron' || (role === 'gerant' ? ECRANS_GERANT : ECRANS_SERVEUR).includes(e),
    peutRestaurer: role === 'patron',
    changerUtilisateur,
  }
}

export const ContexteAcces = createContext<Acces>(construireAcces(false, null, () => {}))
export const useAcces = () => useContext(ContexteAcces)
