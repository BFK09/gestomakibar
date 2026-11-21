import { db, nouvelId } from './base'
import { stockParArticle } from './stock'
import type { Emballage, MouvementEmballage } from './types'

export const NOMS_NATURES: Record<MouvementEmballage['nature'], string> = {
  livre: 'Livré plein',
  rendu_fournisseur: 'Vides rendus au fournisseur',
  consigne_fournisseur: 'Consigne payée au fournisseur',
  emporte_client: 'Emporté par le client',
  rendu_client: 'Vides rapportés par le client',
  consigne_client: 'Consigne payée par le client',
  ajustement: 'Correction',
}

// Ce que chaque mouvement change, selon ce qui s'est passé (quantité toujours positive à la saisie).
// [possession, du] ; « du » se lit côté fournisseur ou côté client selon le mouvement.
const EFFETS: Record<Exclude<MouvementEmballage['nature'], 'ajustement'>, [number, number]> = {
  livre: [1, 1],
  rendu_fournisseur: [-1, -1],
  consigne_fournisseur: [0, -1],
  emporte_client: [-1, 1],
  rendu_client: [1, -1],
  consigne_client: [0, -1],
}

export function mouvement(
  nature: Exclude<MouvementEmballage['nature'], 'ajustement'>, emballageId: string, quantite: number,
  autres: Partial<MouvementEmballage> & { date: string },
): MouvementEmballage {
  const [p, d] = EFFETS[nature]
  return { id: nouvelId(), emballageId, nature, possession: p * quantite, du: d * quantite, ...autres }
}

export interface SoldeEmballage {
  emballage: Emballage
  possession: number // emballages chez nous, pleins + entamés + vides
  pleins: number // casiers pleins en stock (d'après le stock des boissons rattachées)
  entames: number // casiers commencés
  vides: number // possession − pleins − entamés
  duFournisseurs: { id: string; nom: string; quantite: number }[] // positif = on doit
  duClients: { id: string; nom: string; quantite: number }[] // positif = le client doit
}

// Les soldes de chaque type d'emballage.
export async function soldesEmballages(): Promise<SoldeEmballage[]> {
  const [emballages, mouvements, articles, fournisseurs, clients, stocks] = await Promise.all([
    db.emballages.orderBy('nom').toArray(),
    db.mouvementsEmballage.toArray(),
    db.articles.toArray(),
    db.fournisseurs.toArray(),
    db.clients.toArray(),
    stockParArticle(),
  ])
  const nomF = new Map(fournisseurs.map((f) => [f.id, f.nom]))
  const nomC = new Map(clients.map((c) => [c.id, c.nom]))
  return emballages.map((e) => {
    const ses = mouvements.filter((m) => m.emballageId === e.id)
    const possession = ses.reduce((s, m) => s + m.possession, 0)
    let pleins = 0
    let entames = 0
    for (const a of articles.filter((x) => x.emballageId === e.id && x.tailleCasier)) {
      const stock = Math.max(stocks.get(a.id) ?? 0, 0)
      pleins += Math.floor(stock / a.tailleCasier!)
      if (stock % a.tailleCasier! > 0) entames++
    }
    const parTiers = (cle: 'fournisseurId' | 'clientId', noms: Map<string, string>) => {
      const t = new Map<string, number>()
      for (const m of ses) if (m[cle]) t.set(m[cle]!, (t.get(m[cle]!) ?? 0) + m.du)
      return [...t].filter(([, q]) => q !== 0).map(([id, quantite]) => ({ id, nom: noms.get(id) ?? '?', quantite })).sort((a, b) => b.quantite - a.quantite)
    }
    return { emballage: e, possession, pleins, entames, vides: possession - pleins - entames, duFournisseurs: parTiers('fournisseurId', nomF), duClients: parTiers('clientId', nomC) }
  })
}

// Ce qu'un client doit en emballages (par type), pour la caisse et sa fiche.
export async function emballagesDusParClient(clientId: string): Promise<Map<string, number>> {
  const t = new Map<string, number>()
  await db.mouvementsEmballage.where('clientId').equals(clientId).each((m) => t.set(m.emballageId, (t.get(m.emballageId) ?? 0) + m.du))
  return t
}

export async function enregistrerEmballage(id: string | null, nom: string, consigne: number | null, actif: boolean) {
  const n = nom.trim()
  if (!n) throw new Error("Donne un nom à l'emballage (ex. Casier Solibra 12).")
  if (consigne !== null && (!Number.isInteger(consigne) || consigne < 0)) throw new Error('La consigne doit être un nombre entier positif.')
  const doublon = (await db.emballages.toArray()).find((e) => e.nom.toLowerCase() === n.toLowerCase() && e.id !== id)
  if (doublon) throw new Error('Un emballage porte déjà ce nom.')
  if (id) await db.emballages.update(id, { nom: n, consigne, actif })
  else await db.emballages.add({ id: nouvelId(), nom: n, consigne, actif: true })
}

