// Les "types" décrivent la forme de chaque élément enregistré.
// TypeScript s'en sert pour signaler une faute (champ oublié, mauvais type).
// Tous les montants sont en nombres entiers, dans la monnaie de l'établissement (FCFA par défaut).

export type TypeEtablissement = 'maquis' | 'bar' | 'depot'

// L'identité de l'établissement (maquis, bar…), saisie dans l'assistant de démarrage (un seul enregistrement).
export interface Boutique {
  id: 'principale'
  type?: TypeEtablissement
  nom: string
  responsable: string
  telephone?: string
  adresse?: string
  pays?: string // code du pays (CI, SN, FR…) : indicatif téléphonique et monnaie
  monnaie?: string // texte de la monnaie, si on veut autre chose que celle du pays
  configureeLe: string // date de fin de la configuration
  derniereSauvegarde?: string // date du dernier fichier de sauvegarde téléchargé
  // Heure de début de la « journée commerciale » (0 à 23). Un maquis ouvert jusqu'à 3 h du matin :
  // avec 6, une vente faite à 2 h compte dans la journée de la veille. Vide = 6 h.
  debutJournee?: number
  // true : à la caisse, le même serveur reste choisi d'une vente à l'autre (« Changer » pour passer la main).
  // Vide ou false : on redemande « Qui encaisse ? » après chaque vente (plus sûr sur un appareil partagé).
  garderServeur?: boolean
}

// Un serveur ou une serveuse. Chaque vente indique qui l'a faite, pour la clôture de caisse.
export interface Serveur {
  id: string
  nom: string
  code?: string // code à 4 chiffres, facultatif, demandé avant d'encaisser
  actif: boolean
}

// Clôture de caisse d'un serveur pour une journée : l'argent attendu (calculé) et l'argent remis (compté).
// Comme l'historique, une clôture n'est jamais modifiée.
export interface Cloture {
  id: string
  date: string // date et heure de la clôture
  journee: string // journée commerciale concernée, ex. 2026-11-21
  serveurId: string
  attendu: number // espèces attendues d'après les ventes et remboursements
  remis: number // espèces réellement remises
  ecart: number // remis − attendu (négatif = manque)
  note?: string
}

export interface Categorie {
  id: string
  nom: string
}

export interface Fournisseur {
  id: string
  nom: string
  telephone?: string
}

export interface Article {
  id: string
  code: string // ex. CAH-001
  codeBarre?: string // le code imprimé sous les barres (EAN-13…), s'il y en a un
  designation: string
  categorieId: string
  fournisseurId?: string
  unite: string // bouteille, canette, sachet…
  format?: string // contenance : 33 cl, 65 cl, 1,5 L…
  tailleCasier?: number | null // nombre de bouteilles par casier ou par pack (12, 20, 24…)
  prixVente: number | null // vide tant qu'il n'est pas saisi
  seuilAlerte: number | null
  coutMoyen: number | null // coût moyen pondéré, recalculé à chaque achat
  actif: boolean
}

export interface ModePaiement {
  id: string
  nom: string // Espèces, Mobile money, Crédit… (modifiable)
  // Ce que le mode représente vraiment : le calcul des dettes se base sur « credit »,
  // pas sur le nom, pour qu'on puisse renommer un mode sans rien casser.
  nature: 'especes' | 'mobile_money' | 'credit' | 'autre'
  ordre: number // ordre d'affichage dans la caisse
  actif: boolean
}

export interface Client {
  id: string
  nom: string
  type: 'particulier' | 'revendeur' | 'entreprise'
  telephone?: string
  plafondCredit: number // 0 = pas de limite
  note?: string
}

// Un ticket de vente. Ses articles sont dans LigneVente.
export interface Vente {
  id: string
  numero: number
  date: string // date et heure au format ISO
  clientId?: string
  serveurId?: string // le serveur qui a fait la vente
  table?: string // table ou place du client (facultatif)
  total: number
  // Une vente n'est jamais modifiée ni supprimée. Pour l'annuler, on crée un
  // contre-ticket (montants et quantités négatifs) qui pointe vers elle.
  annuleVenteId?: string // rempli seulement sur un contre-ticket (annulation complète)
  retourVenteId?: string // rempli seulement sur un ticket de retour (une partie des produits rapportés)
}

// Valeurs figées : prix, coût et catégorie sont copiés au moment de la vente.
export interface LigneVente {
  id: string
  venteId: string
  articleId: string
  designation: string
  categorieId: string
  quantite: number
  prixUnitaire: number
  coutUnitaire: number
}

// Argent reçu ou rendu. Un ticket peut avoir plusieurs encaissements (paiement partagé).
// - paiement : part d'un ticket (si le mode est « crédit », c'est une dette du client) ;
// - remboursement_credit : le client règle une partie de sa dette (sans ticket) ;
// - rendu : argent rendu lors de l'annulation d'un ticket.
export interface Encaissement {
  id: string
  date: string
  type: 'paiement' | 'remboursement_credit' | 'rendu'
  modePaiementId: string
  montant: number
  venteId?: string
  clientId?: string
  serveurId?: string // le serveur qui a reçu (ou rendu) l'argent, pour la clôture de caisse
}

export interface Achat {
  id: string
  date: string
  fournisseurId?: string
  reference?: string // numéro du bon de livraison ou de la facture
  total: number
}

export interface LigneAchat {
  id: string
  achatId: string
  articleId: string
  quantite: number
  coutUnitaire: number
}

// Le stock est un journal : chaque entrée (+) ou sortie (-) est une ligne.
// Le stock d'un produit = la somme de ses quantités.
export interface MouvementStock {
  id: string
  date: string
  articleId: string
  quantite: number
  type: 'vente' | 'achat' | 'retour' | 'perte' | 'ajustement' | 'inventaire'
  documentId?: string // la vente, l'achat ou l'inventaire d'origine
  motif?: string // pour une perte : casse, vol, abîmé…
}

export interface Inventaire {
  id: string
  date: string
  note?: string
}

export interface LigneInventaire {
  id: string
  inventaireId: string
  articleId: string
  quantiteTheorique: number
  quantiteComptee: number
}
