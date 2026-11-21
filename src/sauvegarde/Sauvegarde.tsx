import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import { lireSauvegarde, restaurerBase, telechargerSauvegarde, type FichierSauvegarde } from '../db/sauvegarde'

// Écran Sauvegarde : enregistrer toute la base dans un fichier, ou la recharger depuis un fichier.
export default function Sauvegarde() {
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [aRestaurer, setARestaurer] = useState<FichierSauvegarde | null>(null)
  const [dernierFichier, setDernierFichier] = useState<File | null>(null)
  const choixFichier = useRef<HTMLInputElement>(null)

  const infos = useLiveQuery(async () => ({
    boutique: await db.boutique.get('principale'),
    ventes: await db.ventes.count(),
    articles: await db.articles.filter((a) => a.actif).count(),
  }), [])
  if (!infos) return <p>Chargement…</p>

  // Le partage (WhatsApp, Drive, e-mail…) n'existe que sur certains appareils, surtout les téléphones.
  const partagePossible = !!dernierFichier && !!navigator.canShare?.({ files: [dernierFichier] })

  async function sauvegarder() {
    setErreur('')
    const f = await telechargerSauvegarde()
    setDernierFichier(f)
    setMessage(`Fichier « ${f.name} » téléchargé. Range-le en lieu sûr : sur une clé, dans Google Drive ou envoyé par WhatsApp.`)
  }

  async function partager() {
    try {
      await navigator.share({ files: [dernierFichier!], title: 'Sauvegarde GESTOMAKIBAR' })
    } catch { /* partage annulé par l'utilisateur */ }
  }

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    setErreur(''); setMessage('')
    const f = e.target.files?.[0]
    e.target.value = '' // pour pouvoir choisir à nouveau le même fichier
    if (!f) return
    try {
      setARestaurer(await lireSauvegarde(f))
    } catch (x) {
      setErreur((x as Error).message)
    }
  }

  async function confirmerRestauration() {
    // Par prudence, on sauvegarde d'abord les données actuelles.
    await telechargerSauvegarde()
    await restaurerBase(aRestaurer!)
    setARestaurer(null)
    setMessage('Restauration terminée. Les données du fichier sont maintenant celles de l’application.')
  }

  const derniere = infos.boutique?.derniereSauvegarde
  const r = aRestaurer
  const boutiqueFichier = r?.tables.boutique?.[0] as { nom?: string } | undefined

  return (
    <section>
      <div className="entete-ecran"><h2>Sauvegarde</h2></div>
      <p className="info">
        Toutes les données sont dans ce téléphone ou cet ordinateur. S'il est perdu, cassé, ou si
        le navigateur est vidé, elles disparaissent. Une sauvegarde régulière, c'est ta protection.
      </p>
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}

      <div className="carte">
        <strong>Sauvegarder</strong>
        <p className="info">
          Dernière sauvegarde : {derniere ? new Date(derniere).toLocaleString('fr-FR') : 'jamais'}
          <br />Contenu actuel : {infos.articles} produits actifs, {infos.ventes} tickets.
        </p>
        <div className="boutons gauche">
          <button className="principal" onClick={sauvegarder}>Télécharger une sauvegarde</button>
          {partagePossible && <button onClick={partager}>Partager le fichier…</button>}
        </div>
      </div>

      <div className="carte">
        <strong>Restaurer</strong>
        <p className="info">Recharge un fichier de sauvegarde, par exemple sur un nouveau téléphone. Les données actuelles seront remplacées.</p>
        <input ref={choixFichier} type="file" accept=".json,application/json" onChange={choisir} hidden />
        <div className="boutons gauche">
          <button onClick={() => choixFichier.current?.click()}>Choisir un fichier…</button>
        </div>
        {r && (
          <div className="confirmation">
            <p>
              Sauvegarde du <strong>{new Date(r.date).toLocaleString('fr-FR')}</strong>
              {boutiqueFichier?.nom && <> ({boutiqueFichier.nom})</>} : {r.tables.articles?.length ?? 0} articles,
              {' '}{r.tables.ventes?.length ?? 0} tickets, {r.tables.achats?.length ?? 0} réceptions.
            </p>
            <p>
              <strong>Toutes les données actuelles seront remplacées.</strong> Une sauvegarde de sécurité des
              données actuelles sera d'abord téléchargée.
            </p>
            <div className="boutons">
              <button onClick={() => setARestaurer(null)}>Annuler</button>
              <button className="danger" onClick={confirmerRestauration}>Remplacer mes données</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
