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
   `content/manifest.json` (section, `slug`, `title`, `file`).
3. Rechargez la page (pensez à vider le cache : les fichiers sont servis avec `no-cache`,
   mais le navigateur peut être tenace — `Ctrl+F5`).

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

Les chemins sont **relatifs** et le routage se fait par **ancre** : le site fonctionne à la
racine d'un domaine comme dans un sous-dossier, sans configuration.

Détails et déploiement via GitHub Actions : voir la page **GitHub** du guide lui-même.

## Licence

- **Code** du site : MIT (voir [`LICENSE`](LICENSE)).
- **Contenu** (`content/*.md`) : [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr).
