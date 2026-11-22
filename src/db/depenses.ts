import { db, nouvelId } from './base'
import type { Depense } from './types'

// Catégories proposées. Les achats de boissons n'y sont pas : ils passent par la réception.
export const CATEGORIES_DEPENSES = ['Loyer', 'Électricité', 'Eau', 'Salaires', 'Glace', 'Transport', 'Entretien, réparations', 'Taxes, mairie', 'Divers']

interface NouvelleDepense { categorie: string; montant: number; serveurId?: string; note?: string; saisiPar?: string; date?: string }

export async function ajouterDepense(d: NouvelleDepense): Promise<Depense> {
  if (!d.categorie.trim()) throw new Error('Choisis une catégorie.')
  if (!Number.isInteger(d.montant) || d.montant <= 0) throw new Error('Le montant doit être un nombre entier plus grand que 0.')
  const depense: Depense = {
    id: nouvelId(), date: d.date ?? new Date().toISOString(), categorie: d.categorie.trim(), montant: d.montant,
    serveurId: d.serveurId || undefined, note: d.note?.trim() || undefined, saisiPar: d.saisiPar || undefined,
  }
  await db.depenses.add(depense)
  return depense
}

// Une dépense prise sur les espèces d'un serveur ne peut plus être supprimée une fois ce serveur clôturé après elle :
// sinon l'attendu de sa clôture ne correspondrait plus.
export async function peutSupprimerDepense(d: Depense) {
  if (!d.serveurId) return true
  return (await db.clotures.where('serveurId').equals(d.serveurId).filter((c) => c.date >= d.date).count()) === 0
}

export async function supprimerDepense(id: string) {
  const d = await db.depenses.get(id)
  if (!d) return
  if (!(await peutSupprimerDepense(d))) throw new Error('Cette dépense est déjà comptée dans une clôture de caisse : elle ne peut plus être supprimée.')
  await db.depenses.delete(id)
}

export async function depensesEntre(du: string, au: string) {
  return db.depenses.where('date').between(du, au, true, false).toArray()
}

export const totalDepenses = (liste: Depense[]) => liste.reduce((s, d) => s + d.montant, 0)
