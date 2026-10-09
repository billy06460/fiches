/* PREJ Missions — Carnet de bord (fiche véhicule), repris de l'application d'origine */
(function () {
  'use strict';
  var P = window.P;
  P.views = P.views || {};

  var EQ = [['fuelCard', 'Carte carburant'], ['telepeage', 'Télépéage'], ['bouclier', 'Bouclier'], ['pareBalle', 'Pare-balle'], ['sac', 'Sac'], ['ceinture', 'Ceinture'], ['entrave', 'Entrave']];
  var STATES = { ok: 'Bon état', minor: 'Usure mineure', damage: 'Dégâts constatés' };

  function fmtKm(v) { return (v === '' || v === null || v === undefined || isNaN(v)) ? '—' : Math.round(Number(v)) + ' km'; }
  function fmtKmNumber(v) { return (v === '' || v === null || v === undefined || isNaN(v)) ? '—' : String(Math.round(Number(v))); }
  function fuelSummary(c) {
    if (!c.fuelDone) return 'Non';
    var extras = (c.extraFuels || []).filter(function (v) { return v !== '' && v !== null && v !== undefined && !isNaN(v); });
    var t = 'Oui, au ' + fmtKm(c.fuelKm);
    if (extras.length) t += ' + plein(s) suppl. au ' + extras.map(fmtKm).join(', ');
    return t;
  }
  function num(v) { return v === '' ? '' : Number(v); }

  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var maxDim = 1100, w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; } else { w = Math.round(w * (maxDim / h)); h = maxDim; } }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(c.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  // ---------------------------------------------------------------- écran
  P.views.carnet = function (m, _id, main) {
    var c = m.carnet;
    if (!c.destination) {
      var guess = (m.fouilles[0] && m.fouilles[0].destination) || (m.retour && m.retour.juridiction) || '';
      if (guess) c.destination = guess;
    }
    function renderExtra() {
      return (c.extraFuels || []).map(function (km, i) {
        return '<div class="row-input" style="margin-top:8px"><input type="number" inputmode="numeric" class="c-extra" data-i="' + i + '" value="' + P.esc(km) + '" placeholder="Kilométrage du plein suppl."><button type="button" class="rm-btn" data-rmfuel="' + i + '" aria-label="Retirer ce plein">✕</button></div>';
      }).join('');
    }
    function renderPhotos() {
      return (c.photos || []).map(function (p) {
        return '<div class="photo-thumb"><img src="' + p.dataUrl + '" alt="Photo" data-zoom="' + p.id + '"><button type="button" class="rm" data-rmphoto="' + p.id + '" aria-label="Supprimer la photo">✕</button></div>';
      }).join('');
    }
    function delta() {
      if (c.kmStart === '' || c.kmEnd === '' || isNaN(c.kmStart) || isNaN(c.kmEnd)) return '';
      return 'Distance parcourue : <strong>' + fmtKmNumber(Number(c.kmEnd) - Number(c.kmStart)) + ' km</strong>';
    }
    var eq = c.equipment || {};
    main.innerHTML =
      '<div class="carnet-wrap"><div class="panel">' +
        '<div class="section"><div class="section-title"><span class="section-num">01</span><h3>Véhicule &amp; chauffeur</h3></div>' +
          '<div class="grid2">' +
            '<div class="field"><label for="c-plate">Immatriculation</label><input type="text" id="c-plate" class="plate-input" value="' + P.esc(c.plate) + '" placeholder="AA-123-BB" autocapitalize="characters"></div>' +
            '<div class="field auto"><label>Numéro de mission</label><input type="text" value="' + P.esc(m.numero) + '" readonly></div>' +
            '<div class="field auto"><label>Date</label><input type="text" value="' + P.esc(P.frDate(m.date)) + '" readonly></div>' +
            '<div class="field"><label for="c-dest">Destination</label><input type="text" id="c-dest" value="' + P.esc(c.destination) + '" placeholder="Ville, lieu…"></div>' +
          '</div>' +
          '<div class="field auto"><label>Nom du chauffeur</label><input type="text" value="' + P.esc(m.chauffeur) + '" readonly></div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">02</span><h3>Kilométrage</h3></div>' +
          '<div class="grid2">' +
            '<div class="field"><label for="c-kmstart">Départ mission</label><input type="number" inputmode="numeric" id="c-kmstart" value="' + P.esc(c.kmStart) + '" placeholder="0"></div>' +
            '<div class="field"><label for="c-kmend">Fin de mission</label><input type="number" inputmode="numeric" id="c-kmend" value="' + P.esc(c.kmEnd) + '" placeholder="0"></div>' +
          '</div><div class="km-delta" id="c-delta"' + (delta() ? '' : ' hidden') + '>' + delta() + '</div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">03</span><h3>Carburant</h3></div>' +
          '<div class="toggle-row"><span>Plein effectué</span><label class="switch"><input type="checkbox" id="c-fuel"' + (c.fuelDone ? ' checked' : '') + '><span class="track"></span><span class="thumb"></span></label></div>' +
          '<p class="reminder">Rappel : faire une photo du ticket de caisse</p>' +
          '<div class="field" id="c-fuelwrap"' + (c.fuelDone ? '' : ' hidden') + '><label for="c-fuelkm">Kilométrage au moment du plein</label>' +
            '<input type="number" inputmode="numeric" id="c-fuelkm" value="' + P.esc(c.fuelKm) + '" placeholder="0">' +
            '<div id="c-extras">' + renderExtra() + '</div>' +
            '<button type="button" class="link" id="c-addfuel">+ Ajouter un plein</button></div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">04</span><h3>Équipement présent</h3></div>' +
          '<div class="check-grid">' + EQ.map(function (x) {
            return '<label class="check-item' + (eq[x[0]] ? ' on' : '') + '"><input type="checkbox" data-eq="' + x[0] + '"' + (eq[x[0]] ? ' checked' : '') + '><span>' + x[1] + '</span></label>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">05</span><h3>État du véhicule</h3></div>' +
          '<div class="state-row">' + Object.keys(STATES).map(function (k) {
            return '<button type="button" class="state-pill' + (c.stateLevel === k ? ' on' : '') + '" data-lvl="' + k + '">' + STATES[k] + '</button>';
          }).join('') + '</div>' +
          '<div class="field"><label for="c-notes">Description / remarques</label><textarea id="c-notes" placeholder="Rayures, chocs, éléments manquants…">' + P.esc(c.stateNotes) + '</textarea></div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">06</span><h3>Photos des défauts et tickets carburant</h3></div>' +
          '<label class="photo-zone" for="c-photo">Prendre une photo</label>' +
          '<input type="file" id="c-photo" accept="image/*" capture="environment" multiple class="visually-hidden">' +
          '<div class="photo-grid" id="c-photos">' + renderPhotos() + '</div>' +
        '</div>' +
      '</div></div>' +
      '<button class="btn btn-block" id="c-share" style="margin-top:12px">Partager le PDF</button>';

    function save() {
      c.plate = P.$('#c-plate').value.trim().toUpperCase();
      c.destination = P.$('#c-dest').value.trim();
      c.kmStart = num(P.$('#c-kmstart').value);
      c.kmEnd = num(P.$('#c-kmend').value);
      c.fuelDone = P.$('#c-fuel').checked;
      c.fuelKm = c.fuelDone ? num(P.$('#c-fuelkm').value) : '';
      c.extraFuels = P.$$('.c-extra').map(function (i) { return num(i.value); });
      c.equipment = {};
      P.$$('[data-eq]').forEach(function (i) { c.equipment[i.getAttribute('data-eq')] = i.checked; });
      c.stateNotes = P.$('#c-notes').value.trim();
      var d = delta(), dl = P.$('#c-delta'); dl.innerHTML = d; dl.hidden = !d;
      P.touch(m);
    }
    function wireDynamic() {
      P.$$('[data-rmfuel]').forEach(function (b) {
        b.onclick = function () { save(); c.extraFuels.splice(Number(b.getAttribute('data-rmfuel')), 1); P.$('#c-extras').innerHTML = renderExtra(); wireDynamic(); save(); };
      });
      P.$$('[data-rmphoto]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-rmphoto');
          c.photos = c.photos.filter(function (p) { return p.id !== id; });
          P.$('#c-photos').innerHTML = renderPhotos(); wireDynamic(); P.touch(m);
        };
      });
      P.$$('[data-zoom]').forEach(function (img) {
        img.onclick = function () {
          var box = document.createElement('div'); box.className = 'lightbox';
          box.innerHTML = '<img src="' + img.src + '" alt="">';
          box.onclick = function () { box.remove(); };
          document.body.appendChild(box);
        };
      });
    }
    wireDynamic();
    main.addEventListener('input', function (e) { if (e.target.id !== 'c-photo') save(); });
    main.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'c-photo') return;
      if (t.matches('[data-eq]')) t.closest('.check-item').classList.toggle('on', t.checked);
      if (t.id === 'c-fuel') P.$('#c-fuelwrap').hidden = !t.checked;
      save();
    });
    P.$('#c-addfuel').onclick = function () { save(); c.extraFuels.push(''); P.$('#c-extras').innerHTML = renderExtra(); wireDynamic(); var l = P.$$('.c-extra'); if (l.length) l[l.length - 1].focus(); };
    P.$$('.state-pill[data-lvl]').forEach(function (b) {
      b.onclick = function () {
        c.stateLevel = b.getAttribute('data-lvl');
        P.$$('.state-pill[data-lvl]').forEach(function (x) { x.classList.toggle('on', x === b); });
        P.touch(m);
      };
    });
    P.$('#c-photo').addEventListener('change', function () {
      var input = this, files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      P.toast('Traitement des photos…');
      var left = files.length;
      files.forEach(function (file) {
        compressImage(file, function (url) {
          left--;
          if (url) { c.photos.push({ id: P.uid('p'), dataUrl: url }); P.$('#c-photos').innerHTML = renderPhotos(); wireDynamic(); }
          if (!left) { input.value = ''; P.touch(m, true); }
        });
      });
    });
    P.$('#c-share').onclick = function () {
      P.toast('Génération du PDF…');
      P.buildCarnetPdf(m).then(function (d) { P.shareFile(d.blob, d.name, 'Carnet de bord'); })
        .catch(function (e) { P.toast(String(e.message || e), 4000); });
    };
  };

  // ---------------------------------------------------------------- PDF (MiniPDF, hors ligne)
  function pdfColors() {
    var p = P.accentPalette(P.validHex(P.resp.pdfAccent) || '#C9860E');
    return {
      accent: p.base.map(Math.round), accentStrong: p.strong.map(Math.round), onAccent: p.ink,
      warnBg: p.warnBg.map(Math.round),
      text: [26, 29, 33], muted: [98, 104, 111], border: [215, 218, 222], panel2: [245, 246, 247],
      success: [47, 125, 83], successBg: [232, 243, 236], danger: [181, 57, 44], dangerBg: [251, 234, 231]
    };
  }
  function fill(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
  function draw(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }
  function ink(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }

  function realFormat(dataUrl) {
    var i = dataUrl.indexOf(','), head = atob(dataUrl.slice(i + 1, i + 9));
    if (head.charCodeAt(0) === 0xFF && head.charCodeAt(1) === 0xD8) return 'jpeg';
    if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50) return 'png';
    return 'unknown';
  }
  // Certains WebView renvoient du PNG au lieu de JPEG : on réencode en pixels bruts dans ce cas
  function preparePhoto(dataUrl) {
    return new Promise(function (resolve) {
      var fmt; try { fmt = realFormat(dataUrl); } catch (e) { fmt = 'unknown'; }
      if (fmt === 'jpeg') return resolve(dataUrl);
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
          var rgba = ctx.getImageData(0, 0, cv.width, cv.height).data, rgb = new Uint8Array(cv.width * cv.height * 3);
          for (var p = 0, q = 0; p < rgba.length; p += 4, q += 3) { rgb[q] = rgba[p]; rgb[q + 1] = rgba[p + 1]; rgb[q + 2] = rgba[p + 2]; }
          if (typeof CompressionStream === 'function') {
            try {
              var cs = new CompressionStream('deflate'), wr = cs.writable.getWriter(); wr.write(rgb); wr.close();
              return new Response(cs.readable).arrayBuffer().then(function (buf) {
                resolve({ rgbFlate: new Uint8Array(buf), width: cv.width, height: cv.height });
              }).catch(function () { resolve({ rgbRaw: rgb, width: cv.width, height: cv.height }); });
            } catch (e) {}
          }
          resolve({ rgbRaw: rgb, width: cv.width, height: cv.height });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  function buildStyled(m, c, prepared) {
    var doc = new window.MiniPDF();
    var pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 14, C = pdfColors();
    var origin = P.resp.origin || 'PREJ Marseille';
    function ensure(y, need) { if (y + need > pageH - 18) { doc.addPage(); return 20; } return y; }

    fill(doc, C.accent); doc.rect(0, 0, pageW, 24, 'F');
    ink(doc, C.onAccent); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('Carnet de bord — Fiche mission', margin, 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Gestion de parc — ' + origin, margin, 17);
    var y = 33;

    draw(doc, C.text); doc.setLineWidth(0.5); doc.roundedRect(margin, y, 42, 11, 1, 1);
    ink(doc, C.text); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(c.plate || '—', margin + 4, y + 7.5);
    var infoX = margin + 48;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(doc, C.muted);
    if (m.numero) doc.text('Mission n° ' + m.numero, infoX, y + 4);
    var done = c.kmEnd !== '' && c.kmEnd !== null && c.kmEnd !== undefined;
    fill(doc, done ? C.successBg : C.warnBg); doc.roundedRect(infoX, y + 6, 46, 6, 2, 2, 'F');
    ink(doc, done ? C.success : C.accentStrong); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text(done ? 'MISSION TERMINÉE' : 'MISSION EN COURS', infoX + 23, y + 10, { align: 'center' });
    y += 18;

    var n = 0;
    function title(t) {
      n++; y = ensure(y, 14);
      fill(doc, C.accent); doc.roundedRect(margin, y, 7, 5.5, 1, 1, 'F');
      ink(doc, C.onAccent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(String(n).padStart(2, '0'), margin + 3.5, y + 4, { align: 'center' });
      ink(doc, C.muted); doc.setFontSize(10.5); doc.text(t.toUpperCase(), margin + 10, y + 4.3);
      y += 9; draw(doc, C.border); doc.setLineWidth(0.2); doc.line(margin, y, pageW - margin, y); y += 5;
    }
    function row(label, value, x, w) {
      ink(doc, C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(label.toUpperCase(), x, y);
      ink(doc, C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      doc.text(String(value == null || value === '' ? '-' : value), x, y + 5, { maxWidth: w });
    }
    var colW = (pageW - margin * 2 - 8) / 2;
    title('Véhicule & chauffeur');
    row('Numéro de mission', m.numero, margin, colW); row('Date', P.frDate(m.date), margin + colW + 8, colW); y += 12;
    row('Destination', c.destination, margin, colW); row('Chauffeur', m.chauffeur, margin + colW + 8, colW); y += 12;

    title('Kilométrage');
    row('Départ mission', fmtKm(c.kmStart), margin, colW); row('Fin de mission', fmtKm(c.kmEnd), margin + colW + 8, colW); y += 10;
    if (c.kmStart !== '' && c.kmEnd !== '' && !isNaN(c.kmStart) && !isNaN(c.kmEnd)) {
      fill(doc, C.panel2); doc.roundedRect(margin, y, pageW - margin * 2, 8, 1, 1, 'F');
      ink(doc, C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Distance parcourue :', margin + 3, y + 5.3);
      ink(doc, C.text); doc.setFont('helvetica', 'bold'); doc.text(fmtKmNumber(Number(c.kmEnd) - Number(c.kmStart)) + ' km', margin + 42, y + 5.3);
      y += 13;
    } else y += 4;

    title('Carburant');
    row('Plein effectué', fuelSummary(c), margin, pageW - margin * 2); y += 12;

    title('Équipement présent');
    var eq = c.equipment || {}, eqW = (pageW - margin * 2 - 12) / 3;
    EQ.forEach(function (x, i) {
      var cx = margin + (i % 3) * (eqW + 6), yy = y + Math.floor(i / 3) * 9, on = !!eq[x[0]];
      draw(doc, on ? C.success : C.border); doc.setLineWidth(0.4);
      if (on) fill(doc, C.successBg);
      doc.roundedRect(cx, yy, eqW, 7, 1, 1, on ? 'FD' : 'D');
      draw(doc, C.text); doc.setLineWidth(0.35); doc.rect(cx + 2, yy + 2, 3, 3, 'S');
      if (on) { doc.setLineWidth(0.5); doc.line(cx + 2.3, yy + 3.6, cx + 3.2, yy + 4.6); doc.line(cx + 3.2, yy + 4.6, cx + 4.8, yy + 2.3); }
      ink(doc, on ? C.success : C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(x[1], cx + 7, yy + 5);
    });
    y += Math.ceil(EQ.length / 3) * 9 + 6;

    y = ensure(y, 30);
    title('État du véhicule');
    var sc = { ok: { fg: C.success, bg: C.successBg }, minor: { fg: C.accentStrong, bg: C.warnBg }, damage: { fg: C.danger, bg: C.dangerBg } }[c.stateLevel] || { fg: C.success, bg: C.successBg };
    var pill = STATES[c.stateLevel] || '-';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    var pw = doc.getTextWidth(pill) + 10;
    fill(doc, sc.bg); doc.roundedRect(margin, y, pw, 7, 2, 2, 'F');
    ink(doc, sc.fg); doc.text(pill, margin + pw / 2, y + 4.7, { align: 'center' });
    y += 11;
    ink(doc, C.muted); doc.setFontSize(8); doc.text('REMARQUES', margin, y); y += 4.5;
    ink(doc, C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    var lines = doc.splitTextToSize(c.stateNotes || '(aucune remarque)', pageW - margin * 2);
    y = ensure(y, lines.length * 5 + 4); doc.text(lines, margin, y); y += lines.length * 5 + 8;

    if (c.photos && c.photos.length) {
      y = ensure(y, 20);
      title('Photos des défauts et tickets carburant');
      var tw = (pageW - margin * 2 - 10) / 3, col = 0;
      c.photos.forEach(function (p, i) {
        y = ensure(y, tw + 8);
        var x = margin + col * (tw + 5);
        draw(doc, C.border); doc.setLineWidth(0.3); doc.roundedRect(x, y, tw, tw, 1.5, 1.5);
        try { doc.addImage(prepared[i] != null ? prepared[i] : p.dataUrl, 'AUTO', x + 0.8, y + 0.8, tw - 1.6, tw - 1.6); } catch (e) {}
        ink(doc, C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('Photo ' + (i + 1), x, y + tw + 3.5);
        col++; if (col >= 3) { col = 0; y += tw + 7; }
      });
      if (col) y += tw + 7;
    }
    return doc;
  }

  function imageSize(u) { return new Promise(function (r) { var i = new Image(); i.onload = function () { r({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 }); }; i.onerror = function () { r(null); }; i.src = u; }); }

  function footer(doc) {
    var C = pdfColors(), pageW = 210, pageH = 297, margin = 14, total = doc.internal.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      draw(doc, C.border); doc.setLineWidth(0.2); doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      ink(doc, C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text('Carnet de bord — Gestion de parc ' + (P.resp.origin || 'PREJ Marseille'), margin, pageH - 7);
      doc.text('Page ' + p + ' / ' + total, pageW - margin, pageH - 7, { align: 'right' });
    }
  }

  // Fiche + photos en annexe (une par page) dans un seul PDF
  P.buildCarnetPdf = function (m) {
    var c = m.carnet, photos = c.photos || [];
    return Promise.all(photos.map(function (p) { return preparePhoto(p.dataUrl); })).then(function (prepared) {
      var doc = buildStyled(m, c, prepared);
      return Promise.all(photos.map(function (p) { return imageSize(p.dataUrl); })).then(function (sizes) {
        var margin = 12, pageW = 210, pageH = 297;
        var t = 'Fiche ' + (m.numero ? m.numero + ' - ' : '') + (c.plate || '');
        photos.forEach(function (p, i) {
          doc.addPage();
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 29, 33);
          doc.text('Annexe  —  ' + t + '  —  Photo ' + (i + 1) + ' / ' + photos.length, margin, margin + 4);
          var s = sizes[i] || { w: 4, h: 3 }, bw = pageW - margin * 2, bh = pageH - margin * 2 - 22;
          var k = Math.min(bw / s.w, bh / s.h), w = s.w * k, h = s.h * k;
          try { doc.addImage(prepared[i] != null ? prepared[i] : p.dataUrl, 'AUTO', margin + (bw - w) / 2, margin + 10, w, h); } catch (e) {}
        });
        footer(doc);
        return { blob: doc.output('blob'), name: 'Carnet_de_bord_OM-' + P.safeName(m.numero) + '_' + (P.safeName(c.plate) || '') + '.pdf' };
      });
    });
  };

  P.carnetBodyText = function (m) {
    var c = m.carnet, eq = c.equipment || {}, L = [];
    L.push('Fiche mission — ' + (c.plate || 'Sans plaque'));
    L.push('Unité : ' + (P.resp.origin || 'PREJ Marseille'));
    L.push('');
    if (m.numero) L.push('Numéro de mission : ' + m.numero);
    L.push('Date : ' + P.frDate(m.date));
    if (c.destination) L.push('Destination : ' + c.destination);
    L.push('Chauffeur : ' + (m.chauffeur || '-'));
    L.push('Kilométrage départ : ' + fmtKm(c.kmStart));
    L.push('Kilométrage fin : ' + fmtKm(c.kmEnd));
    if (c.kmStart !== '' && c.kmEnd !== '' && !isNaN(c.kmStart) && !isNaN(c.kmEnd)) L.push('Distance parcourue : ' + fmtKmNumber(Number(c.kmEnd) - Number(c.kmStart)) + ' km');
    L.push('Plein effectué : ' + fuelSummary(c));
    L.push(''); L.push('Équipement présent :');
    EQ.forEach(function (x) { L.push('- ' + x[1] + ' : ' + (eq[x[0]] ? 'Oui' : 'Non')); });
    L.push(''); L.push('État du véhicule : ' + (STATES[c.stateLevel] || '-'));
    L.push('Remarques : ' + (c.stateNotes || '(aucune)'));
    L.push('');
    L.push((c.photos && c.photos.length) ? '(Fiche PDF en pièce jointe, avec ' + c.photos.length + ' photo(s) en annexe)' : '(Fiche PDF en pièce jointe)');
    return L.join('\n');
  };
})();
