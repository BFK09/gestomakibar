// Pays de l'établissement : il donne l'indicatif téléphonique par défaut (pour WhatsApp) et la monnaie.
// Les montants restent des nombres entiers : parfait pour le FCFA, le franc guinéen, le naira…
// Pour l'euro ou le dollar, on compte en unités entières (pas de centimes pour l'instant).
export interface Pays {
  code: string // code ISO du pays
  nom: string
  indicatif: string // sans « + »
  monnaie: string // texte affiché après les montants
  garderZero?: boolean // le 0 du début fait partie du numéro (Côte d'Ivoire, Bénin)
}

export const PAYS: Pays[] = [
  { code: 'CI', nom: "Côte d'Ivoire", indicatif: '225', monnaie: 'FCFA', garderZero: true },
  { code: 'SN', nom: 'Sénégal', indicatif: '221', monnaie: 'FCFA' },
  { code: 'ML', nom: 'Mali', indicatif: '223', monnaie: 'FCFA' },
  { code: 'BF', nom: 'Burkina Faso', indicatif: '226', monnaie: 'FCFA' },
  { code: 'NE', nom: 'Niger', indicatif: '227', monnaie: 'FCFA' },
  { code: 'TG', nom: 'Togo', indicatif: '228', monnaie: 'FCFA' },
  { code: 'BJ', nom: 'Bénin', indicatif: '229', monnaie: 'FCFA', garderZero: true },
  { code: 'GW', nom: 'Guinée-Bissau', indicatif: '245', monnaie: 'FCFA' },
  { code: 'CM', nom: 'Cameroun', indicatif: '237', monnaie: 'FCFA' },
  { code: 'GA', nom: 'Gabon', indicatif: '241', monnaie: 'FCFA' },
  { code: 'CG', nom: 'Congo', indicatif: '242', monnaie: 'FCFA' },
  { code: 'TD', nom: 'Tchad', indicatif: '235', monnaie: 'FCFA' },
  { code: 'CF', nom: 'Centrafrique', indicatif: '236', monnaie: 'FCFA' },
  { code: 'GQ', nom: 'Guinée équatoriale', indicatif: '240', monnaie: 'FCFA' },
  { code: 'GN', nom: 'Guinée', indicatif: '224', monnaie: 'GNF' },
  { code: 'CD', nom: 'RD Congo', indicatif: '243', monnaie: 'FC' },
  { code: 'MR', nom: 'Mauritanie', indicatif: '222', monnaie: 'MRU' },
  { code: 'MA', nom: 'Maroc', indicatif: '212', monnaie: 'MAD' },
  { code: 'DZ', nom: 'Algérie', indicatif: '213', monnaie: 'DA' },
  { code: 'TN', nom: 'Tunisie', indicatif: '216', monnaie: 'DT' },
  { code: 'MG', nom: 'Madagascar', indicatif: '261', monnaie: 'Ar' },
  { code: 'RW', nom: 'Rwanda', indicatif: '250', monnaie: 'FRW' },
  { code: 'BI', nom: 'Burundi', indicatif: '257', monnaie: 'FBu' },
  { code: 'KM', nom: 'Comores', indicatif: '269', monnaie: 'FC' },
  { code: 'DJ', nom: 'Djibouti', indicatif: '253', monnaie: 'FDJ' },
  { code: 'NG', nom: 'Nigeria', indicatif: '234', monnaie: '₦' },
  { code: 'GH', nom: 'Ghana', indicatif: '233', monnaie: 'GH₵' },
  { code: 'HT', nom: 'Haïti', indicatif: '509', monnaie: 'HTG' },
  { code: 'FR', nom: 'France', indicatif: '33', monnaie: '€' },
  { code: 'BE', nom: 'Belgique', indicatif: '32', monnaie: '€' },
  { code: 'CH', nom: 'Suisse', indicatif: '41', monnaie: 'CHF' },
  { code: 'CA', nom: 'Canada', indicatif: '1', monnaie: '$' },
  { code: 'US', nom: 'États-Unis', indicatif: '1', monnaie: '$' },
  { code: 'GB', nom: 'Royaume-Uni', indicatif: '44', monnaie: '£' },
]

// Pays et monnaie en cours (lus au démarrage depuis la fiche de l'établissement).
let actuel: Pays = PAYS[0]
let monnaieChoisie: string | undefined

export function definirPays(code?: string, monnaie?: string) {
  actuel = PAYS.find((p) => p.code === code) ?? PAYS[0]
  monnaieChoisie = monnaie?.trim() || undefined
}
export const paysActuel = () => actuel
export const monnaie = () => monnaieChoisie ?? actuel.monnaie
