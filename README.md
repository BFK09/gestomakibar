# GESTOMAKIBAR

Application de gestion pour maquis et bars (BFK-TECH) : caisse, serveurs, clôture de caisse,
stock de boissons, crédits clients. Elle fonctionne hors ligne, s'installe depuis le navigateur
et sera aussi disponible en APK Android.

- En ligne : https://bfk09.github.io/gestomakibar/ (publiée automatiquement à chaque envoi sur `main`)
- Construite sur la même base que [GESTOLIBR](https://github.com/BFK09/gestolibr) : Vite + React + TypeScript, base locale Dexie (IndexedDB), PWA.
- Voir `LISEZMOI.md` pour lancer le projet et le rôle de chaque fichier.

## État d'avancement (V1)
V1 terminée le 21/11/2026, en test chez le propriétaire :
1. Fondations · 2. Catalogue de 72 boissons de Côte d'Ivoire (sans prix) · 3. Serveurs et caisse rapide
4. Clôture de caisse par serveur · 5. Réception en casiers et stock · 6. Crédits clients
7. Tableau de bord et rapports par serveur · 8. Sauvegarde · 9. APK Android

- APK Android : https://github.com/BFK09/gestomakibar/releases/latest (onglet Actions → « Fabriquer l'APK »).
- Clé de signature : dossier `cle-apk` du projet sur le PC (secrets GitHub CLE_APK_B64 et MOT_DE_PASSE_CLE).

Suite prévue : V1.1 emballages consignés et mode dépôt ; V2 synchronisation multi-appareils.
