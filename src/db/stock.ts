import { db } from './base'

// Le stock n'est jamais enregistré directement : on additionne le journal.
// Renvoie, pour chaque article, la somme de ses mouvements (+ entrées, − sorties).
export async function stockParArticle(): Promise<Map<string, number>> {
  const stocks = new Map<string, number>()
  await db.mouvementsStock.each((m) => {
    stocks.set(m.articleId, (stocks.get(m.articleId) ?? 0) + m.quantite)
  })
  return stocks
}
