import { db, nouvelId } from './base'
import { bornesJournee, DEBUT_JOURNEE_DEFAUT } from './journee'
import type { Cloture } from './types'

// Ce qu'un serveur a fait pendant une journée commerciale.
export interface BilanServeur {
  serveurId: string
  nom: string
  tickets: number // tickets valides (hors annulations et retours)
  chiffreAffaires: number // net des annulations et retours
  especes: number // espèces encaissées moins espèces rendues
  mobileMoney: number
  credit: number // vendu à crédit (argent que le serveur n'a pas reçu)
  remboursements: number // crédits remboursés reçus par ce serveur (déjà compris dans especes / mobileMoney)
  consignes: number // consignes d'emballages reçues (+) ou payées au fournisseur (−), déjà comprises dans especes / mobileMoney
  dejaCloture: number // espèces déjà comptées dans une clôture précédente de la même journée
  attendu: number // espèces qu'il doit encore remettre = especes − dejaCloture
  clotures: Cloture[]
}

export async function debutJournee() {
  return (await db.boutique.get('principale'))?.debutJournee ?? DEBUT_JOURNEE_DEFAUT
}

// Bilan de chaque serveur pour une journée : serveurs actifs + ceux qui ont vendu ce jour-là.
export async function bilansJournee(journee: string): Promise<BilanServeur[]> {
  const { du, au } = bornesJournee(journee, await debutJournee())
  const [serveurs, ventes, encaissements, modes, clotures] = await Promise.all([
    db.serveurs.toArray(),
    db.ventes.where('date').between(du, au, true, false).toArray(),
    db.encaissements.where('date').between(du, au, true, false).toArray(),
    db.modesPaiement.toArray(),
    db.clotures.where('journee').equals(journee).toArray(),
  ])
  const nature = new Map(modes.map((m) => [m.id, m.nature]))
  const annulees = new Set(ventes.map((v) => v.annuleVenteId).filter(Boolean))

  const bilans: BilanServeur[] = []
  for (const s of serveurs) {
    const sesVentes = ventes.filter((v) => v.serveurId === s.id)
    const sesEnc = encaissements.filter((e) => e.serveurId === s.id)
    const somme = (n: string) => sesEnc.filter((e) => nature.get(e.modePaiementId) === n).reduce((x, e) => x + e.montant, 0)
    const sesClotures = clotures.filter((c) => c.serveurId === s.id).sort((a, b) => a.date.localeCompare(b.date))
    if (!s.actif && sesVentes.length === 0 && sesClotures.length === 0) continue
    const especes = somme('especes')
    const dejaCloture = sesClotures.reduce((x, c) => x + c.attendu, 0)
    bilans.push({
      serveurId: s.id,
      nom: s.nom,
      tickets: sesVentes.filter((v) => !v.annuleVenteId && !v.retourVenteId && !annulees.has(v.id)).length,
      chiffreAffaires: sesVentes.reduce((x, v) => x + v.total, 0),
      especes,
      mobileMoney: somme('mobile_money'),
      credit: somme('credit'),
      remboursements: sesEnc.filter((e) => e.type === 'remboursement_credit').reduce((x, e) => x + e.montant, 0),
      consignes: sesEnc.filter((e) => e.type === 'consigne').reduce((x, e) => x + e.montant, 0),
      dejaCloture,
      attendu: especes - dejaCloture,
      clotures: sesClotures,
    })
  }
  return bilans.sort((a, b) => a.nom.localeCompare(b.nom))
}

// Enregistre la clôture d'un serveur : l'attendu est recalculé ici, au moment de clôturer,
// pour qu'il corresponde exactement aux ventes enregistrées.
export async function cloturer(journee: string, serveurId: string, remis: number, note?: string): Promise<Cloture> {
  if (!Number.isInteger(remis) || remis < 0) throw new Error("L'argent remis doit être un nombre entier positif (0 si rien).")
  return db.transaction('rw', [db.clotures, db.serveurs, db.ventes, db.encaissements, db.modesPaiement, db.boutique], async () => {
    const bilan = (await bilansJournee(journee)).find((b) => b.serveurId === serveurId)
    if (!bilan) throw new Error('Serveur introuvable pour cette journée.')
    const cloture: Cloture = {
      id: nouvelId(), date: new Date().toISOString(), journee, serveurId,
      attendu: bilan.attendu, remis, ecart: remis - bilan.attendu, note: note?.trim() || undefined,
    }
    await db.clotures.add(cloture)
    return cloture
  })
}
