/* PREJ Missions — navigation et écrans principaux */
(function () {
  'use strict';
  var P = window.P;
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var MAX_CONTACTS = 5;

  // ---------------------------------------------------------------- enregistrement automatique
  var saveTimer = null;
  P.touch = function (m, now) {
    clearTimeout(saveTimer);
    var run = function () {
      if (P.saveMissions()) {
        var s = document.getElementById('autosave');
        if (s) { s.classList.add('show'); clearTimeout(s._t); s._t = setTimeout(function () { s.classList.remove('show'); }, 1300); }
      }
    };
    if (now) run(); else saveTimer = setTimeout(run, 400);
  };
  function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; P.saveMissions(); } }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // ---------------------------------------------------------------- navigation (hash + bouton retour Android)
  var stack = [], replacing = false;
  P.go = function (hash, replace) {
    flush();
    if ((location.hash || '#/') === hash) { route(); return; }
    if (replace) { replacing = true; location.replace(hash); } else { location.hash = hash; }
  };
  function back(parent) {
    flush();
    if (stack.length > 1) history.back(); else P.go(parent || '#/', true);
  }
  window.addEventListener('hashchange', function () {
    var h = location.hash || '#/';
    if (replacing) { replacing = false; stack[Math.max(0, stack.length - 1)] = h; }
    else if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
    else if (stack[stack.length - 1] !== h) stack.push(h);
    route();
  });

  function top(o) {
    var bar = $('#topbar');
    bar.innerHTML =
      (o.back ? '<button class="icon-btn" id="tb-back" aria-label="Retour">' + P.ICONS.back + '</button>' : '') +
      '<div class="title"><h1>' + esc(o.title) + '</h1>' + (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') + '</div>' +
      '<span class="autosave" id="autosave">✓ Enregistré</span>' +
      (o.gear ? '<button class="icon-btn" id="tb-gear" aria-label="Réglages">' + P.ICONS.gear + '</button>' : '');
    if (o.back) $('#tb-back').onclick = function () { back(o.back); };
    if (o.gear) $('#tb-gear').onclick = function () { P.go('#/reglages'); };
  }
  function bar(html) { var a = $('#actionbar'); a.innerHTML = html ? '<div class="actionbar">' + html + '</div>' : ''; }
  function fresh() { var v = $('#view'); var d = document.createElement('div'); v.innerHTML = ''; v.appendChild(d); window.scrollTo(0, 0); return d; }

  function route() {
    P.closeModals();
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) return home();
    if (parts[0] === 'nouvelle') return missionForm(null);
    if (parts[0] === 'reglages') return settings();
    if (parts[0] === 'm') {
      var m = P.getMission(parts[1]);
      if (!m) return P.go('#/', true);
      var sub = parts[2];
      if (!sub) return hub(m);
      if (sub === 'infos') return missionForm(m);
      var titles = { fouille: 'Décision de fouille', retour: 'Fiche retour mission', carnet: 'Carnet de bord' };
      if (!titles[sub]) return P.go('#/m/' + m.id, true);
      top({ title: titles[sub], sub: 'Mission ' + (m.numero || '') + ' · ' + P.frDate(m.date), back: '#/m/' + m.id });
      bar('<div class="in"><button class="btn btn-primary btn-lg" id="b-done">Terminé</button></div>');
      $('#b-done').onclick = function () { back('#/m/' + m.id); };
      return P.views[sub](m, parts[3], fresh());
    }
    P.go('#/', true);
  }

  // ---------------------------------------------------------------- accueil
  function dots(m) {
    var st = P.status(m);
    function d(k, label) { return '<span class="dot ' + (st[k].state === 'ok' ? 'ok' : st[k].state === 'part' ? 'part' : '') + '">' + (st[k].state === 'ok' ? '✓ ' : '') + label + '</span>'; }
    return '<div class="dots">' + d('fouille', 'Fouille') + d('retour', 'Retour') + d('carnet', 'Carnet') + '</div>';
  }
  function home() {
    top({ title: 'PREJ Missions', sub: 'Fouille · Retour mission · Carnet de bord', gear: true });
    var main = fresh();
    var list = P.missions.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    if (!list.length) {
      main.innerHTML = '<div class="welcome"><h2>Aucune mission en cours</h2>' +
        '<p>Créez la mission du jour : numéro, chauffeur, chef d\'escorte et agents. Ces informations rempliront automatiquement la décision de fouille, la fiche retour mission et le carnet de bord.</p>' +
        '<button class="btn btn-primary btn-lg btn-block" id="b-new">Créer une nouvelle mission</button></div>';
      $('#b-new').onclick = function () { P.go('#/nouvelle'); };
      bar('');
      if (!P.settings.fouilleEmail && !P.settings.retourEmail) setTimeout(function () { P.toast('Pensez à renseigner les destinataires dans la roue dentée.', 4000); }, 600);
      return;
    }
    var sel = P.getSelected();
    if (!P.getMission(sel)) {
      var today = list.find(function (m) { return m.date === P.todayISO() && !m.sentAt; }) || list[0];
      sel = today.id; P.setSelected(sel);
    }
    var curM = P.getMission(sel), stS = P.status(curM);
    function quick(key, icon, title) {
      var x = stS[key], cls = x.state === 'ok' ? ' ok' : x.state === 'part' ? ' part' : '';
      return '<button class="doc' + cls + '" data-quick="' + key + '"><span class="ico">' + (x.state === 'ok' ? P.ICONS.check : icon) + '</span>' +
        '<span class="t"><strong>' + title + '</strong><span>' + esc(x.state === 'ok' ? x.label : (x.missing[0] ? 'Manque : ' + x.missing.join(', ') : x.label)) + '</span></span>' +
        '<span class="chev">' + P.ICONS.chev + '</span></button>';
    }
    main.innerHTML = '<div id="smsBanner"></div>' +
      '<div class="list-head"><h2>Mission du jour : ' + esc(curM.numero || 'sans n°') + '</h2><button class="btn btn-ghost" id="b-sig">' + (curM.signature ? 'Signature ✓' : 'Signer') + '</button></div>' +
      quick('fouille', P.ICONS.search, 'Décision de fouille') +
      quick('retour', P.ICONS.doc, 'Fiche retour mission') +
      quick('carnet', P.ICONS.car, 'Carnet de bord') +
      '<div class="list-head" style="margin-top:18px"><h2>Missions</h2><button class="btn btn-ghost" id="b-new">+ Nouvelle mission</button></div>' +
      list.map(function (m) {
        var badge = m.sentAt ? '<span class="badge sent">Envoyée</span>' : (m.date === P.todayISO() ? '<span class="badge today">Aujourd\'hui</span>' : '');
        return '<div class="mcard' + (m.id === sel ? ' sel' : '') + '">' +
          '<button class="pick" data-pick="' + m.id + '" aria-label="Choisir comme mission du jour"><span></span></button>' +
          '<button class="body" data-open="' + m.id + '">' +
            '<div class="l1"><span class="om-chip">' + esc(m.numero || 'Sans n°') + '</span>' + badge + '</div>' +
            '<div class="l2">' + esc(P.frDate(m.date)) + ' · Chef : ' + esc(m.chef || '—') + ' · Chauffeur : ' + esc(m.chauffeur || '—') + '</div>' +
            dots(m) +
          '</button></div>';
      }).join('') +
      '<p class="credit">Le rond à gauche choisit la mission du jour : les 3 boutons du haut ouvrent ses documents. Appuyez sur une mission pour voir ou modifier ses informations.</p>';
    $('#b-new').onclick = function () { P.go('#/nouvelle'); };
    $$('[data-quick]').forEach(function (q) { q.onclick = function () { P.go('#/m/' + curM.id + '/' + q.getAttribute('data-quick')); }; });
    $('#b-sig').onclick = function () {
      P.askSignature('Signature de ' + (curM.chef || "chef d'escorte"), curM.signature).then(function (url) {
        if (url === null) return; curM.signature = url; P.touch(curM, true); home();
      });
    };
    $$('[data-pick]').forEach(function (b) { b.onclick = function () { P.setSelected(b.getAttribute('data-pick')); home(); }; });
    $$('[data-open]').forEach(function (b) { b.onclick = function () { P.go('#/m/' + b.getAttribute('data-open')); }; });
    var cur = P.getMission(sel);
    bar('<div class="note">Mission du jour : <b>' + esc(cur.numero || 'Sans n°') + '</b> — ' + esc(P.frDate(cur.date)) + '</div>' +
      '<div class="in"><button class="btn btn-primary btn-lg" id="b-send">Valider et envoyer les PDF</button></div>');
    $('#b-send').onclick = function () { P.sendMission(P.getMission(P.getSelected())); };
    refreshBanner();
  }
  function refreshBanner() {
    var box = $('#smsBanner');
    if (!box || !P.plugin('SmsComposer')) return;
    P.isSmsGranted().then(function (ok) {
      if (ok) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="missing" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><b>Envoi automatique non activé</b><br>Autorisez l\'envoi des SMS pour que les PDF partent seuls.</div><button class="btn btn-primary" id="b-sms">Activer</button></div>';
      $('#b-sms').onclick = function () { P.startSmsSetup(); };
    });
  }
  P.refreshHome = function () { var h = location.hash || '#/'; if (h === '#/' || h === '#') home(); };

  // ---------------------------------------------------------------- création / modification de mission
  function missionForm(m) {
    var editing = !!m;
    var d = m || { numero: '', date: P.todayISO(), chauffeur: '', chef: P.settings.nom || '', contacts: [''] };
    var contacts = (d.contacts && d.contacts.length ? d.contacts.slice() : ['']);
    top({ title: editing ? 'Mission ' + (m.numero || '') : 'Nouvelle mission', sub: editing ? 'Informations de la mission' : 'Rempli automatiquement dans les 3 documents', back: editing ? '#/m/' + m.id : '#/' });
    var main = fresh();
    function contactRows() {
      return contacts.map(function (c, i) {
        return '<div class="field"><label for="n-c' + i + '">Agent contact ' + (i + 1) + '</label>' +
          '<div class="row-input"><input type="text" id="n-c' + i + '" data-c="' + i + '" value="' + esc(c) + '" autocapitalize="words">' +
          (i > 0 ? '<button type="button" class="rm-btn" data-rmc="' + i + '" aria-label="Retirer cet agent">✕</button>' : '') + '</div></div>';
      }).join('') +
        (contacts.length < MAX_CONTACTS ? '<button type="button" class="link" id="n-addc">+ Ajouter un agent contact (' + (MAX_CONTACTS - contacts.length) + ' possible' + (MAX_CONTACTS - contacts.length > 1 ? 's' : '') + ')</button>' : '');
    }
    main.innerHTML = '<div class="panel">' +
      '<div class="section"><div class="section-title"><span class="section-num">01</span><h3>Mission</h3></div>' +
        '<div class="grid2">' +
          '<div class="field"><label for="n-num">Numéro de mission (OM)</label><input type="text" id="n-num" value="' + esc(d.numero) + '" inputmode="text" autocapitalize="characters"></div>' +
          '<div class="field"><label for="n-date">Date</label><input type="date" id="n-date" value="' + esc(d.date) + '"></div>' +
        '</div></div>' +
      '<div class="section"><div class="section-title"><span class="section-num">02</span><h3>Équipe</h3></div>' +
        '<div class="field"><label for="n-chauf">Chauffeur</label><input type="text" id="n-chauf" value="' + esc(d.chauffeur) + '" autocapitalize="words"></div>' +
        '<div class="field"><label for="n-chef">Chef d\'escorte</label><input type="text" id="n-chef" value="' + esc(d.chef) + '" autocapitalize="words"></div>' +
        (editing ? '<div class="field"><label for="n-qual">Qualité du chef d\'escorte (signature de la fouille)</label><input type="text" id="n-qual" value="' + esc(m.chefQualite) + '"></div>' : '') +
        '<div id="n-contacts">' + contactRows() + '</div>' +
      '</div></div>' +
      '<p class="err" id="n-err" hidden></p>' +
      (editing ? '<button class="btn btn-ghost btn-block" id="n-del" style="color:var(--danger);margin-top:10px">Supprimer la mission</button>' : '');

    function readContacts() { contacts = $$('[data-c]').map(function (i) { return i.value; }); }
    function wireContacts() {
      var add = $('#n-addc');
      if (add) add.onclick = function () { readContacts(); contacts.push(''); $('#n-contacts').innerHTML = contactRows(); wireContacts(); var l = $$('[data-c]'); l[l.length - 1].focus(); if (editing) saveEdit(); };
      $$('[data-rmc]').forEach(function (b) {
        b.onclick = function () { readContacts(); contacts.splice(Number(b.getAttribute('data-rmc')), 1); $('#n-contacts').innerHTML = contactRows(); wireContacts(); if (editing) saveEdit(); };
      });
    }
    wireContacts();
    function values() {
      readContacts();
      return {
        numero: $('#n-num').value.trim(), date: $('#n-date').value || P.todayISO(),
        chauffeur: $('#n-chauf').value.trim(), chef: $('#n-chef').value.trim(),
        contacts: contacts.map(function (c) { return c.trim(); }).filter(Boolean)
      };
    }
    function saveEdit() {
      var v = values();
      m.numero = v.numero; m.date = v.date; m.chauffeur = v.chauffeur; m.chef = v.chef; m.contacts = v.contacts;
      m.chefQualite = $('#n-qual').value.trim();
      P.touch(m);
    }
    if (editing) {
      main.addEventListener('input', saveEdit);
      bar('<div class="in"><button class="btn btn-primary btn-lg" id="n-ok">Terminé</button></div>');
      $('#n-ok').onclick = function () { flush(); back('#/m/' + m.id); };
      $('#n-del').onclick = function () {
        P.confirm('Supprimer la mission ?', '<p>Tous ses documents, photos et signature seront supprimés de ce téléphone.</p>', 'Supprimer').then(function (ok) {
          if (!ok) return;
          P.missions = P.missions.filter(function (x) { return x.id !== m.id; });
          P.saveMissions(); P.toast('Mission supprimée.'); P.go('#/', true);
        });
      };
    } else {
      bar('<div class="in"><button class="btn btn-primary btn-lg" id="n-ok">Créer la mission</button></div>');
      $('#n-ok').onclick = function () {
        var v = values(), miss = [];
        if (!v.numero) miss.push('le numéro de mission');
        if (!v.chauffeur) miss.push('le chauffeur');
        if (!v.chef) miss.push("le chef d'escorte");
        if (miss.length) { var e = $('#n-err'); e.textContent = 'Renseignez ' + miss.join(', ') + '.'; e.hidden = false; return; }
        var nm = P.newMission(v);
        P.missions.push(nm); P.saveMissions(); P.setSelected(nm.id);
        P.go('#/m/' + nm.id, true);
      };
    }
  }

  // ---------------------------------------------------------------- page d'une mission
  function hub(m) {
    top({ title: 'Mission ' + (m.numero || 'sans n°'), sub: P.frDate(m.date) + (m.sentAt ? ' · envoyée' : ''), back: '#/' });
    var main = fresh(), st = P.status(m);
    function doc(key, icon, title, s) {
      var cls = s.state === 'ok' ? ' ok' : s.state === 'part' ? ' part' : '';
      return '<button class="doc' + cls + '" data-doc="' + key + '"><span class="ico">' + (s.state === 'ok' ? P.ICONS.check : icon) + '</span>' +
        '<span class="t"><strong>' + title + '</strong><span>' + esc(s.state === 'ok' ? s.label : (s.missing[0] ? 'Manque : ' + s.missing.join(', ') : s.label)) + '</span></span>' +
        '<span class="chev">' + P.ICONS.chev + '</span></button>';
    }
    main.innerHTML =
      '<div class="panel mhead"><div class="l1"><span class="om-chip">' + esc(m.numero || 'Sans n°') + '</span><span style="color:var(--text-muted)">' + esc(P.frDate(m.date)) + '</span>' +
        '<button class="btn btn-ghost" id="h-edit" style="margin-left:auto">Modifier</button></div>' +
        '<dl class="crew"><dt>Chef d\'escorte</dt><dd>' + esc(m.chef || '—') + '</dd><dt>Chauffeur</dt><dd>' + esc(m.chauffeur || '—') + '</dd>' +
        '<dt>Contact(s)</dt><dd>' + esc((m.contacts || []).join(', ') || '—') + '</dd></dl></div>' +
      '<div class="list-head" style="margin-top:16px"><h2>Signature du chef d\'escorte</h2></div>' +
      '<div class="panel" style="padding:12px;display:flex;gap:12px;align-items:center">' +
        (m.signature ? '<div class="sig-preview" style="flex:1"><img src="' + m.signature + '" alt="Signature"></div>' : '<div style="flex:1;color:var(--danger);font-weight:600">Pas encore signée</div>') +
        '<button class="btn" id="h-sign">' + (m.signature ? 'Changer' : 'Signer') + '</button></div>' +
      '<div class="list-head" style="margin-top:16px"><h2>Documents</h2></div>' +
      doc('fouille', P.ICONS.search, 'Décision de fouille', st.fouille) +
      doc('retour', P.ICONS.doc, 'Fiche retour mission', st.retour) +
      doc('carnet', P.ICONS.car, 'Carnet de bord', st.carnet);
    $('#h-edit').onclick = function () { P.go('#/m/' + m.id + '/infos'); };
    $('#h-sign').onclick = function () {
      P.askSignature("Signature de " + (m.chef || "chef d'escorte"), m.signature).then(function (url) {
        if (url === null) return;
        m.signature = url; P.touch(m, true); hub(m);
      });
    };
    $$('[data-doc]').forEach(function (b) { b.onclick = function () { P.go('#/m/' + m.id + '/' + b.getAttribute('data-doc')); }; });
    bar('<div class="in"><button class="btn btn-primary btn-lg" id="h-send">' + (st.allOk ? 'Valider et envoyer les PDF' : 'Envoyer les PDF') + '</button></div>');
    $('#h-send').onclick = function () { P.setSelected(m.id); P.sendMission(m); };
  }

  // ---------------------------------------------------------------- réglages
  function settings() {
    var s = P.settings;
    top({ title: 'Réglages', back: '#/' });
    bar('');
    var main = fresh();
    var log = P.getLog().slice(0, 12);
    main.innerHTML = '<div class="panel">' +
      '<div class="section"><div class="section-title"><span class="section-num">01</span><h3>Destinataires des PDF (@justice.fr)</h3></div>' +
        '<div class="field"><label for="s-fe">Décision de fouille</label><input type="email" inputmode="email" autocapitalize="off" spellcheck="false" id="s-fe" value="' + esc(s.fouilleEmail) + '" placeholder="prenom.nom@justice.fr"><span class="err" id="e-fe" hidden></span></div>' +
        '<div class="field"><label for="s-re">Fiche retour mission</label><input type="email" inputmode="email" autocapitalize="off" spellcheck="false" id="s-re" value="' + esc(s.retourEmail) + '" placeholder="prenom.nom@justice.fr"><span class="err" id="e-re" hidden></span></div>' +
        '<div class="field"><label>Carnet de bord</label><input type="text" readonly value="' + esc([P.resp.email1, P.resp.email2].filter(Boolean).join(', ') || 'Non renseigné') + '">' +
        '<button class="link" id="s-resp" style="align-self:flex-start">Paramètres responsable (mot de passe)</button></div>' +
      '</div>' +
      '<div class="section"><div class="section-title"><span class="section-num">02</span><h3>Ma signature</h3></div>' +
        '<p class="hint" style="margin:0 0 10px;font-size:13px;color:var(--text-muted)">Reprise automatiquement dans les nouvelles missions où vous êtes chef d\'escorte.</p>' +
        '<div class="grid2"><div class="field"><label for="s-nom">Prénom et nom</label><input type="text" id="s-nom" value="' + esc(s.nom) + '" autocapitalize="words"></div>' +
        '<div class="field"><label for="s-qual">Qualité</label><input type="text" id="s-qual" value="' + esc(s.qualite) + '" placeholder="Premier surveillant, chef d\'escorte"></div></div>' +
        '<div class="panel" style="padding:10px;display:flex;gap:12px;align-items:center;background:var(--panel-2)">' +
          (s.signature ? '<div class="sig-preview" style="flex:1"><img src="' + s.signature + '" alt="Ma signature"></div>' : '<div style="flex:1;color:var(--text-muted)">Aucune signature enregistrée</div>') +
          '<button class="btn" id="s-sign">' + (s.signature ? 'Changer' : 'Signer') + '</button></div>' +
      '</div>' +
      '<div class="section"><div class="section-title"><span class="section-num">03</span><h3>Décision de fouille : remplissage automatique</h3></div>' +
        '<div class="field"><label for="s-etab">Établissement par défaut</label><input type="text" id="s-etab" value="' + esc(s.etab) + '"></div>' +
        '<div class="field"><label for="s-lors">« Lors de » par défaut</label><select id="s-lors">' +
          '<option value="">Aucun</option><option value="extraction"' + (s.lors === 'extraction' ? ' selected' : '') + '>Départ en extraction judiciaire</option>' +
          '<option value="transfert"' + (s.lors === 'transfert' ? ' selected' : '') + '>Départ en transfert</option></select></div>' +
        '<div class="checks">' +
          '<label class="check-item' + (s.integrale !== false ? ' on' : '') + '"><input type="checkbox" id="s-int"' + (s.integrale !== false ? ' checked' : '') + '><span>Cocher « Intégrale » automatiquement</span></label>' +
          P.MOTIFS.map(function (x) {
            var on = s.motifs && s.motifs[x[0]];
            return '<label class="check-item' + (on ? ' on' : '') + '"><input type="checkbox" data-smotif="' + x[0] + '"' + (on ? ' checked' : '') + '><span>Motif par défaut : ' + esc(x[1]) + '</span></label>';
          }).join('') + '</div>' +
      '</div>' +
      '<div class="section"><div class="section-title"><span class="section-num">04</span><h3>Affichage</h3></div>' +
        '<div class="seg" style="margin-bottom:12px"><button type="button" data-theme="dark"' + (s.theme !== 'light' ? ' class="on"' : '') + '>Sombre</button><button type="button" data-theme="light"' + (s.theme === 'light' ? ' class="on"' : '') + '>Clair</button></div>' +
        '<div class="swatches">' + P.ACCENTS.map(function (a) {
          return '<button type="button" class="swatch' + (P.validHex(s.accent) === a.hex ? ' sel' : '') + '" data-hex="' + a.hex + '" title="' + a.name + '" aria-label="' + a.name + '" style="background:' + a.hex + '"></button>';
        }).join('') + '</div>' +
      '</div>' +
      (P.plugin('SmsComposer') ? '<div class="section"><div class="section-title"><span class="section-num">05</span><h3>Envoi automatique des MMS</h3></div><div id="s-sms" style="color:var(--text-muted)">Vérification…</div></div>' : '') +
      '<div class="section"><div class="section-title"><span class="section-num">06</span><h3>Derniers envois</h3></div>' +
        (log.length ? '<ul class="log">' + log.map(function (e) {
          var d = new Date(e.at);
          return '<li class="' + (e.ok ? 'ok' : 'ko') + '"><b>' + (e.ok ? '✓ ' : '✗ ') + esc(e.doc) + ' — OM ' + esc(e.om || '') + '</b>' +
            esc(d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) + ' → ' + esc(e.to) +
            (e.info ? '<br><span style="color:var(--text-muted)">' + esc(e.info) + '</span>' : '') + '</li>';
        }).join('') + '</ul>' : '<p style="margin:0;color:var(--text-muted)">Aucun envoi pour l\'instant.</p>') +
      '</div></div>';

    function email(id, key, err) {
      $(id).addEventListener('input', function () {
        var v = this.value.trim().toLowerCase(), e = $(err);
        if (v && !P.isAllowedEmail(v)) { e.textContent = "L'adresse doit se terminer par @justice.fr"; e.hidden = false; return; }
        e.hidden = true; s[key] = v; P.saveSettings();
      });
    }
    email('#s-fe', 'fouilleEmail', '#e-fe');
    email('#s-re', 'retourEmail', '#e-re');
    ['nom', 'qual', 'etab'].forEach(function (k) {
      $('#s-' + k).addEventListener('input', function () { s[{ nom: 'nom', qual: 'qualite', etab: 'etab' }[k]] = this.value.trim(); P.saveSettings(); });
    });
    $('#s-lors').onchange = function () { s.lors = this.value; P.saveSettings(); };
    main.addEventListener('change', function (e) {
      var t = e.target;
      if (t.type !== 'checkbox') return;
      t.closest('.check-item').classList.toggle('on', t.checked);
      if (t.id === 's-int') s.integrale = t.checked;
      else if (t.hasAttribute('data-smotif')) { s.motifs = s.motifs || {}; s.motifs[t.getAttribute('data-smotif')] = t.checked; }
      P.saveSettings();
    });
    $('#s-sign').onclick = function () {
      P.askSignature('Ma signature', s.signature).then(function (url) { if (url === null) return; s.signature = url; P.saveSettings(); settings(); });
    };
    $$('[data-theme]').forEach(function (b) {
      b.onclick = function () { s.theme = b.getAttribute('data-theme'); P.saveSettings(); P.applyTheme(s.theme, s.accent); $$('[data-theme]').forEach(function (x) { x.classList.toggle('on', x === b); }); };
    });
    $$('[data-hex]').forEach(function (b) {
      b.onclick = function () { s.accent = b.getAttribute('data-hex'); P.saveSettings(); P.applyTheme(s.theme, s.accent); $$('[data-hex]').forEach(function (x) { x.classList.toggle('sel', x === b); }); };
    });
    $('#s-resp').onclick = respGate;
    var smsBox = $('#s-sms');
    if (smsBox) P.isSmsGranted().then(function (ok) {
      smsBox.innerHTML = ok ? '<span style="color:var(--success);font-weight:600">✓ Activé : les PDF partent sans ouvrir Messages.</span>'
        : '<span>Non activé.</span> <button class="btn btn-primary" id="s-smsgo" style="margin-left:8px">Activer</button>';
      var g = $('#s-smsgo'); if (g) g.onclick = function () { P.startSmsSetup(function () { settings(); }); };
    });
  }

  // Paramètres responsable du carnet de bord (mot de passe, comme dans le carnet d'origine)
  function respGate() {
    var g = P.modal('<h3>Accès protégé</h3><p>Entrez le mot de passe pour modifier les paramètres du carnet de bord.</p>' +
      '<div class="field"><label for="pw">Mot de passe</label><input type="password" id="pw" inputmode="numeric" autocomplete="off"></div>' +
      '<div class="actions"><button class="btn" data-a="no">Annuler</button><button class="btn btn-primary" data-a="ok">Valider</button></div>');
    var input = g.el.querySelector('#pw');
    function check() {
      if (input.value === P.RESP_PASSWORD) { g.close(); respEdit(); }
      else { P.toast('Mot de passe incorrect.'); input.value = ''; input.focus(); }
    }
    g.el.querySelector('[data-a="no"]').onclick = g.close;
    g.el.querySelector('[data-a="ok"]').onclick = check;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
  }
  function respEdit() {
    var r = P.resp, chosen = P.validHex(r.pdfAccent) || '#C9860E';
    var e = P.modal('<h3>Paramètres responsable</h3><p>Le carnet de bord validé part par MMS vers ces adresses, PDF en pièce jointe. Seules les adresses @justice.fr sont acceptées.</p>' +
      '<div class="field"><label for="r1">Adresse e-mail</label><input type="email" id="r1" inputmode="email" autocapitalize="off" value="' + esc(r.email1) + '" placeholder="prenom.nom@justice.fr"></div>' +
      '<div class="field"><label for="r2">2e adresse e-mail (facultatif)</label><input type="email" id="r2" inputmode="email" autocapitalize="off" value="' + esc(r.email2) + '" placeholder="prenom.nom@justice.fr"></div>' +
      '<div class="field"><label for="ro">Unité</label><input type="text" id="ro" value="' + esc(r.origin) + '"></div>' +
      '<div class="field"><label>Couleur du PDF</label><div class="swatches">' + P.ACCENTS.map(function (a) {
        return '<button type="button" class="swatch' + (a.hex === chosen ? ' sel' : '') + '" data-pdf="' + a.hex + '" aria-label="' + a.name + '" style="background:' + a.hex + '"></button>';
      }).join('') + '</div></div>' +
      '<p class="err" id="r-err" hidden></p>' +
      '<div class="actions"><button class="btn" data-a="no">Annuler</button><button class="btn btn-primary" data-a="ok">Enregistrer</button></div>');
    P.$$('[data-pdf]', e.el).forEach(function (b) {
      b.onclick = function () { chosen = b.getAttribute('data-pdf'); P.$$('[data-pdf]', e.el).forEach(function (x) { x.classList.toggle('sel', x === b); }); };
    });
    e.el.querySelector('[data-a="no"]').onclick = e.close;
    e.el.querySelector('[data-a="ok"]').onclick = function () {
      var e1 = e.el.querySelector('#r1').value.trim().toLowerCase(), e2 = e.el.querySelector('#r2').value.trim().toLowerCase(), err = e.el.querySelector('#r-err');
      if ((e1 && !P.isAllowedEmail(e1)) || (e2 && !P.isAllowedEmail(e2))) { err.textContent = 'Seules les adresses @justice.fr sont acceptées.'; err.hidden = false; return; }
      if (!e1 && e2) { e1 = e2; e2 = ''; }
      if (e2 === e1) e2 = '';
      r.email1 = e1; r.email2 = e2; r.origin = e.el.querySelector('#ro').value.trim() || 'PREJ Marseille'; r.pdfAccent = chosen;
      P.saveResp(); e.close(); P.toast('Paramètres enregistrés.'); settings();
    };
  }

  // ---------------------------------------------------------------- démarrage
  P.applyTheme(P.settings.theme, P.settings.accent);
  stack.push(location.hash || '#/');
  route();
})();
