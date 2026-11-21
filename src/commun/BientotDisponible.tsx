import { Hammer } from 'lucide-react'

interface Props { titre: string; etape: string; contenu: string }

// Écran provisoire : la fonction est prévue dans la feuille de route, mais pas encore construite.
export default function BientotDisponible({ titre, etape, contenu }: Props) {
  return (
    <section>
      <div className="entete-ecran"><h2>{titre}</h2></div>
      <div className="carte bientot">
        <Hammer size={28} />
        <p><strong>En construction ({etape}).</strong></p>
        <p>{contenu}</p>
      </div>
    </section>
  )
}
