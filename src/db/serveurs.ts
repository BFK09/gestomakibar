import { db, nouvelId } from './base'
import type { Serveur } from './types'

// Un code serveur : vide (pas de code) ou exactement 4 chiffres.
export function codeValide(code: string) {
  return code === '' || /^\d{4}$/.test(code)
}

// Ajoute ou modifie un serveur. Deux serveurs ne peuvent pas avoir le même nom.
export async function enregistrerServeur(id: string | null, nom: string, code: string, actif = true) {
  nom = nom.trim()
  code = code.trim()
  if (!nom) throw new Error('Le nom du serveur est obligatoire.')
  if (!codeValide(code)) throw new Error('Le code doit faire exactement 4 chiffres (ou rester vide).')
  const tous = await db.serveurs.toArray()
  if (tous.some((s) => s.id !== id && s.nom.toLowerCase() === nom.toLowerCase())) throw new Error(`Il y a déjà un serveur « ${nom} ».`)
  const donnees: Omit<Serveur, 'id'> = { nom, code: code || undefined, actif }
  if (id) await db.serveurs.update(id, donnees)
  else await db.serveurs.add({ id: nouvelId(), ...donnees })
}

// Un serveur qui a déjà vendu ne peut pas être supprimé (l'historique doit rester juste) :
// on le désactive à la place, il disparaît alors de la caisse.
export async function supprimerServeur(id: string) {
  const n = await db.ventes.where('serveurId').equals(id).count()
  if (n > 0) throw new Error(`Ce serveur a fait ${n} vente(s) : désactive-le plutôt que de le supprimer.`)
  await db.serveurs.delete(id)
}
