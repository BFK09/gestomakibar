import { db, nouvelId } from '../db/base'
import type { Article, Categorie } from '../db/types'
import { codeSuivant } from '../catalogue/codeSuivant'
import { fichierExcel } from '../outils/excel'
import { lireEntier } from '../outils/format'
import { lireExcel } from '../outils/lireExcel'
import { monnaie } from '../outils/pays'
import { sansAccents } from '../outils/texte'

// Le fichier Excel de l'étape 2 de l'assistant : à télécharger, remplir dans Excel, puis importer.
// Il reprend les produits standard ; on peut aussi ajouter des lignes pour de nouveaux produits.

export interface Saisie { stock: string; prixAchat: string; prixVente: string }

const COLONNES = ['Code', 'Produit', 'Catégorie', 'Unité', 'Je vends (OUI)', 'Stock', "Prix d'achat", 'Prix de vente', 'Code-barres', "Seuil d'alerte"]

export function modeleExcel(articles: Article[], categories: Categorie[]): Blob {
  const nomCat = new Map(categories.map((c) => [c.id, c.nom]))
  const lignes = articles
    .slice()
    .sort((a, b) => (nomCat.get(a.categorieId) ?? '').localeCompare(nomCat.get(b.categorieId) ?? '') || a.code.localeCompare(b.code))
    .map((a) => [a.code, a.designation, nomCat.get(a.categorieId) ?? '', a.unite, '', null, null, null, a.codeBarre ?? '', a.seuilAlerte])
  const m = monnaie()
  return fichierExcel([
    { nom: 'Produits', lignes: [COLONNES, ...lignes], largeurs: [11, 42, 22, 10, 15, 9, 13, 14, 16, 13] },
    {
      nom: "Mode d'emploi",
      largeurs: [110],
      lignes: [
        ['Comment remplir ce fichier'],
        ["1. Dans la feuille « Produits », écris OUI dans la colonne « Je vends » pour chaque produit que tu vends."],
        ["2. Pour ces produits, remplis le Stock (la quantité que tu as aujourd'hui, 0 si tu n'en as pas encore),"],
        [`   le Prix d'achat et le Prix de vente d'une unité, en ${m}, en nombres entiers sans espace ni lettre (ex. 1500).`],
        ['3. Facultatif : Unité (pièce, paquet, rame…), Code-barres (le numéro sous les barres), Seuil d\'alerte (stock minimum).'],
        ["4. Un produit manque ? Ajoute une ligne en bas : laisse le Code vide, écris le Produit et sa Catégorie."],
        ['   Si la catégorie n\'existe pas encore, elle sera créée. Sans catégorie, le produit va dans « Divers ».'],
        ['5. Ne change pas les titres de la première ligne. Les lignes sans OUI et sans chiffres sont ignorées.'],
        ["6. Enregistre au format Excel (.xlsx), puis dans l'application : étape 2 → « Importer le fichier rempli »."],
        ["   Tu verras ensuite tous les produits cochés et remplis : vérifie, corrige si besoin, puis « Suivant »."],
        [''],
        ['Catégories existantes :'],
        ...categories.map((c) => [`- ${c.nom}`]),
      ],
    },
  ])
}

const OUI = new Set(['oui', 'o', 'x', 'yes', 'y', '1', 'vrai', 'true'])

// Retrouve une colonne par son titre, sans tenir compte des accents, majuscules ni espaces.
function indexColonnes(titres: string[]) {
  const n = titres.map((t) => sansAccents(t).replace(/[^a-z]/g, ''))
  const chercher = (...mots: string[]) => n.findIndex((t) => mots.some((m) => t.startsWith(m)))
  return {
    code: n.findIndex((t) => t === 'code' || t === 'ref' || t === 'reference'),
    produit: chercher('produit', 'designation', 'article', 'nom'),
    categorie: chercher('categorie'),
    unite: chercher('unite'),
    vend: chercher('jevends', 'vend'),
    stock: chercher('stock', 'quantite'),
    achat: chercher('prixdachat', 'prixachat', 'achat'),
    vente: chercher('prixdevente', 'prixvente', 'vente'),
    barre: chercher('codebarre'),
    seuil: chercher('seuil'),
  }
}

