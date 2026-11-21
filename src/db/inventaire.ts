import { db, nouvelId } from './base'

export interface LigneComptee {
  articleId: string
  quantiteComptee: number // ce qu'on a réellement compté sur l'étagère
  coutUnitaire?: number // facultatif : coût d'achat, si l'article n'en a pas encore
}

// Enregistre un inventaire. Pour chaque article compté :
// écart = quantité comptée − stock calculé par l'application.
// Cet écart est ajouté au journal (mouvement « inventaire »), donc le stock
// affiché devient égal au comptage, sans jamais effacer l'historique.
export async function enregistrerInventaire(lignes: LigneComptee[], note?: string): Promise<number> {
  if (lignes.length === 0) throw new Error("Aucun article n'a été compté.")
  return db.transaction('rw', [db.inventaires, db.lignesInventaire, db.mouvementsStock, db.articles], async () => {
    const inventaireId = nouvelId()
    const date = new Date().toISOString()
    await db.inventaires.add({ id: inventaireId, date, note: note?.trim() || undefined })

    let ecarts = 0
    for (const l of lignes) {
      let theorique = 0
      await db.mouvementsStock.where('articleId').equals(l.articleId).each((m) => { theorique += m.quantite })

      await db.lignesInventaire.add({
        id: nouvelId(), inventaireId, articleId: l.articleId,
        quantiteTheorique: theorique, quantiteComptee: l.quantiteComptee,
      })
      const ecart = l.quantiteComptee - theorique
      if (ecart !== 0) {
        ecarts++
        await db.mouvementsStock.add({ id: nouvelId(), date, articleId: l.articleId, quantite: ecart, type: 'inventaire', documentId: inventaireId })
      }
      const article = await db.articles.get(l.articleId)
      if (article && article.coutMoyen === null && l.coutUnitaire !== undefined) {
        await db.articles.update(l.articleId, { coutMoyen: l.coutUnitaire })
      }
    }
    return ecarts
  })
}
