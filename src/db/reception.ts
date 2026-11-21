import { db, nouvelId } from './base'
import { mouvement } from './emballages'

export interface LigneReception {
  articleId: string
  quantite: number
  coutUnitaire: number // prix d'achat d'une unité
  prixVente?: number // facultatif : seulement si le produit n'a pas encore de prix
  casiers?: number // casiers pleins livrés (pour les emballages consignés)
}

export interface Reception {
  date: string // ISO
  fournisseurNom: string // nom tapé ou choisi ; créé s'il n'existe pas encore
  reference?: string
  lignes: LigneReception[]
  videsRendus?: { emballageId: string; quantite: number }[] // casiers vides rendus au livreur
}

// Nouveau coût moyen pondéré après une entrée de stock.
// Exemple : 10 bouteilles à 200 F en stock, on reçoit 10 à 300 F
// → (10×200 + 10×300) / 20 = 250 F.
export function coutMoyenApres(
  stockAvant: number,
  coutAvant: number | null,
  quantite: number,
  cout: number,
): number {
  if (stockAvant <= 0 || coutAvant === null) return cout
  return Math.round((stockAvant * coutAvant + quantite * cout) / (stockAvant + quantite))
}

// Enregistre une réception complète. Tout se fait dans une "transaction" :
// soit tout est enregistré, soit rien (pas de réception à moitié écrite).
export async function enregistrerReception(r: Reception): Promise<string> {
  if (r.lignes.length === 0) throw new Error('La réception ne contient aucun produit.')

  return db.transaction(
    'rw',
    [db.fournisseurs, db.achats, db.lignesAchat, db.mouvementsStock, db.articles, db.mouvementsEmballage],
    async () => {
      // 1. Le fournisseur : on le retrouve par son nom, ou on le crée.
      let fournisseurId: string | undefined
      const nom = r.fournisseurNom.trim()
      if (nom) {
        const tous = await db.fournisseurs.toArray()
        const existant = tous.find((f) => f.nom.toLowerCase() === nom.toLowerCase())
        fournisseurId = existant?.id ?? (await db.fournisseurs.add({ id: nouvelId(), nom }))
      }

      // 2. Le document d'achat.
      const achatId = nouvelId()
      const total = r.lignes.reduce((s, l) => s + l.quantite * l.coutUnitaire, 0)
      await db.achats.add({ id: achatId, date: r.date, fournisseurId, reference: r.reference?.trim() || undefined, total })

      for (const l of r.lignes) {
        // 3. Le stock juste avant cette entrée (somme du journal).
        let stockAvant = 0
        await db.mouvementsStock.where('articleId').equals(l.articleId).each((m) => {
          stockAvant += m.quantite
        })
        const article = await db.articles.get(l.articleId)
        if (!article) throw new Error('Article introuvable.')

        // 4. La ligne d'achat et le mouvement de stock (+ quantité).
        await db.lignesAchat.add({ id: nouvelId(), achatId, articleId: l.articleId, quantite: l.quantite, coutUnitaire: l.coutUnitaire })
        await db.mouvementsStock.add({ id: nouvelId(), date: r.date, articleId: l.articleId, quantite: l.quantite, type: 'achat', documentId: achatId })

        // 5. Mise à jour de le produit : coût moyen, fournisseur habituel, prix si absent.
        await db.articles.update(l.articleId, {
          coutMoyen: coutMoyenApres(stockAvant, article.coutMoyen, l.quantite, l.coutUnitaire),
          fournisseurId: article.fournisseurId ?? fournisseurId,
          ...(article.prixVente === null && l.prixVente ? { prixVente: l.prixVente } : {}),
        })
      }

      // 6. Les emballages : casiers pleins livrés (dus au fournisseur), et vides rendus au livreur.
      const livres = new Map<string, number>()
      for (const l of r.lignes) {
        const a = await db.articles.get(l.articleId)
        if (a?.emballageId && l.casiers) livres.set(a.emballageId, (livres.get(a.emballageId) ?? 0) + l.casiers)
      }
      const autres = { date: r.date, fournisseurId, documentId: achatId }
      for (const [emballageId, q] of livres) await db.mouvementsEmballage.add(mouvement('livre', emballageId, q, autres))
      for (const v of r.videsRendus ?? []) {
        if (!Number.isInteger(v.quantite) || v.quantite < 0) throw new Error('Le nombre de casiers vides rendus doit être un nombre entier positif.')
        if (v.quantite > 0) await db.mouvementsEmballage.add(mouvement('rendu_fournisseur', v.emballageId, v.quantite, autres))
      }
      return achatId
    },
  )
}
