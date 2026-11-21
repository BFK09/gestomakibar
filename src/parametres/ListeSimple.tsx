import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'

interface Element { id: string; nom: string; telephone?: string }

interface Props {
  titre: string
  explication: string
  avecTelephone?: boolean
  lire: () => Promise<Element[]>
  enregistrer: (id: string | null, nom: string, telephone?: string) => Promise<void>
  supprimer: (id: string) => Promise<void>
}

// Une liste de noms qu'on peut ajouter, renommer ou supprimer (catégories, fournisseurs…).
// Le même composant sert à plusieurs listes : seules les fonctions passées changent.
export default function ListeSimple({ titre, explication, avecTelephone, lire, enregistrer, supprimer }: Props) {
  const elements = useLiveQuery(lire, [])
  const [edition, setEdition] = useState<{ id: string | null; nom: string; telephone: string } | null>(null)
  const [erreur, setErreur] = useState('')
  if (!elements) return <p>Chargement…</p>

  async function valider() {
    setErreur('')
    const nom = edition!.nom.trim()
    if (!nom) return setErreur('Le nom est obligatoire.')
    if (elements!.some((e) => e.nom.toLowerCase() === nom.toLowerCase() && e.id !== edition!.id)) return setErreur(`« ${nom} » existe déjà.`)
    await enregistrer(edition!.id, nom, avecTelephone ? edition!.telephone.trim() || undefined : undefined)
    setEdition(null)
  }

  async function effacer(id: string) {
    setErreur('')
    try { await supprimer(id); setEdition(null) } catch (x) { setErreur((x as Error).message) }
  }

  return (
    <div className="carte">
      <p className="info">{explication}</p>
      {erreur && <p className="erreurs">{erreur}</p>}
      {edition ? (
        <div className="edition-ligne">
          <input value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} placeholder="Nom" autoFocus />
          {avecTelephone && <input inputMode="tel" value={edition.telephone} onChange={(e) => setEdition({ ...edition, telephone: e.target.value })} placeholder="Téléphone" />}
          <div className="boutons gauche">
            <button onClick={() => setEdition(null)}>Annuler</button>
            {edition.id && <button className="danger" onClick={() => effacer(edition.id!)}>Supprimer</button>}
            <button className="principal" onClick={valider}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <div className="boutons gauche"><button className="principal" onClick={() => setEdition({ id: null, nom: '', telephone: '' })}>+ Ajouter</button></div>
      )}
      <ul className="liste-articles">
        {elements.length === 0 && <li className="vide">Aucun élément dans « {titre} ».</li>}
        {elements.map((e) => (
          <li key={e.id}>
            <button onClick={() => setEdition({ id: e.id, nom: e.nom, telephone: e.telephone ?? '' })}>
              <span className="nom" style={{ gridColumn: '1 / 3' }}>{e.nom}{e.telephone && <small>{e.telephone}</small>}</span>
              <span className="chiffres"><small>Modifier</small></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
