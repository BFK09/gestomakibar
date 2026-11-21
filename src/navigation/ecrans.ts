import { BookOpen, ChartColumn, DatabaseBackup, LayoutDashboard, PackagePlus, Settings, ShoppingCart, Boxes, Users, UserRound, Calculator, type LucideIcon } from 'lucide-react'

export type Ecran = 'tableau' | 'vente' | 'catalogue' | 'reception' | 'inventaire' | 'clients' | 'serveurs' | 'cloture' | 'rapports' | 'sauvegarde' | 'parametres'

export interface InfoEcran { id: Ecran; nom: string; court: string; icone: LucideIcon; description: string }

// Tous les écrans, dans l'ordre du menu. « court » = le nom affiché sous l'icône du menu du bas.
export const ECRANS: InfoEcran[] = [
  { id: 'vente', nom: 'Caisse', court: 'Caisse', icone: ShoppingCart, description: 'Vendre, tickets du jour' },
  { id: 'tableau', nom: 'Tableau de bord', court: 'Accueil', icone: LayoutDashboard, description: 'Chiffres du jour, alertes' },
  { id: 'cloture', nom: 'Clôture de caisse', court: 'Clôture', icone: Calculator, description: 'Argent remis par chaque serveur' },
  { id: 'clients', nom: 'Crédits clients', court: 'Crédits', icone: Users, description: 'Ardoises et remboursements' },
  { id: 'catalogue', nom: 'Produits', court: 'Produits', icone: BookOpen, description: 'Boissons, prix, casiers' },
  { id: 'reception', nom: 'Réception', court: 'Réception', icone: PackagePlus, description: 'Boissons reçues du fournisseur' },
  { id: 'inventaire', nom: 'Stock', court: 'Stock', icone: Boxes, description: 'Inventaire, pertes et casse' },
  { id: 'serveurs', nom: 'Serveurs', court: 'Serveurs', icone: UserRound, description: 'Liste des serveurs et leurs codes' },
  { id: 'rapports', nom: 'Rapports', court: 'Rapports', icone: ChartColumn, description: 'Ventes, mouvements, PDF, Excel' },
  { id: 'sauvegarde', nom: 'Sauvegarde', court: 'Sauvegarde', icone: DatabaseBackup, description: 'Sauvegarder, restaurer' },
  { id: 'parametres', nom: 'Paramètres', court: 'Réglages', icone: Settings, description: 'Établissement, catégories, paiements' },
]

// Les 4 écrans les plus utilisés, toujours visibles dans le menu du bas ; les autres sont dans « Plus ».
export const PRINCIPAUX: Ecran[] = ['vente', 'tableau', 'cloture', 'clients']

export const infoEcran = (id: Ecran) => ECRANS.find((e) => e.id === id)!
