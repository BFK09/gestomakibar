import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { UserRound } from 'lucide-react'
import { db } from '../db/base'
import { enregistrerServeur, supprimerServeur } from '../db/serveurs'

interface Edition { id: string | null; nom: string; code: string; actif: boolean }

// Écran Serveurs : la liste des serveurs qui encaissent sur l'appareil du comptoir.
// Le code à 4 chiffres est facultatif : s'il existe, la caisse le demande avant d'encaisser,
// pour qu'un serveur ne vende pas au nom d'un autre.
export default function Serveurs() {
  const serveurs = useLiveQuery(() => db.serveurs.orderBy('nom').toArray(), [])
  const [edition, setEdition] = useState<Edition | null>(null)
  const [erreur, setErreur] = useState('')
  if (!serveurs) return <p>Chargement…</p>

  async function valider() {
    setErreur('')
    try {
      await enregistrerServeur(edition!.id, edition!.nom, edition!.code, edition!.actif)
      setEdition(null)
    } catch (x) { setErreur((x as Error).message) }
  }

  async function supprimer() {
    setErreur('')
    try { await supprimerServeur(edition!.id!); setEdition(null) } catch (x) { setErreur((x as Error).message) }
  }

  return (
    <section>
      <div className="entete-ecran"><h2>Serveurs</h2></div>
      <div className="carte">
        <p className="info">
          Chaque vente est notée au nom du serveur choisi à la caisse. En fin de service, la clôture de caisse
          compare l'argent attendu de chaque serveur et l'argent qu'il remet. Le code à 4 chiffres est facultatif.
        </p>
        {erreur && <p className="erreurs">{erreur}</p>}
        {edition ? (
          <div className="edition-ligne">
            <input value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} placeholder="Nom du serveur" autoFocus />
            <input inputMode="numeric" maxLength={4} value={edition.code} onChange={(e) => setEdition({ ...edition, code: e.target.value.replace(/\D/g, '') })} placeholder="Code à 4 chiffres (facultatif)" />
            {edition.id && (
              <label className="case"><input type="checkbox" checked={edition.actif} onChange={(e) => setEdition({ ...edition, actif: e.target.checked })} /> Actif (visible à la caisse)</label>
            )}
            <div className="boutons gauche">
              <button onClick={() => { setEdition(null); setErreur('') }}>Annuler</button>
              {edition.id && <button className="danger" onClick={supprimer}>Supprimer</button>}
              <button className="principal" onClick={valider}>Enregistrer</button>
            </div>
          </div>
        ) : (
          <div className="boutons gauche"><button className="principal" onClick={() => setEdition({ id: null, nom: '', code: '', actif: true })}>+ Ajouter un serveur</button></div>
        )}
        <ul className="liste-articles">
          {serveurs.length === 0 && <li className="vide">Aucun serveur pour l'instant. Ajoute au moins une personne qui encaisse (toi-même si tu es seul).</li>}
          {serveurs.map((s) => (
            <li key={s.id} className={s.actif ? '' : 'inactif'}>
              <button onClick={() => { setErreur(''); setEdition({ id: s.id, nom: s.nom, code: s.code ?? '', actif: s.actif }) }}>
                <span className="code"><UserRound size={18} /></span>
                <span className="nom">{s.nom}<small>{s.code ? 'Avec code' : 'Sans code'}{s.actif ? '' : ' · inactif'}</small></span>
                <span className="chiffres"><small>Modifier</small></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
