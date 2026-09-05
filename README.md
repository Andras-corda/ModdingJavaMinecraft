# Guide Minecraft Forge 1.20.1

Site statique (HTML / CSS / JavaScript, **sans dépendance externe**) qui documente **de A à Z**
la création d'un mod **Minecraft Forge 1.20.1** : installation du JDK, MDK, IntelliJ IDEA,
Visual Studio Code, travail en équipe avec Git/GitHub, et bonnes pratiques.

Le contenu de chaque page est stocké en **Markdown** dans [`content/`](content/) et rendu
côté client. Aucune étape de build : ce que vous voyez dans le dépôt est ce qui est publié.

## Aperçu local

Le site utilise `fetch()` pour charger les fichiers Markdown : il doit être servi en **HTTP**
(l'ouvrir en `file://` ne fonctionne pas). Lancez un serveur local :

```bash
python -m http.server 8000
```

Puis ouvrez <http://localhost:8000>.

Alternatives : `npx serve`, l'extension *Live Server* de VS Code, `php -S localhost:8000`.

## Structure

```text
.
├── index.html              coquille de l'application (routeur + mise en page)
├── .nojekyll               désactive le traitement Jekyll de GitHub Pages
├── assets/
│   ├── css/style.css       thème clair/sombre, mise en page documentaire
│   ├── js/markdown.js      convertisseur Markdown -> HTML (maison, sans dépendance)
│   ├── js/highlight.js     coloration syntaxique légère (Java, Gradle, JSON, TOML, bash…)
│   ├── js/app.js           routage par ancre, navigation, sommaire, recherche
│   └── img/favicon.svg
└── content/
    ├── manifest.json       ordre et titres des pages (source de la navigation)
    └── *.md                une page = un fichier Markdown
```

## Modifier le contenu

1. Éditez le fichier `.md` concerné dans [`content/`](content/).
2. Pour **ajouter** une page : créez `content/ma-page.md` puis ajoutez une entrée dans
   `content/manifest.json` (section, `slug`, `title`, `file`). Terminez la page par une ligne
   `Page suivante : **[Titre](#/slug)**` pointant vers la page suivante du manifest.
3. Rechargez la page (`Ctrl+F5` pour forcer).
4. **Si vous modifiez un fichier `assets/css/*.css` ou `assets/js/*.js`** : incrémentez le
   `?v=…` des balises `<link>` / `<script>` dans [`index.html`](index.html). Sinon les
   navigateurs (et GitHub Pages) continuent de servir l'ancienne version pendant ~10 min.

### Syntaxe Markdown prise en charge

Titres (avec ancres auto), gras/italique/barré, code en ligne, blocs de code délimités
avec langage, listes (imbriquées, ordonnées, cases à cocher), citations, tableaux façon
GitHub, règles horizontales, liens/images.

**Encadrés** (callouts) : commencez une citation par un marqueur.

```markdown
> :info: Information neutre.
> :astuce: Conseil pratique.
> :attention: Point de vigilance.
> :danger: Risque important.
```

**Liens internes** entre pages : `[texte](#/slug)` ou `[texte](#/slug#ancre)`.

## Publier sur GitHub Pages

1. Poussez ce dossier sur un dépôt GitHub.
2. *Settings → Pages → Build and deployment*
   - **Source** : *Deploy from a branch*
   - **Branch** : `main` — dossier `/ (root)` (ou `/docs` si vous placez le site dans `docs/`).
3. Attendez ~1 minute. Le site est disponible sur
   `https://<utilisateur>.github.io/<dépôt>/`.
4. Dans [`index.html`](index.html), ajustez `window.SITE_CONFIG.repoUrl` pour pointer vers
   votre dépôt (lien « GitHub » de la barre supérieure).

Les chemins sont **relatifs** (résolus à partir de l'emplacement de `assets/js/app.js`) et le
routage se fait par **ancre** : le site fonctionne à la racine d'un domaine comme dans un
sous-dossier (`https://user.github.io/mon-depot/`), sans configuration.

Détails et déploiement via GitHub Actions : voir la page **GitHub** du guide lui-même.

## Dépannage GitHub Pages

**« Impossible de charger `xxx.md` »** :

1. **Testez l'URL directement** dans le navigateur :
   `https://<user>.github.io/<depot>/content/xxx.md`
   - **404** → le fichier n'est pas sur GitHub (pas `git add` / `git push`), ou la **casse**
     du nom diffère (GitHub est sensible à la casse, Git sous Windows non — faites
     `git config core.ignorecase false` puis re-committez si besoin).
   - **Ça marche** → videz le cache (`Ctrl+F5`) ; le problème venait d'un déploiement en cours.
2. Vérifiez que le fichier **`.nojekyll`** (vide, à la racine) est bien présent dans le dépôt.
   Sans lui, GitHub lance Jekyll, ce qui peut faire échouer ou retarder le déploiement.
   Les fichiers commençant par `.` sont parfois oubliés : `git add .nojekyll`.
3. *Settings → Pages* : le bandeau doit indiquer **« Your site is live »** et le dernier
   déploiement (onglet *Actions*) doit être **vert**. Un build Jekyll rouge = site figé sur
   l'ancienne version.
4. `git ls-files content/ | wc -l` doit renvoyer le nombre de pages attendu (≥ 52).

## Licence

- **Code** du site : MIT (voir [`LICENSE`](LICENSE)).
- **Contenu** (`content/*.md`) : [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr).
