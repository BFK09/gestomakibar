// Pour que "ecriture" trouve aussi "Écriture" : minuscules et sans accents.
export function sansAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
