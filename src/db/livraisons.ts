import { db } from './base'

// Les livraisons avec leur ticket et leur client, les plus anciennes à livrer d'abord.
export async function listeLivraisons() {
  const [livraisons, ventes, clients] = await Promise.all([
    db.livraisons.orderBy('date').toArray(), db.ventes.toArray(), db.clients.toArray(),
  ])
  const parVente = new Map(ventes.map((v) => [v.id, v]))
  const nomC = new Map(clients.map((c) => [c.id, c]))
  return livraisons.map((l) => {
    const v = parVente.get(l.venteId)
    const c = v?.clientId ? nomC.get(v.clientId) : undefined
    return { ...l, numero: v?.numero, total: v?.total ?? 0, client: c?.nom ?? '?', telephoneClient: l.telephone ?? c?.telephone }
  })
}

export async function marquerLivree(id: string, livreur: string) {
  const l = await db.livraisons.get(id)
  if (!l || l.statut !== 'a_livrer') throw new Error('Cette livraison n\'est plus à faire.')
  await db.livraisons.update(id, { statut: 'livree', livreeLe: new Date().toISOString(), livreur: livreur.trim() || undefined })
}
