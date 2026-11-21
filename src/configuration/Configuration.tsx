import { useRef, useState } from 'react'
import type { TypeEtablissement } from '../db/types'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nouvelId } from '../db/base'
import { terminerConfiguration } from '../db/configuration'
import { lireSauvegarde, restaurerBase } from '../db/sauvegarde'
import { codeSuivant } from '../catalogue/codeSuivant'
import { fcfa, lireEntier } from '../outils/format'
import { definirPays, monnaie, PAYS } from '../outils/pays'
import { sansAccents } from '../outils/texte'
import { telechargerFichier } from '../outils/excel'
import { importerProduits, modeleExcel, type Saisie } from './importExcel'

// L'assistant de démarrage, affiché tant que l'établissement n'est pas configuré.
// 1. Identification  2. Choix des produits, stock et prix  3. Vérification et validation
export default function Configuration() {
  const [etape, setEtape] = useState(1)
  const [identite, setIdentite] = useState({ nom: '', responsable: '', telephone: '', adresse: '', pays: 'CI', type: 'maquis' as TypeEtablissement })
  const [choix, setChoix] = useState<Record<string, Saisie>>({}) // articleId → saisie
  const [recherche, setRecherche] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [nouveau, setNouveau] = useState({ designation: '', categorieId: '' })
  const [erreurs, setErreurs] = useState<string[]>([])
  const [bilanImport, setBilanImport] = useState<string[]>([])
  const fichierExcelRempli = useRef<HTMLInputElement>(null)
  const [seulementChoisis, setSeulementChoisis] = useState(false)

  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  const articles = useLiveQuery(() => db.articles.orderBy('code').toArray(), [])
  if (!categories || !articles) return <p className="page">Chargement…</p>

  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]))
  const idsChoisis = Object.keys(choix)

  // ---- Étape 1 : identification ----
  function suiteIdentite() {
    const pb: string[] = []
    if (!identite.nom.trim()) pb.push("Le nom de l'établissement est obligatoire.")
    if (!identite.responsable.trim()) pb.push('Le nom du responsable est obligatoire.')
    setErreurs(pb)
    if (pb.length === 0) setEtape(2)
  }

  // ---- Étape 2 : choix des produits ----
  const texte = sansAccents(recherche.trim())
  const visibles = articles.filter((a) =>
    (!seulementChoisis || !!choix[a.id]) &&
    (!categorieId || a.categorieId === categorieId) &&
    (!texte || sansAccents(`${a.code} ${a.designation}`).includes(texte)))

  function basculer(id: string) {
    const copie = { ...choix }
    if (copie[id]) delete copie[id]
    else copie[id] = { stock: '', prixAchat: '', prixVente: '' }
    setChoix(copie)
  }

  function toutCocher(cocher: boolean) {
    const copie = { ...choix }
    for (const a of visibles) {
      if (cocher && !copie[a.id]) copie[a.id] = { stock: '', prixAchat: '', prixVente: '' }
      if (!cocher) delete copie[a.id]
    }
    setChoix(copie)
  }

  function changer(id: string, champ: keyof Saisie, valeur: string) {
    setChoix({ ...choix, [id]: { ...choix[id], [champ]: valeur } })
  }

  // Un produit absent de la liste standard : on le crée et on le coche.
  async function ajouterProduit() {
    const designation = nouveau.designation.trim()
    if (!designation || !nouveau.categorieId) {
      setErreurs(['Pour ajouter un produit, indique son nom et sa catégorie.'])
      return
    }
    const dansCategorie = await db.articles.where('categorieId').equals(nouveau.categorieId).toArray()
    const id = nouvelId()
    await db.articles.add({
      id, code: codeSuivant(dansCategorie, nomCategorie.get(nouveau.categorieId)!), designation,
      categorieId: nouveau.categorieId, unite: 'bouteille', prixVente: null, seuilAlerte: null, coutMoyen: null, actif: true,
    })
    setChoix({ ...choix, [id]: { stock: '', prixAchat: '', prixVente: '' } })
    setNouveau({ designation: '', categorieId: nouveau.categorieId })
    setErreurs([])
  }

  // Vérifie les saisies et renvoie les produits prêts à enregistrer.
  function verifier() {
    const pb: string[] = []
    const produits = idsChoisis.map((id) => {
      const a = articles!.find((x) => x.id === id)!
      const s = choix[id]
      const stock = lireEntier(s.stock)
      const achat = lireEntier(s.prixAchat)
      const vente = lireEntier(s.prixVente)
      const manque: string[] = []
      if (stock === null || Number.isNaN(stock)) manque.push('stock')
      if (achat === null || Number.isNaN(achat)) manque.push("prix d'achat")
      if (vente === null || Number.isNaN(vente)) manque.push('prix de vente')
      if (manque.length) pb.push(`${a.designation} : ${manque.join(', ')} à saisir (nombre entier).`)
      else if (vente! < achat!) pb.push(`${a.designation} : le prix de vente est plus bas que le prix d'achat.`)
      return { articleId: id, stock: stock ?? 0, prixAchat: achat ?? 0, prixVente: vente ?? 0 }
    })
    if (produits.length === 0) pb.push('Choisis au moins un produit.')
    return { pb, produits }
  }

  function suiteProduits() {
    const { pb } = verifier()
    setErreurs(pb)
    if (pb.length === 0) setEtape(3)
  }

  async function valider() {
    const { pb, produits } = verifier()
    setErreurs(pb)
    if (pb.length > 0) return
    await terminerConfiguration(
      { nom: identite.nom.trim(), responsable: identite.responsable.trim(), telephone: identite.telephone.trim() || undefined, adresse: identite.adresse.trim() || undefined, pays: identite.pays, type: identite.type },
      produits,
    )
    // L'application affiche alors automatiquement la caisse.
  }

  // Variante de l'étape 2 : remplir le modèle Excel, puis l'importer ici.
  async function importer(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const r = await importerProduits(f)
      setChoix({ ...choix, ...r.choix })
      setRecherche('')
      setCategorieId('')
      setSeulementChoisis(true)
      setErreurs([])
      setBilanImport([
        `${r.importes} produit(s) importé(s)${r.nouveaux ? `, dont ${r.nouveaux} nouveau(x)` : ''}. Vérifie la liste ci-dessous, puis « Suivant ».`,
        ...r.remarques,
      ])
    } catch (x) {
      setBilanImport([])
      setErreurs([(x as Error).message])
    }
  }

  // Nouveau téléphone : on peut reprendre directement une sauvegarde au lieu de tout configurer.
  async function restaurer(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      await restaurerBase(await lireSauvegarde(f))
    } catch (x) {
      setErreurs([(x as Error).message])
    }
  }

  const listeErreurs = erreurs.length > 0 && <ul className="erreurs">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>

  return (
    <main className="page configuration">
      <h1>Configuration de l'établissement</h1>
      <ol className="etapes">
        <li className={etape === 1 ? 'en-cours' : 'faite'}>Identification</li>
        <li className={etape === 2 ? 'en-cours' : etape > 2 ? 'faite' : ''}>Produits et stock</li>
        <li className={etape === 3 ? 'en-cours' : ''}>Validation</li>
      </ol>

      {etape === 1 && (
        <div className="carte">
          <label>Nom de l'établissement *<input value={identite.nom} onChange={(e) => setIdentite({ ...identite, nom: e.target.value })} autoFocus /></label>
          <label>Type d'établissement
            <select value={identite.type} onChange={(e) => setIdentite({ ...identite, type: e.target.value as TypeEtablissement })}>
              <option value="maquis">Maquis</option><option value="bar">Bar</option><option value="depot">Dépôt de boissons (vente en gros, livraisons)</option>
            </select>
          </label>
          <label>Responsable *<input value={identite.responsable} onChange={(e) => setIdentite({ ...identite, responsable: e.target.value })} /></label>
          <label>Pays (indicatif téléphonique et monnaie)
            <select value={identite.pays} onChange={(e) => { definirPays(e.target.value); setIdentite({ ...identite, pays: e.target.value }) }}>
              {PAYS.map((p) => <option key={p.code} value={p.code}>{p.nom} (+{p.indicatif}, {p.monnaie})</option>)}
            </select>
          </label>
          <label>Téléphone<input inputMode="tel" value={identite.telephone} onChange={(e) => setIdentite({ ...identite, telephone: e.target.value })} /></label>
          <label>Adresse / ville<input value={identite.adresse} onChange={(e) => setIdentite({ ...identite, adresse: e.target.value })} /></label>
          {listeErreurs}
          <div className="boutons"><button className="principal" onClick={suiteIdentite}>Suivant</button></div>
        </div>
      )}
      {etape === 1 && (
        <p className="info restaurer-depart">
          Tu as déjà utilisé l'application sur un autre appareil ?{' '}
          <label className="lien">
            Restaurer une sauvegarde
            <input type="file" accept=".json,application/json" onChange={restaurer} hidden />
          </label>
        </p>
      )}

      {etape === 2 && (
        <>
          <p className="info">
            Coche les produits que tu vends ou que tu vas vendre. Pour chacun, indique la quantité
            que tu as aujourd'hui (0 si tu n'en as pas encore), le prix d'achat et le prix de vente d'une unité.
          </p>
          <div className="carte import-excel">
            <strong>Tu préfères remplir un fichier Excel ?</strong>
            <p className="info">Télécharge le modèle, remplis-le sur ton ordinateur (ou fais-le remplir), puis importe-le : les produits seront cochés avec leur stock et leurs prix.</p>
            <div className="boutons">
              <button onClick={() => telechargerFichier(modeleExcel(articles, categories), 'GESTOMAKIBAR-produits-a-remplir.xlsx')}>Télécharger le modèle Excel</button>
              <button className="principal" onClick={() => fichierExcelRempli.current?.click()}>Importer le fichier rempli</button>
              <input ref={fichierExcelRempli} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importer} hidden />
            </div>
            {bilanImport.length > 0 && <ul className="bilan-import">{bilanImport.map((x) => <li key={x}>{x}</li>)}</ul>}
          </div>

          <div className="filtres">
            <input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <label className="case seulement-choisis"><input type="checkbox" checked={seulementChoisis} onChange={(e) => setSeulementChoisis(e.target.checked)} /> Seulement les produits cochés</label>
            <button onClick={() => toutCocher(true)}>Tout cocher</button>
            <button onClick={() => toutCocher(false)}>Tout décocher</button>
          </div>

          <ul className="liste-choix">
            {visibles.map((a) => {
              const s = choix[a.id]
              return (
                <li key={a.id} className={s ? 'choisi' : ''}>
                  <label className="case">
                    <input type="checkbox" checked={!!s} onChange={() => basculer(a.id)} />
                    <span>{a.designation}<small>{nomCategorie.get(a.categorieId)}</small></span>
                  </label>
                  {s && (
                    <div className="champs-choix">
                      <label>Stock<input inputMode="numeric" value={s.stock} onChange={(e) => changer(a.id, 'stock', e.target.value)} /></label>
                      <label>Prix d'achat<input inputMode="numeric" value={s.prixAchat} onChange={(e) => changer(a.id, 'prixAchat', e.target.value)} placeholder={monnaie()} /></label>
                      <label>Prix de vente<input inputMode="numeric" value={s.prixVente} onChange={(e) => changer(a.id, 'prixVente', e.target.value)} placeholder={monnaie()} /></label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="carte ajout-produit">
            <strong>Un produit n'est pas dans la liste ?</strong>
            <div className="deux">
              <input placeholder="Nom du produit" value={nouveau.designation} onChange={(e) => setNouveau({ ...nouveau, designation: e.target.value })} />
              <select value={nouveau.categorieId} onChange={(e) => setNouveau({ ...nouveau, categorieId: e.target.value })}>
                <option value="">Catégorie…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <button onClick={ajouterProduit}>+ Ajouter ce produit</button>
          </div>

          {listeErreurs}
          <div className="pied-reception pied-collant">
            <button onClick={() => { setErreurs([]); setEtape(1) }}>Retour</button>
            <span>{idsChoisis.length} produit(s) choisi(s)</span>
            <button className="principal" onClick={suiteProduits}>Suivant</button>
          </div>
        </>
      )}

      {etape === 3 && (() => {
        const { produits } = verifier()
        const valeurAchat = produits.reduce((s, p) => s + p.stock * p.prixAchat, 0)
        const valeurVente = produits.reduce((s, p) => s + p.stock * p.prixVente, 0)
        return (
          <div className="carte">
            <p><strong>{identite.nom}</strong><br />Responsable : {identite.responsable}
              {identite.telephone && <><br />Tél. : {identite.telephone}</>}
              {identite.adresse && <><br />{identite.adresse}</>}</p>
            <div className="resume-jour">
              <div><small>Produits choisis</small><strong>{produits.length}</strong></div>
              <div><small>Bouteilles en stock</small><strong>{produits.reduce((s, p) => s + p.stock, 0)}</strong></div>
              <div><small>Valeur du stock (achat)</small><strong>{fcfa(valeurAchat)}</strong></div>
              <div><small>Valeur du stock (vente)</small><strong>{fcfa(valeurVente)}</strong></div>
            </div>
            <p className="info">
              Les produits non cochés restent dans les produits, désactivés : tu pourras les activer plus tard.
              Tout pourra être modifié ensuite dans Produits.
            </p>
            {listeErreurs}
            <div className="boutons">
              <button onClick={() => setEtape(2)}>Retour</button>
              <button className="principal" onClick={valider}>Valider et démarrer</button>
            </div>
          </div>
        )
      })()}
    </main>
  )
}
