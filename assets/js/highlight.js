/*
 * highlight.js — Coloration syntaxique légère, sans dépendance.
 *
 * Principe : on échappe le code, puis chaque jeton reconnu (commentaire,
 * chaîne, annotation, mot-clé, nombre, type) est remplacé par un marqueur
 * « §XX§ » et mis de côté. Les passes suivantes ne voient donc jamais le
 * contenu déjà coloré, ce qui évite toute recoloration parasite.
 *
 * Langages : java, groovy/gradle, kotlin, json, toml, properties,
 * bash/sh/console, yaml, xml/html. Les autres sont simplement échappés.
 *
 * API : window.hlHighlight(code, langue) -> HTML
 */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  var KEYWORDS = {
    java:
      "abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try var void volatile while yield record sealed permits non-sealed",
    kotlin:
      "as break by catch class continue do else enum false for fun if import in interface is null object override package private protected public return super this throw true try typealias val var when while data sealed companion init constructor lateinit open internal",
    groovy:
      "as assert break case catch class def do else extends false finally for if implements import in instanceof interface new null package private protected public return static super switch this throw throws trait true try void while",
  };
  KEYWORDS.gradle = KEYWORDS.groovy;

  var LITERALS = "true false null";

  function highlight(code, lang) {
    lang = (lang || "").toLowerCase();
    var alias = {
      sh: "bash",
      shell: "bash",
      console: "bash",
      "shell-session": "bash",
      js: "javascript",
      ts: "javascript",
      yml: "yaml",
      html: "xml",
      kt: "kotlin",
    };
    lang = alias[lang] || lang;

    var esc = escapeHtml(code);
    var store = [];
    function enc(n) {
      var s = "";
      n++;
      while (n > 0) {
        n--;
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26);
      }
      return s;
    }
    function stash(cls, inner) {
      store.push('<span class="tok-' + cls + '">' + inner + "</span>");
      return "§" + enc(store.length - 1) + "§";
    }

    var hashComment = /^(bash|toml|yaml|properties|ini)$/.test(lang);
    var slashComment = /^(java|groovy|gradle|kotlin|javascript)$/.test(lang);

    if (lang === "xml") {
      esc = esc.replace(/&lt;!--[\s\S]*?--&gt;/g, function (m) {
        return stash("com", m);
      });
      esc = esc.replace(/(&lt;[/?]?)([\w:.-]+)/g, function (_, br, name) {
        return br + stash("type", name);
      });
      esc = esc.replace(/([\w:.-]+)=("[^"]*")/g, function (_, attr, val) {
        return stash("attr", attr) + "=" + stash("str", val);
      });
      return restore(esc, store);
    }

    // Commentaires de bloc.
    if (slashComment) {
      esc = esc.replace(/\/\*[\s\S]*?\*\//g, function (m) {
        return stash("com", m);
      });
    }
    // Commentaires de ligne.
    if (slashComment || lang === "javascript") {
      esc = esc.replace(/\/\/[^\n]*/g, function (m) {
        return stash("com", m);
      });
    }
    if (hashComment) {
      esc = esc.replace(/(^|\s)#[^\n]*/g, function (m) {
        return m.replace(/#[^\n]*/, function (c) {
          return stash("com", c);
        });
      });
    }

    // Clés JSON / YAML / properties / toml avant les chaînes.
    if (lang === "json") {
      esc = esc.replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, function (_, k, c) {
        return stash("key", k) + c;
      });
    }
    if (lang === "yaml") {
      esc = esc.replace(/^(\s*(?:-\s+)?)([\w.-]+)(\s*:)(\s|$)/gm, function (_, pre, k, c, sp) {
        return pre + stash("key", k) + c + sp;
      });
    }
    if (lang === "toml") {
      esc = esc.replace(/^(\s*)(\[\[?[^\]]+\]\]?)/gm, function (_, pre, sec) {
        return pre + stash("type", sec);
      });
      esc = esc.replace(/^(\s*)([A-Za-z0-9_.-]+)(\s*=)/gm, function (_, pre, k, c) {
        return pre + stash("key", k) + c;
      });
    }
    if (lang === "properties" || lang === "ini") {
      esc = esc.replace(/^(\s*)([A-Za-z0-9_.\-]+)(\s*[=:])/gm, function (_, pre, k, c) {
        return pre + stash("key", k) + c;
      });
    }

    // Chaînes de caractères.
    esc = esc.replace(/"(?:[^"\\\n]|\\.)*"/g, function (m) {
      return stash("str", m);
    });
    if (lang !== "json") {
      esc = esc.replace(/'(?:[^'\\\n]|\\.)*'/g, function (m) {
        return stash("str", m);
      });
      esc = esc.replace(/`(?:[^`\\]|\\.)*`/g, function (m) {
        return stash("str", m);
      });
    }

    // Annotations Java / Kotlin.
    if (/^(java|kotlin|groovy|gradle)$/.test(lang)) {
      esc = esc.replace(/@[A-Za-z_][\w.]*/g, function (m) {
        return stash("ann", m);
      });
    }

    // Options de ligne de commande.
    if (lang === "bash") {
      esc = esc.replace(/(^|\s)(--?[A-Za-z][\w-]*)/g, function (_, sp, o) {
        return sp + stash("attr", o);
      });
      esc = esc.replace(
        /(^|\n|\||&&|;)(\s*)(sudo |)([a-z][\w./-]*)/g,
        function (whole, sep, sp, su, cmd) {
          return sep + sp + su + stash("fn", cmd);
        }
      );
    }

    // Types (Majuscule suivie d'une minuscule) — sûr vis-à-vis des marqueurs.
    if (/^(java|kotlin|groovy|gradle)$/.test(lang)) {
      esc = esc.replace(/\b[A-Z][a-z]\w*\b/g, function (m) {
        return stash("type", m);
      });
    }

    // Mots-clés.
    var kw = KEYWORDS[lang];
    if (kw) {
      var re = new RegExp("\\b(" + kw.trim().split(/\s+/).join("|") + ")\\b", "g");
      esc = esc.replace(re, function (m) {
        return stash("kw", m);
      });
    }

    // Littéraux booléens / null.
    esc = esc.replace(
      new RegExp("\\b(" + LITERALS.split(" ").join("|") + ")\\b", "g"),
      function (m) {
        return stash("lit", m);
      }
    );

    // Nombres (aucun chiffre dans les marqueurs -> pas de collision).
    esc = esc.replace(/\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?[fFlLdD]?\b/g, function (m) {
      return stash("num", m);
    });

    return restore(esc, store);
  }

  function restore(text, store) {
    var prev;
    var guard = 0;
    do {
      prev = text;
      text = text.replace(/§([A-Z]+)§/g, function (whole, code) {
        var n = 0;
        for (var k = 0; k < code.length; k++) {
          n = n * 26 + (code.charCodeAt(k) - 65 + 1);
        }
        var idx = n - 1;
        return store[idx] != null ? store[idx] : whole;
      });
      guard++;
    } while (text !== prev && guard < 6);
    return text;
  }

  global.hlHighlight = highlight;
})(typeof window !== "undefined" ? window : globalThis);
