import { db, nouvelId } from './base'
import type { Encaissement } from './types'
import { fcfa } from '../outils/format'

// La dette d'un client = tout ce qu'il a pris à crédit − tout ce qu'il a remboursé.
// (Une annulation de ticket crée un « rendu » négatif en crédit : la dette baisse d'elle-même.)
export async function detteClient(clientId: string): Promise<number> {
  const credit = await modeCredit()
  let dette = 0
  await db.encaissements.where('clientId').equals(clientId).each((e) => {
    if (e.type === 'remboursement_credit') dette -= e.montant
    else if (e.modePaiementId === credit?.id) dette += e.montant
  })
  return dette
}

export async function modeCredit() {
  return (await db.modesPaiement.toArray()).find((m) => m.nature === 'credit')
}

// Dette de tous les clients d'un coup (pour la liste).
export async function dettesParClient(): Promise<Map<string, number>> {
  const credit = await modeCredit()
  const dettes = new Map<string, number>()
  await db.encaissements.filter((e) => !!e.clientId).each((e) => {
    const signe = e.type === 'remboursement_credit' ? -1 : e.modePaiementId === credit?.id ? 1 : 0
    if (signe) dettes.set(e.clientId!, (dettes.get(e.clientId!) ?? 0) + signe * e.montant)
  })
  return dettes
}

// Le client règle tout ou partie de sa dette. Renvoie l'encaissement créé (pour le reçu).
// serveurId : qui a reçu l'argent (il le remettra à la clôture de caisse).
export async function enregistrerRemboursement(clientId: string, montant: number, modePaiementId: string, serveurId?: string): Promise<Encaissement> {
  return db.transaction('rw', [db.encaissements, db.modesPaiement, db.clients], async () => {
    if (!Number.isInteger(montant) || montant <= 0) throw new Error('Le montant doit être un nombre entier supérieur à 0.')
    const mode = await db.modesPaiement.get(modePaiementId)
    if (!mode || mode.nature === 'credit') throw new Error('Choisis comment le client paie (espèces, mobile money…).')
    const dette = await detteClient(clientId)
    if (montant > dette) throw new Error(`Le client ne doit que ${fcfa(dette)}.`)
    const e: Encaissement = { id: nouvelId(), date: new Date().toISOString(), type: 'remboursement_credit', modePaiementId, montant, clientId, serveurId }
    await db.encaissements.add(e)
    return e
  })
}

export interface LigneHistorique {
  id: string
  date: string
  libelle: string
  credit: number // ce qui augmente la dette
  remboursement: number // ce qui la diminue
}

// L'historique du compte d'un client : ventes à crédit, annulations et remboursements.
export async function historiqueClient(clientId: string): Promise<LigneHistorique[]> {
  const credit = await modeCredit()
  const modes = new Map((await db.modesPaiement.toArray()).map((m) => [m.id, m.nom]))
  const encaissements = await db.encaissements.where('clientId').equals(clientId).sortBy('date')
  const ventes = new Map((await db.ventes.where('clientId').equals(clientId).toArray()).map((v) => [v.id, v]))
  const lignes: LigneHistorique[] = []
  for (const e of encaissements) {
    if (e.type === 'remboursement_credit') {
      lignes.push({ id: e.id, date: e.date, libelle: `Remboursement (${modes.get(e.modePaiementId)})`, credit: 0, remboursement: e.montant })
    } else if (e.modePaiementId === credit?.id) {
      const v = e.venteId ? ventes.get(e.venteId) : undefined
      const libelle = v?.annuleVenteId ? `Annulation (ticket n° ${v.numero})` : v?.retourVenteId ? `Retour de produits (ticket n° ${v.numero})` : `Achat à crédit (ticket n° ${v?.numero ?? '?'})`
      if (e.montant >= 0) lignes.push({ id: e.id, date: e.date, libelle, credit: e.montant, remboursement: 0 })
      else lignes.push({ id: e.id, date: e.date, libelle, credit: 0, remboursement: -e.montant })
    }
  }
  return lignes
}

// Depuis quand le client doit de l'argent : on solde ses achats à crédit du plus ancien au plus récent
// avec ses remboursements (et annulations / retours) ; la date du plus ancien achat pas encore payé
// est le début de la dette. Renvoie null si le client ne doit rien.
export async function debutDeLaDette(clientId: string): Promise<string | null> {
  const lignes = await historiqueClient(clientId)
  const restants: { date: string; reste: number }[] = []
  let avoir = 0 // remboursé en avance
  for (const l of lignes) {
    if (l.credit > 0) {
      const utilise = Math.min(avoir, l.credit)
      avoir -= utilise
      if (l.credit - utilise > 0) restants.push({ date: l.date, reste: l.credit - utilise })
    }
    let r = l.remboursement
    while (r > 0 && restants.length) {
      const pris = Math.min(r, restants[0].reste)
      restants[0].reste -= pris
      r -= pris
      if (restants[0].reste === 0) restants.shift()
    }
    avoir += r
  }
  return restants[0]?.date ?? null
}

// Nombre de jours entre une date ISO et aujourd'hui.
export const joursDepuis = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

// Au-delà de ce nombre de jours, un crédit est « à relancer ».
export const DELAI_RELANCE = 30

export function messageRelance(nomClient: string, dette: number, nomBoutique: string, depuis: string | null) {
  const montant = fcfa(dette)
  const quand = depuis ? ` depuis le ${new Date(depuis).toLocaleDateString('fr-FR')}` : ''
  return `Bonjour ${nomClient}, c'est ${nomBoutique}. Petit rappel amical : il reste ${montant} à régler sur votre compte${quand}. Vous pouvez passer au maquis quand cela vous arrange. Merci et bonne journée !`
}