// Prépare les casiers habituels : un type par taille de casier des bières et sucreries en bouteille,
// et rattache ces boissons à leur casier. Ne touche pas aux boissons déjà rattachées.
// Les boissons déjà en stock sont dans leurs casiers : ces casiers sont comptés « chez toi » (solde de départ).
export async function preparerCasiers(): Promise<number> {
  return db.transaction('rw', [db.emballages, db.articles, db.categories, db.mouvementsStock, db.mouvementsEmballage], async () => {
    const stocks = await stockParArticle()
    const categories = new Map((await db.categories.toArray()).map((c) => [c.id, c.nom.toLowerCase()]))
    const verre = (await db.articles.toArray()).filter((a) =>
      !a.emballageId && a.tailleCasier && a.unite.toLowerCase() === 'bouteille' &&
      /bi[eè]re|sucrerie/.test(categories.get(a.categorieId) ?? ''))
    const existants = await db.emballages.toArray()
    let rattaches = 0
    for (const taille of [...new Set(verre.map((a) => a.tailleCasier!))].sort((a, b) => a - b)) {
      const nom = `Casier ${taille}`
      const e = existants.find((x) => x.nom.toLowerCase() === nom.toLowerCase())
      const id = e?.id ?? nouvelId()
      if (!e) await db.emballages.add({ id, nom, consigne: null, actif: true })
      let enStock = 0
      for (const a of verre.filter((x) => x.tailleCasier === taille)) {
        await db.articles.update(a.id, { emballageId: id }); rattaches++
        enStock += Math.ceil(Math.max(stocks.get(a.id) ?? 0, 0) / taille)
      }
      if (enStock > 0) await db.mouvementsEmballage.add({ id: nouvelId(), date: new Date().toISOString(), emballageId: id, nature: 'ajustement', possession: enStock, du: 0, note: 'Casiers des boissons déjà en stock' })
    }
    return rattaches
  })
}

// Un mouvement saisi à la main dans l'écran Emballages.
export interface SaisieEmballage {
  emballageId: string
  nature: MouvementEmballage['nature']
  quantite: number // toujours positive, sauf ajustement (+ ou −)
  fournisseurId?: string
  clientId?: string
  montant?: number
  note?: string
}

export async function enregistrerMouvementEmballage(s: SaisieEmballage) {
  if (!Number.isInteger(s.quantite) || s.quantite === 0) throw new Error('Indique un nombre entier de casiers.')
  if (s.nature !== 'ajustement' && s.quantite < 0) throw new Error('La quantité doit être positive.')
  if (s.nature.endsWith('fournisseur') && !s.fournisseurId) throw new Error('Choisis le fournisseur.')
  if (s.nature.endsWith('client') && !s.clientId) throw new Error('Choisis le client.')
  if (s.montant !== undefined && (!Number.isInteger(s.montant) || s.montant < 0)) throw new Error('Le montant doit être un nombre entier positif.')
  const date = new Date().toISOString()
  const base = { date, fournisseurId: s.fournisseurId, clientId: s.clientId, montant: s.montant, note: s.note?.trim() || undefined }
  const m: MouvementEmballage = s.nature === 'ajustement'
    ? { id: nouvelId(), emballageId: s.emballageId, nature: 'ajustement', possession: s.quantite, du: 0, ...base }
    : mouvement(s.nature, s.emballageId, s.quantite, base)
  await db.mouvementsEmballage.add(m)
}

// Solde de départ envers un fournisseur ou d'un client (emballages déjà dus le jour où l'on commence).
export async function soldeDeDepart(emballageId: string, quantite: number, tiers: { fournisseurId?: string; clientId?: string }, note?: string) {
  if (!Number.isInteger(quantite) || quantite === 0) throw new Error('Indique un nombre entier de casiers.')
  await db.mouvementsEmballage.add({ id: nouvelId(), date: new Date().toISOString(), emballageId, nature: 'ajustement', possession: 0, du: quantite, ...tiers, note: note?.trim() || 'Solde de départ' })
}

export async function historiqueEmballages(limite = 100) {
  const [mouvements, emballages, fournisseurs, clients] = await Promise.all([
    db.mouvementsEmballage.orderBy('date').reverse().limit(limite).toArray(),
    db.emballages.toArray(), db.fournisseurs.toArray(), db.clients.toArray(),
  ])
  const nomE = new Map(emballages.map((e) => [e.id, e.nom]))
  const nomF = new Map(fournisseurs.map((f) => [f.id, f.nom]))
  const nomC = new Map(clients.map((c) => [c.id, c.nom]))
  return mouvements.map((m) => ({
    ...m,
    emballage: nomE.get(m.emballageId) ?? '?',
    tiers: m.fournisseurId ? nomF.get(m.fournisseurId) : m.clientId ? nomC.get(m.clientId) : undefined,
  }))
}
