import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { journalMouvements, nomType } from '../db/rapports'
import type { MouvementStock } from '../db/types'
import { sansAccents } from '../outils/texte'
import { BoutonPdf } from './Rapports'
import { bornesPeriode, jourLocal, libellePeriode, NOMS_PERIODES, type Periode } from './periodes'

const TYPES: MouvementStock['type'][] = ['vente', 'achat', 'retour', 'inventaire', 'perte', 'ajustement']

// Le journal : tous les mouvements de stock, ligne par ligne, avec les totaux en bas.
export default function JournalMouvements({ nomBoutique }: { nomBoutique: string }) {
  const [periode, setPeriode] = useState<Periode>('jour')
  const [du, setDu] = useState(jourLocal())
  const [au, setAu] = useState(jourLocal())
  const [categorieId, setCategorieId] = useState('')
  const [type, setType] = useState('')
  const [recherche, setRecherche] = useState('')

  const [debut, fin] = bornesPeriode(periode, du, au)
  const lignes = useLiveQuery(() => journalMouvements(debut, fin), [debut, fin])
  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  if (!lignes || !categories) return <p>Chargement…</p>

  const texte = sansAccents(recherche.trim())
  const visibles = lignes.filter((l) =>
    (!categorieId || l.categorieId === categorieId) &&
    (!type || l.type === type) &&
    (!texte || sansAccents(`${l.code} ${l.designation}`).includes(texte)))
  const totalEntrees = visibles.reduce((s, l) => s + l.entree, 0)
  const totalSorties = visibles.reduce((s, l) => s + l.sortie, 0)

  // Ce qui est filtré est rappelé dans l'en-tête du PDF.
  const filtres = [
    categorieId && `catégorie : ${categories.find((c) => c.id === categorieId)?.nom}`,
    type && `type : ${nomType(type as MouvementStock['type'])}`,
    texte && `recherche : « ${recherche.trim()} »`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="rapport">
      <div className="filtres-rapport sans-impression">
        <div className="onglets">
          {(Object.keys(NOMS_PERIODES) as Periode[]).map((p) => (
            <button key={p} className={periode === p ? 'choisi' : ''} onClick={() => setPeriode(p)}>{NOMS_PERIODES[p]}</button>
          ))}
        </div>
        {periode === 'perso' && (
          <div className="deux">
            <label>Du<input type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)} /></label>
            <label>Au<input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} /></label>
          </div>
        )}
        <div className="filtres">
          <input type="search" placeholder="Article (code ou nom)…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous les mouvements</option>
            {TYPES.map((t) => <option key={t} value={t}>{nomType(t)}</option>)}
          </select>
        </div>
      </div>

      <div className="entete-document">
        <div>
          <strong>{nomBoutique}</strong>
          <h3>Mouvements de stock</h3>
          <p>Période : {libellePeriode(periode, du, au)}{filtres && <><br />{filtres}</>}</p>
        </div>
        <p className="edite-le">Édité le {new Date().toLocaleString('fr-FR')}</p>
      </div>

      {visibles.length === 0 ? (
        <p className="info">Aucun mouvement sur cette période.</p>
      ) : (
        <div className="table-defilante">
          <table className="table-rapport">
            <thead>
              <tr><th>Date</th><th>Document</th><th>Article</th><th className="nombre">Entrée</th><th className="nombre">Sortie</th></tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.id}>
                  <td className="date">{new Date(l.date).toLocaleDateString('fr-FR')}<br /><small>{new Date(l.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                  <td>{l.document}</td>
                  <td><span className="code">{l.code}</span> {l.designation}</td>
                  <td className="nombre entree">{l.entree || ''}</td>
                  <td className="nombre sortie">{l.sortie || ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>Total ({visibles.length} mouvement{visibles.length > 1 ? 's' : ''})</td><td className="nombre">{totalEntrees}</td><td className="nombre">{totalSorties}</td></tr>
              <tr><td colSpan={3}>Variation du stock (entrées − sorties)</td><td className="nombre" colSpan={2}>{totalEntrees - totalSorties > 0 ? '+' : ''}{totalEntrees - totalSorties}</td></tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="boutons gauche"><BoutonPdf /></div>
    </div>
  )
}
