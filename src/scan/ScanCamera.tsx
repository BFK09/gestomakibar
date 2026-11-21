import { useEffect, useRef, useState } from 'react'

interface Props {
  onCode: (code: string) => void
  onFermer: () => void
}

// Fenêtre qui ouvre la caméra et lit un code-barres.
// Sur Android (Chrome), le téléphone sait lire les codes-barres tout seul (BarcodeDetector).
// Ailleurs (iPhone, ordinateur), on charge la bibliothèque ZXing, seulement au moment du scan.
export default function ScanCamera({ onCode, onFermer }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [erreur, setErreur] = useState('')
  const dejaLu = useRef(false)
  // On garde la dernière version de onCode sans redémarrer la caméra à chaque affichage.
  const rappel = useRef(onCode)
  useEffect(() => { rappel.current = onCode })

  useEffect(() => {
    let arreter = () => {}
    let fini = false
    const lu = (code: string) => {
      if (dejaLu.current || !code) return
      dejaLu.current = true
      navigator.vibrate?.(80)
      rappel.current(code.trim())
    }

    ;(async () => {
      try {
        const Detecteur = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
        if (Detecteur) {
          const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          if (fini) { flux.getTracks().forEach((t) => t.stop()); return }
          video.current!.srcObject = flux
          await video.current!.play()
          const detecteur = new Detecteur()
          const minuterie = window.setInterval(async () => {
            try {
              const r = await detecteur.detect(video.current!)
              if (r[0]) lu(r[0].rawValue)
            } catch { /* image pas encore prête */ }
          }, 250)
          arreter = () => { window.clearInterval(minuterie); flux.getTracks().forEach((t) => t.stop()) }
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (fini) return
          const lecteur = new BrowserMultiFormatReader()
          const controles = await lecteur.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (resultat) => {
            if (resultat) lu(resultat.getText())
          })
          arreter = () => controles.stop()
        }
      } catch (e) {
        const nom = (e as Error).name
        setErreur(nom === 'NotAllowedError'
          ? "L'accès à la caméra a été refusé. Autorise la caméra pour ce site dans les réglages du navigateur."
          : nom === 'NotFoundError' ? 'Aucune caméra trouvée sur cet appareil.' : `La caméra n'a pas pu démarrer (${(e as Error).message}).`)
      }
    })()
    return () => { fini = true; arreter() }
  }, [])

  return (
    <div className="fond" onClick={onFermer}>
      <div className="fiche scan" onClick={(e) => e.stopPropagation()}>
        <h3>Scanner un code-barres</h3>
        {erreur ? <p className="erreurs">{erreur}</p> : (
          <>
            <video ref={video} muted playsInline />
            <p className="info">Place le code-barres dans le cadre, bien éclairé.</p>
          </>
        )}
        <div className="boutons"><button type="button" onClick={onFermer}>Fermer</button></div>
      </div>
    </div>
  )
}