// Nombre lu dans Excel : « 1500 », « 1 500 » ou « 1500.0 » deviennent « 1500 ».
function nombre(texte: string) {
  const t = texte.replace(/\s/g, '')
  if (/^\d+(\.0+)?$/.test(t)) return String(Number(t))
  return texte
}

export interface ResultatImport { choix: Record<string, Saisie>; importes: number; nouveaux: number; remarques: string[] }

// Lit le fichier rempli, crée les produits et catégories manquants, met à jour unité,
// code-barres et seuil, et renvoie les produits à cocher avec leur stock et leurs prix.
export async function importerProduits(fichier: File): Promise<ResultatImport> {
  const lignes = await lireExcel(fichier)
  const iTitre = lignes.findIndex((l) => l.some((c) => /^(produit|designation)$/i.test(sansAccents(c ?? ''))))
  if (iTitre < 0) throw new Error("Colonne « Produit » introuvable. Utilise le modèle proposé, sans changer les titres de la première ligne.")
  const col = indexColonnes(lignes[iTitre])
  const cell = (l: string[], i: number) => (i >= 0 ? (l[i] ?? '').trim() : '')

  const categories = await db.categories.toArray()
  const articles = await db.articles.toArray()
  const choix: Record<string, Saisie> = {}
  const remarques: string[] = []
  let nouveaux = 0

  for (let r = iTitre + 1; r < lignes.length; r++) {
    const l = lignes[r] ?? []
    const nom = cell(l, col.produit)
    if (!nom) continue
    const stock = nombre(cell(l, col.stock))
    const achat = nombre(cell(l, col.achat))
    const vente = nombre(cell(l, col.vente))
    const vend = OUI.has(sansAccents(cell(l, col.vend))) || !!(stock || achat || vente)
    if (!vend) continue
    const ligneXl = `Ligne ${r + 1}`

    // Produit existant : par son code, sinon par son nom exact.
    const code = cell(l, col.code).toUpperCase()
    let article = (code && articles.find((a) => a.code.toUpperCase() === code)) ||
      articles.find((a) => sansAccents(a.designation) === sansAccents(nom))

    if (!article) {
      const nomCat = cell(l, col.categorie) || 'Divers'
      let cat = categories.find((c) => sansAccents(c.nom) === sansAccents(nomCat))
      if (!cat) {
        cat = { id: nouvelId(), nom: nomCat }
        await db.categories.add(cat)
        categories.push(cat)
        remarques.push(`Catégorie « ${nomCat} » créée.`)
      }
      article = {
        id: nouvelId(), code: codeSuivant(articles.filter((a) => a.categorieId === cat!.id), cat.nom), designation: nom,
        categorieId: cat.id, unite: 'bouteille', prixVente: null, seuilAlerte: null, coutMoyen: null, actif: true,
      }
      await db.articles.add(article)
      articles.push(article)
      nouveaux++
    }

    // Compléments facultatifs, enregistrés sur la fiche du produit.
    const modif: Partial<Article> = {}
    const unite = cell(l, col.unite)
    if (unite && unite !== article.unite) modif.unite = unite
    const barre = cell(l, col.barre).replace(/\s/g, '').replace(/\.0+$/, '')
    if (barre && barre !== article.codeBarre) {
      const autre = articles.find((a) => a.codeBarre === barre && a.id !== article!.id)
      if (autre) remarques.push(`${ligneXl} : le code-barres ${barre} est déjà celui de « ${autre.designation} », non repris.`)
      else modif.codeBarre = barre
    }
    const seuilTexte = nombre(cell(l, col.seuil))
    if (seuilTexte) {
      const seuil = lireEntier(seuilTexte)
      if (seuil === null || Number.isNaN(seuil)) remarques.push(`${ligneXl} : seuil d'alerte « ${seuilTexte} » ignoré (nombre entier attendu).`)
      else modif.seuilAlerte = seuil
    }
    if (Object.keys(modif).length) {
      await db.articles.update(article.id, modif)
      Object.assign(article, modif)
    }

    if (choix[article.id]) remarques.push(`${ligneXl} : « ${article.designation} » apparaît deux fois, la dernière ligne est gardée.`)
    choix[article.id] = { stock, prixAchat: achat, prixVente: vente }
  }

  if (Object.keys(choix).length === 0) throw new Error('Aucun produit à importer : écris OUI dans la colonne « Je vends », ou remplis le stock et les prix.')
  return { choix, importes: Object.keys(choix).length, nouveaux, remarques }
}
