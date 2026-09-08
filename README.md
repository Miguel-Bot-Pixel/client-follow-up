# Client Follow Up — application autonome (sans compte Claude)

Cette application remplace les 4 liens Artifact claude.ai par une vraie petite
application web : un serveur Node.js + une page web, à déployer sur un
hébergeur (au choix). **Les agents n'ont besoin d'aucun compte** — juste
d'une URL et du code d'accès de leur desk.

## Comment ça marche

- 4 "desks" = 4 langues (EN / FR / IT / ES), chacun avec :
  - son propre code d'accès (un secret partagé par desk, pas un compte par agent),
  - sa propre base de données (un fichier JSON séparé côté serveur) — un agent
    du desk FR ne peut techniquement pas voir ou modifier les clients du desk EN, IT ou ES.
- Un agent ouvre l'URL de l'app avec `?desk=fr` (ou `en` / `it` / `es`), entre
  le code de son desk une fois, et reste connecté sur cet appareil (le code
  est mémorisé dans son navigateur).
- Le code est vérifié **côté serveur** à chaque appel — ce n'est pas juste une
  protection dans le navigateur, c'est une vraie barrière.
- La page se rafraîchit automatiquement toutes les 5 secondes pour que
  plusieurs agents d'un même desk voient les mises à jour des uns et des autres.

## ⚠️ Ne jamais ouvrir `index.html` directement

Ne double-clique jamais sur `public/index.html` (ni sur un fichier extrait
d'un `.zip` sans l'avoir décompressé au préalable). Ouvert comme ça, la page
n'a aucun serveur derrière elle pour vérifier le code ou sauvegarder quoi que
ce soit ("Connexion au serveur impossible"). L'application doit toujours être
lancée via le serveur (voir ci-dessous), puis ouverte dans le navigateur à
l'adresse `http://localhost:3000/...` (ou l'adresse de l'hébergeur une fois déployée).

## Tester en local — le plus simple

1. **Extrais complètement** le `.zip` dans un dossier normal (Bureau,
   Documents...) — pas depuis la vue "aperçu du zip" de l'explorateur de
   fichiers, sinon rien n'est réellement décompressé.
2. Assure-toi d'avoir Node.js installé (télécharge la version "LTS" sur
   https://nodejs.org si besoin).
3. Double-clique sur :
   - **Windows** : `start-windows.bat`
   - **Mac** : `start-mac.command` (au premier lancement, un clic droit →
     "Ouvrir" peut être nécessaire à cause des protections macOS)
4. Une fenêtre noire (terminal) s'ouvre et affiche la progression — **laisse-la
   ouverte** tant que tu utilises l'outil, c'est elle qui fait tourner le
   serveur. Le navigateur s'ouvre tout seul quelques secondes après sur le
   desk EN (`http://localhost:3000/?desk=en`).
5. Entre le code d'accès du desk (voir `.env.example` pour les codes par
   défaut, ex. `en-desk-2026` pour EN).

Pour tester un autre desk, change `en` par `fr`, `it` ou `es` dans l'adresse
du navigateur (le serveur, lui, gère les 4 desks en même temps).

Pour fermer l'outil : ferme simplement la fenêtre noire du terminal.

## ⚠️ Point important avant de déployer : le stockage

Les données sont stockées dans de simples fichiers JSON sur le disque du
serveur (`data/clients-en.json`, etc.). C'est volontairement simple pour une
V1 rapide à tester, mais ça veut dire :

- Sur certains hébergeurs **gratuits**, le disque est *éphémère* : à chaque
  redéploiement (ou parfois à chaque redémarrage après une mise en veille),
  le contenu du dossier `data/` peut être **réinitialisé aux fiches
  d'exemple**, et tout ce que les agents auront saisi entre-temps sera perdu.
