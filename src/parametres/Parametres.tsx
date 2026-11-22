import { useState } from 'react'
import Identite from './Identite'
import ListeSimple from './ListeSimple'
import ModesPaiement from './ModesPaiement'
import Reinitialiser from './Reinitialiser'
import Affichage from './Affichage'
import Profils from './Profils'
import { db, nouvelId } from '../db/base'

type Section = 'identite' | 'profils' | 'affichage' | 'categories' | 'modes' | 'fournisseurs' | 'reinitialiser'
const NOMS: Record<Section, string> = {
  identite: 'Établissement', profils: 'Profils', affichage: 'Affichage', categories: 'Catégories', modes: 'Modes de paiement', fournisseurs: 'Fournisseurs', reinitialiser: 'Réinitialiser',
}

// Écran Paramètres : tout ce qu'on règle une fois et qu'on modifie rarement.
export default function Parametres() {
  const [section, setSection] = useState<Section>('identite')
  return (
    <section className="parametres">
      <div className="entete-ecran"><h2>Paramètres</h2></div>
      <div className="onglets">
        {(Object.keys(NOMS) as Section[]).map((s) => (
          <button key={s} className={section === s ? 'choisi' : ''} onClick={() => setSection(s)}>{NOMS[s]}</button>
        ))}
      </div>
      {section === 'identite' && <Identite />}
      {section === 'profils' && <Profils />}
      {section === 'affichage' && <Affichage />}
      {section === 'categories' && (
        <ListeSimple
          titre="Catégories"
          explication="Les catégories rangent tes produits (catalogue, rapports, filtres)."
          lire={() => db.categories.orderBy('nom').toArray()}
          enregistrer={async (id, nom) => {
            if (id) await db.categories.update(id, { nom })
            else await db.categories.add({ id: nouvelId(), nom })
          }}
          supprimer={async (id) => {
            const n = await db.articles.where('categorieId').equals(id).count()
            if (n > 0) throw new Error(`Impossible : ${n} produit(s) sont dans cette catégorie. Change-les de catégorie d'abord.`)
            await db.categories.delete(id)
          }}
        />
      )}
      {section === 'modes' && <ModesPaiement />}
      {section === 'fournisseurs' && (
        <ListeSimple
          titre="Fournisseurs"
          explication="Les fournisseurs sont aussi créés automatiquement quand tu tapes un nouveau nom dans une réception."
          avecTelephone
          lire={() => db.fournisseurs.orderBy('nom').toArray()}
          enregistrer={async (id, nom, telephone) => {
            if (id) await db.fournisseurs.update(id, { nom, telephone })
            else await db.fournisseurs.add({ id: nouvelId(), nom, telephone })
          }}
          supprimer={async (id) => {
            const n = await db.achats.where('fournisseurId').equals(id).count()
            if (n > 0) throw new Error(`Impossible : ce fournisseur apparaît dans ${n} réception(s). L'historique ne doit pas être modifié.`)
            await db.fournisseurs.delete(id)
            await db.articles.where('fournisseurId').equals(id).modify({ fournisseurId: undefined })
          }}
        />
      )}
      {section === 'reinitialiser' && <Reinitialiser />}
    </section>
  )
}
