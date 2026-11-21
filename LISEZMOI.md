# Application GESTOMAKIBAR

En ligne : https://bfk09.github.io/gestomakibar/ (publiée automatiquement à chaque envoi sur GitHub).

## Lancer l'application sur ce PC
Il faut Node.js (version 20 ou plus). Dans PowerShell, depuis ce dossier :
```
npm install      # télécharge les bibliothèques (une seule fois)
npm run dev      # lance l'application, puis ouvrir l'adresse affichée
npm run build    # fabrique la version finale dans le dossier dist
```

## À quoi sert chaque fichier
- `package.json` : la fiche d'identité du projet, avec la liste des bibliothèques (React, Vite...) et les commandes.
- `package-lock.json` : les versions exactes installées, pour avoir le même résultat partout.
- `index.html` : la seule page HTML. React vient dessiner l'écran dans `<div id="root">`.
- `vite.config.ts` : réglages de Vite, l'outil qui construit l'application. C'est ici qu'on la rend installable et hors ligne (PWA) : nom, couleurs, icônes.
- `src/main.tsx` : le point de départ, qui branche React sur la page.
- `src/App.tsx` : l'écran principal : la navigation, puis l'écran choisi.
- `src/navigation/` : le menu. Sur téléphone, une barre en bas (Vente, Accueil, Catalogue, Clients, Plus) ; sur ordinateur, un menu à gauche. `ecrans.ts` liste les écrans, leurs icônes (bibliothèque lucide-react) et ceux du menu du bas.
- `src/db/types.ts` : la forme de chaque table (article, vente, ligne de vente, encaissement, achat, mouvement de stock, inventaire, serveur, clôture de caisse…).
- `src/db/base.ts` : la base locale Dexie (version 1 du plan), ses 16 tables (dont serveurs et clôtures) et les champs sur lesquels on cherche.
- `src/db/depart.ts` : au tout premier lancement, lit le CSV et crée les catégories, les 111 articles et les 3 modes de paiement.
- `src/db/stock.ts` : calcule le stock de chaque article en additionnant le journal des mouvements.
- `src/catalogue/Catalogue.tsx` : l'écran Catalogue (liste, recherche, filtres par catégorie, sans prix, inactifs).
- `src/catalogue/FicheArticle.tsx` : le formulaire pour ajouter ou modifier un article, avec les vérifications (code unique, prix en nombre entier…).
- `src/catalogue/codeSuivant.ts` : propose le prochain code libre d'une catégorie (ex. CAH-019).
- `src/db/reception.ts` : enregistre une réception en une seule fois (achat, lignes, entrées dans le journal de stock, nouveau coût moyen pondéré de chaque article).
- `src/reception/Reception.tsx` : l'écran Réception, avec ses deux onglets.
- `src/reception/NouvelleReception.tsx` : la saisie d'une livraison (fournisseur, date, référence, articles, quantités, coûts).
- `src/reception/HistoriqueReceptions.tsx` : la liste des réceptions passées et leur détail.
- `src/db/vente.ts` : enregistre une vente en une seule fois (ticket numéroté, lignes avec prix et coût figés, sorties de stock, encaissements par mode de paiement, client créé si besoin).
- `src/vente/Vente.tsx` : l'écran Vente, avec ses onglets Caisse et Ventes du jour.
- `src/vente/Caisse.tsx` : le panier, le total, le paiement partagé, la monnaie à rendre et le client pour un crédit.
- `src/vente/Ticket.tsx` : le ticket affiché après la vente, avec un bouton pour l'imprimer.
- `src/vente/VentesDuJour.tsx` : les tickets du jour et les totaux par mode de paiement.
- `src/configuration/Configuration.tsx` : l'assistant du premier lancement (1. identification de l'établissement, 2. choix des produits avec stock, prix d'achat et prix de vente, 3. vérification et validation).
- `src/db/configuration.ts` : enregistre la fin de l'assistant (identité, produits activés, stock de départ).
- `src/stock/Inventaire.tsx` et `src/db/inventaire.ts` : recompter le stock réel ; l'écart est ajouté au journal.
- Annulation de ticket : `annulerVente` dans `src/db/vente.ts` crée un contre-ticket (rien n'est supprimé) ; le bouton est sur le ticket (`src/vente/Ticket.tsx`).
- `src/db/sauvegarde.ts` : fabrique le fichier de sauvegarde (toutes les tables en JSON), le vérifie et le recharge.
- `src/sauvegarde/Sauvegarde.tsx` : l'écran Sauvegarde (télécharger, partager, restaurer).
- `src/sauvegarde/RappelSauvegarde.tsx` : le bandeau qui rappelle de sauvegarder après 7 jours.
- `src/db/statistiques.ts` : les calculs du tableau de bord (chiffre d'affaires net, marge, tickets, panier moyen, meilleurs produits, alertes de stock, valeur du stock).
- `src/tableau/TableauDeBord.tsx` : l'écran Tableau de bord.
- `src/db/rapports.ts` : prépare le journal des mouvements (avec le document d'origine) et l'état du stock.
- `src/rapports/` : l'écran Rapports (mouvements par période, état du stock, feuille de comptage), imprimable en PDF ; `periodes.ts` calcule les dates des périodes.
- `src/db/clients.ts`, `src/clients/` : crédits clients (dette = achats à crédit − remboursements), remboursement avec reçu imprimable, historique du compte, plafond de crédit.
- `src/parametres/` : l'écran Paramètres (identité de l'établissement, catégories, fournisseurs, modes de paiement, réinitialisation avec sauvegarde automatique avant d'effacer).
- Retours partiels : `retournerArticles` dans `src/db/vente.ts` (bouton « Retour d'articles… » sur le ticket) ; rembourse en espèces ou déduit de la dette.
- `src/stock/Pertes.tsx` et `enregistrerPerte` (`src/db/vente.ts`) : pertes et casse, avec un motif.
- `src/commun/BientotDisponible.tsx` : écran provisoire « En construction » pour les écrans prévus mais pas encore faits (Serveurs, Clôture).
- `src/data/catalogue_depart.csv` : le catalogue de départ des boissons (code ; désignation ; catégorie ; unité ; format ; bouteilles par casier), sans prix.
- `src/scan/ScanCamera.tsx` : lit un code-barres avec la caméra (lecteur intégré au téléphone sur Android, sinon la bibliothèque ZXing).
- `src/outils/codeBarre.ts` : retrouve l'article quand une douchette tape un code-barres puis Entrée.
- `src/rapports/RapportVentes.tsx` (+ `rapportVentes` dans `src/db/rapports.ts`) : rapport des ventes par article, catégorie, jour ou ligne par ligne, avec coût et marge.
- `src/configuration/importExcel.ts` : le modèle Excel de l'étape 2 de l'assistant (« Télécharger le modèle Excel ») et son import (« Importer le fichier rempli ») : produits cochés avec stock et prix, nouveaux produits et catégories créés, unité, code-barres et seuil repris.
- `src/outils/lireExcel.ts` : lit la première feuille d'un fichier .xlsx (sans bibliothèque en plus).
- `src/outils/excel.ts` : fabrique un vrai fichier Excel (.xlsx) dans le navigateur, sans serveur.
- `src/outils/pays.ts` : la liste des pays (indicatif téléphonique, monnaie). Le pays se choisit dans l'assistant de démarrage et dans Paramètres → Établissement ; la monnaie affichée peut être changée.
- `src/outils/whatsapp.ts` : ouvre WhatsApp avec un message déjà écrit (ticket, rappel de crédit) ; un numéro tapé sans indicatif reçoit celui du pays de l'établissement, un numéro avec + garde le sien.
- Rappels de crédit : `debutDeLaDette` et `messageRelance` dans `src/db/clients.ts` ; filtre « À relancer » (plus de 30 jours) dans l'écran Clients, bouton « Rappel WhatsApp » dans la fiche du client.
- `src/outils/affichage.ts` et `src/parametres/Affichage.tsx` : mode clair / sombre / automatique et taille du texte, propres à chaque appareil.
- `src/outils/texte.ts` : recherche sans tenir compte des accents.
- `src/outils/format.ts` : affichage des montants en FCFA et lecture des nombres saisis.
- `src/data/catalogue_depart.csv` : copie du catalogue de départ, incluse dans l'application pour marcher hors ligne.
- `src/index.css` : les styles. Les couleurs sont en haut (`--bleu`, `--fond`…) : on les change à un seul endroit.
- `public/` : les icônes de l'application.
- `tsconfig*.json`, `eslint.config.js`, `src/vite-env.d.ts` : réglages de TypeScript et du vérificateur de code. On n'y touche presque jamais.
- `.gitignore` : les dossiers que Git ne doit pas sauvegarder (`node_modules`, `dist`).

## Bon à savoir
- Les données restent dans le navigateur de l'appareil. **Faire une sauvegarde régulièrement** (écran Sauvegarde) et la garder ailleurs (WhatsApp, Drive, clé USB).
- Rien n'est jamais effacé de l'historique : une annulation crée un contre-ticket, un retour crée un ticket de retour, un inventaire enregistre un écart.

## Avoir une application Android (APK)
La version la plus simple, sans rien installer : **PWABuilder** fabrique l'APK à partir du site en ligne.
1. Ouvrir https://www.pwabuilder.com et coller l'adresse https://bfk09.github.io/gestomakibar/
2. Cliquer sur « Package for stores », puis « Android » et « Download test package ».
3. Envoyer le fichier .apk sur le téléphone et l'ouvrir (autoriser l'installation depuis cette source).
L'APK affiche le site dans Chrome : tout marche comme sur le site (PDF, Excel, sauvegarde, scan) et les mises à jour arrivent seules.
Attention : les données de l'APK et celles du site dans Chrome ne sont pas forcément les mêmes ; pour passer de l'un à l'autre, utiliser Sauvegarde puis Restaurer.