- C'est acceptable pour une phase de test/validation (ce que tu as prévu),
  mais **avant un usage réel avec de vraies données clients, il faudra soit
  un hébergeur avec un disque persistant, soit migrer vers une vraie base de
  données** (Postgres, etc. — je peux le faire quand tu seras prêt).

Deux pistes ci-dessous, selon ce que tu veux tester en premier.

## Option A — Render (le plus simple, pour tester vite)

1. Crée un compte gratuit sur render.com.
2. Mets ce dossier dans un dépôt GitHub (ou GitLab).
3. Sur Render : **New +** → **Web Service** → connecte le dépôt.
4. Render détecte Node.js automatiquement. Renseigne :
   - Build Command : `npm install`
   - Start Command : `npm start`
5. Dans l'onglet **Environment**, ajoute les 4 variables (voir `.env.example`) :
   `DESK_EN_CODE`, `DESK_FR_CODE`, `DESK_IT_CODE`, `DESK_ES_CODE` — remplace
   les valeurs par défaut par de vrais codes secrets.
6. Déploie. Render te donne une URL du type `https://client-follow-up.onrender.com`.
7. Chaque desk accède via :
   - `https://.../?desk=en`
   - `https://.../?desk=fr`
   - `https://.../?desk=it`
   - `https://.../?desk=es`

⚠️ Sur le plan gratuit Render, le service se met en veille après une période
sans activité et **le disque repart de zéro à chaque redéploiement** —
pratique pour tester l'outil et le flux d'utilisation, mais pas pour garder
des données dans la durée (voir l'avertissement ci-dessus).

## Option B — Fly.io (pour garder les données, avec un volume persistant)

Fly.io propose un disque persistant ("volume") même sur son offre gratuite,
ce qui règle le problème de perte de données au redémarrage.

1. Installe le CLI `flyctl` et crée un compte gratuit sur fly.io.
2. Depuis ce dossier : `fly launch` (répondre "no" à la création d'une base
   de données proposée automatiquement — on n'en a pas besoin).
3. Crée un volume : `fly volumes create data --size 1`.
4. Dans `fly.toml`, ajoute le montage du volume sur `/app/data` (le
   fichier généré par `fly launch` peut être ajusté, demande-moi si besoin
   d'aide sur cette étape précise).
5. Configure les 4 codes secrets : `fly secrets set DESK_EN_CODE=... DESK_FR_CODE=... DESK_IT_CODE=... DESK_ES_CODE=...`
6. `fly deploy`.

Je peux préparer le `fly.toml` complet si tu choisis cette option — dis-le
moi et je te génère le fichier prêt à l'emploi.

## Tester en local — méthode "terminal" (alternative avancée)

Si tu préfères ne pas utiliser les scripts `start-windows.bat` / `start-mac.command` :

```bash
npm install
DESK_EN_CODE=test-en DESK_FR_CODE=test-fr DESK_IT_CODE=test-it DESK_ES_CODE=test-es npm start
```

Puis ouvrir `http://localhost:3000/?desk=en` et entrer le code `test-en`. Là
aussi, laisse cette fenêtre de terminal ouverte pendant que tu testes.

## Ce qui a déjà été testé ici avant livraison

- Démarrage du serveur, les 4 desks se chargent correctement (`/api/:desk/meta`).
- Refus d'accès (401) sans code ou avec un mauvais code, sur les 4 desks.
- Acceptation avec le bon code, sur les 4 desks.
- Création, modification et suppression d'une fiche client (CRUD complet).
- **Cloisonnement réel vérifié** : une fiche créée sur le desk EN n'apparaît
  pas dans les données du desk FR.
- La page web se charge et affiche le bon nom d'outil par desk.

## Prochaines étapes suggérées (pas encore faites)

- Remplacer les 4 codes par défaut par de vrais secrets avant tout partage aux agents.
- Choisir l'hébergement définitif selon le besoin de persistance des données.
- Si besoin plus tard : vraie base de données (au lieu des fichiers JSON) pour un usage en production durable.
