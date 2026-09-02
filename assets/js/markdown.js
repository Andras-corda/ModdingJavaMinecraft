/*
 * markdown.js — Petit convertisseur Markdown -> HTML, sans dépendance.
 *
 * Prend en charge : titres ATX (avec ancres), paragraphes, gras / italique /
 * barré, code en ligne, liens, images, listes ordonnées / non ordonnées
 * imbriquées, cases à cocher, citations, blocs de code délimités (```),
 * tableaux façon GitHub, règles horizontales.
 *
 * Le HTML présent dans la source est échappé : le rendu est sûr même si le
 * Markdown provient d'un fichier tiers.
 *
 * API : window.mdRender(sourceMarkdown) -> { html, headings }
 *   headings : [{ level, text, id }] pour construire un sommaire.
 */
(function (global) {
  "use strict";

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // ---------------------------------------------------------------------------
  // Rendu en ligne (inline)
  // ---------------------------------------------------------------------------
  function renderInline(text) {
    var store = [];
    var stash = function (html) {
      store.push(html);
      return "\x00" + (store.length - 1) + "\x00";
    };

    // 1. Échappement HTML global.
    text = escapeHtml(text);

    // 2. Code en ligne : `` `code` `` ou `code`. Mis de côté pour ne pas être
    //    retouché par les règles suivantes.
    text = text.replace(/(`+)([\s\S]+?)\1/g, function (_, _ticks, code) {
      if (code.length > 2 && code.charAt(0) === " " && code.charAt(code.length - 1) === " ") {
        code = code.slice(1, -1);
      }
      return stash("<code>" + code + "</code>");
    });

    // 3. Images : ![alt](src "titre")
    text = text.replace(
      /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g,
      function (_, alt, src, title) {
        var t = title ? ' title="' + title + '"' : "";
        return stash(
          '<img src="' + src + '" alt="' + alt + '" loading="lazy"' + t + ">"
        );
      }
    );

    // 4. Liens : [texte](url "titre")
    text = text.replace(
      /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g,
      function (_, label, href, title) {
        var ext = /^https?:\/\//.test(href);
        var attrs =
          'href="' +
          href +
          '"' +
          (title ? ' title="' + title + '"' : "") +
          (ext ? ' target="_blank" rel="noopener noreferrer"' : "");
        return stash("<a " + attrs + ">" + label + "</a>");
      }
    );

    // 5. Gras, italique, barré.
    text = text.replace(/\*\*([^\s*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^\s_][\s\S]*?)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^\s*][\s\S]*?)\*/g, "$1<em>$2</em>");
    text = text.replace(/(^|[^_\w])_([^\s_][\s\S]*?)_(?=$|[^_\w])/g, "$1<em>$2</em>");
    text = text.replace(/~~([^\s~][\s\S]*?)~~/g, "<del>$1</del>");

    // 6. Liens automatiques sur URL nues.
    text = text.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)(?=$|[\s).,;!])/g,
      function (_, pre, url) {
        return (
          pre +
          stash(
            '<a href="' +
              url +
              '" target="_blank" rel="noopener noreferrer">' +
              url +
              "</a>"
          )
        );
      }
    );

    // 7. Retour à la ligne forcé (deux espaces en fin de ligne).
    text = text.replace(/ {2,}\n/g, "<br>\n");

    // 8. Restauration des fragments mis de côté. On boucle car un fragment
    //    peut en contenir un autre (ex. code en ligne dans le texte d'un lien).
    var prev;
    var guard = 0;
    do {
      prev = text;
      text = text.replace(/\x00(\d+)\x00/g, function (whole, i) {
        var frag = store[Number(i)];
        return frag == null ? whole : frag;
      });
      guard++;
    } while (text !== prev && guard < 8);

    return text;
  }

  // ---------------------------------------------------------------------------
  // Rendu par blocs
  // ---------------------------------------------------------------------------
  function renderBlocks(src, headings) {
    var lines = src.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
    var out = [];
    var i = 0;

    var isBlank = function (l) {
      return /^\s*$/.test(l);
    };
    var listRe = /^( *)([-*+]|\d+[.)])( +)(.*)$/;
    var headingRe = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
    var fenceRe = /^(\s*)(`{3,}|~{3,})\s*([^\n`]*)$/;
    var hrRe = /^ {0,3}([-*_])\s*(?:\1\s*){2,}$/;
    var quoteRe = /^ {0,3}>\s?(.*)$/;

    function isTableSep(l) {
      return (
        /\|/.test(l) &&
        /^[\s|:-]+$/.test(l) &&
        /-/.test(l)
      );
    }

    while (i < lines.length) {
      var line = lines[i];

      // Lignes vides.
      if (isBlank(line)) {
        i++;
        continue;
      }

      // Bloc de code délimité.
      var fence = line.match(fenceRe);
      if (fence) {
        var marker = fence[2][0];
        var lang = (fence[3] || "").trim().split(/\s+/)[0];
        var buf = [];
        i++;
        while (i < lines.length && !new RegExp("^\\s*" + marker + "{3,}\\s*$").test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++; // saute la clôture
        var raw = buf.join("\n");
        var code = global.hlHighlight
          ? global.hlHighlight(raw, lang)
          : escapeHtml(raw);
        var label = lang ? ' data-lang="' + escapeHtml(lang) + '"' : "";
        out.push(
          '<div class="code-block"' +
            label +
            "><pre><code>" +
            code +
            "</code></pre></div>"
        );
        continue;
      }

      // Titre.
      var h = line.match(headingRe);
      if (h) {
        var level = h[1].length;
        var inner = renderInline(h[2]);
        var plain = h[2].replace(/[*_`~]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
        var id = slugify(plain) || "section-" + headings.length;
        var used = headings.filter(function (x) {
          return x.id === id || x.id.indexOf(id + "-") === 0;
        });
        if (used.length) id = id + "-" + (used.length + 1);
        headings.push({ level: level, text: plain, id: id });
        out.push(
          "<h" +
            level +
            ' id="' +
            id +
            '">' +
            inner +
            ' <a class="anchor" href="#' +
            id +
            '" aria-label="Lien vers cette section">#</a></h' +
            level +
            ">"
        );
        i++;
        continue;
      }

      // Règle horizontale.
      if (hrRe.test(line)) {
        out.push("<hr>");
        i++;
        continue;
      }

      // Citation.
      if (quoteRe.test(line)) {
        var qbuf = [];
        while (i < lines.length && (quoteRe.test(lines[i]) || (!isBlank(lines[i]) && qbuf.length))) {
          if (isBlank(lines[i])) break;
          qbuf.push(lines[i].replace(quoteRe, "$1"));
          i++;
        }
        var qcontent = renderBlocks(qbuf.join("\n"), headings);
        var callout = qcontent.match(/^\s*<p>\s*(?:\[!|:(?:info|note|warning|tip|danger):)/i);
        var cls = "";
        var m2 = qcontent.match(/<p>\s*(?:\[!(\w+)\]|:(\w+):)\s*/i);
        if (m2) {
          var kind = (m2[1] || m2[2]).toLowerCase();
          var map = {
            note: "note",
            info: "info",
            tip: "tip",
            astuce: "tip",
            warning: "warning",
            attention: "warning",
            danger: "danger",
            important: "warning",
          };
          cls = ' class="callout callout-' + (map[kind] || "note") + '"';
          qcontent = qcontent.replace(/<p>\s*(?:\[!\w+\]|:\w+:)\s*/i, "<p>");
        }
        out.push("<blockquote" + cls + ">" + qcontent + "</blockquote>");
        continue;
      }

      // Tableau.
      if (/\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = splitRow(line);
        var aligns = splitRow(lines[i + 1]).map(function (c) {
          var l = /^:/.test(c);
          var r = /:$/.test(c);
          return r && l ? "center" : r ? "right" : l ? "left" : "";
        });
        i += 2;
        var rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && !isBlank(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        var thead =
          "<thead><tr>" +
          header
            .map(function (c, idx) {
              return cell("th", c, aligns[idx]);
            })
            .join("") +
          "</tr></thead>";
        var tbody =
          "<tbody>" +
          rows
            .map(function (r) {
              return (
                "<tr>" +
                header
                  .map(function (_, idx) {
                    return cell("td", r[idx] || "", aligns[idx]);
                  })
                  .join("") +
                "</tr>"
              );
            })
            .join("") +
          "</tbody>";
        out.push('<div class="table-wrap"><table>' + thead + tbody + "</table></div>");
        continue;
      }

      // Listes.
      if (listRe.test(line)) {
        var parsed = parseList(lines, i, headings);
        out.push(parsed.html);
        i = parsed.next;
        continue;
      }

      // Paragraphe.
      var pbuf = [];
      while (
        i < lines.length &&
        !isBlank(lines[i]) &&
        !headingRe.test(lines[i]) &&
        !fenceRe.test(lines[i]) &&
        !hrRe.test(lines[i]) &&
        !quoteRe.test(lines[i]) &&
        !listRe.test(lines[i]) &&
        !(/\|/.test(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
      ) {
        pbuf.push(lines[i]);
        i++;
      }
      if (pbuf.length) {
        out.push("<p>" + renderInline(pbuf.join("\n")) + "</p>");
      }
    }

    return out.join("\n");
  }

  function splitRow(row) {
    var trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
    var cells = [];
    var cur = "";
    for (var k = 0; k < trimmed.length; k++) {
      var ch = trimmed[k];
      if (ch === "\\" && trimmed[k + 1] === "|") {
        cur += "|";
        k++;
      } else if (ch === "|") {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  function cell(tag, content, align) {
    var style = align ? ' style="text-align:' + align + '"' : "";
    return "<" + tag + style + ">" + renderInline(content) + "</" + tag + ">";
  }

  // Analyse une liste (et ses sous-listes) à partir de lines[start].
  function parseList(lines, start, headings) {
    var first = lines[start].match(/^( *)([-*+]|\d+[.)])( +)/);
    var baseIndent = first[1].length;
    var ordered = /\d/.test(first[2]);
    var items = [];
    var i = start;
    var loose = false;
    var pendingBlank = false;

    while (i < lines.length) {
      var line = lines[i];
      var m = line.match(/^( *)([-*+]|\d+[.)])( +)(.*)$/);

      if (m && m[1].length <= baseIndent + 1) {
        // Un changement de type de marqueur (numéroté <-> à puces) au même
        // niveau démarre une nouvelle liste : on rend la main.
        if (/^\d/.test(m[2]) !== ordered) break;
        if (pendingBlank && items.length) loose = true;
        pendingBlank = false;
        var contentIndent = m[1].length + m[2].length + m[3].length;
        var buf = [m[4]];
        i++;
        while (i < lines.length) {
          if (/^\s*$/.test(lines[i])) {
            // Peut être une ligne vide interne à l'item : on regarde la suite.
            var j = i + 1;
            if (
              j < lines.length &&
              /^\s+\S/.test(lines[j]) &&
              lines[j].search(/\S/) >= contentIndent
            ) {
              buf.push("");
              i++;
              continue;
            }
            if (
              j < lines.length &&
              /^( *)([-*+]|\d+[.)])( +)/.test(lines[j]) &&
              lines[j].match(/^( *)/)[1].length <= baseIndent + 1
            ) {
              pendingBlank = true;
              i++;
              break;
            }
            break;
          }
          var nextItem = lines[i].match(/^( *)([-*+]|\d+[.)])( +)/);
          if (nextItem && nextItem[1].length <= baseIndent + 1) break;
          // Ligne de continuation : on retire l'indentation de contenu.
          buf.push(lines[i].replace(new RegExp("^ {0," + contentIndent + "}"), ""));
          i++;
        }
        items.push(buf.join("\n"));
      } else if (/^\s*$/.test(line)) {
        pendingBlank = true;
        i++;
      } else {
        break;
      }
    }

    var html = items
      .map(function (raw) {
        var task = raw.match(/^\[([ xX])\]\s+([\s\S]*)$/);
        var checkbox = "";
        if (task) {
          checkbox =
            '<input type="checkbox" disabled' +
            (task[1].toLowerCase() === "x" ? " checked" : "") +
            "> ";
          raw = task[2];
        }
        var inner = renderBlocks(raw, headings);
        if (!loose) {
          inner = inner.replace(/^<p>([\s\S]*?)<\/p>$/, "$1");
          // Si l'item contient encore un sous-bloc + du texte, on garde le <p>.
          if (/<\/(p|ul|ol|pre|blockquote|div)>/.test(inner) && !/^[\s\S]*<\/p>\s*<(ul|ol)/.test(raw)) {
            // rien
          }
        }
        return "<li" + (task ? ' class="task"' : "") + ">" + checkbox + inner + "</li>";
      })
      .join("\n");

    var tag = ordered ? "ol" : "ul";
    var startAttr = "";
    if (ordered) {
      var n = first[2].match(/^\d+/)[0];
      if (n !== "1") startAttr = ' start="' + n + '"';
    }
    return {
      html: "<" + tag + startAttr + (loose ? ' class="loose"' : "") + ">" + html + "</" + tag + ">",
      next: i,
    };
  }

  // ---------------------------------------------------------------------------
  function mdRender(src) {
    var headings = [];
    var html = renderBlocks(String(src == null ? "" : src), headings);
    return { html: html, headings: headings };
  }

  global.mdRender = mdRender;
  global.mdSlugify = slugify;
})(typeof window !== "undefined" ? window : globalThis);
