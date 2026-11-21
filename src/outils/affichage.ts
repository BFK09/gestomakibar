// Réglages d'affichage propres à cet appareil (thème et taille du texte).
// Gardés dans le navigateur : ce ne sont pas des données de l'établissement, donc pas dans la sauvegarde.
export type Theme = 'auto' | 'light' | 'dark'
export type TailleTexte = 'normal' | 'grand' | 'tres-grand'

function lire(cle: string): string | null {
  try { return localStorage.getItem(cle) } catch { return null }
}
function ecrire(cle: string, valeur: string) {
  try { localStorage.setItem(cle, valeur) } catch { /* navigation privée : réglage non gardé */ }
}

export const themeActuel = () => (lire('affichage.theme') as Theme) ?? 'auto'
export const tailleActuelle = () => (lire('affichage.texte') as TailleTexte) ?? 'normal'

// Applique les réglages à la page (attributs lus par index.css).
export function appliquerAffichage(theme = themeActuel(), taille = tailleActuelle()) {
  const html = document.documentElement
  if (theme === 'auto') html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', theme)
  if (taille === 'normal') html.removeAttribute('data-texte')
  else html.setAttribute('data-texte', taille)
  // Couleur de la barre d'état du téléphone.
  const sombre = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#0f1419' : '#9a3412')
}

export function changerTheme(t: Theme) { ecrire('affichage.theme', t); appliquerAffichage() }
export function changerTaille(t: TailleTexte) { ecrire('affichage.texte', t); appliquerAffichage() }
