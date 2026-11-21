import { strFromU8, unzipSync } from 'fflate'

// Lit la première feuille d'un fichier Excel (.xlsx) et renvoie ses lignes en texte.
// Un .xlsx est un zip de fichiers XML : on lit le classeur, trouve la première feuille,
// puis chaque cellule (texte partagé, texte direct, nombre ou formule déjà calculée).
export async function lireExcel(fichier: File): Promise<string[][]> {
  let zip: Record<string, Uint8Array>
  try {
    zip = unzipSync(new Uint8Array(await fichier.arrayBuffer()))
  } catch {
    throw new Error("Ce fichier n'est pas un fichier Excel (.xlsx). Dans Excel, fais « Enregistrer sous » au format Classeur Excel (.xlsx).")
  }
  const lire = (chemin: string) => (zip[chemin] ? new DOMParser().parseFromString(strFromU8(zip[chemin]), 'application/xml') : null)
  const classeur = lire('xl/workbook.xml')
  if (!classeur) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).")

  // Première feuille : son identifiant mène, via les liens du classeur, au fichier XML de la feuille.
  const premiere = classeur.getElementsByTagName('sheet')[0]
  const rid = premiere?.getAttribute('r:id') ?? premiere?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  let cible = 'worksheets/sheet1.xml'
  const liens = lire('xl/_rels/workbook.xml.rels')
  if (liens && rid) {
    for (const l of Array.from(liens.getElementsByTagName('Relationship'))) {
      if (l.getAttribute('Id') === rid) cible = l.getAttribute('Target') ?? cible
    }
  }
  const chemin = cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`
  const feuille = lire(chemin)
  if (!feuille) throw new Error('La première feuille du classeur est introuvable.')

  // Textes partagés : Excel range chaque texte une seule fois et y renvoie par un numéro.
  const partages: string[] = []
  const ss = lire('xl/sharedStrings.xml')
  if (ss) for (const si of Array.from(ss.getElementsByTagName('si'))) {
    partages.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''))
  }

  const lignes: string[][] = []
  for (const row of Array.from(feuille.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r')) - 1
    const ligne: string[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const col = colonne(c.getAttribute('r') ?? '')
      const type = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let texte = ''
      if (type === 's') texte = partages[Number(v)] ?? ''
      else if (type === 'inlineStr') texte = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')
      else if (type === 'b') texte = v === '1' ? 'OUI' : ''
      else texte = v
      ligne[col] = texte.trim()
    }
    lignes[r >= 0 ? r : lignes.length] = Array.from(ligne, (x) => x ?? '')
  }
  return Array.from(lignes, (l) => l ?? [])
}

// « C12 » → 2 (colonne C, en partant de 0).
function colonne(ref: string) {
  const lettres = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const ch of lettres) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
