import { db, nouvelId } from './base'
import type { Profil, RoleProfil } from './types'

// Profils avec code PIN : le patron voit tout, le gérant fait tourner le maquis sans voir
// les prix d'achat ni le bénéfice, le serveur ne voit que la caisse et ses propres ventes.
// Le PIN protège l'écran (pas le téléphone) : on n'en garde qu'une empreinte.

export const pinValide = (pin: string) => /^\d{4}$/.test(pin)

async function empreinte(texte: string, sel: string): Promise<string> {
  const octets = new TextEncoder().encode(`${sel}:${texte}`)
  const h = await crypto.subtle.digest('SHA-256', octets)
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// La phrase de secours est comparée sans tenir compte des majuscules ni des espaces en trop.
const normaliser = (phrase: string) => phrase.trim().toLowerCase().replace(/\s+/g, ' ')

export async function verifierPin(p: Profil, pin: string) {
  return (await empreinte(pin, p.sel)) === p.pinHash
}

export async function listeProfils() {
  return db.profils.orderBy('nom').toArray()
}

// Ajoute ou modifie un profil. PIN vide à la modification = on garde l'ancien.
export async function enregistrerProfil(id: string | null, nom: string, role: RoleProfil, pin: string, actif = true, secours?: string) {
  nom = nom.trim()
  if (!nom) throw new Error('Le nom est obligatoire.')
  if ((!id || pin) && !pinValide(pin)) throw new Error('Le code PIN doit faire exactement 4 chiffres.')
  const tous = await db.profils.toArray()
  if (tous.some((p) => p.id !== id && p.nom.toLowerCase() === nom.toLowerCase())) throw new Error(`Il y a déjà un profil « ${nom} ».`)
  if (role === 'patron' && tous.some((p) => p.id !== id && p.role === 'patron')) throw new Error('Il y a déjà un patron.')
  if (role === 'patron' && !id && normaliser(secours ?? '').length < 6) throw new Error('Choisis une phrase de secours d’au moins 6 caractères.')
  const ancien = id ? tous.find((p) => p.id === id) : undefined
  const sel = ancien?.sel ?? nouvelId()
  const donnees: Profil = {
    id: id ?? nouvelId(), nom, role, sel, actif: role === 'patron' ? true : actif,
    pinHash: pin ? await empreinte(pin, sel) : ancien!.pinHash,
    secoursHash: secours ? await empreinte(normaliser(secours), sel) : ancien?.secoursHash,
  }
  await db.profils.put(donnees)
  return donnees
}

// Active les profils en créant le patron. Ensuite l'application demande « Qui êtes-vous ? » à l'ouverture.
export async function activerProfils(nom: string, pin: string, secours: string) {
  const existant = (await db.profils.toArray()).find((p) => p.role === 'patron')
  const patron = await enregistrerProfil(existant?.id ?? null, nom, 'patron', pin, true, secours)
  await db.boutique.update('principale', { profilsActifs: true })
  return patron
}

// Désactive les profils : l'application redevient ouverte à tous, comme avant. Les profils restent enregistrés.
export async function desactiverProfils() {
  await db.boutique.update('principale', { profilsActifs: false })
}

// PIN du patron oublié : la phrase de secours permet d'en choisir un nouveau.
export async function nouveauPinParSecours(secours: string, pin: string) {
  const patron = (await db.profils.toArray()).find((p) => p.role === 'patron')
  if (!patron?.secoursHash) throw new Error('Aucune phrase de secours enregistrée.')
  if ((await empreinte(normaliser(secours), patron.sel)) !== patron.secoursHash) throw new Error('Phrase de secours incorrecte.')
  if (!pinValide(pin)) throw new Error('Le nouveau code PIN doit faire exactement 4 chiffres.')
  await db.profils.update(patron.id, { pinHash: await empreinte(pin, patron.sel) })
  return { ...patron, pinHash: await empreinte(pin, patron.sel) }
}

export async function supprimerProfil(id: string) {
  const p = await db.profils.get(id)
  if (p?.role === 'patron') throw new Error('Le patron ne peut pas être supprimé.')
  await db.profils.delete(id)
}
