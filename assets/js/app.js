/*
 * app.js — Routeur et logique du site (SPA statique).
 *
 * - Charge content/manifest.json pour construire la navigation.
 * - Récupère les fichiers Markdown de content/ à la demande (fetch).
 * - Convertit en HTML via markdown.js, colore le code via highlight.js.
 * - Gère : sommaire de page, précédent/suivant, thème clair/sombre,
 *   menu mobile, recherche plein texte.
 *
 * Routage par ancre : #/slug  (compatible GitHub Pages, aucun serveur requis).
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};

  // Base du site résolue à partir de l'emplacement RÉEL de ce script
  // (assets/js/app.js) plutôt que de l'URL courante du document. Cela évite
  // les erreurs « Failed to fetch » quand le site est servi dans un
  // sous-dossier (GitHub Pages de projet : /nom-du-depot/) ou sans « / »
  // final dans l'URL.
  var SITE_BASE = (function () {
    try {
      var self =
        (document.currentScript && document.currentScript.src) ||
        (function () {
          var s = document.getElementsByTagName("script");
          for (var i = s.length - 1; i >= 0; i--) {
            if (s[i].src && /\/app\.js(\?|$)/.test(s[i].src)) return s[i].src;
          }
          return null;
        })();
      if (self) return new URL("../../", self).href; // assets/js/ -> racine du site
    } catch (e) {}
    return new URL(".", location.href).href;
  })();

  var CONTENT_DIR = SITE_BASE + "content/";

  var el = {
    nav: document.getElementById("nav"),
    article: document.getElementById("article"),
    toc: document.getElementById("toc"),
    pager: document.getElementById("pager"),
    sidebar: document.getElementById("sidebar"),
    backdrop: document.getElementById("backdrop"),
    menuToggle: document.getElementById("menu-toggle"),
    themeToggle: document.getElementById("theme-toggle"),
    searchInput: document.getElementById("search-input"),
    searchResults: document.getElementById("search-results"),
    repoLink: document.getElementById("repo-link"),
    crumb: document.getElementById("crumb"),
  };

  var state = {
    manifest: null,
    pages: [], // liste à plat, dans l'ordre
    cache: {}, // slug -> markdown brut
    searchIndex: null,
  };

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------
  function init() {
    initTheme();
    initSidebar();

    if (CONFIG.repoUrl && el.repoLink) {
      el.repoLink.href = CONFIG.repoUrl;
    } else if (el.repoLink) {
      el.repoLink.style.display = "none";
    }

    el.menuToggle.addEventListener("click", toggleSidebar);
    el.backdrop.addEventListener("click", closeSidebar);
    el.themeToggle.addEventListener("click", toggleTheme);
    window.addEventListener("hashchange", route);

    initSearch();

    fetchText(CONTENT_DIR + "manifest.json")
      .then(function (txt) {
        var manifest = JSON.parse(txt);
        state.manifest = manifest;
        if (manifest.title) document.title = manifest.title;
        flattenPages();
        buildNav();
        route();
      })
      .catch(function (err) {
        el.article.innerHTML =
          '<div class="callout callout-danger"><p><strong>Impossible de charger le guide.</strong></p>' +
          "<p>" +
          escapeHtml(err.message) +
          "</p><p>Vérifiez que l'URL testée directement dans le navigateur répond bien :<br>" +
          '<code>' +
          escapeHtml(CONTENT_DIR + "manifest.json") +
          "</code></p><p>En local, le site doit être servi via HTTP (pas <code>file://</code>) : " +
          "<code>python -m http.server</code>.</p></div>";
      });
  }

  // Récupère un fichier texte de façon robuste : d'abord avec revalidation,
  // puis en repli sans option de cache (certains hébergeurs/proxies rejettent
  // la requête conditionnelle avec un « Failed to fetch »).
  function fetchText(url) {
    return fetch(url, { cache: "no-cache" })
      .catch(function () {
        return fetch(url);
      })
      .then(function (r) {
        if (!r.ok) {
          throw new Error(
            "Fichier absent ou inaccessible (HTTP " +
              r.status +
              ") : " +
              url.replace(SITE_BASE, "")
          );
        }
        return r.text();
      });
  }

  function flattenPages() {
    state.pages = [];
    (state.manifest.sections || []).forEach(function (section) {
      (section.pages || []).forEach(function (p) {
        state.pages.push({
          slug: p.slug,
          title: p.title,
          file: p.file || p.slug + ".md",
          group: section.group,
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // Navigation latérale
  // --------------------------------------------------------------------------
  function buildNav() {
    var html = "";
    (state.manifest.sections || []).forEach(function (section) {
      html += '<div class="nav-group">';
      html += '<div class="nav-group-title">' + escapeHtml(section.group) + "</div>";
      html += "<ul>";
      (section.pages || []).forEach(function (p) {
        html +=
          '<li><a data-slug="' +
          escapeHtml(p.slug) +
          '" href="#/' +
          encodeURIComponent(p.slug) +
          '">' +
          escapeHtml(p.title) +
          "</a></li>";
      });
      html += "</ul></div>";
    });
    el.nav.innerHTML = html;
  }

  function setActiveNav(slug) {
    var links = el.nav.querySelectorAll("a[data-slug]");
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle("active", links[i].getAttribute("data-slug") === slug);
    }
  }

  // --------------------------------------------------------------------------
  // Routage
  // --------------------------------------------------------------------------
  function currentRoute() {
    var raw = location.hash.replace(/^#\/?/, "");
    var parts = raw.split("#");
    var slug = decodeURIComponent(parts[0] || "");
    var anchor = parts[1] ? decodeURIComponent(parts[1]) : "";
    if (!slug && state.pages.length) slug = state.pages[0].slug;
    return { slug: slug, anchor: anchor };
  }

  function route() {
    if (!state.manifest) return;
    var r = currentRoute();
    var page = findPage(r.slug);
    if (!page) {
      el.article.innerHTML =
        '<div class="callout callout-warning"><p>Page introuvable : <code>' +
        escapeHtml(r.slug) +
        "</code></p></div>";
      el.toc.innerHTML = "";
      el.pager.innerHTML = "";
      return;
    }
    setActiveNav(page.slug);
    closeSidebar();
    loadPage(page, r.anchor);
  }

  function findPage(slug) {
    for (var i = 0; i < state.pages.length; i++) {
      if (state.pages[i].slug === slug) return state.pages[i];
    }
    return null;
  }

  function loadPage(page, anchor) {
    el.article.setAttribute("aria-busy", "true");
    var render = function (md) {
      var result = window.mdRender(md);
      el.article.innerHTML = result.html;
      el.article.removeAttribute("aria-busy");
      document.title =
        page.title + " · " + (state.manifest.title || "Guide Forge 1.20.1");
      enhance();
      buildToc(result.headings);
      buildPager(page);
      window.scrollTo(0, 0);
      if (anchor) {
        var target = document.getElementById(anchor);
        if (target) target.scrollIntoView();
      }
      spyToc();
    };

    if (state.cache[page.slug] != null) {
      render(state.cache[page.slug]);
      return;
    }
    fetchText(CONTENT_DIR + page.file)
      .then(function (md) {
        state.cache[page.slug] = md;
        render(md);
      })
      .catch(function (err) {
        el.article.removeAttribute("aria-busy");
        el.article.innerHTML =
          '<div class="callout callout-danger"><p><strong>Impossible de charger cette page.</strong></p><p>' +
          escapeHtml(err.message) +
          "</p><p>URL attendue : <code>" +
          escapeHtml(CONTENT_DIR + page.file) +
          "</code><br>Ouvrez-la directement dans le navigateur : si elle renvoie 404, le fichier " +
          "n'a pas été poussé sur GitHub ou la casse du nom diffère ; si le déploiement Pages " +
          "vient d'être lancé, patientez une minute et rechargez.</p></div>";
      });
  }

  // --------------------------------------------------------------------------
  // Améliorations post-rendu
  // --------------------------------------------------------------------------
  function enhance() {
    // Boutons « copier » sur les blocs de code.
    var blocks = el.article.querySelectorAll(".code-block");
    for (var i = 0; i < blocks.length; i++) {
      (function (block) {
        var btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.type = "button";
        btn.textContent = "Copier";
        btn.addEventListener("click", function () {
          var code = block.querySelector("code");
          var text = code ? code.innerText : "";
          navigator.clipboard.writeText(text).then(
            function () {
              btn.textContent = "Copié !";
              setTimeout(function () {
                btn.textContent = "Copier";
              }, 1500);
            },
            function () {
              btn.textContent = "Échec";
            }
          );
        });
        block.appendChild(btn);
      })(blocks[i]);
    }

    // Liens externes : nouvelle fenêtre déjà gérée par le parseur.
    // Tableaux larges : enveloppe déjà posée par le parseur.
  }

  // --------------------------------------------------------------------------
  // Sommaire de page (TOC)
  // --------------------------------------------------------------------------
  function buildToc(headings) {
    var items = headings.filter(function (h) {
      return h.level === 2 || h.level === 3;
    });
    if (items.length < 2) {
      el.toc.innerHTML = "";
      el.toc.classList.add("empty");
      return;
    }
    el.toc.classList.remove("empty");
    var html = '<div class="toc-title">Sur cette page</div><ul>';
    items.forEach(function (h) {
      html +=
        '<li class="toc-l' +
        h.level +
        '"><a href="#/' +
        encodeURIComponent(currentRoute().slug) +
        "#" +
        encodeURIComponent(h.id) +
        '" data-id="' +
        escapeHtml(h.id) +
        '">' +
        escapeHtml(h.text) +
        "</a></li>";
    });
    html += "</ul>";
    el.toc.innerHTML = html;

    var tocLinks = el.toc.querySelectorAll("a[data-id]");
    for (var i = 0; i < tocLinks.length; i++) {
      tocLinks[i].addEventListener("click", function (e) {
        e.preventDefault();
        var id = this.getAttribute("data-id");
        var target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          history.replaceState(
            null,
            "",
            "#/" + encodeURIComponent(currentRoute().slug) + "#" + encodeURIComponent(id)
          );
        }
      });
    }
  }

  var spyHandler = null;
  function spyToc() {
    if (spyHandler) window.removeEventListener("scroll", spyHandler);
    var links = el.toc.querySelectorAll("a[data-id]");
    if (!links.length) return;
    var targets = [];
    for (var i = 0; i < links.length; i++) {
      var t = document.getElementById(links[i].getAttribute("data-id"));
      if (t) targets.push({ id: links[i].getAttribute("data-id"), el: t });
    }
    spyHandler = throttle(function () {
      var pos = window.scrollY + 120;
      var currentId = targets.length ? targets[0].id : null;
      for (var j = 0; j < targets.length; j++) {
        if (targets[j].el.offsetTop <= pos) currentId = targets[j].id;
      }
      for (var k = 0; k < links.length; k++) {
        links[k].classList.toggle(
          "active",
          links[k].getAttribute("data-id") === currentId
        );
      }
    }, 100);
    window.addEventListener("scroll", spyHandler, { passive: true });
    spyHandler();
  }

  // --------------------------------------------------------------------------
  // Précédent / suivant
  // --------------------------------------------------------------------------
  function buildPager(page) {
    var idx = state.pages.indexOf(page);
    var prev = idx > 0 ? state.pages[idx - 1] : null;
    var next = idx < state.pages.length - 1 ? state.pages[idx + 1] : null;
    var html = "";
    if (prev) {
      html +=
        '<a class="pager-prev" href="#/' +
        encodeURIComponent(prev.slug) +
        '"><span>Précédent</span><strong>' +
        escapeHtml(prev.title) +
        "</strong></a>";
    } else {
      html += "<span></span>";
    }
    if (next) {
      html +=
        '<a class="pager-next" href="#/' +
        encodeURIComponent(next.slug) +
        '"><span>Suivant</span><strong>' +
        escapeHtml(next.title) +
        "</strong></a>";
    }
    el.pager.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // Thème
  // --------------------------------------------------------------------------
  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch (e) {}
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) {
      cur = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    var nextTheme = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("theme", nextTheme);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Barre latérale : tiroir sur mobile, repli sur bureau
  // --------------------------------------------------------------------------
  function isMobile() {
    return window.matchMedia("(max-width: 860px)").matches;
  }

  function toggleSidebar() {
    if (isMobile()) {
      document.body.classList.toggle("sidebar-open");
      return;
    }
    var collapsed = document.documentElement.classList.toggle("sidebar-collapsed");
    try {
      localStorage.setItem("sidebar", collapsed ? "collapsed" : "expanded");
    } catch (e) {}
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
  }

  function initSidebar() {
    var saved = null;
    try {
      saved = localStorage.getItem("sidebar");
    } catch (e) {}
    if (saved === "collapsed") {
      document.documentElement.classList.add("sidebar-collapsed");
    }
  }

  // --------------------------------------------------------------------------
  // Recherche plein texte
  // --------------------------------------------------------------------------
  function initSearch() {
    if (!el.searchInput) return;
    var debounced = debounce(runSearch, 180);
    el.searchInput.addEventListener("input", debounced);
    el.searchInput.addEventListener("focus", function () {
      buildSearchIndex();
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".search")) hideSearch();
    });
    el.searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideSearch();
    });
  }

  function buildSearchIndex() {
    if (state.searchIndex || !state.pages.length) return;
    state.searchIndex = [];
    Promise.all(
      state.pages.map(function (p) {
        if (state.cache[p.slug] != null) return Promise.resolve(state.cache[p.slug]);
        return fetchText(CONTENT_DIR + p.file)
          .then(function (md) {
            state.cache[p.slug] = md;
            return md;
          })
          .catch(function () {
            return "";
          });
      })
    ).then(function (docs) {
      docs.forEach(function (md, i) {
        var page = state.pages[i];
        var lines = md.replace(/\r\n?/g, "\n").split("\n");
        var currentHeading = { id: "", text: page.title };
        var inCode = false;
        lines.forEach(function (line) {
          if (/^\s*(```|~~~)/.test(line)) {
            inCode = !inCode;
            return;
          }
          if (inCode) return;

          var h = line.match(/^(#{1,6})\s+(.*)/);
          if (h) {
            var text = h[2].replace(/[*_`#]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
            currentHeading = { id: window.mdSlugify(text), text: text };
            state.searchIndex.push({
              page: page,
              heading: currentHeading,
              text: text,
              weight: 3,
            });
            return;
          }
          var clean = line
            .replace(/`[^`]*`/g, " ")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/^[\s>|*+-]+/, "")
            .replace(/[#*_`]/g, "")
            .trim();
          if (clean.length > 12 && !/^[|:-]+$/.test(clean)) {
            state.searchIndex.push({
              page: page,
              heading: currentHeading,
              text: clean,
              weight: 1,
            });
          }
        });
      });
    });
  }

  function runSearch() {
    var q = el.searchInput.value.trim().toLowerCase();
    if (q.length < 2) {
      hideSearch();
      return;
    }
    if (!state.searchIndex) {
      buildSearchIndex();
      el.searchResults.innerHTML =
        '<div class="search-empty">Indexation en cours… retapez votre recherche.</div>';
      el.searchResults.classList.add("open");
      return;
    }
    var terms = q.split(/\s+/);
    var scored = [];
    state.searchIndex.forEach(function (entry) {
      var hay = entry.text.toLowerCase();
      var score = 0;
      terms.forEach(function (t) {
        var pos = hay.indexOf(t);
        if (pos !== -1) score += entry.weight + (pos === 0 ? 1 : 0);
      });
      if (score > 0) scored.push({ entry: entry, score: score });
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });

    var seen = {};
    var results = [];
    for (var i = 0; i < scored.length && results.length < 8; i++) {
      var e = scored[i].entry;
      var key = e.page.slug + "#" + e.heading.id;
      if (seen[key]) continue;
      seen[key] = true;
      results.push(e);
    }

    if (!results.length) {
      el.searchResults.innerHTML =
        '<div class="search-empty">Aucun résultat pour « ' + escapeHtml(q) + " ».</div>";
      el.searchResults.classList.add("open");
      return;
    }

    el.searchResults.innerHTML = results
      .map(function (e) {
        var href =
          "#/" +
          encodeURIComponent(e.page.slug) +
          (e.heading.id ? "#" + encodeURIComponent(e.heading.id) : "");
        return (
          '<a class="search-hit" href="' +
          href +
          '"><span class="search-hit-page">' +
          escapeHtml(e.page.title) +
          "</span><span class=\"search-hit-text\">" +
          highlightTerms(e.heading.text, terms) +
          "</span></a>"
        );
      })
      .join("");
    el.searchResults.classList.add("open");

    var hits = el.searchResults.querySelectorAll("a");
    for (var j = 0; j < hits.length; j++) {
      hits[j].addEventListener("click", function () {
        hideSearch();
        el.searchInput.value = "";
      });
    }
  }

  function highlightTerms(text, terms) {
    var out = escapeHtml(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function hideSearch() {
    el.searchResults.classList.remove("open");
  }

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments,
        c = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(c, a);
      }, ms);
    };
  }
  function throttle(fn, ms) {
    var last = 0,
      timer;
    return function () {
      var now = Date.now();
      var remaining = ms - (now - last);
      var a = arguments,
        c = this;
      if (remaining <= 0) {
        last = now;
        fn.apply(c, a);
      } else {
        clearTimeout(timer);
        timer = setTimeout(function () {
          last = Date.now();
          fn.apply(c, a);
        }, remaining);
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
