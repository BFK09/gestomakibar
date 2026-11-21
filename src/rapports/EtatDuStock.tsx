import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { etatStock } from '../db/rapports'
import { fcfa } from '../outils/format'
import { BoutonPdf } from './Rapports'

// L'inventaire théorique : ce que l'application pense avoir en stock, produit par produit,
// avec sa valeur. Imprimé, il sert aussi de feuille de comptage (colonne « Compté » vide).
export default function EtatDuStock({ nomBoutique }: { nomBoutique: string }) {
  const [categorieId, setCategorieId] = useState('')
  const [feuilleComptage, setFeuilleComptage] = useState(false)
  const lignes = useLiveQuery(() => etatStock(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  if (!lignes || !categories) return <p>Chargement…</p>

  const visibles = lignes.filter((l) => !categorieId || l.categorieId === categorieId)
  const totalQuantite = visibles.reduce((s, l) => s + Math.max(l.stock, 0), 0)
  const valeurAchat = visibles.reduce((s, l) => s + Math.max(l.stock, 0) * (l.coutMoyen ?? 0), 0)
  const valeurVente = visibles.reduce((s, l) => s + Math.max(l.stock, 0) * (l.prixVente ?? 0), 0)
  const nomCat = categories.find((c) => c.id === categorieId)?.nom

  return (
    <div className="rapport">
      <div className="filtres sans-impression">
        <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <label className="case">
          <input type="checkbox" checked={feuilleComptage} onChange={(e) => setFeuilleComptage(e.target.checked)} />
          Feuille de comptage (colonne vide pour noter le stock compté)
        </label>
      </div>

      <div className="entete-document">
        <div>
          <strong>{nomBoutique}</strong>
          <h3>{feuilleComptage ? 'Feuille de comptage' : 'État du stock (inventaire théorique)'}</h3>
          <p>Au {new Date().toLocaleDateString('fr-FR')}{nomCat && <> · catégorie : {nomCat}</>}</p>
        </div>
        <p className="edite-le">Édité le {new Date().toLocaleString('fr-FR')}</p>
      </div>

      <div className="table-defilante">
        <table className="table-rapport">
          <thead>
            <tr>
              <th>Code</th><th>Produit</th><th className="nombre">Stock</th>
              {feuilleComptage ? <th className="nombre">Compté</th> : <><th className="nombre">Coût unit.</th><th className="nombre">Valeur</th></>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.code}>
                <td className="code">{l.code}</td>
                <td>{l.designation}</td>
                <td className={`nombre ${l.stock < 0 || (l.seuilAlerte !== null && l.stock <= l.seuilAlerte) ? 'alerte' : ''}`}>{l.stock}</td>
                {feuilleComptage
                  ? <td className="case-vide"></td>
                  : <><td className="nombre">{fcfa(l.coutMoyen)}</td><td className="nombre">{fcfa(Math.max(l.stock, 0) * (l.coutMoyen ?? 0))}</td></>}
              </tr>
            ))}
          </tbody>
          {!feuilleComptage && (
            <tfoot>
              <tr><td colSpan={2}>Total ({visibles.length} produits)</td><td className="nombre">{totalQuantite}</td><td></td><td className="nombre">{fcfa(valeurAchat)}</td></tr>
              <tr><td colSpan={4}>Valeur au prix de vente</td><td className="nombre">{fcfa(valeurVente)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="boutons gauche"><BoutonPdf /></div>
    </div>
  )
}
