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
  // Vente en gros aux revendeurs (prix de gros, vente au casier, livraisons). Toujours actif pour un dépôt.
  venteEnGros?: boolean
  // Profils avec code PIN (patron, gérants, serveurs). Vide ou false : pas de connexion, tout est visible, comme avant.
  profilsActifs?: boolean
  // Verrouillage automatique après ce nombre de minutes sans toucher l'écran (0 = jamais). Vide = 10.
  verrouMinutes?: number
}

// Le mode dépôt (gros, casiers, livraisons) est-il actif ?
export const modeDepot = (b?: Pick<Boutique, 'type' | 'venteEnGros'>) => b?.type === 'depot' || !!b?.venteEnGros

// Un serveur ou une serveuse. Chaque vente indique qui l'a faite, pour la clôture de caisse.
// Un profil de direction : le patron (un seul) ou un gérant. Le PIN n'est jamais gardé en clair :
// on garde son empreinte (SHA-256 avec un sel propre au profil).
export type RoleProfil = 'patron' | 'gerant'
export interface Profil {
  id: string
  nom: string
  role: RoleProfil
  sel: string
  pinHash: string
  secoursHash?: string // patron seulement : empreinte de la phrase de secours (PIN oublié)
  actif: boolean
}

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
  emballageId?: string // le casier consigné dans lequel cette boisson arrive (vide = pas de consigne)
  prixVente: number | null // vide tant qu'il n'est pas saisi
  prixGros?: number | null // prix d'une unité pour un revendeur (mode dépôt) ; vide = prix de détail
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
  tarif?: 'gros' // prix de gros (revendeur) ; vide = prix de détail
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
// - rendu : argent rendu lors de l'annulation d'un ticket ;
// - consigne : consigne d'emballages payée par un client (+) ou payée au fournisseur avec l'argent de la caisse (−).
export interface Encaissement {
  id: string
  date: string
  type: 'paiement' | 'remboursement_credit' | 'rendu' | 'consigne'
  modePaiementId: string
  montant: number
  venteId?: string
  clientId?: string
  serveurId?: string // le serveur qui a reçu (ou rendu) l'argent, pour la clôture de caisse
  fournisseurId?: string // consigne payée à un fournisseur
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

// Un type d'emballage consigné : casier avec ses bouteilles vides (ex. « Casier Solibra 12 »).
// Le fournisseur livre des casiers pleins et reprend les vides ; ce qui n'est pas rendu se paie (consigne).
export interface Emballage {
  id: string
  nom: string
  consigne: number | null // valeur d'un emballage (casier + bouteilles), vide tant qu'elle n'est pas saisie
  actif: boolean
}

// Journal des emballages, comme le stock : on ne modifie jamais une ligne, on en ajoute.
// Chaque mouvement change deux soldes :
// - possession : emballages présents chez nous (pleins ou vides) ;
// - du : emballages dus au fournisseur (positif = on lui doit) ou par le client (positif = il nous doit).
export interface MouvementEmballage {
  id: string
  date: string
  emballageId: string
  nature:
    | 'livre' // le fournisseur livre des casiers pleins
    | 'rendu_fournisseur' // on rend des vides au fournisseur
    | 'consigne_fournisseur' // on paie au fournisseur la consigne d'emballages qu'on garde
    | 'emporte_client' // un client emporte des casiers
    | 'rendu_client' // un client rapporte des vides
    | 'consigne_client' // un client paie la consigne d'emballages qu'il garde
    | 'ajustement' // comptage, casse, achat d'emballages, solde de départ
  possession: number
  du: number
  fournisseurId?: string
  clientId?: string
  documentId?: string // la réception ou la vente d'origine
  montant?: number // argent versé ou reçu pour une consigne
  note?: string
}

// Une livraison : un ticket de vente à apporter chez le client (mode dépôt).
export interface Livraison {
  id: string
  venteId: string
  date: string // date de la commande
  adresse: string
  telephone?: string
  note?: string
  statut: 'a_livrer' | 'livree' | 'annulee'
  livreur?: string
  livreeLe?: string
}

// Une dépense de fonctionnement (loyer, électricité, glace…). Les achats de boissons n'en font pas partie :
// ils passent par la réception. Payée avec l'argent d'un serveur, elle est retirée de ses espèces à remettre.
export interface Depense {
  id: string
  date: string // date et heure
  categorie: string
  montant: number
  serveurId?: string // payée avec les espèces de ce serveur (déduite à sa clôture)
  note?: string
  saisiPar?: string // nom de la personne connectée qui l'a saisie
}
