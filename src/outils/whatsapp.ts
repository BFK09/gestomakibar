// Envoi par WhatsApp : on ouvre WhatsApp avec un message déjà écrit ; la personne n'a plus qu'à appuyer sur Envoyer.
// Rien ne part tout seul.

import { PAYS, paysActuel } from './pays'

// Numéro au format international sans « + » (ex. en Côte d'Ivoire 07 07 07 07 07 → 2250707070707).
// Un numéro qui commence par + ou 00 garde son pays ; sinon on ajoute l'indicatif du pays de l'établissement
// (en enlevant le 0 du début, sauf dans les pays où il fait partie du numéro).
export function numeroInternational(tel?: string): string | null {
  if (!tel) return null
  let n = tel.replace(/[^\d+]/g, '')
  if (n.startsWith('+')) n = n.slice(1)
  else if (n.startsWith('00')) n = n.slice(2)
  else {
    const p = paysActuel()
    // Déjà écrit avec l'indicatif (ex. 2250707…) : on le garde tel quel.
    const dejaIndicatif = PAYS.some((x) => n.startsWith(x.indicatif) && n.length > 10)
    if (!dejaIndicatif) n = p.indicatif + (p.garderZero ? n : n.replace(/^0/, ''))
  }
  return n.length >= 8 ? n : null
}

// Lien qui ouvre WhatsApp. Sans numéro, WhatsApp demande à qui envoyer.
export function lienWhatsApp(texte: string, tel?: string): string {
  const n = numeroInternational(tel)
  return `https://wa.me/${n ?? ''}?text=${encodeURIComponent(texte)}`
}

export function ouvrirWhatsApp(texte: string, tel?: string) {
  window.open(lienWhatsApp(texte, tel), '_blank', 'noopener')
}
