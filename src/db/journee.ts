// La « journée commerciale » d'un maquis ne s'arrête pas à minuit : une bière vendue à 2 h du matin
// appartient à la soirée de la veille. On décale donc l'heure de début (6 h par défaut).
export const DEBUT_JOURNEE_DEFAUT = 6

const deux = (n: number) => String(n).padStart(2, '0')

// Journée commerciale d'une date ISO, au format AAAA-MM-JJ (heure du téléphone).
export function journeeDe(iso: string | Date, debut = DEBUT_JOURNEE_DEFAUT): string {
  const d = new Date(iso)
  d.setHours(d.getHours() - debut)
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

// Début et fin (exclue) d'une journée commerciale, en dates ISO, pour chercher dans la base.
export function bornesJournee(journee: string, debut = DEBUT_JOURNEE_DEFAUT): { du: string; au: string } {
  const [a, m, j] = journee.split('-').map(Number)
  const du = new Date(a, m - 1, j, debut, 0, 0)
  const au = new Date(a, m - 1, j + 1, debut, 0, 0)
  return { du: du.toISOString(), au: au.toISOString() }
}

// Ex. « samedi 21 novembre »
export function nomJournee(journee: string): string {
  const [a, m, j] = journee.split('-').map(Number)
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
