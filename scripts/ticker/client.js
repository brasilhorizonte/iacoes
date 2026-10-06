/* Script cliente das páginas de ticker (embutido inline no build).
   Depende de: window.__TK (dados da página) e _iaTrack/_iaB/_iaK (script de tracking no <head>).
   ES5 de propósito: roda em in-app browsers antigos (Instagram/WhatsApp). */
(function () {
  var TK = window.__TK || {};
  var price = TK.price || 0;

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { d = d == null ? 2 : d; return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function brl(n) { return 'R$ ' + fmt(n); }
  function spct(n) { return (n > 0 ? '+' : '') + fmt(n * 100, 1) + '%'; }
  function val(id) { var el = $(id); return el ? parseFloat(el.value) : NaN; }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? parseFloat(el.getAttribute('data-avg')) : 0; }

  var BADGE = {
    positive: 'border-transparent bg-positive/12 text-positive',
    negative: 'border-transparent bg-negative/12 text-negative',
    neutral: 'border-transparent bg-muted text-muted-foreground'
  };
  var BADGE_BASE = 'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 font-mono tnum ';

  function setBadge(el, fv, extra) {
    if (!el) return;
    var t = fv > 0 ? (fv >= price ? 'positive' : 'negative') : 'neutral';
    el.className = BADGE_BASE + BADGE[t] + (extra ? ' ' + extra : '');
    el.textContent = fv > 0 ? spct(fv / price - 1) : 'n/a';
  }

  // --- Sliders: preenchimento do track + saída formatada ---
  function paint(el) {
    var min = parseFloat(el.min), max = parseFloat(el.max), v = parseFloat(el.value);
    el.style.setProperty('--pct', ((v - min) / (max - min) * 100).toFixed(1) + '%');
    var out = $(el.id + '-out');
    if (out) out.textContent = fmt(v, parseFloat(el.step) < 1 ? 1 : 0) + (el.getAttribute('data-suffix') || '');
  }

  // --- Calculadoras ---
  var res = { graham: 0, bazin: 0, gordon: 0 };

  function show(id, fv, na) {
    res[id] = fv > 0 && isFinite(fv) ? fv : 0;
    var f = $(id + '-fv'), n = $(id + '-note');
    if (f) f.textContent = res[id] > 0 ? brl(res[id]) : '—';
    if (n) {
      n.textContent = res[id] > 0 ? 'vs. cotação de ' + brl(price) : na;
    }
    setBadge($(id + '-upside'), res[id]);
  }

  function calc() {
    var lpa = TK.lpa, vpa = TK.vpa;
    var g = (lpa > 0 && vpa > 0) ? Math.sqrt(val('graham-pl') * val('graham-pvp') * lpa * vpa) * (1 - val('graham-margin') / 100) : 0;
    show('graham', g, 'Não se aplica: LPA ou VPA negativo.');

    var dy = val('bazin-dy') / 100, db = radio('bazin-win');
    show('bazin', db > 0 && dy > 0 ? db / dy : 0, 'Sem dividendos na janela escolhida.');

    var r = val('gordon-r') / 100, gr = val('gordon-g') / 100, d0 = radio('gordon-win');
    var gv = (d0 > 0 && r > gr) ? d0 * (1 + gr) / (r - gr) : 0;
    show('gordon', gv, d0 <= 0 ? 'Sem dividendos na janela escolhida.' : 'A taxa de desconto precisa ser maior que o crescimento.');

    summary();
  }

  function summary() {
    var ids = ['graham', 'bazin', 'gordon'], vals = [], i;
    var scale = price * 1.5;
    for (i = 0; i < ids.length; i++) { if (res[ids[i]] > scale) scale = res[ids[i]]; }
    scale *= 1.08;
    for (i = 0; i < ids.length; i++) {
      var v = res[ids[i]], bar = $('sum-' + ids[i] + '-bar'), lab = $('sum-' + ids[i] + '-val');
      if (bar) {
        bar.style.width = Math.max(0, Math.min(100, v / scale * 100)).toFixed(1) + '%';
        bar.className = 'h-full rounded-md transition-[width] duration-300 ' + (v >= price ? 'bg-positive' : 'bg-negative/85');
      }
      if (lab) lab.textContent = v > 0 ? brl(v) : '—';
      if (v > 0) vals.push(v);
    }
    var line = $('sum-price-line');
    if (line) line.style.left = 'calc(5.5rem + (100% - 11rem) * ' + (price / scale).toFixed(4) + ')';
    var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
    var a = $('sum-avg');
    if (a) a.textContent = avg > 0 ? brl(avg) : '—';
    setBadge($('sum-avg-upside'), avg, 'text-sm');
  }

  var touched = false;
  var sliders = document.querySelectorAll('input.slider');
  for (var s = 0; s < sliders.length; s++) {
    (function (el) {
      paint(el);
      el.addEventListener('input', function () {
        paint(el); calc();
        if (!touched) { touched = true; try { _iaTrack('calc_interact'); } catch (e) {} }
      });
    })(sliders[s]);
  }
  var radios = document.querySelectorAll('input[name="bazin-win"],input[name="gordon-win"]');
  for (var q = 0; q < radios.length; q++) radios[q].addEventListener('change', calc);

  // --- Tabs (padrão shadcn; todo painel fica no DOM) ---
  var tabsRoots = document.querySelectorAll('[data-tabs]');
  for (var t = 0; t < tabsRoots.length; t++) {
    (function (root) {
      var triggers = root.querySelectorAll('[role="tab"]');
      function activate(v, focus) {
        for (var k = 0; k < triggers.length; k++) {
          var on = triggers[k].getAttribute('data-value') === v;
          triggers[k].setAttribute('aria-selected', on ? 'true' : 'false');
          triggers[k].setAttribute('data-state', on ? 'active' : 'inactive');
          triggers[k].tabIndex = on ? 0 : -1;
          if (on && focus) triggers[k].focus();
        }
        var panels = root.querySelectorAll('[role="tabpanel"]');
        for (var p = 0; p < panels.length; p++) {
          var show = panels[p].getAttribute('data-value') === v;
          panels[p].hidden = !show;
          panels[p].setAttribute('data-state', show ? 'active' : 'inactive');
        }
      }
      for (var k = 0; k < triggers.length; k++) {
        (function (btn, idx) {
          btn.tabIndex = btn.getAttribute('aria-selected') === 'true' ? 0 : -1;
          btn.addEventListener('click', function () { activate(btn.getAttribute('data-value')); });
          btn.addEventListener('keydown', function (e) {
            var n = e.key === 'ArrowRight' ? idx + 1 : e.key === 'ArrowLeft' ? idx - 1 : null;
            if (n === null) return;
            e.preventDefault();
            n = (n + triggers.length) % triggers.length;
            activate(triggers[n].getAttribute('data-value'), true);
          });
        })(triggers[k], k);
      }
    })(tabsRoots[t]);
  }

  // --- Busca de ticker (header) ---
  (function () {
    var input = $('ticker-search'), box = $('ticker-search-results');
    if (!input || !box) return;
    var list = null, hl = -1;
    function load() {
      if (list) return Promise.resolve(list);
      return fetch('/tickers.json').then(function (r) { return r.ok ? r.json() : []; })
        .then(function (d) { list = d || []; return list; })
        .catch(function () { list = []; return list; });
    }
    function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function close() { box.classList.add('hidden'); hl = -1; }
    function render(items) {
      hl = -1;
      if (!items.length) { box.innerHTML = '<div class="px-3 py-2.5 text-sm text-muted-foreground">Nenhuma ação encontrada</div>'; box.classList.remove('hidden'); return; }
      box.innerHTML = items.map(function (it) {
        return '<a role="option" href="/' + esc(it.ticker) + '/" data-t="' + esc(it.ticker) + '" class="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"><span class="font-mono font-bold">' + esc(it.ticker) + '</span><span class="truncate text-muted-foreground">' + esc(it.name) + '</span></a>';
      }).join('');
      box.classList.remove('hidden');
    }
    input.addEventListener('input', function () {
      var v = input.value.trim().toUpperCase();
      if (!v) { close(); return; }
      load().then(function (all) {
        render(all.filter(function (x) { return x.ticker.indexOf(v) === 0 || (x.name && x.name.toUpperCase().indexOf(v) >= 0); }).slice(0, 8));
      });
    });
    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('a');
      function mark() { for (var i = 0; i < items.length; i++) items[i].classList.toggle('bg-muted', i === hl); }
      if (e.key === 'ArrowDown') { e.preventDefault(); hl = Math.min(hl + 1, items.length - 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(hl - 1, 0); mark(); }
      else if (e.key === 'Escape') { close(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var tk = hl >= 0 && items[hl] ? items[hl].getAttribute('data-t') : input.value.trim().toUpperCase();
        if (tk) window.location.href = '/' + tk + '/';
      }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('[data-search]')) close(); });
  })();

  // --- Cotação ao vivo (mesma fonte do build; atualiza sem esperar o cron) ---
  (function () {
    if (typeof _iaB === 'undefined' || !TK.symbol) return;
    fetch(_iaB + '/rest/v1/brapi_quotes?select=regular_market_price,regular_market_change_percent,updated_at&symbol=eq.' + TK.symbol + '&limit=1', {
      headers: { apikey: _iaK, Authorization: 'Bearer ' + _iaK }
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d[0] || !d[0].regular_market_price) return;
      var p = Number(d[0].regular_market_price), c = Number(d[0].regular_market_change_percent || 0);
      var pe = $('live-price'), ce = $('live-change-day'), de = $('live-date');
      if (pe) pe.textContent = brl(p);
      if (ce) { ce.textContent = (c > 0 ? '+' : '') + fmt(c, 2) + '% hoje'; ce.className = 'font-mono text-sm font-semibold tnum ' + (c > 0 ? 'text-positive' : c < 0 ? 'text-negative' : 'text-muted-foreground'); }
      if (de && d[0].updated_at) { var dt = new Date(d[0].updated_at); de.textContent = 'Atualizado em ' + dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    }).catch(function () {});
  })();

  // --- Profundidade de scroll ---
  (function () {
    if (!window.IntersectionObserver || typeof _iaTrack !== 'function') return;
    var marks = { scroll_25: 'calculadoras', scroll_50: 'indicadores', scroll_75: 'demonstracoes', scroll_100: 'faq' }, seen = {};
    var ob = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var k = e.target.getAttribute('data-sm');
        if (e.isIntersecting && k && !seen[k]) { seen[k] = 1; _iaTrack(k); ob.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    Object.keys(marks).forEach(function (k) { var el = $(marks[k]); if (el) { el.setAttribute('data-sm', k); ob.observe(el); } });
  })();
})();
