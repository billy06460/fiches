/* PREJ Missions — Décision de fouille individuelle */
(function () {
  'use strict';
  var P = window.P;
  P.views = P.views || {};

  var REG1_HEAD = 'L. 225-1.';
  var REG1 = " Lorsque les mesures de fouilles des personnes détenues, intégrales ou par palpation, sont réalisées à l'occasion de leur extraction ou de leur transfèrement par l'administration pénitentiaire, elles sont mises en œuvre sur décision du chef d'escorte. Leur nature et leur fréquence sont décidées au vu de la personnalité des personnes détenues intéressées et des circonstances dans lesquelles se déroule l'extraction ou le transfèrement.";
  var REG2_HEAD = 'Art. R. 225-2.';
  var REG2 = " – Les personnes détenues sont fouillées chaque fois qu'il existe des éléments permettant de suspecter un risque d'évasion, l'entrée, la sortie ou la circulation en détention d'objets ou substances prohibés ou dangereux pour la sécurité des personnes ou le bon ordre de l'établissement pénitentiaire.";

  // ---------------------------------------------------------------- écran
  P.views.fouille = function (m, fid, main) {
    if (!m.fouilles.length) { m.fouilles.push(P.blankFouille(m)); P.saveMissions(); }
    var f = m.fouilles.find(function (x) { return x.id === fid; }) || m.fouilles[0];
    var idx = m.fouilles.indexOf(f);

    var chips = m.fouilles.map(function (x, i) {
      return '<button class="state-pill' + (x === f ? ' on' : '') + '" data-lvl="' + (P.fouilleMissing(x).length ? 'minor' : 'ok') + '" data-go="' + x.id + '">' +
        (i + 1) + ' · ' + P.esc(x.detenu || 'Sans nom') + '</button>';
    }).join('') + '<button class="state-pill" data-add="1">+ Ajouter</button>';

    var motifs = P.MOTIFS.map(function (x) {
      var on = f.motifs && f.motifs[x[0]];
      return '<label class="check-item' + (on ? ' on' : '') + '"><input type="checkbox" data-motif="' + x[0] + '"' + (on ? ' checked' : '') + '><span>' + P.esc(x[1]) + '</span></label>' +
        (x[0] === 'autre' ? '<div class="field" id="autreWrap" style="margin:0 0 0 30px;' + (on ? '' : 'display:none') + '"><input type="text" id="f-autre" value="' + P.esc(f.autreTxt) + '" placeholder="Précisez le motif"></div>' : '');
    }).join('');

    main.innerHTML =
      '<div class="state-row" style="margin-bottom:10px">' + chips + '</div>' +
      '<div class="panel">' +
        '<div class="section"><div class="section-title"><span class="section-num">AUTO</span><h3>Rempli depuis la mission</h3></div>' +
          '<dl class="crew">' +
            '<dt>Numéro OM</dt><dd>' + P.esc(m.numero || '—') + '</dd>' +
            '<dt>Décisionnaire</dt><dd>' + P.esc(m.chef || '—') + "</dd>" +
            '<dt>Date</dt><dd>' + P.esc(P.frDate(m.date)) + '</dd>' +
            '<dt>Type de fouille</dt><dd>' + (f.integrale ? 'Intégrale' : '—') + '</dd>' +
            '<dt>Signature</dt><dd>' + (m.signature ? 'Enregistrée' : '<span class="err">À faire sur la page de la mission</span>') + '</dd>' +
          '</dl></div>' +
        '<div class="section"><div class="section-title"><span class="section-num">01</span><h3>Personne détenue</h3></div>' +
          '<div class="field"><label for="f-detenu">Personne détenue</label><input type="text" id="f-detenu" value="' + P.esc(f.detenu) + '" autocapitalize="characters" placeholder="NOM Prénom, n° d\'écrou"></div>' +
          '<div class="field"><label for="f-etab">Établissement</label><input type="text" id="f-etab" value="' + P.esc(f.etablissement) + '"></div>' +
          '<div class="field"><label for="f-dest">À destination de</label><input type="text" id="f-dest" value="' + P.esc(f.destination) + '" placeholder="Tribunal, hôpital…"></div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">02</span><h3>Lors de</h3></div>' +
          '<div class="seg"><button type="button" data-lors="extraction"' + (f.lors === 'extraction' ? ' class="on"' : '') + '>Départ en extraction judiciaire</button>' +
          '<button type="button" data-lors="transfert"' + (f.lors === 'transfert' ? ' class="on"' : '') + '>Départ en transfert</button></div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">03</span><h3>Considérant que la personne détenue</h3></div>' +
          '<div class="checks">' + motifs + '</div></div>' +
        '<div class="section"><div class="section-title"><span class="section-num">04</span><h3>Type de fouille</h3></div>' +
          '<label class="check-item' + (f.integrale ? ' on' : '') + '"><input type="checkbox" id="f-integrale"' + (f.integrale ? ' checked' : '') + '><span>Intégrale</span></label></div>' +
        '<div class="section"><div class="section-title"><span class="section-num">05</span><h3>Observations</h3></div>' +
          '<div class="field"><textarea id="f-obs" maxlength="420" aria-label="Observations">' + P.esc(f.obs) + '</textarea></div></div>' +
      '</div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<button class="btn" id="f-preview">Aperçu</button>' +
        '<button class="btn" id="f-share">Partager le PDF</button>' +
      '</div>' +
      (m.fouilles.length > 1 ? '<button class="btn btn-ghost btn-block" id="f-del" style="color:var(--danger);margin-top:8px">Supprimer cette décision (' + (idx + 1) + ')</button>' : '');

    function save() {
      f.detenu = P.$('#f-detenu').value.trim();
      f.etablissement = P.$('#f-etab').value.trim();
      f.destination = P.$('#f-dest').value.trim();
      f.autreTxt = P.$('#f-autre').value.trim();
      f.obs = P.$('#f-obs').value.trim();
      f.integrale = P.$('#f-integrale').checked;
      f.motifs = {};
      P.$$('[data-motif]').forEach(function (c) { if (c.checked) f.motifs[c.getAttribute('data-motif')] = true; });
      P.touch(m);
    }
    main.addEventListener('input', save);
    main.addEventListener('change', function (e) {
      var t = e.target;
      if (t.type === 'checkbox') t.closest('.check-item').classList.toggle('on', t.checked);
      if (t.getAttribute('data-motif') === 'autre') P.$('#autreWrap').style.display = t.checked ? '' : 'none';
      save();
    });
    P.$$('[data-lors]').forEach(function (b) {
      b.onclick = function () {
        f.lors = f.lors === b.getAttribute('data-lors') ? '' : b.getAttribute('data-lors');
        P.$$('[data-lors]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-lors') === f.lors); });
        P.touch(m);
      };
    });
    P.$$('[data-go]').forEach(function (b) { b.onclick = function () { P.go('#/m/' + m.id + '/fouille/' + b.getAttribute('data-go'), true); }; });
    P.$('[data-add]').onclick = function () {
      save();
      var nf = P.blankFouille(m);
      nf.destination = f.destination; nf.etablissement = f.etablissement; nf.lors = f.lors;
      m.fouilles.push(nf); P.saveMissions();
      P.go('#/m/' + m.id + '/fouille/' + nf.id, true);
    };
    var del = P.$('#f-del');
    if (del) del.onclick = function () {
      P.confirm('Supprimer cette décision ?', '<p>La décision de fouille de ' + P.esc(f.detenu || 'cette personne') + ' sera supprimée.</p>', 'Supprimer').then(function (ok) {
        if (!ok) return;
        m.fouilles.splice(m.fouilles.indexOf(f), 1); P.saveMissions();
        P.go('#/m/' + m.id + '/fouille/' + m.fouilles[0].id, true);
      });
    };
    P.$('#f-preview').onclick = function () {
      save();
      P.fouillePreview(m, f).then(function (url) {
        P.modal('<h3>Aperçu</h3><img class="preview-img" src="' + url + '" alt="Aperçu de la décision de fouille"><div class="actions"><button class="btn btn-primary" onclick="P.closeModals()">Fermer</button></div>', { focus: false });
      });
    };
    P.$('#f-share').onclick = function () {
      save();
      P.buildFouillePdf(m).then(function (doc) { P.shareFile(doc.blob, doc.name, 'Décision de fouille'); })
        .catch(function (e) { P.toast(String(e.message || e), 4000); });
    };
  };

  // ---------------------------------------------------------------- tracé du document (PDF ou image)
  var INK = '#1a1a1a';
  function pdfBackend(doc) {
    doc.setTextColor(26, 26, 26); doc.setDrawColor(26, 26, 26);
    return {
      font: function (pt, st) { doc.setFont('helvetica', st || 'normal'); doc.setFontSize(pt); },
      text: function (t, x, y) { if (t) doc.text(t, x, y); },
      measure: function (t) { return doc.getTextWidth(t); },
      line: function (x1, y1, x2, y2, dashed, w) { doc.setLineWidth(w || 0.25); if (dashed) doc.setLineDashPattern([0.4, 0.9], 0); doc.line(x1, y1, x2, y2); if (dashed) doc.setLineDashPattern([], 0); },
      rect: function (x, y, w, h) { doc.setLineWidth(0.3); doc.rect(x, y, w, h); },
      image: function (sig, x, y, w, h) { doc.addImage(sig.src, 'PNG', x, y, w, h); }
    };
  }
  function canvasBackend(s) {
    var c = document.createElement('canvas'); c.width = Math.round(210 * s); c.height = Math.round(297 * s);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.textBaseline = 'alphabetic';
    return {
      canvas: c,
      font: function (pt, st) { var p = st === 'bold' ? 'bold ' : st === 'italic' ? 'italic ' : ''; ctx.font = p + (pt * 0.3528 * s) + 'px Helvetica, Arial, sans-serif'; },
      text: function (t, x, y) { if (t) ctx.fillText(t, x * s, y * s); },
      measure: function (t) { return ctx.measureText(t).width / s; },
      line: function (x1, y1, x2, y2, dashed, w) { ctx.save(); ctx.lineWidth = (w || 0.25) * s; ctx.setLineDash(dashed ? [0.4 * s, 0.9 * s] : []); ctx.beginPath(); ctx.moveTo(x1 * s, y1 * s); ctx.lineTo(x2 * s, y2 * s); ctx.stroke(); ctx.restore(); },
      rect: function (x, y, w, h) { ctx.save(); ctx.lineWidth = 0.3 * s; ctx.strokeRect(x * s, y * s, w * s, h * s); ctx.restore(); },
      image: function (sig, x, y, w, h) { ctx.drawImage(sig.el, x * s, y * s, w * s, h * s); }
    };
  }
  function wrap(b, str, maxW) {
    var out = [];
    String(str || '').split(/\n/).forEach(function (par) {
      var words = par.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        while (b.measure(w) > maxW && w.length > 1) {
          var i = w.length; while (i > 1 && b.measure(w.slice(0, i)) > maxW) i--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        var t = line ? line + ' ' + w : w;
        if (b.measure(t) <= maxW) line = t; else { out.push(line); line = w; }
      });
      if (line) out.push(line);
    });
    return out;
  }
  function drawDoc(b, d) {
    var M = 18, R = 192, W = R - M;
    function box(x, y, on) { b.rect(x, y - 3.2, 3.5, 3.5); if (on) { b.line(x + 0.6, y - 2.6, x + 2.9, y - 0.3, false, 0.45); b.line(x + 2.9, y - 2.6, x + 0.6, y - 0.3, false, 0.45); } }
    function label(t, x, y) { b.font(10.5, 'bold'); b.text(t, x, y); var w = b.measure(t); b.line(x, y + 0.8, x + w, y + 0.8, false, 0.25); return w; }
    function field(t, x, y, val, maxX) {
      var lw = label(t, x, y); b.font(10.5, 'normal');
      var lines = wrap(b, val, maxX - (x + lw + 2.5));
      lines.forEach(function (l, i) { b.text(l, x + lw + 2.5, y + i * 4.8); });
      return Math.max(1, lines.length);
    }
    b.font(8.5, 'bold'); b.text('MINISTÈRE', M, 16); b.text('DE LA JUSTICE', M, 19.8);
    b.font(5.5, 'italic'); b.text('Liberté', M, 23.2); b.text('Égalité', M, 25.6); b.text('Fraternité', M, 28);
    b.font(15, 'normal'); var t = 'DECISION DE FOUILLE INDIVIDUELLE'; b.text(t, 105 - b.measure(t) / 2, 36);
    b.font(13, 'normal'); t = 'PREJ MARSEILLE'; b.text(t, 105 - b.measure(t) / 2, 43);

    var y = 55;
    y += field('Décisionnaire :', M, y, (d.dec ? d.dec + ' ' : '………………………… ') + "en sa qualité de che(ffe) d'escorte.", R) * 4.8 + 3.5;
    var n1 = field('Numéro OM :', M, y, d.om, 104);
    var n2 = field('A destination de :', 108, y, d.dest, R);
    y += Math.max(n1, n2) * 4.8 + 3.5;
    y += field('Etablissement :', M, y, d.etab, R) * 4.8 + 3.5;
    y += field('Personne détenue :', M, y, d.detenu, R) * 4.8 + 3.5;
    label('Motivation de la décision :', M, y); y += 7;
    b.font(10.5, 'normal'); b.text('Lors de :', M, y); y += 7;
    box(M, y, d.lors === 'extraction'); b.text('Départ en extraction judiciaire', M + 6, y);
    box(108, y, d.lors === 'transfert'); b.text('Départ en transfert', 114, y); y += 8.5;
    b.text('Considérant le fait que la personne détenue :', M, y); y += 7;
    P.MOTIFS.forEach(function (x) {
      var s = x[0] === 'autre' ? (d.motifs.autre && d.autreTxt ? 'Autre (précisez) : ' + d.autreTxt : 'Autre (précisez)') : x[1];
      box(M + 4, y, d.motifs[x[0]]);
      var lines = wrap(b, s, W - 10); lines.forEach(function (l, i) { b.text(l, M + 10, y + i * 4.8); });
      y += lines.length * 4.8 + 2;
    });
    y += 2.5;
    b.text('Type de fouille :', M, y); y += 7;
    box(M + 4, y, d.integrale); b.text('Intégrale', M + 10, y); y += 9;
    b.text('Observations :', M, y); y += 6.5;
    var obs = wrap(b, d.obs, W).slice(0, 7), nObs = Math.max(3, obs.length);
    for (var i = 0; i < nObs; i++) { if (obs[i]) b.text(obs[i], M + 1, y); b.line(M, y + 1.3, R, y + 1.3, true, 0.25); y += 6; }
    y += 3;
    label('Réglementation :', M, y); y += 6;
    function para(head, body) {
      b.font(8, 'normal');
      var lines = wrap(b, head + body, W);
      lines.forEach(function (l, i) { b.text(l, M, y + i * 3.5); });
      b.line(M, y + 0.6, M + b.measure(head), y + 0.6, false, 0.2);
      y += lines.length * 3.5 + 3.5;
    }
    para(REG1_HEAD, REG1); para(REG2_HEAD, REG2);

    y = Math.max(y + 4, 228);
    b.font(10.5, 'normal'); b.text('Le ' + d.dateStr, M, y + 6);
    var X = 112;
    b.text("Le ou la Che(ffe) d'escorte", X, y);
    b.font(10.5, 'bold'); b.text(d.signName, X, y + 5);
    b.font(9.5, 'italic'); var q = wrap(b, d.qual, R - X); q.slice(0, 2).forEach(function (l, k) { b.text(l, X, y + 9.5 + k * 4.2); });
    if (d.sig) {
      var top = y + 9.5 + Math.min(2, q.length) * 4.2 - 1, maxW = 60, maxH = Math.min(24, 290 - top);
      var r = Math.min(maxW / d.sig.w, maxH / d.sig.h); b.image(d.sig, X, top, d.sig.w * r, d.sig.h * r);
    }
  }

  P.loadImage = function (src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var im = new Image();
      im.onload = function () { resolve({ src: src, el: im, w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  };
  function data(m, f, sig) {
    return {
      dec: m.chef, om: m.numero, dest: f.destination, etab: f.etablissement, detenu: f.detenu,
      lors: f.lors, motifs: f.motifs || {}, autreTxt: f.autreTxt, integrale: f.integrale, obs: f.obs,
      dateStr: P.frDate(m.date), signName: m.chef, qual: m.chefQualite || '', sig: sig
    };
  }
  P.fouillePreview = function (m, f) {
    return P.loadImage(m.signature).then(function (sig) {
      var b = canvasBackend(4); drawDoc(b, data(m, f, sig)); return b.canvas.toDataURL('image/jpeg', 0.85);
    });
  };
  // Un seul PDF : une page par personne détenue
  P.buildFouillePdf = function (m) {
    if (!window.jspdf) return Promise.reject(new Error("Le module PDF n'est pas chargé."));
    return P.loadImage(m.signature).then(function (sig) {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      m.fouilles.forEach(function (f, i) {
        if (i > 0) doc.addPage();
        drawDoc(pdfBackend(doc), data(m, f, sig));
      });
      return { blob: doc.output('blob'), name: 'Decision_fouille_OM-' + P.safeName(m.numero) + '_' + m.date + '.pdf' };
    });
  };
})();
