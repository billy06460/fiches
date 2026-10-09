/* PREJ Missions — envoi des documents d'une mission par MMS */
(function () {
  'use strict';
  var P = window.P;

  // ---------------------------------------------------------------- journal
  var LOG_KEY = 'prej_send_log_v1';
  P.getLog = function () { return P.lsJSON(LOG_KEY, []); };
  function addLog(entries) { P.lsSet(LOG_KEY, JSON.stringify(entries.concat(P.getLog()).slice(0, 30))); }

  // ---------------------------------------------------------------- autorisation SMS (repris du carnet)
  function sms() { return P.plugin('SmsComposer'); }
  P.isSmsGranted = function () {
    var S = sms();
    if (!S || typeof S.checkPermissions !== 'function') return Promise.resolve(true);
    return S.checkPermissions().then(function (r) { return !!r && r.sms === 'granted'; }).catch(function () { return false; });
  };
  function requestSms() {
    var S = sms();
    if (!S || typeof S.requestPermissions !== 'function') return Promise.resolve(false);
    return S.requestPermissions({ permissions: ['sms'] }).then(function (r) { return !!r && r.sms === 'granted'; }).catch(function () { return false; });
  }
  var waitingReturn = false, guideAttempts = 0, afterGrant = null;
  P.startSmsSetup = function (then) {
    afterGrant = then || null;
    requestSms().then(function (ok) { if (ok) smsDone(); else showGuide(); });
  };
  function smsDone() {
    waitingReturn = false; guideAttempts = 0;
    P.closeModals(); P.toast('Envoi automatique activé.', 3500);
    if (P.refreshHome) P.refreshHome();
    var f = afterGrant; afterGrant = null; if (f) f();
  }
  function showGuide() {
    P.closeModals();
    var extra = guideAttempts > 0
      ? '<p>L\'option n\'apparaît pas dans le menu ⋮ ? Ouvrez d\'abord <b>Autorisations &gt; SMS</b> et appuyez sur <b>Autoriser</b> : Android affiche un avertissement, fermez-le, puis revenez à la page précédente et réessayez le menu ⋮.</p>'
      : '';
    var m = P.modal('<h3>Activer l\'envoi automatique</h3>' +
      '<p>Android bloque l\'autorisation SMS pour les applications installées hors du Play Store. Une seule manipulation suffit :</p>' +
      '<ol class="guide-steps"><li>Appuyez sur <b>Ouvrir les réglages</b>.</li>' +
      '<li>Sur la page qui s\'ouvre, touchez les <b>⋮</b> en haut à droite puis <b>Autoriser les paramètres restreints</b>, et confirmez.</li>' +
      '<li>Revenez dans PREJ Missions : l\'application redemande l\'autorisation SMS, appuyez sur <b>Autoriser</b>.</li></ol>' + extra +
      '<div class="actions"><button class="btn" data-a="later">Plus tard</button><button class="btn btn-primary" data-a="open">Ouvrir les réglages</button></div>');
    m.el.querySelector('[data-a="later"]').onclick = function () { waitingReturn = false; afterGrant = null; m.close(); };
    m.el.querySelector('[data-a="open"]').onclick = function () {
      var S = sms();
      if (!S) return;
      waitingReturn = true;
      S.openAppSettings().catch(function (e) { waitingReturn = false; P.toast('Ouvrez Paramètres > Applications > PREJ Missions.', 5000); });
    };
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (waitingReturn) {
      waitingReturn = false;
      setTimeout(function () { requestSms().then(function (ok) { if (ok) smsDone(); else { guideAttempts++; showGuide(); } }); }, 400);
    } else if (P.refreshHome) P.refreshHome();
  });

  // ---------------------------------------------------------------- contenu des messages
  function fouilleBody(m) {
    return 'Décision(s) de fouille — OM ' + (m.numero || '-') + ' — ' + P.frDate(m.date) + '\n' +
      "Chef d'escorte : " + (m.chef || '-') + '\n' +
      'Personne(s) détenue(s) : ' + (m.fouilles.map(function (f) { return f.detenu || '?'; }).join(', ') || '-') + '\n' +
      '(PDF en pièce jointe)';
  }
  function retourBody(m) {
    var r = m.retour;
    return 'Fiche retour mission — OM ' + (m.numero || '-') + ' — ' + P.frDate(m.date) + '\n' +
      "Chef d'escorte : " + (m.chef || '-') + ' — Chauffeur : ' + (m.chauffeur || '-') + '\n' +
      'Service : ' + (r.priseService || '?') + ' → ' + (r.finService || '?') + (r.amplitude ? ' (' + r.amplitude + ')' : '') + '\n' +
      '(PDF en pièce jointe)';
  }

  function jobsFor(m) {
    var s = P.settings, jobs = [];
    if (m.fouilles.length) jobs.push({
      key: 'fouille', label: 'Décision' + (m.fouilles.length > 1 ? 's' : '') + ' de fouille (' + m.fouilles.length + ')',
      to: [s.fouilleEmail].filter(Boolean), subject: 'Décision de fouille - OM ' + (m.numero || ''),
      body: fouilleBody(m), build: function () { return P.buildFouillePdf(m); }
    });
    jobs.push({
      key: 'retour', label: 'Fiche retour mission', to: [s.retourEmail].filter(Boolean),
      subject: 'Fiche retour mission - OM ' + (m.numero || ''), body: retourBody(m),
      build: function () { return P.buildRetourPdf(m); }
    });
    jobs.push({
      key: 'carnet', label: 'Carnet de bord', to: [P.resp.email1, P.resp.email2].filter(Boolean),
      subject: ('Fiche mission ' + (m.carnet.plate || '') + (m.numero ? ' - ' + m.numero : '')).trim(),
      body: P.carnetBodyText(m), build: function () { return P.buildCarnetPdf(m); }
    });
    return jobs;
  }

  // ---------------------------------------------------------------- lancement
  P.sendMission = function (m) {
    if (P.sending) { P.toast('Envoi déjà en cours…'); return; }
    var jobs = jobsFor(m);
    var noDest = jobs.filter(function (j) { return !j.to.length || j.to.some(function (e) { return !P.isAllowedEmail(e); }); });
    if (noDest.length) {
      P.confirm('Destinataires à renseigner',
        '<p>Aucune adresse @justice.fr valide pour : <b>' + noDest.map(function (j) { return P.esc(j.label); }).join(', ') + '</b>.</p>' +
        '<p>Renseignez-les dans la roue dentée (le carnet de bord est dans « Paramètres responsable »).</p>',
        'Ouvrir les réglages', 'Plus tard').then(function (ok) { if (ok) P.go('#/reglages'); });
      return;
    }
    var st = P.status(m);
    var miss = [];
    [['fouille', 'Décision de fouille'], ['retour', 'Fiche retour mission'], ['carnet', 'Carnet de bord']].forEach(function (k) {
      if (st[k[0]].missing.length) miss.push('<li><b>' + k[1] + '</b> : ' + st[k[0]].missing.map(P.esc).join(' ; ') + '</li>');
    });
    var go = function () { run(m, jobs); };
    if (!miss.length) return confirmSend(m, jobs).then(function (ok) { if (ok) go(); });
    P.confirm('Documents incomplets', '<div class="missing">Il manque :<ul>' + miss.join('') + '</ul></div><p>Envoyer quand même ?</p>',
      'Envoyer quand même', 'Compléter').then(function (ok) { if (ok) go(); });
  };

  function confirmSend(m, jobs) {
    var list = jobs.map(function (j) { return '<li><b>' + P.esc(j.label) + '</b> → ' + P.esc(j.to.join(', ')) + '</li>'; }).join('');
    return P.confirm('Envoyer la mission ' + (m.numero || ''),
      '<p>Les PDF partent par MMS, sans ouvrir Messages :</p><ul style="padding-left:18px;font-size:14px">' + list + '</ul>',
      'Envoyer', 'Annuler');
  }

  function row(j) {
    return '<li data-k="' + j.key + '"><span class="st"><span class="spin"></span></span><div><b>' + P.esc(j.label) + '</b><small>En attente…</small></div></li>';
  }
  function setRow(el, k, state, text) {
    var li = el.querySelector('[data-k="' + k + '"]');
    if (!li) return;
    var st = li.querySelector('.st');
    st.className = 'st' + (state === 'ok' ? ' ok' : state === 'ko' ? ' ko' : '');
    st.innerHTML = state === 'ok' ? '✓' : state === 'ko' ? '✗' : '<span class="spin"></span>';
    li.querySelector('small').textContent = text;
  }

  function run(m, jobs) {
    P.sending = true;
    var dlg = P.modal('<h3>Envoi en cours</h3><p>Gardez l\'application ouverte et les données mobiles activées. Chaque MMS peut prendre jusqu\'à une minute.</p>' +
      '<ul class="progress-list">' + jobs.map(row).join('') + '</ul><div class="actions" id="sendActions" hidden></div>', { locked: true, focus: false });
    var el = dlg.el, results = [], native = !!sms();
    var chain = Promise.resolve();

    if (!native) {
      // Navigateur : on partage tous les PDF d'un coup
      chain = Promise.all(jobs.map(function (j) { return j.build(); })).then(function (docs) {
        var files = docs.map(function (d) { return new File([d.blob], d.name, { type: 'application/pdf' }); });
        jobs.forEach(function (j, i) { j.doc = docs[i]; setRow(el, j.key, 'ok', 'PDF prêt'); });
        if (navigator.canShare && navigator.canShare({ files: files })) return navigator.share({ files: files, title: 'Mission ' + (m.numero || '') });
        docs.forEach(function (d) { var a = document.createElement('a'); a.href = URL.createObjectURL(d.blob); a.download = d.name; a.click(); });
      }).then(function () {
        jobs.forEach(function (j) { results.push({ job: j, ok: true, info: 'Partagé manuellement' }); });
      }).catch(function (e) {
        jobs.forEach(function (j) { results.push({ job: j, ok: false, info: String((e && e.message) || e) }); setRow(el, j.key, 'ko', 'Non partagé'); });
      });
    } else {
      jobs.forEach(function (j) {
        chain = chain.then(function () {
          setRow(el, j.key, 'run', 'Création du PDF…');
          return j.build();
        }).then(function (doc) {
          j.doc = doc;
          setRow(el, j.key, 'run', 'Envoi du MMS à ' + j.to.join(', ') + '…');
          return P.blobToBase64(doc.blob).then(function (b64) {
            return sms().sendMms({ to: j.to, subject: j.subject, body: j.body, attachments: [{ name: doc.name, data: b64 }] });
          });
        }).then(function (res) {
          var rs = (res && res.results) || [];
          var bad = rs.filter(function (r) { return !r.ok; });
          var good = rs.filter(function (r) { return r.ok; });
          results.push({ job: j, ok: !bad.length, results: rs, failedTo: bad.map(function (r) { return r.to; }),
            info: bad.length ? bad.map(function (r) { return r.to + ' — ' + (r.error || 'code ' + r.code); }).join(' ; ') : 'Envoyé à ' + good.map(function (r) { return r.to; }).join(', ') });
          setRow(el, j.key, bad.length ? 'ko' : 'ok', results[results.length - 1].info);
        }).catch(function (e) {
          if (e && e.code === 'PERMISSION_DENIED') throw e;
          var msg = String((e && (e.message || e.errorMessage)) || e);
          results.push({ job: j, ok: false, failedTo: j.to, info: msg });
          setRow(el, j.key, 'ko', msg);
        });
      });
    }

    chain.then(function () { finish(m, jobs, results, el, dlg); }).catch(function (e) {
      P.sending = false; dlg.close();
      if (e && e.code === 'PERMISSION_DENIED') { P.startSmsSetup(function () { P.sendMission(m); }); return; }
      P.toast('Envoi interrompu : ' + String((e && e.message) || e), 5000);
    });
  }

  function finish(m, jobs, results, el, dlg) {
    P.sending = false;
    var when = new Date().toISOString();
    addLog(results.map(function (r) { return { at: when, om: m.numero, doc: r.job.label, to: r.job.to.join(', '), ok: r.ok, info: r.info }; }));
    m.sendLog = (m.sendLog || []).concat(results.map(function (r) { return { at: when, doc: r.job.key, ok: r.ok, info: r.info }; }));
    var allOk = results.length && results.every(function (r) { return r.ok; });
    if (allOk) m.sentAt = when;
    P.saveMissions();

    el.querySelector('h3').textContent = allOk ? 'Mission envoyée' : 'Envoi incomplet';
    el.querySelector('p').textContent = allOk ? 'Tous les documents sont partis.' : 'Certains documents ne sont pas partis. Vous pouvez les envoyer à la main.';
    var act = el.querySelector('#sendActions');
    var failed = results.filter(function (r) { return !r.ok && r.job.doc; });
    act.innerHTML = failed.map(function (r, i) {
      return '<button class="btn" data-msg="' + i + '">Messages : ' + P.esc(r.job.label) + '</button>' +
        '<button class="btn" data-share="' + i + '">Partager : ' + P.esc(r.job.label) + '</button>';
    }).join('') + '<button class="btn btn-primary" data-a="close">Fermer</button>';
    act.hidden = false;
    act.querySelector('[data-a="close"]').onclick = function () { dlg.close(); if (P.refreshHome) P.refreshHome(); };
    P.$$('[data-share]', act).forEach(function (b) {
      b.onclick = function () { var r = failed[Number(b.getAttribute('data-share'))]; P.shareFile(r.job.doc.blob, r.job.doc.name, r.job.label); };
    });
    P.$$('[data-msg]', act).forEach(function (b) {
      b.onclick = function () {
        var r = failed[Number(b.getAttribute('data-msg'))];
        var to = (r.failedTo && r.failedTo.length ? r.failedTo : r.job.to)[0];
        P.blobToBase64(r.job.doc.blob).then(function (b64) {
          return sms().composeSms({ to: to, body: r.job.body, attachments: [{ name: r.job.doc.name, data: b64 }] });
        }).then(function () { P.toast('Adresse copiée : collez-la dans « À » si besoin.', 4000); })
          .catch(function (e) { P.toast('Ouverture de Messages impossible : ' + String((e && e.message) || e), 5000); });
      };
    });
  }
})();
