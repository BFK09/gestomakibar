import type { Article } from '../db/types'

// Propose le prochain code libre pour une catégorie.
// Ex. si la catégorie contient CAH-001 à CAH-018, propose CAH-019.
export function codeSuivant(articlesDeLaCategorie: Article[], nomCategorie: string): string {
  // On cherche le préfixe le plus utilisé dans la catégorie (CAH, ECR…).
  const compteur = new Map<string, number>()
  let plusGrand = 0
  for (const a of articlesDeLaCategorie) {
    const m = /^([A-Z]+)-(\d+)$/.exec(a.code)
    if (!m) continue
    compteur.set(m[1], (compteur.get(m[1]) ?? 0) + 1)
  }
  let prefixe = [...compteur.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
  // Nouvelle catégorie sans article : 3 premières lettres du nom, sans accents.
  if (!prefixe) {
    prefixe = nomCategorie
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'ART'
  }
  for (const a of articlesDeLaCategorie) {
    const m = /^([A-Z]+)-(\d+)$/.exec(a.code)
    if (m && m[1] === prefixe) plusGrand = Math.max(plusGrand, Number(m[2]))
  }
  return `${prefixe}-${String(plusGrand + 1).padStart(3, '0')}`
}
