import { db, nouvelId } from './base'
import { detteClient } from './clients'
import { fcfa } from '../outils/format'
import { mouvement } from './emballages'

export interface LignePanier {
  articleId: string
  quantite: number
}

export interface Paiement {
  modePaiementId: string
  montant: number
}

export interface NouvelleVente {
  lignes: LignePanier[]
  paiements: Paiement[] // leur somme doit être égale au total (paiement partagé possible)
  clientNom?: string // obligatoire si une partie est payée à crédit
  clientTelephone?: string
  serveurId: string // le serveur qui encaisse (obligatoire)
  table?: string // table ou place du client (facultatif)
  // Casiers consignés emportés par le client, et vides qu'il rapporte (client obligatoire).
  emballages?: { emballageId: string; emportes: number; rendus: number }[]
  tarif?: 'gros' // prix de gros (revendeur) : le prix de gros de chaque produit, ou son prix de détail s'il n'en a pas
  livraison?: { adresse: string; telephone?: string; note?: string } // à livrer chez le client
}

// Enregistre une vente en un seul bloc (transaction) et renvoie l'id du ticket.
export async function enregistrerVente(v: NouvelleVente): Promise<string> {
  if (v.lignes.length === 0) throw new Error('Le panier est vide.')
  if (v.lignes.some((l) => !Number.isInteger(l.quantite) || l.quantite <= 0)) throw new Error('Chaque quantité doit être un nombre entier supérieur à 0.')
  if (v.paiements.some((p) => !Number.isInteger(p.montant) || p.montant < 0)) throw new Error('Un montant de paiement ne peut pas être négatif.')
  if (!v.serveurId) throw new Error('Choisis le serveur avant d\'encaisser.')

  return db.transaction(
    'rw',
    [db.ventes, db.lignesVente, db.mouvementsStock, db.encaissements, db.articles, db.clients, db.modesPaiement, db.serveurs, db.mouvementsEmballage, db.livraisons],
    async () => {
      // 1. Le prix et le coût sont lus MAINTENANT et copiés dans la ligne (valeurs figées).
      const articles = await db.articles.bulkGet(v.lignes.map((l) => l.articleId))
      let total = 0
      const lignes = v.lignes.map((l, i) => {
        const a = articles[i]
        if (!a) throw new Error('Article introuvable.')
        const prix = v.tarif === 'gros' ? a.prixGros ?? a.prixVente : a.prixVente
        if (prix === null || prix === undefined) throw new Error(`${a.code} n'a pas de prix de vente.`)
        total += prix * l.quantite
        return { article: a, quantite: l.quantite, prix }
      })

      // 2. Les paiements doivent couvrir exactement le total.
      const paye = v.paiements.reduce((s, p) => s + p.montant, 0)
      if (paye !== total) throw new Error(`Les paiements (${paye}) ne correspondent pas au total (${total}).`)

      // 3. Le client : obligatoire pour un crédit. Retrouvé par son nom, sinon créé.
      const modes = await db.modesPaiement.toArray()
      const credit = modes.find((m) => m.nature === 'credit')
      const montantCredit = v.paiements.filter((p) => p.modePaiementId === credit?.id).reduce((s, p) => s + p.montant, 0)
      const aCredit = montantCredit > 0
      let clientId: string | undefined
      const nom = v.clientNom?.trim()
      if (aCredit && !nom) throw new Error('Un paiement à crédit demande le nom du client.')
      const emballages = (v.emballages ?? []).filter((e) => e.emportes || e.rendus)
      if (emballages.some((e) => !Number.isInteger(e.emportes) || !Number.isInteger(e.rendus) || e.emportes < 0 || e.rendus < 0)) throw new Error('Les casiers emportés ou rendus doivent être des nombres entiers positifs.')
      if (emballages.length > 0 && !nom) throw new Error('Pour des casiers emportés ou rapportés, indique le nom du client.')
      if (v.livraison && !v.livraison.adresse.trim()) throw new Error('Indique l\'adresse de livraison.')
      if (v.livraison && !nom) throw new Error('Pour une livraison, indique le nom du client.')
      if (nom) {
        const existant = (await db.clients.toArray()).find((c) => c.nom.toLowerCase() === nom.toLowerCase())
        clientId = existant?.id ?? (await db.clients.add({
          id: nouvelId(), nom, type: 'particulier', telephone: v.clientTelephone?.trim() || undefined, plafondCredit: 0,
        }))
        // Le plafond de crédit : la nouvelle dette ne doit pas le dépasser (0 = pas de limite).
        if (aCredit && existant && existant.plafondCredit > 0) {
          const dette = await detteClient(existant.id)
          if (dette + montantCredit > existant.plafondCredit) {
            throw new Error(`Plafond de crédit dépassé pour ${existant.nom} : il doit déjà ${fcfa(dette)}, plafond ${fcfa(existant.plafondCredit)}.`)
          }
        }
      }

      // Le serveur doit exister et être actif.
      const serveur = await db.serveurs.get(v.serveurId)
      if (!serveur || !serveur.actif) throw new Error('Serveur introuvable ou inactif.')
      const table = v.table?.trim() || undefined

      // 4. Le ticket, avec le numéro suivant.
      const dernier = await db.ventes.orderBy('numero').last()
      const venteId = nouvelId()
      const date = new Date().toISOString()
      await db.ventes.add({ id: venteId, numero: (dernier?.numero ?? 0) + 1, date, clientId, serveurId: v.serveurId, table, total, ...(v.tarif === 'gros' ? { tarif: 'gros' as const } : {}) })

      // 5. Les lignes de vente et les sorties de stock (quantité négative).
      for (const { article, quantite, prix } of lignes) {
        await db.lignesVente.add({
          id: nouvelId(), venteId, articleId: article.id,
          designation: article.designation, categorieId: article.categorieId,
          quantite, prixUnitaire: prix, coutUnitaire: article.coutMoyen ?? 0,
        })
        await db.mouvementsStock.add({ id: nouvelId(), date, articleId: article.id, quantite: -quantite, type: 'vente', documentId: venteId })
      }

      // 6. Les encaissements : un par mode de paiement utilisé.
      for (const p of v.paiements.filter((p) => p.montant > 0)) {
        await db.encaissements.add({ id: nouvelId(), date, type: 'paiement', modePaiementId: p.modePaiementId, montant: p.montant, venteId, clientId, serveurId: v.serveurId })
      }
      // 7. La livraison à faire, s'il y en a une.
      if (v.livraison) {
        await db.livraisons.add({ id: nouvelId(), venteId, date, adresse: v.livraison.adresse.trim(), telephone: v.livraison.telephone?.trim() || undefined, note: v.livraison.note?.trim() || undefined, statut: 'a_livrer' })
      }

      // 8. Les emballages consignés emportés ou rapportés par le client.
      for (const e of emballages) {
        const autres = { date, clientId, documentId: venteId }
        if (e.emportes) await db.mouvementsEmballage.add(mouvement('emporte_client', e.emballageId, e.emportes, autres))
        if (e.rendus) await db.mouvementsEmballage.add(mouvement('rendu_client', e.emballageId, e.rendus, autres))
      }
      return venteId
    },
  )
}

