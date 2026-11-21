import { monnaie } from './pays'

// Affiche un montant avec des espaces entre les milliers et la monnaie du pays : 1 500 FCFA
// (la fonction garde son nom « fcfa », mais elle suit la monnaie choisie dans Paramètres).
export function fcfa(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(montant) + ' ' + monnaie()
}

// Transforme le texte d'un champ en nombre entier positif, ou null si vide.
// Renvoie NaN si le texte n'est pas un nombre valable.
export function lireEntier(texte: string): number | null {
  const propre = texte.replace(/\s/g, '')
  if (propre === '') return null
  if (!/^\d+$/.test(propre)) return NaN
  return Number(propre)
}
