import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/base'
import {
  enregistrerEmballage, enregistrerMouvementEmballage, historiqueEmballages, NOMS_NATURES,
  preparerCasiers, soldeDeDepart, soldesEmballages, type SaisieEmballage,
} from '../db/emballages'
import type { MouvementEmballage } from '../db/types'
import { fcfa, lireEntier } from '../outils/format'

type Onglet = 'soldes' | 'mouvement' | 'types' | 'historique'
interface EditionType { id: string | null; nom: string; consigne: string; actif: boolean }

// Ce que l'on peut saisir à la main (les livraisons et les ventes se notent toutes seules).
const NATURES_SAISIE: { nature: MouvementEmballage['nature'] | 'depart_fournisseur' | 'depart_client'; libelle: string; aide: string }[] = [
  { nature: 'rendu_fournisseur', libelle: 'Vides rendus au fournisseur', aide: 'Hors réception (sinon, note-les dans la réception).' },
  { nature: 'consigne_fournisseur', libelle: 'Consigne payée au fournisseur', aide: "Tu gardes les casiers et tu les paies : ta dette en casiers diminue." },
  { nature: 'emporte_client', libelle: 'Casiers prêtés à un client', aide: 'Sans vente (sinon, note-les au moment de la vente).' },
  { nature: 'rendu_client', libelle: 'Vides rapportés par un client', aide: 'Hors vente.' },
  { nature: 'consigne_client', libelle: 'Consigne payée par un client', aide: 'Le client garde les casiers et les paie : sa dette en casiers diminue.' },
  { nature: 'ajustement', libelle: 'Correction du stock d\'emballages', aide: 'Après un comptage, une casse (−) ou un achat de casiers (+).' },
  { nature: 'depart_fournisseur', libelle: 'Solde de départ avec un fournisseur', aide: 'Casiers que tu lui dois déjà le jour où tu commences.' },
  { nature: 'depart_client', libelle: 'Solde de départ d\'un client', aide: 'Casiers qu\'un client te doit déjà.' },
]

