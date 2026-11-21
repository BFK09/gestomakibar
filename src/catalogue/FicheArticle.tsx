import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nouvelId } from '../db/base'
import type { Article } from '../db/types'
import { fcfa, lireEntier } from '../outils/format'
import { monnaie } from '../outils/pays'
import { codeSuivant } from './codeSuivant'
import ScanCamera from '../scan/ScanCamera'
import { ScanBarcode } from 'lucide-react'

interface Props {
  articleId: string // un id existant, ou 'nouveau'
  onFermer: () => void
}

// Les valeurs du formulaire sont gardées en texte pendant la saisie,
// puis vérifiées et converties au moment d'enregistrer.
interface Saisie {
  code: string
  codeBarre: string
  designation: string
  categorieId: string
  unite: string
  prixVente: string
  seuilAlerte: string
  actif: boolean
}

// Fiche d'un article : ajout (articleId = 'nouveau') ou modification.
export default function FicheArticle({ articleId, onFermer }: Props) {
  const estNouveau = articleId === 'nouveau'
  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  const unites = useLiveQuery(
    async () => [...new Set((await db.articles.toArray()).map((a) => a.unite))].sort(),
    [],
  )
  const [article, setArticle] = useState<Article | null>(null)
  const [saisie, setSaisie] = useState<Saisie | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])
  const [codeModifieALaMain, setCodeModifieALaMain] = useState(false)
  const [scan, setScan] = useState(false)

  // Au chargement : on remplit le formulaire avec l'article, ou des valeurs vides.
  useEffect(() => {
    if (estNouveau) {
      setSaisie({ code: '', codeBarre: '', designation: '', categorieId: '', unite: 'pièce', prixVente: '', seuilAlerte: '', actif: true })
    } else {
      db.articles.get(articleId).then((a) => {
        if (!a) return
        setArticle(a)
        setSaisie({
          code: a.code,
          codeBarre: a.codeBarre ?? '',
          designation: a.designation,
          categorieId: a.categorieId,
          unite: a.unite,
          prixVente: a.prixVente?.toString() ?? '',
          seuilAlerte: a.seuilAlerte?.toString() ?? '',
          actif: a.actif,
        })
      })
    }
  }, [articleId, estNouveau])

  // Fermer la fiche avec la touche Échap.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer()
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [onFermer])

  if (!saisie || !categories || !unites) return null

  const changer = (champ: keyof Saisie, valeur: string | boolean) =>
    setSaisie({ ...saisie, [champ]: valeur })

  // Nouvel article : quand on choisit la catégorie, le code se remplit tout seul.
  async function choisirCategorie(id: string) {
    const suite: Saisie = { ...saisie!, categorieId: id }
    if (estNouveau && !codeModifieALaMain && id) {
      const dansCategorie = await db.articles.where('categorieId').equals(id).toArray()
      suite.code = codeSuivant(dansCategorie, categories!.find((c) => c.id === id)!.nom)
    }
    setSaisie(suite)
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const s = saisie!
    const code = s.code.trim().toUpperCase()
    const prixVente = lireEntier(s.prixVente)
    const seuilAlerte = lireEntier(s.seuilAlerte)
    const codeBarre = s.codeBarre.trim() || undefined

    // Vérifications avant d'enregistrer.
    const pb: string[] = []
    if (!code) pb.push('Le code est obligatoire.')
    if (!s.designation.trim()) pb.push('La désignation est obligatoire.')
    if (!s.categorieId) pb.push('Choisis une catégorie.')
    if (!s.unite.trim()) pb.push("L'unité est obligatoire.")
    if (Number.isNaN(prixVente)) pb.push(`Le prix de vente doit être un nombre entier (en ${monnaie()}).`)
    if (Number.isNaN(seuilAlerte)) pb.push("Le seuil d'alerte doit être un nombre entier.")
    const memeCode = code ? await db.articles.where('code').equals(code).first() : undefined
    if (memeCode && memeCode.id !== article?.id) pb.push(`Le code ${code} est déjà utilisé par « ${memeCode.designation} ».`)
    const memeBarre = codeBarre ? await db.articles.where('codeBarre').equals(codeBarre).first() : undefined
    if (memeBarre && memeBarre.id !== article?.id) pb.push(`Ce code-barres est déjà celui de « ${memeBarre.designation} ».`)
    setErreurs(pb)
    if (pb.length > 0) return

    const donnees = {
      code,
      codeBarre,
      designation: s.designation.trim(),
      categorieId: s.categorieId,
      unite: s.unite.trim(),
      prixVente,
      seuilAlerte,
      actif: s.actif,
    }
    if (article) {
      await db.articles.update(article.id, donnees)
    } else {
      await db.articles.add({ id: nouvelId(), coutMoyen: null, ...donnees })
    }
    onFermer()
  }

  return (
    <div className="fond" onClick={onFermer}>
      <form className="fiche" onClick={(e) => e.stopPropagation()} onSubmit={enregistrer}>
        <h3>{estNouveau ? 'Nouvel article' : `Modifier ${article?.code ?? ''}`}</h3>

        {erreurs.length > 0 && (
          <ul className="erreurs">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>
        )}

        <label>
          Catégorie
          <select value={saisie.categorieId} onChange={(e) => choisirCategorie(e.target.value)}>
            <option value="">— Choisir —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>

        <div className="deux">
          <label>
            Code
            <input
              value={saisie.code}
              onChange={(e) => { setCodeModifieALaMain(true); changer('code', e.target.value) }}
              placeholder="ex. CAH-019"
            />
          </label>
          <label>
            Unité
            <input list="unites" value={saisie.unite} onChange={(e) => changer('unite', e.target.value)} />
            <datalist id="unites">{unites.map((u) => <option key={u} value={u} />)}</datalist>
          </label>
        </div>

        <label>
          Désignation
          <input
            value={saisie.designation}
            onChange={(e) => changer('designation', e.target.value)}
            autoFocus={estNouveau}
          />
        </label>

        <label>
          Code-barres (facultatif)
          <span className="avec-scan">
            <input
              value={saisie.codeBarre}
              onChange={(e) => changer('codeBarre', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              placeholder="Scanne ou tape le code sous les barres"
              inputMode="numeric"
            />
            <button type="button" className="bouton-scan" onClick={() => setScan(true)} aria-label="Scanner avec la caméra"><ScanBarcode size={20} /></button>
          </span>
        </label>
        {scan && <ScanCamera onCode={(c) => { changer('codeBarre', c); setScan(false) }} onFermer={() => setScan(false)} />}

        <div className="deux">
          <label>
            Prix de vente ({monnaie()})
            <input inputMode="numeric" value={saisie.prixVente} onChange={(e) => changer('prixVente', e.target.value)} placeholder="ex. 500" autoFocus={!estNouveau} />
          </label>
          <label>
            Seuil d'alerte
            <input inputMode="numeric" value={saisie.seuilAlerte} onChange={(e) => changer('seuilAlerte', e.target.value)} placeholder="ex. 10" />
          </label>
        </div>

        {!estNouveau && (
          <p className="info">
            Coût moyen : {fcfa(article?.coutMoyen)} (calculé automatiquement à chaque réception de marchandise)
          </p>
        )}

        <label className="case">
          <input type="checkbox" checked={saisie.actif} onChange={(e) => changer('actif', e.target.checked)} />
          Article actif (décocher pour le retirer de la vente sans perdre son historique)
        </label>

        <div className="boutons">
          <button type="button" onClick={onFermer}>Annuler</button>
          <button type="submit" className="principal">Enregistrer</button>
        </div>
      </form>
    </div>
  )
}
