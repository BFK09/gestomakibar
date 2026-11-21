import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { rapportVentes, type LigneRapportVente } from '../db/rapports'
import { fcfa } from '../outils/format'
import { sansAccents } from '../outils/texte'
import { BoutonPdf } from './Rapports'
import { bornesPeriode, jourLocal, libellePeriode, NOMS_PERIODES, type Periode } from './periodes'

type Regroupement = 'article' | 'categorie' | 'jour' | 'detail'
const NOMS_REGROUPEMENTS: Record<Regroupement, string> = {
  article: 'Par article',
  categorie: 'Par catégorie',
  jour: 'Par jour',
  detail: 'Ligne par ligne',
}

interface Groupe { cle: string; libelle: string; quantite: number; montant: number; cout: number }

const pourcent = (marge: number, montant: number) => (montant ? `${Math.round((marge / montant) * 1000) / 10} %` : '')
const NATURES = { vente: 'Vente', annulation: 'Annulation', retour: 'Retour' }

// Rapport des ventes : chiffre d'affaires, coût et marge, regroupés comme on veut, en PDF ou Excel.
export default function RapportVentes({ nomBoutique }: { nomBoutique: string }) {
  const [periode, setPeriode] = useState<Periode>('mois')
  const [du, setDu] = useState(jourLocal())
  const [au, setAu] = useState(jourLocal())
  const [regroupement, setRegroupement] = useState<Regroupement>('article')
  const [categorieId, setCategorieId] = useState('')
  const [recherche, setRecherche] = useState('')

  const [debut, fin] = bornesPeriode(periode, du, au)
  const r = useLiveQuery(() => rapportVentes(debut, fin), [debut, fin])
  const categories = useLiveQuery(() => db.categories.orderBy('nom').toArray(), [])
  if (!r || !categories) return <p>Chargement…</p>

  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]))
  const texte = sansAccents(recherche.trim())
  const lignes = r.detail.filter((l) =>
    (!categorieId || l.categorieId === categorieId) &&
    (!texte || sansAccents(`${l.code} ${l.designation}`).includes(texte)))

  const cleDe = (l: LigneRapportVente): [string, string] =>
    regroupement === 'article' ? [l.articleId, `${l.code} ${l.designation}`]
      : regroupement === 'categorie' ? [l.categorieId, nomCategorie.get(l.categorieId) ?? '—']
        : [jourLocal(new Date(l.date)), new Date(l.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })]

  const groupes = new Map<string, Groupe>()
  if (regroupement !== 'detail') {
    for (const l of lignes) {
      const [cle, libelle] = cleDe(l)
      const g = groupes.get(cle) ?? { cle, libelle, quantite: 0, montant: 0, cout: 0 }
      g.quantite += l.quantite
      g.montant += l.montant
      g.cout += l.cout
      groupes.set(cle, g)
    }
  }
  // Une vente annulée en entier s'efface (0) : on ne garde pas la ligne vide.
  const liste = [...groupes.values()].filter((g) => g.quantite !== 0 || g.montant !== 0)
    .sort(regroupement === 'jour' ? (a, b) => a.cle.localeCompare(b.cle) : (a, b) => b.montant - a.montant)

  const total = lignes.reduce((s, l) => ({ quantite: s.quantite + l.quantite, montant: s.montant + l.montant, cout: s.cout + l.cout }), { quantite: 0, montant: 0, cout: 0 })
  const rendus = lignes.filter((l) => l.nature !== 'vente').reduce((s, l) => s + l.montant, 0)

  const filtres = [
    categorieId && `catégorie : ${nomCategorie.get(categorieId)}`,
    texte && `recherche : « ${recherche.trim()} »`,
  ].filter(Boolean).join(' · ')

  async function exporterExcel() {
    const { fichierExcel, telechargerFichier } = await import('../outils/excel')
    const entete = [[nomBoutique], [`Rapport des ventes, ${libellePeriode(periode, du, au)}${filtres ? ` (${filtres})` : ''}`], []]
    const synthese = regroupement === 'detail' ? [] : [{
      nom: NOMS_REGROUPEMENTS[regroupement],
      largeurs: [40, 12, 16, 16, 16, 10],
      lignes: [
        ...entete,
        [regroupement === 'article' ? 'Article' : regroupement === 'categorie' ? 'Catégorie' : 'Jour', 'Quantité', "Chiffre d'affaires", 'Coût', 'Marge', 'Marge %'],
        ...liste.map((g) => [g.libelle, g.quantite, g.montant, g.cout, g.montant - g.cout, g.montant ? Math.round(((g.montant - g.cout) / g.montant) * 1000) / 10 : null]),
        ['TOTAL', total.quantite, total.montant, total.cout, total.montant - total.cout, total.montant ? Math.round(((total.montant - total.cout) / total.montant) * 1000) / 10 : null],
      ],
    }]
    const detail = {
      nom: 'Détail',
      largeurs: [12, 7, 10, 12, 12, 34, 22, 10, 14, 14, 14],
      lignes: [
        ...entete,
        ['Date', 'Heure', 'Ticket', 'Nature', 'Code', 'Désignation', 'Catégorie', 'Quantité', 'Montant', 'Coût', 'Marge'],
        ...lignes.map((l) => {
          const d = new Date(l.date)
          return [d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), l.numero, NATURES[l.nature], l.code, l.designation, nomCategorie.get(l.categorieId) ?? '', l.quantite, l.montant, l.cout, l.montant - l.cout]
        }),
      ],
    }
    const blob = fichierExcel([...synthese, detail], 3)
    telechargerFichier(blob, `ventes-${debut.slice(0, 10)}-au-${jourLocal(new Date(new Date(fin).getTime() - 1))}.xlsx`)
  }

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
          <select value={regroupement} onChange={(e) => setRegroupement(e.target.value as Regroupement)}>
            {(Object.keys(NOMS_REGROUPEMENTS) as Regroupement[]).map((g) => <option key={g} value={g}>{NOMS_REGROUPEMENTS[g]}</option>)}
          </select>
          <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <input type="search" placeholder="Article (code ou nom)…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
      </div>

      <div className="entete-document">
        <div>
          <strong>{nomBoutique}</strong>
          <h3>Rapport des ventes · {NOMS_REGROUPEMENTS[regroupement].toLowerCase()}</h3>
          <p>Période : {libellePeriode(periode, du, au)}{filtres && <><br />{filtres}</>}</p>
        </div>
        <p className="edite-le">Édité le {new Date().toLocaleString('fr-FR')}</p>
      </div>

      <div className="resume-ventes">
        <div><small>Chiffre d'affaires</small><strong>{fcfa(total.montant)}</strong></div>
        <div><small>Marge</small><strong>{fcfa(total.montant - total.cout)}</strong><small>{pourcent(total.montant - total.cout, total.montant)}</small></div>
        <div><small>Tickets</small><strong>{r.tickets}</strong></div>
        {rendus !== 0 && <div><small>Retours et annulations</small><strong>{fcfa(rendus)}</strong></div>}
        {!categorieId && !texte && r.parMode.map((m) => <div key={m.nom}><small>{m.nom}</small><strong>{fcfa(m.montant)}</strong></div>)}
      </div>

      {lignes.length === 0 ? (
        <p className="info">Aucune vente sur cette période.</p>
      ) : regroupement === 'detail' ? (
        <div className="table-defilante">
          <table className="table-rapport">
            <thead><tr><th>Date</th><th>Ticket</th><th>Article</th><th className="nombre">Qté</th><th className="nombre">Montant</th><th className="nombre">Marge</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className={l.nature !== 'vente' ? 'ligne-retour' : ''}>
                  <td className="date">{new Date(l.date).toLocaleDateString('fr-FR')}<br /><small>{new Date(l.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                  <td>n° {l.numero}{l.nature !== 'vente' && <><br /><small>{NATURES[l.nature]}</small></>}</td>
                  <td><span className="code">{l.code}</span> {l.designation}</td>
                  <td className="nombre">{l.quantite}</td>
                  <td className="nombre">{fcfa(l.montant)}</td>
                  <td className="nombre">{fcfa(l.montant - l.cout)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total ({lignes.length} ligne{lignes.length > 1 ? 's' : ''})</td><td className="nombre">{total.quantite}</td><td className="nombre">{fcfa(total.montant)}</td><td className="nombre">{fcfa(total.montant - total.cout)}</td></tr></tfoot>
          </table>
        </div>
      ) : (
        <div className="table-defilante">
          <table className="table-rapport">
            <thead><tr><th>{regroupement === 'article' ? 'Article' : regroupement === 'categorie' ? 'Catégorie' : 'Jour'}</th><th className="nombre">Qté</th><th className="nombre">Chiffre d'affaires</th><th className="nombre">Coût</th><th className="nombre">Marge</th><th className="nombre">%</th></tr></thead>
            <tbody>
              {liste.map((g) => (
                <tr key={g.cle}>
                  <td>{g.libelle}</td>
                  <td className="nombre">{g.quantite}</td>
                  <td className="nombre">{fcfa(g.montant)}</td>
                  <td className="nombre">{fcfa(g.cout)}</td>
                  <td className="nombre">{fcfa(g.montant - g.cout)}</td>
                  <td className="nombre">{pourcent(g.montant - g.cout, g.montant)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td className="nombre">{total.quantite}</td><td className="nombre">{fcfa(total.montant)}</td><td className="nombre">{fcfa(total.cout)}</td><td className="nombre">{fcfa(total.montant - total.cout)}</td><td className="nombre">{pourcent(total.montant - total.cout, total.montant)}</td></tr></tfoot>
          </table>
        </div>
      )}

      <p className="info">La marge = prix de vente − coût moyen d'achat au moment de la vente. Un article vendu sans prix d'achat connu compte avec un coût de 0.</p>
      <div className="boutons gauche">
        <BoutonPdf />
        <button className="sans-impression" onClick={exporterExcel} disabled={lignes.length === 0}>Télécharger en Excel</button>
      </div>
    </div>
  )
}
