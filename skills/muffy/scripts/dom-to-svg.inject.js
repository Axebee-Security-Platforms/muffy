/* Injected by diagram-export.mjs into a temporary copy of a muffy diagram page (never into the page itself).
   After the page has rendered its finished frame, it redraws what the browser laid out as plain SVG shapes and text, and writes the
   result into a pre element with id muffy-svg so the exporter can read it from the dumped DOM. Shadows, the grid paper and rounded clipping of
   child corners are left out; positions, colours, borders, wires and text lines are kept. Text stays text (font: the viewer's system-ui). */
(function () {
  var SVG_STYLE = ['fill', 'stroke', 'strokeWidth', 'strokeDasharray', 'strokeDashoffset', 'strokeLinecap', 'opacity', 'fontFamily', 'fontSize', 'fontWeight', 'textAnchor', 'dominantBaseline', 'letterSpacing', 'textTransform', 'display'];
  var kebab = function (p) { return p.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); };
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var clear = function (c) { return !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c); };

  function inlineStyles(orig, clone) {
    var s = getComputedStyle(orig), css = SVG_STYLE.map(function (p) { return kebab(p) + ':' + s[p]; }).join(';');
    clone.setAttribute('style', css);
    for (var i = 0; i < orig.children.length && i < clone.children.length; i++) inlineStyles(orig.children[i], clone.children[i]);
  }

  function run() {
    var de = document.documentElement, W = Math.ceil(de.scrollWidth), H = Math.ceil(de.scrollHeight), out = [], defs = [], clips = 0;
    // a caption that is still fixed to the window is pinned to the bottom of the page instead
    var cap = document.querySelector('.cap'); if (cap && getComputedStyle(cap).position === 'fixed') { var ch = cap.offsetHeight; cap.style.position = 'absolute'; cap.style.bottom = 'auto'; cap.style.top = (H - ch - 20) + 'px'; }
    out.push('<rect width="' + W + '" height="' + H + '" fill="' + getComputedStyle(document.body).backgroundColor + '"/>');

    function edge(x1, y1, x2, y2, c, w) { out.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + w + '"/>'); }

    function drawBox(e, s, r) {
      var rx = Math.min(num(s.borderTopLeftRadius), r.width / 2, r.height / 2), fill = clear(s.backgroundColor) ? 'none' : s.backgroundColor;
      var sides = ['Top', 'Right', 'Bottom', 'Left'].map(function (d) { return { d: d, w: num(s['border' + d + 'Width']), st: s['border' + d + 'Style'], c: s['border' + d + 'Color'] }; }).filter(function (b) { return b.w > 0 && b.st !== 'none'; });
      var all = sides.length === 4 && sides.every(function (b) { return b.w === sides[0].w && b.c === sides[0].c; });
      if (fill !== 'none' || all) {
        var dash = all && sides[0].st === 'dashed' ? ' stroke-dasharray="6 4"' : '';
        out.push('<rect x="' + (r.left + (all ? sides[0].w / 2 : 0)) + '" y="' + (r.top + (all ? sides[0].w / 2 : 0)) + '" width="' + (r.width - (all ? sides[0].w : 0)) + '" height="' + (r.height - (all ? sides[0].w : 0)) + '" rx="' + rx + '" fill="' + fill + '"' + (all ? ' stroke="' + sides[0].c + '" stroke-width="' + sides[0].w + '"' + dash : '') + '/>');
      }
      if (!all) sides.forEach(function (b) {
        if (b.d === 'Top') edge(r.left, r.top + b.w / 2, r.right, r.top + b.w / 2, b.c, b.w);
        if (b.d === 'Bottom') edge(r.left, r.bottom - b.w / 2, r.right, r.bottom - b.w / 2, b.c, b.w);
        if (b.d === 'Left') edge(r.left + b.w / 2, r.top, r.left + b.w / 2, r.bottom, b.c, b.w);
        if (b.d === 'Right') edge(r.right - b.w / 2, r.top, r.right - b.w / 2, r.bottom, b.c, b.w);
      });
      // a coloured bar drawn with ::before (the card's type bar), clipped to the card's rounded corners
      var b4 = getComputedStyle(e, '::before');
      if (b4 && b4.content !== 'none' && b4.content !== 'normal' && !clear(b4.backgroundColor) && b4.position === 'absolute' && num(b4.width) > 0) {
        var id = 'muffy-clip-' + clips++;
        defs.push('<clipPath id="' + id + '"><rect x="' + r.left + '" y="' + r.top + '" width="' + r.width + '" height="' + r.height + '" rx="' + rx + '"/></clipPath>');
        out.push('<rect x="' + r.left + '" y="' + r.top + '" width="' + num(b4.width) + '" height="' + r.height + '" fill="' + b4.backgroundColor + '" clip-path="url(#' + id + ')"/>');
      }
    }

    function textLines(node, s) {
      var txt = node.nodeValue, re = /\S+/g, m, lines = [], range = document.createRange();
      if (s.textTransform === 'uppercase') txt = txt.toUpperCase(); else if (s.textTransform === 'lowercase') txt = txt.toLowerCase();
      var raw = node.nodeValue;
      while ((m = re.exec(raw))) {
        range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
        var rr = range.getClientRects()[0]; if (!rr || !rr.width) continue;
        var word = txt.substr(m.index, m[0].length), L = lines[lines.length - 1];
        if (L && Math.abs(L.top - rr.top) < rr.height / 2) L.text += ' ' + word; else lines.push({ text: word, left: rr.left, top: rr.top, h: rr.height });
      }
      lines.forEach(function (L) {
        out.push('<text x="' + L.left + '" y="' + (L.top + L.h / 2) + '" dominant-baseline="central" fill="' + s.color + '" font-family="' + esc(s.fontFamily.replace(/"/g, "'")) + '" font-size="' + s.fontSize + '" font-weight="' + s.fontWeight + '"' + (s.letterSpacing !== 'normal' ? ' letter-spacing="' + s.letterSpacing + '"' : '') + '>' + esc(L.text) + '</text>');
      });
    }

    function pseudoText(e, s, r) {
      var p = getComputedStyle(e, '::before'), c = p && p.content;
      if (!c || c === 'none' || c === 'normal' || c === '""' || !/^"/.test(c) || p.position === 'absolute') return;
      out.push('<text x="' + (r.left + num(s.paddingLeft)) + '" y="' + (r.top + num(s.paddingTop) + num(p.lineHeight) / 2 || r.top + r.height / 2) + '" dominant-baseline="central" fill="' + p.color + '" font-family="' + esc(p.fontFamily.replace(/"/g, "'")) + '" font-size="' + p.fontSize + '" font-weight="' + p.fontWeight + '">' + esc(c.slice(1, -1)) + '</text>');
    }

    function walk(e) {
      var tag = e.tagName.toLowerCase();
      if (/^(script|style|head|meta|title|link)$/.test(tag) || e.id === 'muffy-svg' || e.classList.contains('sr')) return;
      var s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return;
      var r = e.getBoundingClientRect();
      if (tag === 'svg') {
        if (r.width < 1 && r.height < 1) return;
        var clone = e.cloneNode(true); inlineStyles(e, clone);
        clone.setAttribute('x', r.left); clone.setAttribute('y', r.top); clone.setAttribute('width', r.width); clone.setAttribute('height', r.height); clone.setAttribute('overflow', 'visible');
        clone.removeAttribute('class'); clone.removeAttribute('aria-hidden');
        out.push(new XMLSerializer().serializeToString(clone)); return;
      }
      if (r.width > 0 && r.height > 0 && tag !== 'html' && tag !== 'body') { drawBox(e, s, r); pseudoText(e, s, r); }
      for (var n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && /\S/.test(n.nodeValue)) textLines(n, s); else if (n.nodeType === 1) walk(n);
      }
    }

    walk(document.body);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(document.title) + '"><title>' + esc(document.title) + '</title>' + (defs.length ? '<defs>' + defs.join('') + '</defs>' : '') + out.join('') + '</svg>';
    var pre = document.createElement('pre'); pre.id = 'muffy-svg'; pre.textContent = svg; document.body.appendChild(pre);
  }

  window.addEventListener('load', function () { setTimeout(run, 100); });
})();