// Écran Emballages : casiers consignés en possession, pleins et vides, dus aux fournisseurs et par les clients.
export default function Emballages() {
  const [onglet, setOnglet] = useState<Onglet>('soldes')
  const soldes = useLiveQuery(() => soldesEmballages(), [])
  const emballages = useLiveQuery(() => db.emballages.orderBy('nom').toArray(), [])
  const fournisseurs = useLiveQuery(() => db.fournisseurs.orderBy('nom').toArray(), [])
  const clients = useLiveQuery(() => db.clients.orderBy('nom').toArray(), [])
  const historique = useLiveQuery(() => historiqueEmballages(), [])
  const modes = useLiveQuery(() => db.modesPaiement.filter((m) => m.actif && m.nature !== 'credit').sortBy('ordre'), [])
  const serveurs = useLiveQuery(() => db.serveurs.orderBy('nom').filter((s) => s.actif).toArray(), [])
  const rattaches = useLiveQuery(() => db.articles.filter((a) => !!a.emballageId).count(), [])
  const [edition, setEdition] = useState<EditionType | null>(null)
  const [saisie, setSaisie] = useState({ nature: 'rendu_fournisseur', emballageId: '', quantite: '', tiers: '', montant: '', note: '', modeId: '', serveurId: '' })
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  if (!modes || !serveurs || !soldes || !emballages || !fournisseurs || !clients || !historique || rattaches === undefined) return <p>Chargement…</p>

  async function preparer() {
    setErreur(''); setMessage('')
    const n = await preparerCasiers()
    setMessage(n ? `${n} boisson(s) rattachée(s) à leur casier. Saisis maintenant la valeur de la consigne de chaque casier (onglet Types).` : 'Aucune bière ou sucrerie en bouteille à rattacher.')
  }

  async function validerType() {
    setErreur('')
    const c = lireEntier(edition!.consigne)
    if (Number.isNaN(c)) return setErreur('La consigne doit être un nombre entier.')
    try { await enregistrerEmballage(edition!.id, edition!.nom, c, edition!.actif); setEdition(null) } catch (x) { setErreur((x as Error).message) }
  }

  const choix = NATURES_SAISIE.find((n) => n.nature === saisie.nature)!
  const cote = saisie.nature.endsWith('fournisseur') ? 'fournisseur' : saisie.nature.endsWith('client') ? 'client' : null
  const avecMontant = saisie.nature.startsWith('consigne')

  async function validerMouvement() {
    setErreur(''); setMessage('')
    const q = lireEntier(saisie.quantite)
    const montant = lireEntier(saisie.montant)
    if (!saisie.emballageId) return setErreur("Choisis l'emballage.")
    if (q === null || Number.isNaN(q)) return setErreur('Indique le nombre de casiers.')
    if (Number.isNaN(montant)) return setErreur('Le montant doit être un nombre entier.')
    const tiers = cote === 'fournisseur' ? { fournisseurId: saisie.tiers || undefined } : cote === 'client' ? { clientId: saisie.tiers || undefined } : {}
    try {
      if (saisie.nature === 'depart_fournisseur' || saisie.nature === 'depart_client') {
        if (!saisie.tiers) return setErreur(cote === 'client' ? 'Choisis le client.' : 'Choisis le fournisseur.')
        await soldeDeDepart(saisie.emballageId, q, tiers, saisie.note)
      } else {
        await enregistrerMouvementEmballage({ nature: saisie.nature as SaisieEmballage['nature'], emballageId: saisie.emballageId, quantite: q, montant: avecMontant ? montant ?? undefined : undefined, note: saisie.note, modePaiementId: saisie.modeId || modes!.find((m) => m.nature === 'especes')?.id, serveurId: saisie.serveurId || undefined, ...tiers })
      }
      setMessage(`Enregistré : ${choix.libelle.toLowerCase()}, ${q} ${emballages!.find((e) => e.id === saisie.emballageId)?.nom}.`)
      setSaisie({ ...saisie, quantite: '', montant: '', note: '' })
    } catch (x) { setErreur((x as Error).message) }
  }

  const consigneDe = (id: string) => emballages.find((e) => e.id === id)?.consigne ?? null
  const valeur = (id: string, q: number) => { const c = consigneDe(id); return c ? ` (${fcfa(c * q)})` : '' }

  return (
    <section>
      <div className="entete-ecran"><h2>Emballages consignés</h2></div>
      <div className="onglets">
        {(['soldes', 'mouvement', 'types', 'historique'] as Onglet[]).map((o) => (
          <button key={o} className={onglet === o ? 'choisi' : ''} onClick={() => { setOnglet(o); setMessage(''); setErreur('') }}>
            {{ soldes: 'Soldes', mouvement: 'Noter', types: 'Types', historique: 'Historique' }[o]}
          </button>
        ))}
      </div>
      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreurs">{erreur}</p>}

      {emballages.length === 0 || rattaches === 0 ? (
        <div className="carte">
          <p>Les casiers des bières et sucreries en bouteille sont consignés : le fournisseur livre des pleins et reprend les vides.
            L'appli peut compter tes casiers et ce que tu dois au fournisseur.</p>
          <div className="boutons gauche"><button className="principal" onClick={preparer}>Préparer les casiers à partir de mes boissons</button></div>
          <p className="info">Crée un type « Casier 12 », « Casier 24 »… et y rattache chaque bière et sucrerie en bouteille. Tu pourras ensuite renommer, séparer par marque (Solibra, Brassivoire…) ou changer le casier d'une boisson dans sa fiche.</p>
        </div>
      ) : null}

      {onglet === 'soldes' && soldes.map((s) => (
        <div className="carte carte-emballage" key={s.emballage.id}>
          <div className="entete-ecran">
            <strong>{s.emballage.nom}</strong>
            <span className="info">{s.emballage.consigne ? `consigne ${fcfa(s.emballage.consigne)}` : 'consigne à saisir'}</span>
          </div>
          <div className="resume-jour">
            <div><small>Chez toi</small><strong>{s.possession}</strong></div>
            <div><small>Pleins</small><strong>{s.pleins}</strong></div>
            <div><small>Entamés</small><strong>{s.entames}</strong></div>
            <div><small>Vides</small><strong className={s.vides < 0 ? 'alerte' : ''}>{s.vides}</strong></div>
          </div>
          {s.vides < 0 && <p className="info alerte">Plus de casiers en stock de boissons que de casiers comptés : note le solde de départ (onglet Noter → Correction).</p>}
          {s.duFournisseurs.length > 0 && (
            <table className="tableau-simple"><tbody>
              {s.duFournisseurs.map((f) => (
                <tr key={f.id}><td>{f.quantite > 0 ? `Tu dois à ${f.nom}` : `${f.nom} te doit`}</td><td>{Math.abs(f.quantite)} casier(s){valeur(s.emballage.id, Math.abs(f.quantite))}</td></tr>
              ))}
            </tbody></table>
          )}
          {s.duClients.length > 0 && (
            <table className="tableau-simple"><tbody>
              {s.duClients.map((c) => (
                <tr key={c.id}><td>{c.quantite > 0 ? `${c.nom} doit rapporter` : `Tu dois à ${c.nom}`}</td><td>{Math.abs(c.quantite)} casier(s){valeur(s.emballage.id, Math.abs(c.quantite))}</td></tr>
              ))}
            </tbody></table>
          )}
          {s.duFournisseurs.length === 0 && s.duClients.length === 0 && <p className="info">Aucun casier dû, ni au fournisseur ni par un client.</p>}
        </div>
      ))}

      {onglet === 'mouvement' && (
        <div className="carte">
          <label>Ce qui se passe
            <select value={saisie.nature} onChange={(e) => setSaisie({ ...saisie, nature: e.target.value, tiers: '' })}>
              {NATURES_SAISIE.map((n) => <option key={n.nature} value={n.nature}>{n.libelle}</option>)}
            </select>
          </label>
          <p className="info">{choix.aide}</p>
          <div className="deux">
            <label>Emballage
              <select value={saisie.emballageId} onChange={(e) => setSaisie({ ...saisie, emballageId: e.target.value })}>
                <option value="">Choisir…</option>
                {emballages.filter((e) => e.actif).map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </label>
            <label>Nombre de casiers{saisie.nature === 'ajustement' || saisie.nature.startsWith('depart') ? ' (+ ou −)' : ''}
              <input inputMode="numeric" value={saisie.quantite} onChange={(e) => setSaisie({ ...saisie, quantite: e.target.value })} />
            </label>
          </div>
          {cote && (
            <label>{cote === 'fournisseur' ? 'Fournisseur' : 'Client'}
              <select value={saisie.tiers} onChange={(e) => setSaisie({ ...saisie, tiers: e.target.value })}>
                <option value="">Choisir…</option>
                {(cote === 'fournisseur' ? fournisseurs : clients).map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </label>
          )}
          {cote && (cote === 'fournisseur' ? fournisseurs : clients).length === 0 && (
            <p className="info">{cote === 'fournisseur' ? 'Aucun fournisseur : il est créé à la première réception.' : 'Aucun client : il est créé à la première vente à son nom (ou dans Crédits).'}</p>
          )}
          {avecMontant && (
            <label>Montant payé
              <input inputMode="numeric" value={saisie.montant} onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })}
                placeholder={(() => { const c = consigneDe(saisie.emballageId); const q = lireEntier(saisie.quantite); return c && q ? String(c * q) : '' })()} />
            </label>
          )}
          {avecMontant && (
            <div className="deux">
              <label>Payé en
                <select value={saisie.modeId} onChange={(e) => setSaisie({ ...saisie, modeId: e.target.value })}>
                  {modes.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </label>
              {serveurs.length > 0 && (
                <label>{saisie.nature === 'consigne_client' ? "Reçu par" : 'Sorti de la caisse de'}
                  <select value={saisie.serveurId} onChange={(e) => setSaisie({ ...saisie, serveurId: e.target.value })}>
                    <option value="">Choisir…</option>
                    {serveurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {avecMontant && <p className="info">Cet argent compte dans la clôture de caisse de ce serveur.</p>}
          <label>Remarque (facultatif)<input value={saisie.note} onChange={(e) => setSaisie({ ...saisie, note: e.target.value })} /></label>
          <div className="boutons gauche"><button className="principal" onClick={validerMouvement}>Enregistrer</button></div>
          <p className="info">Les casiers pleins livrés et les vides rendus au livreur se notent dans Réception ; ceux qu'un client emporte, dans la Caisse.</p>
        </div>
      )}

      {onglet === 'types' && (
        <div className="carte">
          {edition ? (
            <div className="edition-ligne">
              <input value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} placeholder="Nom (ex. Casier Solibra 12)" autoFocus />
              <input inputMode="numeric" value={edition.consigne} onChange={(e) => setEdition({ ...edition, consigne: e.target.value })} placeholder="Consigne d'un casier (casier + bouteilles)" />
              {edition.id && <label className="case"><input type="checkbox" checked={edition.actif} onChange={(e) => setEdition({ ...edition, actif: e.target.checked })} /> Actif</label>}
              <div className="boutons gauche">
                <button onClick={() => setEdition(null)}>Annuler</button>
                <button className="principal" onClick={validerType}>Enregistrer</button>
              </div>
            </div>
          ) : (
            <div className="boutons gauche">
              <button className="principal" onClick={() => setEdition({ id: null, nom: '', consigne: '', actif: true })}>+ Ajouter un type</button>
              <button onClick={preparer}>Rattacher les boissons sans casier</button>
            </div>
          )}
          <ul className="liste-articles">
            {emballages.map((e) => (
              <li key={e.id} className={e.actif ? '' : 'inactif'}>
                <button onClick={() => setEdition({ id: e.id, nom: e.nom, consigne: e.consigne?.toString() ?? '', actif: e.actif })}>
                  <span className="nom">{e.nom}<small>{e.consigne ? `consigne ${fcfa(e.consigne)}` : 'consigne à saisir'}{e.actif ? '' : ' · inactif'}</small></span>
                  <span className="chiffres"><small>Modifier</small></span>
                </button>
              </li>
            ))}
          </ul>
          <p className="info">Pour changer le casier d'une boisson (par marque, par exemple), ouvre sa fiche dans Produits.</p>
        </div>
      )}

      {onglet === 'historique' && (
        <div className="carte">
          {historique.length === 0 ? <p className="info">Aucun mouvement d'emballage pour l'instant.</p> : (
            <div className="table-defilante">
              <table className="table-rapport">
                <thead><tr><th>Date</th><th>Mouvement</th><th className="nombre">Chez toi</th><th className="nombre">Dû</th></tr></thead>
                <tbody>
                  {historique.map((m) => (
                    <tr key={m.id}>
                      <td className="date">{new Date(m.date).toLocaleDateString('fr-FR')}<br /><small>{new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                      <td>{NOMS_NATURES[m.nature]} · {m.emballage}{m.tiers && <><br /><small>{m.tiers}</small></>}{m.montant ? <><br /><small>{fcfa(m.montant)}</small></> : null}{m.note && <><br /><small>{m.note}</small></>}</td>
                      <td className="nombre">{m.possession > 0 ? `+${m.possession}` : m.possession || ''}</td>
                      <td className="nombre">{m.du > 0 ? `+${m.du}` : m.du || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
