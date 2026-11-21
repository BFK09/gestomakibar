import { db, nouvelId } from './base'
import type { Boutique } from './types'

export interface ProduitChoisi {
  articleId: string
  stock: number
  prixAchat: number
  prixVente: number
}

// Termine l'assistant de démarrage, en un seul bloc :
// - enregistre l'identité de l'établissement ;
// - active les produits choisis (prix de vente, coût d'achat) et désactive les autres ;
// - crée le stock de départ comme un inventaire (entrées dans le journal de stock).
export async function terminerConfiguration(
  identite: Omit<Boutique, 'id' | 'configureeLe'>,
  produits: ProduitChoisi[],
) {
  if (produits.length === 0) throw new Error('Choisis au moins un produit.')
  await db.transaction('rw', [db.boutique, db.articles, db.inventaires, db.lignesInventaire, db.mouvementsStock], async () => {
    const date = new Date().toISOString()
    const choisis = new Map(produits.map((p) => [p.articleId, p]))

    // Les articles non choisis restent dans la base, mais inactifs (réactivables dans le Catalogue).
    await db.articles.toCollection().modify((a) => {
      const p = choisis.get(a.id)
      a.actif = !!p
      if (p) {
        a.prixVente = p.prixVente
        a.coutMoyen = p.prixAchat
      }
    })

    const inventaireId = nouvelId()
    await db.inventaires.add({ id: inventaireId, date, note: 'Stock de départ' })
    for (const p of produits) {
      await db.lignesInventaire.add({ id: nouvelId(), inventaireId, articleId: p.articleId, quantiteTheorique: 0, quantiteComptee: p.stock })
      if (p.stock > 0) {
        await db.mouvementsStock.add({ id: nouvelId(), date, articleId: p.articleId, quantite: p.stock, type: 'inventaire', documentId: inventaireId })
      }
    }

    await db.boutique.put({ id: 'principale', ...identite, configureeLe: date })
  })
}