// Annule un ticket entier en créant un contre-ticket (on ne supprime jamais rien) :
// - quantités et montants négatifs, avec le même prix et le même coût que l'original ;
// - le stock revient (mouvement « retour », quantité positive) ;
// - l'argent est rendu par le même mode de paiement (encaissement « rendu », négatif).
export async function annulerVente(venteId: string): Promise<string> {
  return db.transaction(
    'rw',
    [db.ventes, db.lignesVente, db.mouvementsStock, db.encaissements, db.mouvementsEmballage, db.livraisons],
    async () => {
      const vente = await db.ventes.get(venteId)
      if (!vente) throw new Error('Ticket introuvable.')
      if (vente.annuleVenteId) throw new Error("Un ticket d'annulation ne peut pas être annulé.")
      if (vente.retourVenteId) throw new Error("Un ticket de retour ne peut pas être annulé.")
      const deja = await db.ventes.where('annuleVenteId').equals(venteId).first()
      if (deja) throw new Error(`Ce ticket est déjà annulé (ticket n° ${deja.numero}).`)
      if (await db.ventes.where('retourVenteId').equals(venteId).count()) {
        throw new Error('Des articles de ce ticket ont déjà été retournés : utilise « Retour d\'articles » pour le reste.')
      }

      const dernier = await db.ventes.orderBy('numero').last()
      const contreId = nouvelId()
      const date = new Date().toISOString()
      await db.ventes.add({
        id: contreId, numero: (dernier?.numero ?? 0) + 1, date,
        clientId: vente.clientId, serveurId: vente.serveurId, table: vente.table, total: -vente.total, annuleVenteId: venteId, tarif: vente.tarif,
      })

      const lignes = await db.lignesVente.where('venteId').equals(venteId).toArray()
      for (const l of lignes) {
        await db.lignesVente.add({ ...l, id: nouvelId(), venteId: contreId, quantite: -l.quantite })
        await db.mouvementsStock.add({ id: nouvelId(), date, articleId: l.articleId, quantite: l.quantite, type: 'retour', documentId: contreId })
      }

      const encaissements = await db.encaissements.where('venteId').equals(venteId).toArray()
      for (const e of encaissements) {
        await db.encaissements.add({ ...e, id: nouvelId(), date, type: 'rendu', montant: -e.montant, venteId: contreId })
      }
      // Les casiers emportés ou rapportés avec ce ticket sont aussi annulés (mouvements inverses).
      const emballages = await db.mouvementsEmballage.where('documentId').equals(venteId).toArray()
      for (const m of emballages) {
        await db.mouvementsEmballage.add({ ...m, id: nouvelId(), date, possession: -m.possession, du: -m.du, documentId: contreId, note: 'Annulation du ticket' })
      }
      // Une livraison pas encore faite n'a plus lieu d'être.
      await db.livraisons.where('venteId').equals(venteId).filter((l) => l.statut === 'a_livrer').modify({ statut: 'annulee' })
      return contreId
    },
  )
}

