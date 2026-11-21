import type { Article } from '../db/types'

// Un lecteur de codes-barres (douchette USB ou Bluetooth) « tape » le code puis Entrée.
// Quand on appuie sur Entrée dans la recherche, on cherche l'article qui a exactement ce code-barres
// (ou ce code article). S'il n'y a qu'une seule suggestion, on la prend aussi.
export function articleScanne<A extends Article>(articles: A[], saisie: string, suggestions: A[]): A | undefined {
  const t = saisie.trim()
  if (!t) return undefined
  return articles.find((a) => a.codeBarre === t)
    ?? articles.find((a) => a.code === t.toUpperCase())
    ?? (suggestions.length === 1 ? suggestions[0] : undefined)
}

// Texte dans lequel on cherche : code, code-barres et désignation.
export const texteRecherche = (a: Article) => `${a.code} ${a.codeBarre ?? ''} ${a.designation}`
