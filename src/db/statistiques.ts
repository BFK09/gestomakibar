import { db } from './base'
import { stockParArticle } from './stock'

export interface Resume {
  chiffreAffaires: number // net : les annulations sont déduites
  marge: number // chiffre d'affaires − coût d'achat des articles vendus (coût figé sur la ligne)
  tickets: number // tickets valides (ni annulés, ni contre-tickets)
  panierMoyen: number
  parMode: { nom: string; montant: number }[]
  remboursements: number // dettes de clients encaissées pendant la période
  meilleurs: { designation: string; quantite: number; montant: number }[]
}

// Calcule les chiffres d'une période [debut, fin[ (dates ISO).
export async function resumePeriode(debut: string, fin: string): Promise<Resume> {
  const ventes = await db.ventes.where('date').between(debut, fin, true, false).toArray()
  const ids = ventes.map((v) => v.id)
  const lignes = await db.lignesVente.where('venteId').anyOf(ids).toArray()
  const encaissements = await db.encaissements.where('venteId').anyOf(ids).toArray()
  const modes = await db.modesPaiement.toCollection().sortBy('ordre')
  const remboursements = (await db.encaissements.where('date').between(debut, fin, true, false).filter((e) => e.type === 'remboursement_credit').toArray())
    .reduce((s, e) => s + e.montant, 0)

  // Un contre-ticket a des quantités négatives : en additionnant tout, l'annulation s'efface d'elle-même.
  const chiffreAffaires = ventes.reduce((s, v) => s + v.total, 0)
  const marge = lignes.reduce((s, l) => s + l.quantite * (l.prixUnitaire - l.coutUnitaire), 0)
  const annulees = new Set(ventes.map((v) => v.annuleVenteId).filter(Boolean))
  const tickets = ventes.filter((v) => !v.annuleVenteId && !v.retourVenteId && !annulees.has(v.id)).length

  const parArticle = new Map<string, { designation: string; quantite: number; montant: number }>()
  for (const l of lignes) {
    const x = parArticle.get(l.articleId) ?? { designation: l.designation, quantite: 0, montant: 0 }
    x.quantite += l.quantite
    x.montant += l.quantite * l.prixUnitaire
    parArticle.set(l.articleId, x)
  }
  const meilleurs = [...parArticle.values()].filter((x) => x.quantite > 0).sort((a, b) => b.montant - a.montant).slice(0, 5)

  return {
    chiffreAffaires,
    marge,
    tickets,
    panierMoyen: tickets ? Math.round(chiffreAffaires / tickets) : 0,
    parMode: modes.map((m) => ({
      nom: m.nom,
      montant: encaissements.filter((e) => e.modePaiementId === m.id).reduce((s, e) => s + e.montant, 0),
    })),
    meilleurs,
    remboursements,
  }
}

// Chiffre d'affaires de chacun des 7 derniers jours (aujourd'hui compris).
export async function ventesSeptJours(): Promise<{ jour: Date; montant: number }[]> {
  const jours: { jour: Date; montant: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = debutDuJour(); d.setDate(d.getDate() - i)
    jours.push({ jour: d, montant: 0 })
  }
  const ventes = await db.ventes.where('date').aboveOrEqual(jours[0].jour.toISOString()).toArray()
  for (const v of ventes) {
    const d = new Date(v.date); d.setHours(0, 0, 0, 0)
    const j = jours.find((x) => x.jour.getTime() === d.getTime())
    if (j) j.montant += v.total
  }
  return jours
}

export interface EtatStock {
  alertes: { code: string; designation: string; stock: number; seuil: number | null }[]
  sansSeuil: number // produits actifs sans seuil d'alerte
  valeurAchat: number // valeur du stock au coût moyen
}

// Produits à recommander : stock sous le seuil, ou stock négatif (erreur à corriger par un inventaire).
export async function etatDuStock(): Promise<EtatStock> {
  const articles = await db.articles.filter((a) => a.actif).toArray()
  const stocks = await stockParArticle()
  const alertes: EtatStock['alertes'] = []
  let valeurAchat = 0
  for (const a of articles) {
    const s = stocks.get(a.id) ?? 0
    if (s > 0) valeurAchat += s * (a.coutMoyen ?? 0)
    if (s < 0 || (a.seuilAlerte !== null && s <= a.seuilAlerte)) {
      alertes.push({ code: a.code, designation: a.designation, stock: s, seuil: a.seuilAlerte })
    }
  }
  alertes.sort((x, y) => x.stock - y.stock)
  return { alertes, sansSeuil: articles.filter((a) => a.seuilAlerte === null).length, valeurAchat }
}

export function debutDuJour(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}
