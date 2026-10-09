/* PREJ Missions — noyau commun (stockage, réglages, missions, outils) */
(function () {
  'use strict';
  var P = window.P = {};

  // ---------------------------------------------------------------- stockage
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsJSON(k, def) { try { var r = lsGet(k); return r ? JSON.parse(r) : def; } catch (e) { return def; } }
  P.lsGet = lsGet; P.lsSet = lsSet; P.lsJSON = lsJSON;

  // ---------------------------------------------------------------- réglages
  var SET_KEY = 'prej_settings_v1';
  var SET_DEF = {
    nom: '', qualite: "Chef d'escorte", signature: '',
    fouilleEmail: '', retourEmail: '',
    etab: '', lors: 'extraction', integrale: true, motifs: {},
    theme: 'dark', accent: '#C9860E'
  };
  P.settings = Object.assign({}, SET_DEF, lsJSON(SET_KEY, {}));
  P.saveSettings = function () { return lsSet(SET_KEY, JSON.stringify(P.settings)); };

  // Paramètres responsable du carnet de bord (protégés par mot de passe, comme avant)
  var RESP_KEY = 'prej_carnet_resp_v1';
  P.RESP_PASSWORD = '1402';
  P.resp = Object.assign({ email1: '', email2: '', origin: 'PREJ Marseille', pdfAccent: '#C9860E' }, lsJSON(RESP_KEY, {}));
  P.saveResp = function () { return lsSet(RESP_KEY, JSON.stringify(P.resp)); };

  // ---------------------------------------------------------------- outils
  P.uid = function (p) { return (p || 'm') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); };
  P.pad2 = function (n) { return String(n).padStart(2, '0'); };
  P.todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + P.pad2(d.getMonth() + 1) + '-' + P.pad2(d.getDate()); };
  P.frDate = function (iso) { if (!iso) return ''; var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; };
  P.esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  P.$ = function (sel, root) { return (root || document).querySelector(sel); };
  P.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  P.isAllowedEmail = function (v) { v = String(v || '').trim().toLowerCase(); return /^[^\s@]+@justice\.fr$/.test(v); };
  P.safeName = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'sans_numero'; };
  P.nameKey = function (s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');
  };

  var toastT;
  P.toast = function (msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, ms || 2800);
  };

  // Fenêtre modale simple. Renvoie { el, close }.
  P.modal = function (html, opts) {
    opts = opts || {};
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.getElementById('modalRoot').appendChild(back);
    function close() { if (back.parentNode) back.parentNode.removeChild(back); if (opts.onClose) opts.onClose(); }
    if (!opts.locked) back.addEventListener('click', function (e) { if (e.target === back) close(); });
    var first = back.querySelector('input, button.btn-primary');
    if (first && opts.focus !== false) setTimeout(function () { try { first.focus(); } catch (e) {} }, 40);
    return { el: back, close: close };
  };
  P.closeModals = function () { document.getElementById('modalRoot').innerHTML = ''; };
  P.confirm = function (title, text, okLabel, cancelLabel) {
    return new Promise(function (resolve) {
      var m = P.modal('<h3>' + P.esc(title) + '</h3><div>' + text + '</div>' +
        '<div class="actions"><button class="btn" data-a="no">' + P.esc(cancelLabel || 'Annuler') + '</button>' +
        '<button class="btn btn-primary" data-a="ok">' + P.esc(okLabel || 'OK') + '</button></div>',
        { onClose: function () { resolve(false); } });
      m.el.querySelector('[data-a="no"]').onclick = function () { m.close(); };
      m.el.querySelector('[data-a="ok"]').onclick = function () { var r = resolve; resolve = function () {}; m.close(); r(true); };
    });
  };

  // ---------------------------------------------------------------- thème et couleur
  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(rgb) { return '#' + rgb.map(function (c) { c = Math.max(0, Math.min(255, Math.round(c))); return (c < 16 ? '0' : '') + c.toString(16); }).join('').toUpperCase(); }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; }); }
  function lum(rgb) { var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function inkFor(rgb) { return lum(rgb) > 0.4 ? [24, 20, 16] : [255, 255, 255]; }
  P.validHex = function (v) { return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v.toUpperCase() : ''; };
  P.accentPalette = function (hex) {
    var base = hexToRgb(hex), black = [0, 0, 0], white = [255, 255, 255];
    return {
      base: base, strong: mix(base, black, 0.18), ink: inkFor(base), warnBg: mix(base, white, 0.86),
      darkBase: mix(base, white, 0.22), darkStrong: mix(base, white, 0.38),
      darkInk: inkFor(mix(base, white, 0.22)), darkWarnBg: mix(base, [21, 23, 26], 0.78)
    };
  };
  P.inkFor = inkFor; P.hexToRgb = hexToRgb;
  P.applyTheme = function (theme, accent) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    var p = P.accentPalette(P.validHex(accent) || '#C9860E');
    var light = '--accent:' + rgbToHex(p.base) + ';--accent-strong:' + rgbToHex(p.strong) + ';--accent-ink:' + rgbToHex(p.ink) + ';--warn-bg:' + rgbToHex(p.warnBg) + ';';
    var dark = '--accent:' + rgbToHex(p.darkBase) + ';--accent-strong:' + rgbToHex(p.darkStrong) + ';--accent-ink:' + rgbToHex(p.darkInk) + ';--warn-bg:' + rgbToHex(p.darkWarnBg) + ';';
    var css = ':root{' + light + '}:root[data-theme="dark"]{' + dark + '}';
    var tag = document.getElementById('accentStyle');
    if (!tag) { tag = document.createElement('style'); tag.id = 'accentStyle'; document.head.appendChild(tag); }
    tag.textContent = css;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#FFFFFF' : '#1D2024');
  };
  P.ACCENTS = [
    { name: 'Ambre', hex: '#C9860E' }, { name: 'Bleu', hex: '#1F5FAD' }, { name: 'Marine', hex: '#1B3A6B' },
    { name: 'Vert', hex: '#2F7D53' }, { name: 'Rouge', hex: '#B5392C' }, { name: 'Orange', hex: '#D0621B' },
    { name: 'Violet', hex: '#6B4FA0' }, { name: 'Ardoise', hex: '#4A5561' }
  ];

  // ---------------------------------------------------------------- missions
  var M_KEY = 'prej_missions_v1';
  var SEL_KEY = 'prej_selected_v1';
  var MAX_MISSIONS = 6;
  P.missions = lsJSON(M_KEY, []);
  if (!Array.isArray(P.missions)) P.missions = [];

  P.saveMissions = function () {
    if (P.missions.length > MAX_MISSIONS) {
      P.missions.sort(function (a, b) { return b.createdAt - a.createdAt; });
      P.missions = P.missions.slice(0, MAX_MISSIONS);
    }
    var ok = lsSet(M_KEY, JSON.stringify(P.missions));
    if (!ok) P.toast("Mémoire pleine : supprimez des photos ou d'anciennes missions.", 5000);
    return ok;
  };
  P.getMission = function (id) { return P.missions.find(function (m) { return m.id === id; }) || null; };
  P.getSelected = function () { return lsGet(SEL_KEY) || ''; };
  P.setSelected = function (id) { lsSet(SEL_KEY, id || ''); };

  P.blankFouille = function (m) {
    var s = P.settings;
    return {
      id: P.uid('f'), destination: (m && m.retour && m.retour.juridiction) || '', etablissement: s.etab || '',
      detenu: '', lors: s.lors || '', motifs: Object.assign({}, s.motifs || {}), autreTxt: '',
      integrale: s.integrale !== false, obs: ''
    };
  };
  P.newMission = function (data) {
    var s = P.settings;
    var chefMatches = s.signature && (!s.nom || P.nameKey(s.nom) === P.nameKey(data.chef));
    var m = {
      id: P.uid('m'), createdAt: Date.now(), date: data.date || P.todayISO(),
      numero: data.numero || '', chauffeur: data.chauffeur || '', chef: data.chef || '',
      contacts: (data.contacts || []).filter(Boolean),
      chefQualite: chefMatches ? (s.qualite || "Chef d'escorte") : "Chef d'escorte",
      signature: chefMatches ? s.signature : '',
      fouilles: [],
      retour: { priseService: '', priseCharge: '', juridiction: '', depose: '', finMission: '', finService: '', amplitude: '', ampManual: false, infos: '' },
      carnet: {
        plate: '', destination: '', kmStart: '', kmEnd: '', fuelDone: false, fuelKm: '', extraFuels: [],
        equipment: { fuelCard: false, telepeage: false, bouclier: false, pareBalle: false, sac: false, ceinture: false, entrave: false },
        stateLevel: 'ok', stateNotes: '', photos: []
      },
      sentAt: null, sendLog: []
    };
    m.fouilles.push(P.blankFouille(m));
    return m;
  };

  // ---------------------------------------------------------------- état des documents
  P.MOTIFS = [
    ['evasion', "Présente un risque d'évasion"],
    ['risque', 'Présente un risque pour elle-même ou pour autrui'],
    ['delit', 'Est soupçonnée de commettre ou vouloir commettre un fait délictueux'],
    ['objets', "Est soupçonnée d'avoir sur elle des objets ou substances prohibés"],
    ['autre', 'Autre (précisez)']
  ];
  function filled(v) { return v !== '' && v !== null && v !== undefined && !(typeof v === 'number' && isNaN(v)); }

  P.fouilleMissing = function (f) {
    var miss = [];
    if (!filled((f.detenu || '').trim())) miss.push('personne détenue');
    if (!filled((f.etablissement || '').trim())) miss.push('établissement');
    if (!f.lors) miss.push('« Lors de »');
    var any = P.MOTIFS.some(function (x) { return f.motifs && f.motifs[x[0]]; });
    if (!any) miss.push('motif');
    if (f.motifs && f.motifs.autre && !(f.autreTxt || '').trim()) miss.push('précision du motif « Autre »');
    return miss;
  };
  P.status = function (m) {
    var out = {};
    // Fouilles
    var fm = [];
    var fOk = 0;
    (m.fouilles || []).forEach(function (f, i) {
      var x = P.fouilleMissing(f);
      if (!x.length) fOk++;
      else fm.push('Fouille ' + (i + 1) + (f.detenu ? ' (' + f.detenu + ')' : '') + ' : ' + x.join(', '));
    });
    if (!m.signature) fm.push("signature du chef d'escorte");
    var nF = (m.fouilles || []).length;
    out.fouille = {
      state: nF === 0 ? 'empty' : (fm.length === 0 ? 'ok' : (fOk > 0 || nF > 0 ? 'part' : 'empty')),
      label: nF === 0 ? 'Aucune personne détenue' : (fOk + ' / ' + nF + ' complète' + (fOk > 1 ? 's' : '')),
      missing: nF === 0 ? ['aucune décision de fouille'] : fm
    };
    // Fiche retour
    var r = m.retour || {};
    var rm = [];
    if (!r.priseService) rm.push('horaire de prise de service');
    if (!r.finService) rm.push('horaire de fin de service');
    if (!m.signature) rm.push("signature du chef d'escorte");
    var rAny = ['priseService', 'priseCharge', 'juridiction', 'depose', 'finMission', 'finService', 'infos'].some(function (k) { return filled(r[k]); });
    out.retour = { state: rm.length === 0 ? 'ok' : (rAny ? 'part' : 'empty'), label: rm.length ? (rAny ? 'En cours' : 'À remplir') : 'Complète', missing: rm };
    // Carnet
    var c = m.carnet || {};
    var cm = [];
    if (!filled((c.plate || '').trim())) cm.push('immatriculation');
    if (!filled(c.kmStart)) cm.push('kilométrage de départ');
    if (!filled(c.kmEnd)) cm.push('kilométrage de fin');
    var cAny = filled(c.plate) || filled(c.kmStart) || filled(c.kmEnd) || (c.photos || []).length;
    out.carnet = { state: cm.length === 0 ? 'ok' : (cAny ? 'part' : 'empty'), label: cm.length ? (cAny ? 'En cours' : 'À remplir') : 'Complet', missing: cm };
    out.allOk = out.fouille.state === 'ok' && out.retour.state === 'ok' && out.carnet.state === 'ok';
    return out;
  };

  // ---------------------------------------------------------------- natif (Capacitor)
  P.isNative = function () { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); };
  P.plugin = function (name) { return (P.isNative() && window.Capacitor.Plugins) ? window.Capacitor.Plugins[name] || null : null; };

  P.blobToBase64 = function (blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onloadend = function () { var s = String(r.result || ''); var i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };
  P.dataUrlToBlob = function (u) {
    var i = u.indexOf(','), mime = (u.slice(0, i).match(/:(.*?);/) || [, 'application/octet-stream'])[1];
    var bin = atob(u.slice(i + 1)), a = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
    return new Blob([a], { type: mime });
  };

  P.copyText = function (t) {
    if (!t) return Promise.resolve();
    var Clip = P.plugin('Clipboard');
    if (Clip) return Clip.write({ string: t }).catch(function () {});
    try { if (navigator.clipboard) return navigator.clipboard.writeText(t).catch(function () {}); } catch (e) {}
    return Promise.resolve();
  };

  // Partage / enregistrement manuel d'un fichier (secours)
  P.shareFile = function (blob, name, title) {
    var FS = P.plugin('Filesystem'), Share = P.plugin('Share');
    if (FS && Share) {
      return P.blobToBase64(blob).then(function (data) {
        return FS.writeFile({ path: name, data: data, directory: 'CACHE' });
      }).then(function (w) {
        return Share.share({ title: title || name, files: [w.uri], dialogTitle: 'Partager ou enregistrer' });
      }).catch(function (e) {
        var msg = String((e && e.message) || e);
        if (!/cancel/i.test(msg)) P.toast('Partage impossible : ' + msg, 4000);
      });
    }
    try {
      var file = new File([blob], name, { type: blob.type || 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: title || name }).catch(function () {});
      }
    } catch (e) {}
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return Promise.resolve();
  };

  // ---------------------------------------------------------------- pavé de signature
  P.SignaturePad = function (canvas, emptyEl, onChange) {
    var ctx = canvas.getContext('2d'), drawing = false, last = null, self = this;
    this.hasInk = false; this.dirty = false;
    function size() {
      var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0c1f5c'; ctx.lineWidth = 2.4; ctx.fillStyle = '#0c1f5c';
    }
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function setEmpty(v) { if (emptyEl) emptyEl.hidden = !v; }
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      drawing = true; last = pos(e);
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fill();
      self.hasInk = true; self.dirty = true; setEmpty(false);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return; e.preventDefault();
      var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      canvas.addEventListener(ev, function () { if (drawing && onChange) onChange(); drawing = false; });
    });
    this.clear = function () { ctx.clearRect(0, 0, canvas.width, canvas.height); self.hasInk = false; self.dirty = true; setEmpty(true); if (onChange) onChange(); };
    this.load = function (dataUrl) {
      size(); self.hasInk = false; setEmpty(true);
      if (!dataUrl) return;
      var im = new Image();
      im.onload = function () {
        var r = canvas.getBoundingClientRect();
        var k = Math.min((r.width - 20) / im.width, (r.height - 20) / im.height, 1);
        var w = im.width * k, h = im.height * k;
        ctx.drawImage(im, (r.width - w) / 2, (r.height - h) / 2, w, h);
        self.hasInk = true; setEmpty(false);
      };
      im.src = dataUrl;
    };
    // Image recadrée sur le tracé (PNG transparent)
    this.toDataURL = function () {
      if (!self.hasInk) return '';
      var w = canvas.width, h = canvas.height, data = ctx.getImageData(0, 0, w, h).data;
      var x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return '';
      var m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
      var tw = x1 - x0 + 1, th = y1 - y0 + 1, k = Math.min(1, 600 / tw);
      var c = document.createElement('canvas'); c.width = Math.round(tw * k); c.height = Math.round(th * k);
      c.getContext('2d').drawImage(canvas, x0, y0, tw, th, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    };
    size();
  };

  // Ouvre une fenêtre pour signer. Renvoie une promesse avec l'image (ou null si annulé).
  P.askSignature = function (title, current) {
    return new Promise(function (resolve) {
      var done = false;
      var m = P.modal('<h3>' + P.esc(title) + '</h3>' +
        '<div class="sig-zone"><canvas></canvas><div class="empty">Signez ici avec le doigt</div></div>' +
        '<button class="link" data-a="clear">Effacer</button>' +
        '<div class="actions"><button class="btn" data-a="no">Annuler</button><button class="btn btn-primary" data-a="ok">Enregistrer la signature</button></div>',
        { focus: false, onClose: function () { if (!done) resolve(null); } });
      var pad;
      requestAnimationFrame(function () {
        pad = new P.SignaturePad(m.el.querySelector('canvas'), m.el.querySelector('.empty'));
        pad.load(current || '');
      });
      m.el.querySelector('[data-a="clear"]').onclick = function () { pad && pad.clear(); };
      m.el.querySelector('[data-a="no"]').onclick = function () { m.close(); };
      m.el.querySelector('[data-a="ok"]').onclick = function () {
        var url = pad ? (pad.dirty ? pad.toDataURL() : (current || '')) : '';
        done = true; m.close(); resolve(url);
      };
    });
  };

  P.ICONS = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 19v2M17 19v2M5 11h14"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  };
})();
