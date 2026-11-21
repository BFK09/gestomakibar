import { db } from './base'

// Le stock n'est jamais enregistré directement : on additionne le journal.
// Renvoie, pour chaque produit, la somme de ses mouvements (+ entrées, − sorties).
export async function stockParArticle(): Promise<Map<string, number>> {
  const stocks = new Map<string, number>()
  await db.mouvementsStock.each((m) => {
    stocks.set(m.articleId, (stocks.get(m.articleId) ?? 0) + m.quantite)
  })
  return stocks
}

// Seuil d'alerte d'une boisson : celui de sa fiche, sinon un casier, sinon 10 (comme l'Excel GESTOMAQUIS).
export function seuilEffectif(a: { seuilAlerte: number | null; tailleCasier?: number | null }): number {
  return a.seuilAlerte ?? a.tailleCasier ?? 10
}

// Stock lisible au comptoir : « 30 (2 casiers + 6) » pour une boisson vendue en casiers de 12.
export function stockEnCasiers(stock: number, tailleCasier?: number | null): string {
  if (!tailleCasier || stock < tailleCasier) return String(stock)
  const casiers = Math.floor(stock / tailleCasier)
  const reste = stock - casiers * tailleCasier
  return `${stock} (${casiers} casier${casiers > 1 ? 's' : ''}${reste ? ` + ${reste}` : ''})`
}
