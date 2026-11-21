import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { fcfa } from '../outils/format'

// Liste des réceptions passées, de la plus récente à la plus ancienne.
// Elles ne se modifient pas : une erreur se corrigera par un retour ou un ajustement.
export default function HistoriqueReceptions() {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const donnees = useLiveQuery(async () => {
    const achats = await db.achats.orderBy('date').reverse().toArray()
    const fournisseurs = new Map((await db.fournisseurs.toArray()).map((f) => [f.id, f.nom]))
    const articles = new Map((await db.articles.toArray()).map((a) => [a.id, a]))
    const lignes = await db.lignesAchat.toArray()
    return { achats, fournisseurs, articles, lignes }
  }, [])
  if (!donnees) return <p>Chargement…</p>
  if (donnees.achats.length === 0) return <p className="info">Aucune réception pour l'instant.</p>

  return (
    <ul className="liste-articles">
      {donnees.achats.map((a) => {
        const lignes = donnees.lignes.filter((l) => l.achatId === a.id)
        return (
          <li key={a.id}>
            <button onClick={() => setOuvert(ouvert === a.id ? null : a.id)}>
              <span className="code">{new Date(a.date).toLocaleDateString('fr-FR')}</span>
              <span className="nom">
                {(a.fournisseurId && donnees.fournisseurs.get(a.fournisseurId)) || 'Fournisseur non précisé'}
                <small>{a.reference ? `Réf. ${a.reference} · ` : ''}{lignes.length} produit(s)</small>
              </span>
              <span className="chiffres">{fcfa(a.total)}</span>
            </button>
            {ouvert === a.id && (
              <table className="detail">
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id}>
                      <td>{donnees.articles.get(l.articleId)?.designation}</td>
                      <td>{l.quantite} × {fcfa(l.coutUnitaire)}</td>
                      <td>{fcfa(l.quantite * l.coutUnitaire)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        )
      })}
    </ul>
  )
}
