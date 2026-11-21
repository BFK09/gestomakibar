import { db } from './base'

// Format du fichier de sauvegarde : un simple fichier texte JSON,
// lisible et indépendant de l'appareil (téléphone, ordinateur…).
const APPLICATION = 'gestomakibar-bfk-tech'
const FORMAT = 1

export interface FichierSauvegarde {
  application: string
  format: number
  versionBase: number
  date: string
  tables: Record<string, unknown[]>
}

// Copie toutes les tables de la base dans un objet.
export async function exporterBase(): Promise<FichierSauvegarde> {
  return db.transaction('r', db.tables, async () => {
    const tables: Record<string, unknown[]> = {}
    for (const table of db.tables) tables[table.name] = await table.toArray()
    return { application: APPLICATION, format: FORMAT, versionBase: db.verno, date: new Date().toISOString(), tables }
  })
}

export function nomDeFichier(date = new Date()) {
  const d = (n: number) => String(n).padStart(2, '0')
  return `gestomakibar-sauvegarde-${date.getFullYear()}-${d(date.getMonth() + 1)}-${d(date.getDate())}-${d(date.getHours())}h${d(date.getMinutes())}.json`
}

// Fabrique le fichier, le télécharge, et note la date de la dernière sauvegarde.
export async function telechargerSauvegarde(): Promise<File> {
  // On note la date AVANT l'export, pour qu'elle soit aussi dans le fichier.
  await noterSauvegarde()
  const contenu = await exporterBase()
  const fichier = new File([JSON.stringify(contenu)], nomDeFichier(), { type: 'application/json' })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(fichier)
  lien.download = fichier.name
  lien.click()
  setTimeout(() => URL.revokeObjectURL(lien.href), 10_000)
  return fichier
}

export async function noterSauvegarde() {
  await db.boutique.update('principale', { derniereSauvegarde: new Date().toISOString() })
}

// Lit un fichier choisi par l'utilisateur et vérifie que c'est bien une sauvegarde valable.
export async function lireSauvegarde(fichier: File): Promise<FichierSauvegarde> {
  let donnees: FichierSauvegarde
  try {
    donnees = JSON.parse(await fichier.text())
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde lisible.")
  }
  if (donnees?.application !== APPLICATION) throw new Error("Ce fichier n'est pas une sauvegarde de l'application GESTOMAKIBAR.")
  if (donnees.format > FORMAT || donnees.versionBase > db.verno) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'application. Mets l'application à jour d'abord.")
  }
  const connues = new Set(db.tables.map((t) => t.name))
  for (const [nom, lignes] of Object.entries(donnees.tables ?? {})) {
    if (!connues.has(nom)) throw new Error(`Table inconnue dans le fichier : ${nom}.`)
    if (!Array.isArray(lignes)) throw new Error(`La table ${nom} est abîmée dans le fichier.`)
  }
  if (!donnees.tables?.articles) throw new Error('Le fichier ne contient pas de catalogue.')
  return donnees
}

// Remplace TOUTES les données actuelles par celles du fichier, en un seul bloc :
// si quelque chose échoue, rien n'est changé.
export async function restaurerBase(donnees: FichierSauvegarde) {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const lignes = donnees.tables[table.name]
      if (lignes?.length) await table.bulkAdd(lignes)
    }
    // Une sauvegarde faite avec une ancienne version peut manquer de champs ajoutés depuis :
    // on les complète comme le fait la mise à jour de la base.
    const modes = await db.modesPaiement.toArray()
    for (const [i, m] of modes.entries()) {
      const n = String(m.nom).toLowerCase()
      await db.modesPaiement.update(m.id, {
        nature: m.nature ?? (n.startsWith('esp') ? 'especes' : n.includes('mobile') ? 'mobile_money' : n.startsWith('cr') ? 'credit' : 'autre'),
        ordre: m.ordre ?? i + 1,
        actif: m.actif ?? true,
      })
    }
  })
}
