/* PREJ Missions — Fiche retour mission (mise en page de la fiche papier) */
(function () {
  'use strict';
  var P = window.P;
  P.views = P.views || {};

  function enMin(v) { if (!v) return null; var p = v.split(':').map(Number); return p[0] * 60 + p[1]; }
  function amplitude(r) {
    var a = enMin(r.priseService), b = enMin(r.finService);
    if (a == null || b == null) return '';
    var d = b - a; if (d < 0) d += 1440;
    return Math.floor(d / 60) + 'h' + String(d % 60).padStart(2, '0');
  }

  P.views.retour = function (m, _id, main) {
    var r = m.retour;
    function f(id, label, type, val, extra) {
      return '<div class="field"><label for="r-' + id + '">' + label + '</label><input type="' + type + '" id="r-' + id + '" value="' + P.esc(val || '') + '"' + (extra || '') + '></div>';
    }
    main.innerHTML =
      '<div class="panel">' +
        '<div class="section"><div class="section-title"><span class="section-num">AUTO</span><h3>Rempli depuis la mission</h3></div>' +
          '<dl class="crew">' +
            '<dt>Date</dt><dd>' + P.esc(P.frDate(m.date)) + '</dd>' +
            '<dt>Ordre(s) de mission</dt><dd>' + P.esc(m.numero || '—') + '</dd>' +
            "<dt>Chef d'escorte</dt><dd>" + P.esc(m.chef || '—') + '</dd>' +
            '<dt>Chauffeur</dt><dd>' + P.esc(m.chauffeur || '—') + '</dd>' +
            '<dt>Contact(s)</dt><dd>' + P.esc((m.contacts || []).join(', ') || '—') + '</dd>' +
            '<dt>Signature</dt><dd>' + (m.signature ? 'Enregistrée' : '<span class="err">À faire sur la page de la mission</span>') + '</dd>' +
          '</dl></div>' +
        '<div class="section"><div class="section-title"><span class="section-num">01</span><h3>Horaires</h3></div>' +
          '<div class="grid2">' +
            f('priseService', 'Prise de service', 'time', r.priseService) +
            f('priseCharge', 'Prise en charge', 'time', r.priseCharge) +
            f('juridiction', 'Lieu de juridiction', 'text', r.juridiction) +
            f('depose', 'Dépose', 'time', r.depose) +
            f('finMission', 'Fin de mission', 'time', r.finMission) +
            f('finService', 'Fin de service', 'time', r.finService) +
          '</div>' +
          '<div class="field auto"><label for="r-amplitude">Amplitude horaire mission</label><input type="text" id="r-amplitude" value="' + P.esc(r.amplitude) + '" placeholder="Calculée automatiquement">' +
            '<span class="hint">De la prise de service à la fin de service. Modifiable à la main.</span></div>' +
        '</div>' +
        '<div class="section"><div class="section-title"><span class="section-num">02</span><h3>Information(s) sur la mission</h3></div>' +
          '<div class="field"><textarea id="r-infos" placeholder="Incidents, observations, remarques…" aria-label="Informations sur la mission">' + P.esc(r.infos) + '</textarea></div></div>' +
      '</div>' +
      '<button class="btn btn-block" id="r-share" style="margin-top:12px">Partager le PDF</button>';

    var keys = ['priseService', 'priseCharge', 'juridiction', 'depose', 'finMission', 'finService', 'infos'];
    main.addEventListener('input', function (e) {
      keys.forEach(function (k) { r[k] = P.$('#r-' + k).value.trim(); });
      if (e.target.id === 'r-amplitude') {
        r.amplitude = e.target.value.trim(); r.ampManual = r.amplitude !== '';
      } else if (!r.ampManual) {
        r.amplitude = amplitude(r); P.$('#r-amplitude').value = r.amplitude;
      }
      P.touch(m);
    });
    P.$('#r-share').onclick = function () {
      P.buildRetourPdf(m).then(function (d) { P.shareFile(d.blob, d.name, 'Fiche retour mission'); })
        .catch(function (e) { P.toast(String(e.message || e), 4000); });
    };
  };

  // ---------------------------------------------------------------- images de l'en-tête
  var images = { logo: null, tampon: null };
  function chargerImage(src) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () {
        var c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
        c.getContext('2d').drawImage(i, 0, 0);
        res({ data: c.toDataURL('image/png'), w: i.naturalWidth, h: i.naturalHeight });
      };
      i.onerror = function () { res(null); };
      i.src = src;
    });
  }
  function tamponDessine() {
    var S = 600, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), R = S / 2;
    g.translate(R, R);
    g.fillStyle = '#262626'; g.beginPath(); g.arc(0, 0, R - 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d0d0d0'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, R - 78, Math.PI * 0.62, Math.PI * 0.9); g.stroke();
    g.beginPath(); g.arc(0, 0, R - 78, Math.PI * 0.1, Math.PI * 0.38); g.stroke();
    g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle';
    function arc(txt, rayon, haut, police) {
      g.font = police;
      var chars = Array.from(txt);
      var larg = chars.map(function (ch) { return g.measureText(ch).width + 2; });
      var total = larg.reduce(function (a, b) { return a + b; }, 0) / rayon;
      var ang = haut ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
      chars.forEach(function (ch, k) {
        var demi = larg[k] / 2 / rayon;
        ang += haut ? demi : -demi;
        g.save();
        if (haut) { g.rotate(ang + Math.PI / 2); g.translate(0, -rayon); }
        else { g.rotate(ang - Math.PI / 2); g.translate(0, rayon); }
        g.fillText(ch, 0, 0); g.restore();
        ang += haut ? demi : -demi;
      });
    }
    arc('ADMINISTRATION \u2605 PÉNITENTIAIRE', R - 42, true, 'bold 40px Arial, sans-serif');
    arc('PREJ MARSEILLE', R - 44, false, 'bold 44px Arial, sans-serif');
    g.font = 'bold 22px Arial, sans-serif'; g.fillText('SEMPER PRIMUS', 0, R - 108);
    g.fillRect(-80, R - 94, 160, 3);
    return { data: c.toDataURL('image/png'), w: S, h: S };
  }
  var imagesPretes = Promise.all([chargerImage('img/logo.png'), chargerImage('img/tampon.png')]).then(function (x) {
    images.logo = x[0]; images.tampon = x[1] || tamponDessine();
  });

  function contactLines(list) {
    list = (list || []).filter(Boolean);
    if (list.length <= 3) return [list[0] || '', list[1] || '', list[2] || ''];
    var out = [[], [], []];
    list.forEach(function (c, i) { out[Math.min(2, Math.floor(i / 2))].push(c); });
    return out.map(function (x) { return x.join(', '); });
  }

  // ---------------------------------------------------------------- PDF (A4, en mm)
  P.buildRetourPdf = function (m) {
    if (!window.jspdf) return Promise.reject(new Error("Le module PDF n'est pas chargé."));
    return Promise.all([imagesPretes, P.loadImage(m.signature)]).then(function (x) {
      var sig = x[1], r = m.retour;
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      var NOIR = [22, 22, 22], ENCRE = [0, 0, 145], GRIS = [110, 110, 110];
      doc.setLineWidth(0.25); doc.setDrawColor.apply(doc, NOIR);

      if (images.logo) {
        var lw = 42; doc.addImage(images.logo.data, 'PNG', 11, 24, lw, lw * images.logo.h / images.logo.w);
      } else {
        doc.setFillColor.apply(doc, NOIR);
        doc.rect(12, 24.5, 5.5, 3, 'F'); doc.rect(19, 24.5, 3.5, 3, 'F');
        doc.setTextColor.apply(doc, NOIR); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
        doc.text('MINISTÈRE', 11.6, 32.5); doc.text('DE LA JUSTICE', 11.6, 37.5);
        doc.setFont('times', 'bolditalic'); doc.setFontSize(7);
        doc.text('Liberté', 12, 41.5); doc.text('Égalité', 12, 44.5); doc.text('Fraternité', 12, 47.5);
      }
      if (images.tampon) {
        var w = 47, h = w * images.tampon.h / images.tampon.w;
        doc.addImage(images.tampon.data, 'PNG', 158 - w / 2, 28 - h / 2, w, h);
      }
      doc.rect(5, 60, 192, 21);
      doc.setTextColor.apply(doc, NOIR); doc.setFont('helvetica', 'normal');
      doc.setFontSize(17); doc.text('PREJ MARSEILLE', 101, 68.5, { align: 'center' });
      doc.setFontSize(14); doc.text('Fiche retour mission', 101, 77, { align: 'center' });

      function libelle(txt, x, y) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, NOIR);
        doc.text(txt, x, y);
        var tw = doc.getTextWidth(txt);
        doc.setLineWidth(0.2); doc.line(x, y + 0.9, x + tw, y + 0.9);
        return x + tw;
      }
      function ligne(x1, x2, y, valeur) {
        doc.setLineWidth(0.25); doc.setDrawColor.apply(doc, NOIR); doc.line(x1, y + 0.6, x2, y + 0.6);
        if (valeur) {
          doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, ENCRE);
          var fs = 11; doc.setFontSize(fs);
          while (doc.getTextWidth(valeur) > x2 - x1 - 2 && fs > 6) doc.setFontSize(--fs);
          doc.text(valeur, x1 + 1, y - 0.6);
        }
      }
      function champ(lib, x, y, debut, fin, valeur) { var e = libelle(lib, x, y); ligne(Math.max(debut, e + 1.5), fin, y, valeur); }

      var c = contactLines(m.contacts);
      champ('Date :', 8.5, 95, 18, 87, P.frDate(m.date));
      champ('Numéro(s) Ordre(s) de Mission(s) :', 8.5, 103, 64, 134, m.numero);
      libelle('Agents :', 8.5, 111);
      champ("Chef d'escorte :", 20.5, 118.5, 46, 133, m.chef);
      champ('Chauffeur :', 20.5, 126.5, 45, 132, m.chauffeur);
      champ('Contact (s) :', 20.5, 134, 45, 132, c[0]);
      ligne(45, 132, 142, c[1]);
      ligne(45, 132, 150, c[2]);

      champ('Horaire prise de service :', 8.5, 164, 49, 77, r.priseService);
      champ('Horaire prise en charge :', 83, 163.5, 123, 167, r.priseCharge);
      champ('Lieu de juridiction :', 8.5, 171.5, 40, 78, r.juridiction);
      champ('Horaire de dépose :', 83, 171, 115, 167, r.depose);
      champ('Horaire fin de mission :', 8.5, 179.5, 46, 77, r.finMission);
      champ('Horaire fin de service :', 83, 179, 120, 168, r.finService);
      champ('Amplitude horaire mission :', 8.5, 187, 53.5, 77, r.amplitude || amplitude(r));

      var finLib = libelle('Information(s) sur la mission :', 8.7, 211);
      var zones = [
        { x1: Math.max(57, finLib + 1.5), x2: 169, y: 211 },
        { x1: 8.7, x2: 168.5, y: 228 }, { x1: 8.7, x2: 168.5, y: 245 }, { x1: 8.7, x2: 168.5, y: 262 }
      ];
      zones.forEach(function (z) { ligne(z.x1, z.x2, z.y, ''); });
      var texte = (r.infos || '').trim();
      if (texte) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, ENCRE);
        var fs = 11, placement = null;
        while (fs >= 6 && !placement) {
          doc.setFontSize(fs);
          var pas = fs * 0.42;
          var capa = zones.map(function (z, i) { return i === 0 ? 1 : Math.max(1, Math.floor(15 / pas)); });
          var mots = texte.replace(/\n/g, ' \n ').split(' ');
          var iz = 0, iy = 0, courant = '', lignes = [], ok = true;
          var pousser = function () { lignes.push({ zone: iz, rang: iy, txt: courant }); courant = ''; iy++; if (iy >= capa[iz]) { iz++; iy = 0; } };
          for (var k = 0; k < mots.length; k++) {
            var mot = mots[k];
            if (iz >= zones.length) { ok = false; break; }
            if (mot === '\n') { pousser(); continue; }
            var essai = courant ? courant + ' ' + mot : mot;
            if (doc.getTextWidth(essai) > zones[iz].x2 - zones[iz].x1 - 2 && courant) {
              pousser();
              if (iz >= zones.length) { ok = false; break; }
              courant = mot;
            } else courant = essai;
          }
          if (ok && courant) { if (iz >= zones.length) ok = false; else pousser(); }
          if (ok) placement = { lignes: lignes, pas: pas, capa: capa }; else fs--;
        }
        if (placement) {
          placement.lignes.forEach(function (l) {
            var z = zones[l.zone], n = placement.capa[l.zone];
            doc.text(l.txt, z.x1 + 1, z.y - 0.6 - (n - 1 - l.rang) * placement.pas);
          });
        }
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor.apply(doc, GRIS);
      doc.text("Signature Chef d'escorte", 162, 276, { align: 'center' });
      if (sig) {
        var sw = 48, sh = Math.min(16, sw * sig.h / sig.w);
        sw = sh * sig.w / sig.h;
        doc.addImage(sig.src, 'PNG', 162 - sw / 2, 278, sw, sh);
      }
      return { blob: doc.output('blob'), name: 'Fiche_retour_mission_OM-' + P.safeName(m.numero) + '_' + m.date + '.pdf' };
    });
  };
})();
