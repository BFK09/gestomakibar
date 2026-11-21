import Dexie, { type EntityTable } from 'dexie'
import type {
  Achat, Article, Boutique, Categorie, Client, Cloture, Encaissement, Fournisseur, Inventaire,
  LigneAchat, LigneInventaire, LigneVente, ModePaiement, MouvementStock, Serveur, Vente,
} from './types'
import { chargerDonneesDeDepart } from './depart'

// La base de données locale, enregistrée dans le navigateur (IndexedDB).
// Elle reste sur l'appareil et fonctionne sans internet.
export class BaseMakibar extends Dexie {
  boutique!: EntityTable<Boutique, 'id'>
  categories!: EntityTable<Categorie, 'id'>
  fournisseurs!: EntityTable<Fournisseur, 'id'>
  articles!: EntityTable<Article, 'id'>
  modesPaiement!: EntityTable<ModePaiement, 'id'>
  clients!: EntityTable<Client, 'id'>
  ventes!: EntityTable<Vente, 'id'>
  lignesVente!: EntityTable<LigneVente, 'id'>
  encaissements!: EntityTable<Encaissement, 'id'>
  achats!: EntityTable<Achat, 'id'>
  lignesAchat!: EntityTable<LigneAchat, 'id'>
  mouvementsStock!: EntityTable<MouvementStock, 'id'>
  inventaires!: EntityTable<Inventaire, 'id'>
  lignesInventaire!: EntityTable<LigneInventaire, 'id'>
  serveurs!: EntityTable<Serveur, 'id'>
  clotures!: EntityTable<Cloture, 'id'>

  constructor() {
    super('gestomakibar')

    // Version 1 du plan de la base (repris de GESTOLIBR, adapté au maquis).
    // Pour chaque table : le premier champ est l'identifiant,
    // les suivants sont les champs sur lesquels on veut chercher ou trier.
    // "&" veut dire "unique" (deux produits ne peuvent pas avoir le même code).
    // Pour changer le plan plus tard : ajouter une version 2, ne jamais modifier celle-ci.
    this.version(1).stores({
      boutique: 'id',
      categories: 'id, &nom',
      fournisseurs: 'id, nom',
      articles: 'id, &code, codeBarre, designation, categorieId, fournisseurId',
      modesPaiement: 'id, &nom',
      clients: 'id, nom, telephone',
      serveurs: 'id, nom',
      ventes: 'id, &numero, date, clientId, serveurId, annuleVenteId, retourVenteId',
      lignesVente: 'id, venteId, articleId',
      encaissements: 'id, date, venteId, clientId, modePaiementId, type, serveurId',
      clotures: 'id, date, journee, serveurId',
      achats: 'id, date, fournisseurId',
      lignesAchat: 'id, achatId, articleId',
      mouvementsStock: 'id, date, articleId, type, documentId',
      inventaires: 'id, date',
      lignesInventaire: 'id, inventaireId, articleId',
    })

    // "populate" ne s'exécute qu'une fois : à la toute première ouverture.
    this.on('populate', () => chargerDonneesDeDepart(this))
  }
}

export const db = new BaseMakibar()

// Donne un identifiant unique à chaque nouvel élément.
export const nouvelId = () => crypto.randomUUID()
