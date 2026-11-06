(function () {
  'use strict';

  var ICON = {
    shipped: '<path d="M5 12l5 5 9-10"/>',
    reverted: '<path d="M4 10h11a5 5 0 0 1 0 10H9"/><path d="M8 6l-4 4 4 4"/>',
    base: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
    running: ''
  };
  var DOT = { shipped: 'ok', reverted: 'reverted', base: 'base', running: 'running' };
  var CHECK_NAMES = {
    build: 'Build', start: 'Start', smoke: 'Smoke-Test', endpoints: 'Endpunkte', characterisation: 'Tests',
    'lighthouse-perf': 'Lighthouse', 'lighthouse-a11y': 'Barrierefreiheit', cls: 'CLS',
    'main-content-top': 'Hauptinhalt mobil', 'controls-above': 'Bedienelemente oben', 'page-bytes': 'Seitengröße'
  };

  var st = { run: null, runKey: '', details: {}, round: null, tab: 'live', view: 'desktop', overlay: false, previews: {} };
  var timer = null;
  var nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  function h(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v; // static markup only, never data
      else if (k === 'cls') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svgIcon(inner) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ['width:16', 'height:16', 'viewBox:0 0 24 24', 'fill:none', 'stroke:currentColor', 'stroke-width:2', 'aria-hidden:true'].forEach(function (a) { var i = a.indexOf(':'); n.setAttribute(a.slice(0, i), a.slice(i + 1)); });
    n.innerHTML = inner; // static markup
    return n;
  }
  var lighthouseDrop = function () { var t = st.run && st.run.thresholds; return Math.abs(t && t.lighthousePerf != null ? t.lighthousePerf : 5); };
  var isBackend = function () { return !!(st.run && st.run.app && st.run.app.kind === 'backend'); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var pad = function (n) { return String(n).padStart(3, '0'); };
  var signed = function (d) { return (d > 0 ? '+' : '−') + nf.format(Math.abs(d)); };
  var tokenSum = function (t) {
    if (typeof t === 'number') return t;
    return t ? (t.input || 0) + (t.output || 0) + (t.cacheWrite || 0) + (t.cacheRead || 0) : 0;
  };
  function fmtTokens(n) { return n >= 1e5 ? nf.format(n / 1e6) + ' Mio.' : n.toLocaleString('de-DE'); }
  function fmtTime(iso) {
    var d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }
  function minutes(a, b) {
    var ms = new Date(b) - new Date(a);
    return isNaN(ms) ? null : Math.max(1, Math.round(ms / 60000));
  }
  function modelName(id) {
    var m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id);
    return m ? m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + '.' + m[3] : id;
  }
  function getJson(url, opts) {
    return fetch(url, opts).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); });
  }

  // ---- data helpers ----
  // a running round has no summary yet, so it lands in the block after the last finished round (or the open one)
  function rounds() {
    var out = [], prev = 0;
    ((st.run && st.run.rounds) || []).forEach(function (r) {
      var b = r.block;
      if (b == null) {
        var cnt = out.filter(function (x) { return x.block === prev; }).length;
        b = prev === 0 || cnt >= st.run.roundsPerBlock ? prev + 1 : prev;
      }
      out.push(Object.assign({}, r, { block: b }));
      prev = b;
    });
    return out;
  }
  var roundOf = function (n) { return rounds().filter(function (r) { return r.round === n; })[0]; };
  function previousOf(n) {
    var l = rounds().filter(function (r) { return r.round < n && (r.status === 'shipped' || r.status === 'base'); });
    return l[l.length - 1];
  }
  var cur = function () { var e = st.details[st.round]; return e && e.json; };
  function titleOf(r) { return r.round === 0 ? 'Ausgangslage' : r.title || 'Runde ' + r.round + (r.status === 'running' ? ' läuft' : ''); }

  // ---- header and KPIs ----
  function renderTop() {
    var run = st.run, rs = rounds(), running = rs.filter(function (r) { return r.status === 'running'; })[0];
    var crumbs = $('#crumbs');
    crumbs.textContent = '';
    crumbs.appendChild(h('b', { text: 'Lauf „' + run.run + '“' }));
    crumbs.appendChild(h('span', { cls: 'badge', 'data-variant': 'outline', text: run.mode }));
    var live = $('#live');
    live.hidden = !running;
    live.className = running ? 'live muted' : 'muted';
    if (running) live.textContent = 'Runde ' + running.round + ' baut gerade';
    var last = running || rs[rs.length - 1];
    var finished = rs.filter(function (r) { return r.status === 'shipped' || r.status === 'reverted'; }).length;
    $('#state').textContent = running ? 'läuft' : finished && finished >= run.blocks * run.roundsPerBlock ? 'fertig' : 'pausiert';
    $('#blockinfo').textContent = last && last.block ? 'Block ' + last.block + ' von ' + run.blocks : '';
  }

  function renderKpis() {
    var run = st.run, rs = rounds(), u = run.usage;
    var shipped = rs.filter(function (r) { return r.status === 'shipped'; }).length;
    var reverted = rs.filter(function (r) { return r.status === 'reverted'; }).length;
    var base = rs.filter(function (r) { return r.round === 0 && r.lighthouse != null; })[0];
    var measured = rs.filter(function (r) { return r.status !== 'running' && r.lighthouse != null; });
    var latest = measured[measured.length - 1];
    var total = u ? tokenSum(u.total) : 0;
    var cache = u && u.total && typeof u.total === 'object' && total ? Math.round(100 * (u.total.cacheRead || 0) / total) : null;
    var kpi = function (label, value, hint) {
      return h('div', { cls: 'kpi' }, [h('p', { cls: 'label', text: label }), h('p', { cls: 'value num', text: value }), h('p', { cls: 'hint', text: hint })]);
    };
    var root = $('#kpis');
    root.textContent = '';
    root.appendChild(kpi('Runden', (shipped + reverted) + ' / ' + run.blocks * run.roundsPerBlock, shipped + ' ausgeliefert' + (reverted ? ', ' + reverted + ' zurückgedreht' : '')));
    root.appendChild(kpi('Tokens', u ? fmtTokens(total) : '–', cache != null ? 'davon ' + cache + ' % aus dem Cache' : 'noch nicht gemessen'));
    root.appendChild(kpi('Kosten', u && u.cost != null ? '≈ ' + new Intl.NumberFormat('de-DE', { maximumFractionDigits: u.cost < 10 ? 2 : 0 }).format(u.cost) + ' €' : '–',
      u && u.unpriced && u.unpriced.length ? 'Schätzung, ohne Preis: ' + u.unpriced.join(', ') : 'Schätzung, Preise anpassbar'));
    root.appendChild(kpi('Lighthouse', latest ? String(latest.lighthouse) : '–',
      base ? 'Runde 0: ' + base.lighthouse + ', Grenze ' + (base.lighthouse - lighthouseDrop()) : 'Runde 0 noch nicht gemessen'));
    root.appendChild(modelsKpi(u));
  }

  function modelsKpi(u) {
    var box = h('div', { cls: 'kpi models' }, [h('p', { cls: 'label', text: 'Verbrauch nach Modell' })]);
    var entries = u && u.byModel ? Object.keys(u.byModel).map(function (m) { return [m, tokenSum(u.byModel[m])]; }).filter(function (e) { return e[1] > 0; }) : [];
    var sum = entries.reduce(function (a, e) { return a + e[1]; }, 0);
    if (!sum) { box.appendChild(h('p', { cls: 'hint', text: 'Noch kein Verbrauch erfasst.' })); return box; }
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var stack = h('div', { cls: 'stack', role: 'img' }), legend = h('ul', { cls: 'legend' }), alt = [];
    entries.forEach(function (e, i) {
      var pct = Math.round(100 * e[1] / sum), c = 'var(--m' + (i % 3 + 1) + ')';
      stack.appendChild(h('span', { style: '--c: ' + c + '; flex: ' + e[1] }));
      legend.appendChild(h('li', { style: '--c: ' + c }, [h('b', { text: modelName(e[0]) }), ' ' + pct + ' %']));
      alt.push(modelName(e[0]) + ' ' + pct + ' Prozent');
    });
    stack.setAttribute('aria-label', alt.join(', '));
    box.appendChild(stack);
    box.appendChild(legend);
    return box;
  }

  // ---- timeline ----
  function renderNav() {
    var nav = $('#rounds'), rs = rounds();
    nav.textContent = '';
    var maxBlock = rs.reduce(function (m, r) { return Math.max(m, r.block); }, st.run.blocks);
    for (var b = 0; b <= maxBlock; b++) {
      var inBlock = rs.filter(function (r) { return r.block === b; });
      var head = h('h3', null, [h('span', { text: b ? 'Block ' + b : 'Ausgangslage' }), h('span', { cls: 'num' })]);
      if (b) head.lastChild.textContent = inBlock.length ? inBlock.filter(function (r) { return r.status === 'shipped'; }).length + ' ausgeliefert' : 'noch offen';
      nav.appendChild(head);
      var group = h('div', { cls: 'block' });
      inBlock.forEach(function (r) {
        var btn = h('button', { type: 'button', cls: 'round', 'data-round': r.round,
          'aria-current': String(r.round === st.round),
          'aria-label': 'Runde ' + r.round + ': ' + titleOf(r) + (r.status === 'reverted' ? ', zurückgedreht' : '') }, [
          h('span', { cls: 'dot ' + DOT[r.status], html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[r.status] + '</svg>' }),
          h('span', null, [h('span', { cls: 't', text: titleOf(r) }),
            h('span', { cls: 'sub', text: r.tidy ? 'Aufräumrunde' : r.status === 'reverted' ? 'zurückgedreht' : r.status === 'running' ? 'läuft' : fmtTime(r.time) })]),
          h('span', { cls: 'no num', text: 'r' + pad(r.round) })]);
        group.appendChild(btn);
      });
      nav.appendChild(group);
    }
  }

  // ---- selected round ----
  function chip(c, soft) {
    var v = c.value, d = c.delta;
    if (v === 'ok') v = '✓'; else if (v === 'failed') v = '✗';
    else if (typeof v === 'number') {
      if (c.name === 'main-content-top' || c.name === 'controls-above') v = nf.format(v) + ' px';
      else if (c.name === 'page-bytes') { v = Math.round(v / 1024) + ' kB'; d = typeof d === 'number' ? Math.round(d / 1024) : d; }
      else v = nf.format(v);
    }
    var cls = c.pass ? 'ok' : soft ? 'warn' : 'fail';
    var el = h('span', { cls: 'check ' + cls, title: c.detail || null }, [h('span', { text: CHECK_NAMES[c.name] || c.name }), h('b', { cls: 'num', text: String(v) })]);
    if (typeof d === 'number' && d !== 0) el.appendChild(h('small', { cls: 'num', text: signed(d) + ' zu Runde 0' }));
    return el;
  }

  function metaNode(r, s) {
    var meta = h('div', { cls: 'meta' }, [h('span', { cls: 'badge', 'data-variant': 'secondary', text: 'Runde ' + r.round + (r.block ? ' · Block ' + r.block : '') })]);
    if (s && s.tidy) meta.appendChild(h('span', { cls: 'badge', 'data-variant': 'outline', text: 'Aufräumrunde' }));
    ((s && s.compass) || []).forEach(function (c) { meta.appendChild(h('span', { cls: 'badge', 'data-variant': 'outline', text: '✓ ' + c })); });
    return meta;
  }

  // the parts that depend on the run list, refreshed in place so the preview iframe keeps playing
  function updateRunParts() {
    var r = roundOf(st.round), d = cur(), meta = $('#main .head .meta'), card = $('#main .trend > section');
    if (!r || !d) return;
    if (meta) meta.replaceWith(metaNode(r, d.summary));
    if (card) { card.textContent = ''; card.appendChild(trend(r.round)); }
    var cap = $('#main .trend > header p');
    if (cap) cap.textContent = 'Gestrichelt: Grenze (Runde 0 minus ' + lighthouseDrop() + ')';
  }

  function renderMain() {
    var main = $('#main'), d = cur(), r = roundOf(st.round);
    if (!r) { main.textContent = ''; main.appendChild(h('p', { cls: 'state', text: 'Noch keine Runden.' })); return; }
    if (!d) { main.textContent = ''; main.appendChild(h('p', { cls: 'state', text: 'Lade …' })); return; }
    var s = d.summary, status = d.status;
    var why = s ? s.why : status === 'base' ? 'Scan, Messwerte und Screenshots, an denen alles Spätere gemessen wird.' : 'Der Runden-Agent baut gerade. Das Dashboard zeigt den Stand, sobald die Runde ausgeliefert ist.';
    main.textContent = '';
    main.appendChild(h('section', { cls: 'head' }, [metaNode(r, s), h('h1', { text: titleOf(r) }), h('p', { cls: 'why', text: why })]));
    if (status === 'reverted') {
      main.appendChild(h('div', { cls: 'alert', 'data-variant': 'destructive' }, [
        svgIcon(ICON.reverted),
        h('h2', { text: 'Zurückgedreht' }), h('section', { text: (s && s.revertReason) || 'Kein Grund angegeben.' })]));
    }
    var g = d.guardrails || (s && s.guardrails);
    var checks = h('div', { cls: 'checks', 'aria-label': 'Leitplanken' });
    if (g) {
      (g.hard || []).forEach(function (c) { checks.appendChild(chip(c, false)); });
      (g.soft || []).forEach(function (c) { checks.appendChild(chip(c, true)); });
    }
    main.appendChild(checks);
    main.appendChild(h('section', { cls: 'card viewer', html:
      '<header><div class="tabs"><nav role="tablist" aria-orientation="horizontal">' +
      '<button type="button" role="tab" data-tab="live">Vorschau</button><button type="button" role="tab" data-tab="compare">Vorher / nachher</button><button type="button" role="tab" data-tab="files">Dateien</button></nav></div>' +
      '<div class="view-tools"><div class="button-group" role="group" aria-label="Breite"><button type="button" class="btn" data-variant="outline" data-size="sm" data-view="desktop">Desktop</button><button type="button" class="btn" data-variant="outline" data-size="sm" data-view="mobile">390 px</button></div>' +
      '<label><input type="checkbox" role="switch" class="input" data-overlay>Änderungen zeigen</label><span class="hint-inline" data-overlay-hint></span></div></header><section class="panel"></section>' }));
    var facts = h('dl', { cls: 'facts num' });
    var dur = s && s.startedAt && s.endedAt ? minutes(s.startedAt, s.endedAt) + ' min' : status === 'running' && d.start && d.start.at ? 'seit ' + minutes(d.start.at, Date.now()) + ' min' : '–';
    [['Tokens', d.usage ? fmtTokens(tokenSum(d.usage.total)) + (status === 'running' ? ' bisher' : '') : '–'], ['Modell', (s && s.model) || '–'], ['Dauer', dur], ['Tag', (s && s.tag) || '–']].forEach(function (p) {
      facts.appendChild(h('dt', { text: p[0] }));
      facts.appendChild(h('dd', { text: p[1] }));
    });
    main.appendChild(h('div', { cls: 'lower' }, [
      h('section', { cls: 'card' }, [h('header', null, [h('h2', { text: 'Diese Runde' })]), h('section', null, [facts])]),
      h('section', { cls: 'card trend' }, [h('header', null, [h('h2', { text: 'Lighthouse je Runde' }), h('p', { text: 'Gestrichelt: Grenze (Runde 0 minus ' + lighthouseDrop() + ')' })]), h('section', null, [trend(r.round)])])]));
    renderPanel();
  }

  function trend(selected) {
    var pts = rounds().filter(function (r) { return r.status !== 'running'; });
    var base = pts.filter(function (r) { return r.round === 0 && r.lighthouse != null; })[0];
    var vals = pts.map(function (r) { return r.lighthouse == null ? null : Number(r.lighthouse); }).filter(function (v) { return v != null; });
    if (!vals.length) return h('p', { cls: 'muted', text: 'Noch keine Messwerte.' });
    var limit = base ? Number(base.lighthouse) - lighthouseDrop() : null;
    var lo = Math.max(0, Math.floor((Math.min.apply(null, vals.concat(limit == null ? [] : [limit])) - 3) / 5) * 5);
    var W = 320, H = 110, x0 = 26;
    var y = function (v) { return 10 + (100 - v) / (100 - lo) * 80; };
    var step = pts.length > 1 ? (W - x0 - 8) / (pts.length - 1) : 0;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Lighthouse-Wert je Runde">';
    [100, Math.round((100 + lo) / 2), lo].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (v) {
      s += '<line class="grid" x1="' + x0 + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="0" y="' + (y(v) + 4) + '">' + v + '</text>';
    });
    if (limit != null) s += '<line class="limit" x1="' + x0 + '" x2="' + W + '" y1="' + y(limit) + '" y2="' + y(limit) + '"/>';
    var line = [], dots = '', last = null;
    pts.forEach(function (r, i) {
      var cx = x0 + i * step, v = r.lighthouse != null ? Number(r.lighthouse) : last;
      if (r.lighthouse != null) { line.push(cx + ',' + y(v)); last = v; }
      if (v != null && (r.lighthouse != null || r.status === 'reverted')) {
        dots += '<circle class="' + (r.lighthouse != null ? '' : 'gone ') + (r.round === selected ? 'sel' : '') + '" cx="' + cx + '" cy="' + y(v) + '" r="4"><title>Runde ' + r.round + ': ' + (r.lighthouse != null ? r.lighthouse : 'zurückgedreht, nicht gemessen') + '</title></circle>';
      }
      dots += '<text x="' + (cx - 6) + '" y="' + (H - 2) + '">r' + r.round + '</text>';
    });
    s += '<polyline class="line" points="' + line.join(' ') + '"/>' + dots + '</svg>';
    return h('div', { html: s }); // numbers only
  }

  // ---- viewer ----
  var shotUrl = function (n, file) { return '/files/rounds/' + n + '/shots/' + encodeURIComponent(file); };
  var viewShots = function (d) {
    var all = d.shots.filter(function (f) { return /\.png$/.test(f); });
    var own = all.filter(function (f) { return f.endsWith('-' + st.view + '.png'); });
    return own.length ? own : all;
  };
  var diffEntry = function (d, file) { return d.diffs.filter(function (x) { return x.file === file; })[0]; };

  function addBox(shot, img, entry) {
    if (!entry || !entry.box) return;
    var marks = h('div', { cls: 'marks' });
    shot.appendChild(marks);
    var draw = function () {
      var w = img.naturalWidth, hh = img.naturalHeight, b = entry.box;
      if (!w) return;
      var m = h('div', { cls: 'mark', style: 'left:' + 100 * b.x / w + '%;top:' + 100 * b.y / hh + '%;width:' + 100 * b.w / w + '%;height:' + 100 * b.h / hh + '%' });
      m.appendChild(h('span', { text: nf.format(entry.changedPixels) + ' px geändert' }));
      marks.appendChild(m);
    };
    if (img.complete) draw(); else img.addEventListener('load', draw);
  }

  function shotFigure(n, file, caption, entry) {
    var img = h('img', { src: shotUrl(n, file), alt: caption + ' (' + file + ')' });
    var shot = h('div', { cls: 'shot' }, [img]);
    var fig = h('figure', null, [h('figcaption', { text: caption }), shot]);
    img.addEventListener('error', function () { shot.replaceWith(h('p', { cls: 'empty muted', text: 'Kein Screenshot vorhanden.' })); });
    addBox(shot, img, entry);
    return fig;
  }

  function stage(kids) {
    return h('div', { cls: 'stage' + (st.view === 'mobile' ? ' mobile' : '') + (st.overlay ? ' show-overlay' : '') }, kids);
  }

  function shotsPanel(d) {
    var files = viewShots(d);
    if (!files.length) return h('p', { cls: 'state', text: 'Keine Screenshots vorhanden.' });
    return stage([h('div', { cls: 'shots' }, files.map(function (f) { return shotFigure(st.round, f, f.replace(/\.png$/, ''), diffEntry(d, f)); }))]);
  }

  function filesTable(d) {
    var files = (d.summary && d.summary.files) || [];
    var tbody = h('tbody');
    if (!files.length) tbody.appendChild(h('tr', null, [h('td', { colspan: 3, cls: 'muted', text: d.status === 'reverted' ? 'Keine, die Runde wurde zurückgedreht.' : 'Noch keine.' })]));
    files.forEach(function (f) {
      tbody.appendChild(h('tr', null, [h('td', { text: f.path }), h('td', { cls: 'num plus', text: '+' + f.added }), h('td', { cls: 'num minus', text: '−' + f.removed })]));
    });
    return h('div', { cls: 'table-container' }, [h('table', { cls: 'table diff' }, [
      h('thead', null, [h('tr', null, [h('th', { text: 'Datei' }), h('th', { cls: 'num', text: 'hinzu' }), h('th', { cls: 'num', text: 'weg' })])]), tbody])]);
  }

  function backendPanel(d) {
    var eps = (d.metrics && d.metrics.endpoints) || [];
    var body = h('tbody');
    if (!eps.length) body.appendChild(h('tr', null, [h('td', { colspan: 3, cls: 'muted', text: 'Keine Endpunkte gemessen.' })]));
    eps.forEach(function (e) {
      body.appendChild(h('tr', null, [h('td', { text: e.method || 'GET' }), h('td', { text: e.path }), h('td', { cls: 'num', text: String(e.status) })]));
    });
    return h('div', { cls: 'state-box' }, [
      h('p', { cls: 'muted', text: 'Backend: keine Vorschau, dafür die Endpunkte dieser Runde und ihre geänderten Dateien.' }),
      h('div', { cls: 'table-container' }, [h('table', { cls: 'table' }, [h('thead', null, [h('tr', null, [h('th', { text: 'Methode' }), h('th', { text: 'Endpunkt' }), h('th', { cls: 'num', text: 'Status' })])]), body])]),
      filesTable(d)]);
  }

  function livePanel(d) {
    var n = st.round;
    if (d.status === 'running') return h('p', { cls: 'state', text: 'Die Runde läuft noch. Eine Vorschau gibt es, sobald sie ausgeliefert ist.' });
    if (d.status === 'reverted') return h('div', null, [h('p', { cls: 'muted', text: 'Keine Vorschau, die Runde wurde zurückgedreht. Ihre Screenshots:' }), shotsPanel(d)]);
    if (isBackend()) return backendPanel(d);
    var p = st.previews[n];
    if (!p) { startPreview(n); return h('p', { cls: 'state', text: 'Vorschau startet …' }); }
    if (p.pending) return h('p', { cls: 'state', text: 'Vorschau startet …' });
    if (p.error) {
      var retry = h('button', { type: 'button', cls: 'btn', 'data-variant': 'outline', 'data-size': 'sm', 'data-retry': n, text: 'Erneut versuchen' });
      return h('div', null, [h('div', { cls: 'alert' }, [h('h2', { text: 'Keine Vorschau' }), h('section', { text: p.error })]), h('p', null, [retry]), shotsPanel(d)]);
    }
    if (p.fallback) return backendPanel(d);
    if (st.overlay && d.diffs.some(function (x) { return x.box; })) {
      return h('div', null, [h('p', { cls: 'hint-inline', text: 'Markierungen auf dem Screenshot' }), shotsPanel(d)]);
    }
    var frame = h('div', { cls: 'frame' }, [h('iframe', { src: p.url, title: 'Vorschau Runde ' + n })]);
    var s = d.summary;
    return h('div', { cls: 'browser' }, [
      h('div', { cls: 'browser-bar' }, [h('i'), h('i'), h('i'), h('span', { cls: 'url', text: p.url }), h('span', { cls: 'tag', text: s && s.tag ? 'Tag ' + s.tag : '' })]),
      stage([frame])]);
  }

  function comparePanel(d) {
    var prev = previousOf(st.round);
    if (!prev) return h('p', { cls: 'state', text: 'Keine Runde davor, mit der sich vergleichen ließe.' });
    var files = viewShots(d);
    if (!files.length) return h('p', { cls: 'state', text: 'Keine Screenshots vorhanden.' });
    return stage([h('div', { cls: 'pairs' }, files.map(function (f) {
      var before = shotFigure(prev.round, f, 'Vorher: Runde ' + prev.round, null);
      return h('div', { cls: 'compare' }, [before, shotFigure(st.round, f, 'Nachher: Runde ' + st.round, diffEntry(d, f))]);
    }))]);
  }

  function renderPanel() {
    var d = cur(), panel = $('.panel');
    if (!d || !panel) return;
    document.querySelectorAll('[role=tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === st.tab)); });
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === st.view)); });
    var sw = $('[data-overlay]'), hasDiff = d.diffs.some(function (x) { return x.box; });
    sw.checked = st.overlay && hasDiff;
    sw.disabled = !hasDiff;
    $('[data-overlay-hint]').textContent = hasDiff ? '' : d.diffs.length ? 'Keine Änderungen gefunden' : 'Kein Vergleich vorhanden';
    panel.textContent = '';
    panel.appendChild(st.tab === 'files' ? filesTable(d) : st.tab === 'compare' ? comparePanel(d) : livePanel(d));
    panel.querySelectorAll('.stage').forEach(function (s) { s.classList.toggle('show-overlay', st.overlay && hasDiff); });
  }

  function startPreview(n) {
    st.previews[n] = { pending: true };
    getJson('/api/rounds/' + n + '/start', { method: 'POST' }).then(function (r) {
      st.previews[n] = r.ok && r.json.url ? r.json : { error: r.json.error || 'Die Vorschau konnte nicht gestartet werden.' };
    }, function (e) {
      st.previews[n] = { error: e.message };
    }).then(function () {
      if (st.round === n && st.tab === 'live') renderPanel();
    });
  }

  // ---- loading ----
  function loadDetail(n) {
    return getJson('/api/rounds/' + n).then(function (r) {
      if (!r.ok) return false;
      var key = JSON.stringify(r.json), old = st.details[n];
      st.details[n] = { key: key, json: r.json };
      return !old || old.key !== key;
    });
  }

  function select(n) {
    st.round = n;
    renderNav();
    renderMain(); // the cache may render first
    loadDetail(n).then(function (changed) { if (st.round === n && changed) renderMain(); });
  }

  function refresh() {
    clearTimeout(timer);
    return getJson('/api/run').then(function (res) {
      if (!res.ok) throw new Error(res.json.error || 'Fehler');
      var key = JSON.stringify(res.json), changed = key !== st.runKey;
      st.run = res.json;
      st.runKey = key;
      var rs = rounds();
      if (st.round == null || !roundOf(st.round)) {
        var done = rs.filter(function (r) { return r.status !== 'running'; });
        st.round = (done.length ? done[done.length - 1] : rs[rs.length - 1] || { round: null }).round;
        changed = true;
      }
      if (changed) { renderTop(); renderKpis(); renderNav(); }
      if (st.round == null) return renderMain();
      var n = st.round;
      return loadDetail(n).then(function (diff) {
        if (st.round !== n) return;
        if (diff || !$('#main h1')) renderMain(); else if (changed) updateRunParts();
      });
    }).catch(function (e) {
      if (!st.run) { $('#main').textContent = ''; $('#main').appendChild(h('p', { cls: 'state', text: 'Der Server antwortet nicht (' + e.message + '). Neuer Versuch in 5 s …' })); }
    }).then(function () {
      if (!st.run || st.run.state === 'running') timer = setTimeout(refresh, 5000);
    });
  }

  document.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-round]'))) select(+t.dataset.round);
    else if ((t = e.target.closest('[data-tab]'))) { st.tab = t.dataset.tab; renderPanel(); }
    else if ((t = e.target.closest('[data-view]'))) { st.view = t.dataset.view; renderPanel(); }
    else if ((t = e.target.closest('[data-retry]'))) { delete st.previews[+t.dataset.retry]; renderPanel(); }
    else if (e.target.closest('[data-theme-toggle]')) {
      var dark = document.documentElement.classList.toggle('dark');
      try { localStorage.setItem('evolve-theme', dark ? 'dark' : 'light'); } catch (err) { /* storage blocked */ }
    }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-overlay]')) return;
    st.overlay = e.target.checked;
    if (st.tab === 'live') renderPanel();
    else document.querySelectorAll('.panel .stage').forEach(function (s) { s.classList.toggle('show-overlay', st.overlay); });
  });

  refresh();
})();
