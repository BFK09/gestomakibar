// Fabrique l'APK Android (une « TWA » : une coquille Android qui ouvre le site dans Chrome).
// Lancé par GitHub (.github/workflows/apk.yml) : rien à installer sur le PC.
// Utilise Bubblewrap, l'outil de Google sur lequel repose aussi PWABuilder.
import { AndroidSdkTools, Config, ConsoleLog, GradleWrapper, JdkHelper, KeyTool, TwaGenerator, TwaManifest } from '@bubblewrap/core'
import fs from 'node:fs'
import path from 'node:path'

const SITE = process.env.SITE_URL ?? 'https://bfk09.github.io/gestomakibar/'
const dossier = path.resolve('apk/projet-android')
const cle = { path: path.resolve('apk/cle.keystore'), alias: 'gestomakibar', password: process.env.MOT_DE_PASSE_CLE, keypassword: process.env.MOT_DE_PASSE_CLE }
const log = new ConsoleLog('apk')

// 1. Lire le manifeste du site (nom, couleurs, icônes) pour décrire l'application Android.
const twa = await TwaManifest.fromWebManifest(new URL('manifest.webmanifest', SITE).toString())
twa.packageId = 'ci.bfktech.gestomakibar'
twa.name = 'GESTOMAKIBAR'
twa.launcherName = 'Makibar'
twa.appVersionCode = Number(process.env.NUMERO_VERSION ?? 1)
twa.appVersionName = `1.0.${twa.appVersionCode}`
twa.fallbackType = 'customtabs'
// Écran de démarrage : ses couleurs viennent du manifeste du site (background_color, brun foncé du logo) ;
// il s'efface en douceur quand l'appli est prête, sur le même fond que l'écran de démarrage du site.
twa.splashScreenFadeOutDuration = 400
console.log('Couleur du démarrage :', twa.backgroundColor?.hex?.() ?? twa.backgroundColor)
twa.signingKey = { path: cle.path, alias: cle.alias }
console.log('Application :', twa.name, twa.host, twa.startUrl)

// 2. Créer le projet Android à partir du modèle.
await new TwaGenerator().createTwaProject(dossier, twa, log)

// 3. Compiler, aligner et signer.
const config = new Config(process.env.JAVA_HOME, process.env.ANDROID_HOME)
const jdk = new JdkHelper(process, config)
const sdk = await AndroidSdkTools.create(process, config, jdk, log)
if (!(await sdk.checkBuildTools())) await sdk.installBuildTools()
// La clé fixe vient des secrets du dépôt (voir apk.yml) ; on n'en crée une que si elle manque.
if (!fs.existsSync(cle.path)) await new KeyTool(jdk, log).createSigningKey({ ...cle, fullName: 'GESTOMAKIBAR', organizationalUnit: 'BFK-TECH', organization: 'BFK-TECH', country: 'CI' }, true)
await new GradleWrapper(process, sdk, dossier).assembleRelease()
const brut = path.join(dossier, 'app/build/outputs/apk/release/app-release-unsigned.apk')
const aligne = path.resolve('apk/aligne.apk')
await sdk.zipalign(brut, aligne)
await sdk.apksigner(cle.path, cle.password, cle.alias, cle.keypassword, aligne, path.resolve('apk/GESTOMAKIBAR.apk'))
console.log('APK prête : apk/GESTOMAKIBAR.apk')
