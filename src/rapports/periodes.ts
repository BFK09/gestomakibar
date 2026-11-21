export type Periode = 'jour' | 'semaine' | 'mois' | 'perso'

export const NOMS_PERIODES: Record<Periode, string> = {
  jour: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois',
  perso: 'Personnalisée',
}

// Date du jour au format AAAA-MM-JJ (celui des champs de type date), en heure locale.
export function jourLocal(d = new Date()) {
  const n = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}`
}

// Renvoie [début, fin[ en ISO. La semaine commence le lundi.
export function bornesPeriode(p: Periode, du: string, au: string): [string, string] {
  const debut = new Date(); debut.setHours(0, 0, 0, 0)
  const fin = new Date(debut); fin.setDate(fin.getDate() + 1)
  if (p === 'semaine') debut.setDate(debut.getDate() - ((debut.getDay() + 6) % 7))
  if (p === 'mois') debut.setDate(1)
  if (p === 'perso') {
    const d = new Date(du + 'T00:00:00')
    const f = new Date(au + 'T00:00:00'); f.setDate(f.getDate() + 1) // « au » est inclus
    return [d.toISOString(), f.toISOString()]
  }
  return [debut.toISOString(), fin.toISOString()]
}

export function libellePeriode(p: Periode, du: string, au: string) {
  const [d, f] = bornesPeriode(p, du, au)
  const fin = new Date(f); fin.setDate(fin.getDate() - 1)
  const txt = (x: Date) => x.toLocaleDateString('fr-FR')
  return d.slice(0, 10) === fin.toISOString().slice(0, 10) || txt(new Date(d)) === txt(fin)
    ? `le ${txt(new Date(d))}`
    : `du ${txt(new Date(d))} au ${txt(fin)}`
}