// Quantités déjà retournées pour chaque ligne d'un ticket (articleId → quantité).
export async function quantitesRetournees(venteId: string): Promise<Map<string, number>> {
  const retours = await db.ventes.where('retourVenteId').equals(venteId).toArray()
  const lignes = await db.lignesVente.where('venteId').anyOf(retours.map((r) => r.id)).toArray()
  const q = new Map<string, number>()
  for (const l of lignes) q.set(l.articleId, (q.get(l.articleId) ?? 0) - l.quantite) // lignes négatives
  return q
}

// Retour partiel : le client rapporte une partie des produits d'un ticket.
// On crée un ticket de retour (quantités et montant négatifs, prix d'origine),
// le stock revient, et l'argent est rendu par le mode choisi
// (si c'est le mode « crédit », la dette du client diminue).
export async function retournerArticles(
  venteId: string,
  retours: { articleId: string; quantite: number }[],
  modePaiementId: string,
): Promise<string> {
  return db.transaction('rw', [db.ventes, db.lignesVente, db.mouvementsStock, db.encaissements, db.modesPaiement], async () => {
    const vente = await db.ventes.get(venteId)
    if (!vente || vente.annuleVenteId || vente.retourVenteId) throw new Error('Ce ticket ne peut pas recevoir de retour.')
    if (await db.ventes.where('annuleVenteId').equals(venteId).count()) throw new Error('Ce ticket a déjà été annulé.')
    const mode = await db.modesPaiement.get(modePaiementId)
    if (!mode) throw new Error('Choisis comment rembourser le client.')
    if (mode.nature === 'credit' && !vente.clientId) throw new Error('Pas de client sur ce ticket : impossible de déduire de sa dette.')

    const lignes = await db.lignesVente.where('venteId').equals(venteId).toArray()
    const deja = await quantitesRetournees(venteId)
    const aRendre = retours.filter((r) => r.quantite > 0)
    if (aRendre.length === 0) throw new Error('Indique au moins une quantité à retourner.')

    const dernier = await db.ventes.orderBy('numero').last()
    const retourId = nouvelId()
    const date = new Date().toISOString()
    let total = 0
    for (const r of aRendre) {
      const l = lignes.find((x) => x.articleId === r.articleId)
      if (!l) throw new Error('Article absent du ticket.')
      const max = l.quantite - (deja.get(r.articleId) ?? 0)
      if (!Number.isInteger(r.quantite) || r.quantite > max) throw new Error(`${l.designation} : on ne peut retourner que ${max} au maximum.`)
      total += r.quantite * l.prixUnitaire
      await db.lignesVente.add({ ...l, id: nouvelId(), venteId: retourId, quantite: -r.quantite })
      await db.mouvementsStock.add({ id: nouvelId(), date, articleId: r.articleId, quantite: r.quantite, type: 'retour', documentId: retourId })
    }
    // Déduire de la dette : seulement dans la limite de ce que le client doit encore.
    if (mode.nature === 'credit') {
      const dette = await detteClient(vente.clientId!)
      if (total > dette) throw new Error(`Le client ne doit que ${fcfa(dette)} : rembourse plutôt en espèces ou en mobile money.`)
    }
    await db.ventes.add({ id: retourId, numero: (dernier?.numero ?? 0) + 1, date, clientId: vente.clientId, serveurId: vente.serveurId, table: vente.table, total: -total, retourVenteId: venteId, tarif: vente.tarif })
    await db.encaissements.add({ id: nouvelId(), date, type: 'rendu', modePaiementId, montant: -total, venteId: retourId, clientId: vente.clientId, serveurId: vente.serveurId })
    return retourId
  })
}

// Perte, casse, vol… : une sortie de stock avec un motif (sans argent).
export async function enregistrerPerte(articleId: string, quantite: number, motif: string) {
  if (!Number.isInteger(quantite) || quantite <= 0) throw new Error('La quantité doit être un nombre entier supérieur à 0.')
  await db.mouvementsStock.add({ id: nouvelId(), date: new Date().toISOString(), articleId, quantite: -quantite, type: 'perte', motif })
}
