/* Widget "calc" (SPEC §4; SPEC-v2 §C Calculadora, §E4–§E6): calculadora de preço justo e preço
   teto por Graham, Bazin e Gordon. Widget pesado: arquivo próprio no bundle
   (assets/js/ferramentas-calc.js), carregado só na página /ferramentas/calculadora-preco-justo/.

   DADO REAL do build: /valuations.json ({ _quoteDate, TICKER: { name, sector, price, graham, bazin,
   gordon, lpa, vpa, divTTM, avgDiv: { 1, 3, 5, 10 } } }). Com as premissas padrão do site, mostra
   os preços justos prontos do arquivo, que são os da página do ticker; ao mexer numa premissa,
   recalcula no navegador com as mesmas fórmulas da página do ticker (scripts/ticker/client.js):
     Graham = √(P/L máx × P/VP máx × LPA × VPA) × (1 − margem)   padrão 15 × 1,5 = 22,5 e margem 0
     Bazin  = média anual de proventos da janela ÷ DY mínimo     padrão janela de 5 anos e DY de 6%
     Gordon = D₀ × (1 + g) ÷ (r − g), D₀ = média da janela      padrão 5 anos, r 14%, g 4% (r > g)
   Modo "Digitar números": cotação, LPA, VPA e dividendo digitados, para qualquer empresa.
   Sem IA e sem número inventado: sem dado, "—" e o motivo.

   Página ('page'): ?t=TICKER pré-seleciona (o canonical da página não muda; a escolha regrava o
   ?t= com replaceState); a ação escolhida linka /TICKER/; os links da página para o app que
   apontam para a aba Preço justo (/ativo/T?tab=valuation&_=, SPEC §2) passam a levar o ticker
   escolhido. 'tile' (≈300×220): busca e os três números, sem premissas, sem mexer na URL.
   Movimento só para mostrar dado: as barras de comparação enchem com scaleX e a linha da cotação
   anda com translateX; com movimento reduzido, o CSS do runtime zera as transições. Nenhum laço
   de animação. Altura reservada no calc.css (sem CLS): a montagem só troca textos. */
(function () {
  var DEF = { pl: 15, pvp: 1.5, margin: 0, dy: 6, bw: '5', r: 14, g: 4, gw: '5' };
  var WINS = ['1', '3', '5', '10'];
  var TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;
  var DEFAULT_T = 'PETR4';
  var DATA_URL = '/valuations.json';
  var APP = 'https://app.brasilhorizonte.com.br/authnew';
  /* Nomes populares que não estão no nome registrado da empresa (busca por "petrobras" etc.). */
  var ALIASES = { PETROBRAS: 'PETR', MAGALU: 'MGLU', TAESA: 'TAEE', CEMIG: 'CMIG', COPEL: 'CPLE', COPASA: 'CSMG', VIVO: 'VIVT', ELETROBRAS: 'AXIA' };
  var METHODS = [
    { id: 'graham', name: 'Graham', kind: 'Preço justo', formula: '√(P/L × P/VP × LPA × VPA) × (1 − margem)' },
    { id: 'bazin', name: 'Bazin', kind: 'Preço teto', formula: 'média de proventos ÷ DY mínimo' },
    { id: 'gordon', name: 'Gordon', kind: 'Preço justo', formula: 'D₀ × (1 + g) ÷ (r − g)' }
  ];
  var SLIDERS = {
    graham: [
      { key: 'pl', label: 'P/L máximo', min: 8, max: 25, step: 0.5, unit: 'x', dec: 1 },
      { key: 'pvp', label: 'P/VP máximo', min: 0.5, max: 3, step: 0.1, unit: 'x', dec: 1 },
      { key: 'margin', label: 'Margem de segurança', min: 0, max: 50, step: 1, unit: '%', dec: 0 }
    ],
    bazin: [
      { key: 'dy', label: 'DY mínimo', min: 3, max: 12, step: 0.5, unit: '%', dec: 1 }
    ],
    gordon: [
      { key: 'r', label: 'Taxa de desconto (r)', min: 8, max: 25, step: 0.5, unit: '%', dec: 1 },
      { key: 'g', label: 'Crescimento (g)', min: 0, max: 10, step: 0.5, unit: '%', dec: 1 }
    ]
  };
  var WIN_GROUPS = { bazin: { key: 'bw', legend: 'Média de proventos (anos)' }, gordon: { key: 'gw', legend: 'D₀: média de proventos (anos)' } };

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function pos(n) { return isNum(n) && n > 0; }
  function copy(o) { var c = {}; for (var k in o) if (has(o, k)) c[k] = o[k]; return c; }

  /* --- Fórmulas (iguais às da página do ticker) --- */
  function graham(lpa, vpa, p) { return pos(lpa) && pos(vpa) ? Math.sqrt(p.pl * p.pvp * lpa * vpa) * (1 - p.margin / 100) : 0; }
  function bazin(div, p) { return pos(div) && p.dy > 0 ? div / (p.dy / 100) : 0; }
  function gordon(d0, p) { return pos(d0) && p.r > p.g ? d0 * (1 + p.g / 100) / ((p.r - p.g) / 100) : 0; }

  /* Número pronto do arquivo quando ele confere com a conta feita com os mesmos insumos (diferença
     de arredondamento); senão vale a conta, que é a que a tela explica (arquivo de build antigo). */
  function ready(json, live) {
    if (!pos(json) || !pos(live)) return live;
    return Math.abs(json - live) <= Math.max(0.02, live * 0.01) ? json : live;
  }

  /* "1.234,56", "1234,56", "1234.56" → número; vazio ou inválido → NaN. */
  function parseNum(s) {
    var t = String(s == null ? '' : s).replace(/\s|R\$/g, '');
    if (!t) return NaN;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
    return parseFloat(t);
  }

  /* --- Busca: código (prefixo), apelido, início de palavra do nome e trecho do nome --- */
  function fold(s) {
    var t = String(s == null ? '' : s).toUpperCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t;
  }
  function words(s) { return ' ' + fold(s).replace(/[^A-Z0-9]+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function byT(a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; }
  function search(index, q, limit) {
    var qt = fold(q).replace(/[^A-Z0-9]/g, '');
    var qw = words(q);
    if (!qt) return [];
    var roots = [];
    if (qt.length >= 3) for (var a in ALIASES) if (has(ALIASES, a) && a.indexOf(qt) === 0) roots.push(ALIASES[a]);
    var exact = [], pre = [], word = [], part = [];
    for (var i = 0; i < index.length; i++) {
      var it = index[i];
      var alias = false;
      for (var j = 0; j < roots.length; j++) if (it.t.indexOf(roots[j]) === 0) alias = true;
      if (it.t === qt) exact.push(it);
      else if (it.t.indexOf(qt) === 0) pre.push(it);
      else if (alias || it.w.indexOf(qw) >= 0) word.push(it);
      else if (qt.length >= 3 && it.w.indexOf(qt) >= 0) part.push(it);
    }
    pre.sort(byT); word.sort(byT); part.sort(byT);
    return exact.concat(pre, word, part).slice(0, limit);
  }

  window.IAFerr.register('calc', function (el, ctx) {
    var h = ctx.h;
    var f = ctx.fmt;
    var page = ctx.size === 'page';
    var id = ctx.uid('iaw-calc');
    var S = {
      mode: 'acao',
      t: '',
      data: null,
      index: [],
      date: '',
      state: 'carregando',   // carregando | pronto | erro
      msg: '',
      p: copy(DEF),
      manual: { price: '', lpa: '', vpa: '', div: '' },
      opts: [],
      active: -1,
      touched: false
    };
    var R = { graham: 0, bazin: 0, gordon: 0 };
    var ui = { cards: {}, sliders: [], wins: {}, bars: {} };

    function txt(node, s) { if (node && node.textContent !== s) node.textContent = s; }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
    function interact() { if (!S.touched) { S.touched = true; ctx.track('calc'); } }
    function money(v) { return v >= 0.005 ? f.brl(v) : '—'; }
    function announce(s) { txt(status, ''); txt(status, s); }

    /* ── Busca de ticker (combobox, padrão WAI-ARIA 1.2) ── */
    var inputId = id + '-busca';
    var listId = id + '-lista';
    var input = h('input', {
      type: 'text', id: inputId, 'class': 'iaw-calc-input iaw-calc-search iaw-mono',
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId,
      autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '40',
      placeholder: page ? 'Código ou nome, ex.: PETR4' : 'Código, ex.: PETR4'
    });
    var list = h('ul', { id: listId, role: 'listbox', 'class': 'iaw-calc-list', 'aria-label': 'Ações encontradas', hidden: true });
    var status = h('p', { 'class': 'iaw-sr', role: 'status', 'aria-live': 'polite' });
    var icon = ctx.svg('svg', { 'class': 'iaw-calc-search-ico', viewBox: '0 0 20 20', width: '16', height: '16', 'aria-hidden': 'true', focusable: 'false' }, [
      ctx.svg('circle', { cx: '8.5', cy: '8.5', r: '5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
      ctx.svg('path', { d: 'M13 13l4.5 4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' })
    ]);

    function closeList() {
      if (!list.hidden) list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      S.active = -1;
    }
    function openList(items) {
      S.opts = items;
      S.active = -1;
      clear(list);
      for (var i = 0; i < items.length; i++) (function (it, i) {
        var li = h('li', { role: 'option', id: id + '-o-' + i, 'class': 'iaw-calc-opt', 'aria-selected': 'false' }, [
          h('span', { 'class': 'iaw-calc-opt-t iaw-mono' }, it.t),
          h('span', { 'class': 'iaw-calc-opt-n', 'data-fonte': 'b3' }, it.name)
        ]);
        // mousedown sem efeito: o foco fica no campo (o blur não fecha a lista antes do clique).
        li.addEventListener('mousedown', function (e) { e.preventDefault(); });
        li.addEventListener('click', function () { choose(it.t, true); });
        li.addEventListener('mousemove', function () { if (S.active !== i) highlight(i); });
        list.appendChild(li);
      })(items[i], i);
      input.removeAttribute('aria-activedescendant');
      if (items.length) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); } else closeList();
      list.scrollTop = 0;
    }
    function highlight(i) {
      S.active = i;
      var items = list.childNodes;
      for (var k = 0; k < items.length; k++) {
        var on = k === i;
        items[k].setAttribute('aria-selected', on ? 'true' : 'false');
        items[k].className = 'iaw-calc-opt' + (on ? ' is-active' : '');
      }
      var li = items[i];
      if (!li) return;
      input.setAttribute('aria-activedescendant', li.id);
      // Rola só a lista (scrollIntoView rolaria a página).
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
    }
    function find(q) {
      var items = search(S.index, q, 8);
      openList(items);
      announce(!items.length ? 'Nenhuma ação encontrada.' : items.length + (items.length === 1 ? ' ação encontrada' : ' ações encontradas') + '. Use as setas para escolher.');
    }
    input.addEventListener('input', function () {
      if (S.state !== 'pronto') return;
      if (!input.value.replace(/\s/g, '')) { closeList(); return; }
      find(input.value);
    });
    input.addEventListener('keydown', function (e) {
      var k = e.key;
      var n = S.opts.length;
      if (k === 'ArrowDown' || k === 'Down') {
        e.preventDefault();
        if (S.state !== 'pronto') return;
        // Com a ação já escolhida no campo, a seta abre as classes da mesma empresa (PETR3, PETR4).
        if (list.hidden) {
          var q0 = S.t && input.value === S.t ? S.t.slice(0, 4) : input.value;
          if (!q0.replace(/\s/g, '')) return;
          find(q0);
          n = S.opts.length;
        }
        if (n && !e.altKey) highlight(S.active < 0 ? 0 : (S.active + 1) % n);
      } else if (k === 'ArrowUp' || k === 'Up') {
        if (list.hidden || !n) return;
        e.preventDefault();
        highlight(S.active <= 0 ? n - 1 : S.active - 1);
      } else if (k === 'Enter') {
        if (!list.hidden && n) { e.preventDefault(); choose(S.opts[S.active >= 0 ? S.active : 0].t, true); return; }
        var q = fold(input.value).replace(/[^A-Z0-9]/g, '');
        if (S.data && has(S.data, q)) { e.preventDefault(); choose(q, true); }
      } else if (k === 'Escape' || k === 'Esc') {
        if (!list.hidden) { e.preventDefault(); closeList(); }
        else if (input.value) { e.preventDefault(); input.value = ''; }
      } else if (k === 'Tab') {
        closeList();
      }
    });
    input.addEventListener('focus', function () { try { input.select(); } catch (e) { /* nada */ } });
    // Fecha com um respiro: no toque, o blur pode chegar antes do clique na opção.
    input.addEventListener('blur', function () {
      window.setTimeout(function () {
        if (document.activeElement === input) return;
        closeList();
        if (S.t && input.value !== S.t) input.value = S.t;
      }, 150);
    });

    /* ── Ação escolhida ── */
    var assetT = h('span', { 'class': 'iaw-calc-asset-t iaw-mono' });
    var assetName = h('span', { 'class': 'iaw-calc-asset-name', 'data-fonte': 'b3' });
    var assetPrice = h('span', { 'class': 'iaw-calc-asset-price' });
    var assetLink = h('a', { 'class': 'iaw-calc-link', href: '/' + DEFAULT_T + '/', hidden: true });
    assetLink.addEventListener('click', function () {
      try { if (typeof window._iaTrack === 'function') window._iaTrack('cta_click', 'tool-calc-ticker'); } catch (e) { /* tracking nunca quebra o widget */ }
    });
    var dateEl = h('span', { 'class': 'iaw-calc-date' });
    var msg = h('p', { 'class': 'iaw-calc-msg' });
    var retry = h('button', { type: 'button', 'class': 'iaw-btn iaw-calc-retry', hidden: true }, 'Tentar de novo');
    retry.addEventListener('click', function () { load(); });

    /* ── Premissas ── */
    function sliderField(m, s) {
      var sid = id + '-' + s.key;
      var out = h('output', { 'for': sid, 'class': 'iaw-calc-out iaw-mono' });
      var inp = h('input', { type: 'range', id: sid, 'class': 'iaw-calc-range', min: s.min, max: s.max, step: s.step });
      inp.value = String(S.p[s.key]);
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        if (!isNum(v)) return;
        S.p[s.key] = v;
        interact();
        render();
      });
      ui.sliders.push({ m: m, s: s, input: inp, out: out });
      return h('div', { 'class': 'iaw-calc-field' }, [
        h('div', { 'class': 'iaw-calc-field-head' }, [h('label', { 'for': sid }, s.label), out]),
        inp
      ]);
    }
    function windowField(m) {
      var g = WIN_GROUPS[m];
      var name = id + '-' + g.key;
      var radios = [];
      var opts = [];
      for (var i = 0; i < WINS.length; i++) (function (w) {
        var r = h('input', { type: 'radio', name: name, value: w, 'class': 'iaw-calc-seg-input' });
        r.checked = S.p[g.key] === w;
        r.addEventListener('change', function () {
          if (!r.checked) return;
          S.p[g.key] = w;
          interact();
          render();
        });
        radios.push(r);
        opts.push(h('label', { 'class': 'iaw-calc-seg-opt' }, [r, h('span', null, [w, h('span', { 'class': 'iaw-sr' }, w === '1' ? ' ano' : ' anos')])]));
      })(WINS[i]);
      ui.wins[g.key] = radios;
      return h('fieldset', { 'class': 'iaw-calc-win' }, [h('legend', null, g.legend), h('div', { 'class': 'iaw-calc-seg iaw-calc-seg--sm' }, opts)]);
    }

    /* ── Cartão de cada método ── */
    function card(M) {
      var titleId = id + '-t-' + M.id;
      var premId = id + '-p-' + M.id;
      var val = h('p', { 'class': 'iaw-calc-value iaw-mono' }, '—');
      var chipText = h('span', null);
      var chipTail = h('span', { 'class': 'iaw-calc-chip-x' });
      var chip = h('span', { 'class': 'iaw-calc-chip' }, [chipText, chipTail]);
      var why = h('span', { 'class': 'iaw-calc-why' });
      var used = h('p', { 'class': 'iaw-calc-used' });
      var head = h('div', { 'class': 'iaw-calc-card-head' }, [
        h('span', { id: titleId, 'class': 'iaw-calc-card-title' }, M.name),
        h('span', { 'class': 'iaw-calc-kind' }, M.kind)
      ]);
      var box = h('div', { 'class': 'iaw-calc-card', 'data-m': M.id, role: 'group', 'aria-labelledby': titleId });
      var kids = [head, val, h('p', { 'class': 'iaw-calc-meta' }, [chip, why])];
      if (page) {
        var fields = [];
        for (var i = 0; i < SLIDERS[M.id].length; i++) fields.push(sliderField(M.id, SLIDERS[M.id][i]));
        var win = WIN_GROUPS[M.id] ? windowField(M.id) : null;
        if (win) fields.push(win);
        var toggle = h('button', { type: 'button', 'class': 'iaw-calc-toggle', 'aria-expanded': 'false', 'aria-controls': premId }, 'Ajustar premissas');
        toggle.addEventListener('click', function () {
          var open = toggle.getAttribute('aria-expanded') !== 'true';
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          txt(toggle, open ? 'Fechar premissas' : 'Ajustar premissas');
          box.className = 'iaw-calc-card' + (open ? ' is-open' : '');
        });
        kids.push(toggle);
        kids.push(h('div', { 'class': 'iaw-calc-prem', id: premId }, [
          h('div', { 'class': 'iaw-calc-fields' }, fields),
          h('p', { 'class': 'iaw-calc-formula iaw-mono' }, M.formula),
          used
        ]));
        ui.cards[M.id] = { box: box, val: val, chip: chip, chipText: chipText, chipTail: chipTail, why: why, used: used, win: win };
      } else {
        ui.cards[M.id] = { box: box, val: val, chip: chip, chipText: chipText, chipTail: chipTail, why: why, used: null, win: null };
      }
      for (var k = 0; k < kids.length; k++) box.appendChild(kids[k]);
      return box;
    }

    /* ── Modo "Digitar números" (só na página) ── */
    var manualHintId = id + '-dica';
    function numField(key, label) {
      var nid = id + '-n-' + key;
      var inp = h('input', { type: 'text', inputmode: 'decimal', id: nid, 'class': 'iaw-calc-input iaw-mono', autocomplete: 'off', placeholder: '0,00', 'aria-describedby': manualHintId });
      inp.addEventListener('input', function () { S.manual[key] = inp.value; interact(); render(); });
      return h('div', { 'class': 'iaw-calc-num' }, [
        h('label', { 'for': nid }, label),
        h('span', { 'class': 'iaw-calc-num-box' }, [h('span', { 'class': 'iaw-calc-num-pre', 'aria-hidden': 'true' }, 'R$'), inp])
      ]);
    }

    /* ── Comparação com a cotação (só na página) ── */
    function chartRow(M) {
      var fill = h('span', { 'class': 'iaw-calc-fill' });
      var v = h('span', { 'class': 'iaw-calc-bar-v iaw-mono' }, '—');
      ui.bars[M.id] = { fill: fill, v: v };
      return [h('span', { 'class': 'iaw-calc-bar-l' }, M.name), h('span', { 'class': 'iaw-calc-track' }, [fill]), v];
    }

    /* ── Links para o app: a aba Preço justo da ação escolhida ── */
    var NEXT_RE = /([?&]next=)([^&#]*)/;
    function isValuationNext(href) {
      var m = NEXT_RE.exec(href || '');
      if (!m) return false;
      var next = '';
      try { next = decodeURIComponent(m[2]); } catch (e) { return false; }
      return /^\/ativo\/[A-Z0-9]+\?tab=valuation&_=$/.test(next);
    }
    function withTicker(href, t) {
      var next = encodeURIComponent('/ativo/' + t + '?tab=valuation&_=');
      if (isValuationNext(href)) return href.replace(NEXT_RE, '$1' + next);
      return APP + '?ref=iacoes&utm_medium=ferramentas&next=' + next;
    }
    var baseHref = '';
    var ctaLabel = h('span', null, 'Calcular na plataforma');
    var cta = null;
    if (page) {
      try {
        var all = document.getElementsByTagName('a');
        for (var ai = 0; ai < all.length; ai++) {
          var hrefAttr = all[ai].getAttribute('href') || '';
          if (hrefAttr.indexOf(APP) === 0 && isValuationNext(hrefAttr)) { baseHref = hrefAttr; break; }
        }
      } catch (e) { baseHref = ''; }
      cta = h('a', { 'class': 'iaw-calc-cta', href: withTicker(baseHref, DEFAULT_T), 'data-cta': 'tool-calc-widget' }, [
        ctaLabel,
        h('span', { 'aria-hidden': 'true' }, '→')
      ]);
      // Mesmo caminho dos CTAs do servidor (onclick="_iaClick(event)"): medição + redirect.
      cta.addEventListener('click', function (e) { if (typeof window._iaClick === 'function') window._iaClick(e); });
    }
    function syncCtas(t) {
      if (!page || !TICKER_RE.test(t)) return;
      try {
        var links = document.getElementsByTagName('a');
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute('href') || '';
          if (href.indexOf(APP) === 0 && isValuationNext(href)) {
            var out = withTicker(href, t);
            if (out !== href) links[i].setAttribute('href', out);
          }
        }
      } catch (e) { /* sem DOM completo: os links ficam como vieram do servidor */ }
      if (cta) txt(ctaLabel, 'Calcular ' + t + ' na plataforma');
    }

    /* ── ?t=TICKER ── */
    function fromUrl() {
      var m = /[?&]t=([^&#]*)/.exec((window.location && window.location.search) || '');
      if (!m) return '';
      var t = '';
      try { t = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return ''; }
      t = t.toUpperCase().replace(/\s+/g, '');
      return TICKER_RE.test(t) ? t : '';
    }
    function setUrl(t) {
      if (!page) return;
      try {
        var hist = window.history;
        if (!hist || !hist.replaceState) return;
        var loc = window.location;
        var parts = (loc.search || '').replace(/^\?/, '').split('&');
        var keep = [];
        for (var i = 0; i < parts.length; i++) if (parts[i] && !/^t=/.test(parts[i])) keep.push(parts[i]);
        keep.push('t=' + encodeURIComponent(t));
        hist.replaceState(hist.state, '', loc.pathname + '?' + keep.join('&') + (loc.hash || ''));
      } catch (e) { /* sem history: segue sem ?t= */ }
    }

    /* ── Estado → tela ── */
    function isDefault(m) {
      var p = S.p;
      if (m === 'graham') return p.pl === DEF.pl && p.pvp === DEF.pvp && p.margin === DEF.margin;
      if (m === 'bazin') return p.dy === DEF.dy && p.bw === DEF.bw;
      return p.r === DEF.r && p.g === DEF.g && p.gw === DEF.gw;
    }
    function allDefault() { return isDefault('graham') && isDefault('bazin') && isDefault('gordon'); }
    function avgOf(x, w) {
      var a = x.avgDiv || {};
      if (isNum(a[w])) return a[w];
      return w === '1' && isNum(x.divTTM) ? x.divTTM : 0;
    }
    function inputs() {
      if (S.mode === 'manual') {
        var d = parseNum(S.manual.div);
        return { manual: true, x: null, price: parseNum(S.manual.price), lpa: parseNum(S.manual.lpa), vpa: parseNum(S.manual.vpa), divB: d, divG: d };
      }
      var x = S.t && S.data && has(S.data, S.t) ? S.data[S.t] : null;
      if (!x) return null;
      return { manual: false, x: x, price: x.price, lpa: x.lpa, vpa: x.vpa, divB: avgOf(x, S.p.bw), divG: avgOf(x, S.p.gw) };
    }
    function compute(inp) {
      var out = { graham: 0, bazin: 0, gordon: 0 };
      if (!inp) return out;
      out.graham = graham(inp.lpa, inp.vpa, S.p);
      out.bazin = bazin(inp.divB, S.p);
      out.gordon = gordon(inp.divG, S.p);
      if (!inp.manual) {
        if (isDefault('graham')) out.graham = ready(inp.x.graham, out.graham);
        if (isDefault('bazin')) out.bazin = ready(inp.x.bazin, out.bazin);
        if (isDefault('gordon')) out.gordon = ready(inp.x.gordon, out.gordon);
      }
      return out;
    }
    function reason(m, inp) {
      if (!inp) return S.state === 'erro' ? 'Sem dados agora.' : '';
      if (m === 'graham') {
        if (inp.manual && (!isNum(inp.lpa) || !isNum(inp.vpa))) return 'Digite o LPA e o VPA.';
        return 'Não se aplica: LPA ou VPA negativo ou zero.';
      }
      var d = m === 'bazin' ? inp.divB : inp.divG;
      if (m === 'gordon' && !(S.p.r > S.p.g)) return 'Não se aplica: r precisa ser maior que g.';
      if (inp.manual && !isNum(d)) return 'Digite o dividendo por ação.';
      if (!pos(d)) return inp.manual ? 'Não se aplica: dividendo zero ou negativo.' : 'Sem proventos na janela escolhida.';
      return 'Não se aplica.';
    }
    function versus(v, price) {
      if (!pos(v) || !pos(price)) return null;
      var d = v / price - 1;
      return { up: d >= 0, text: f.pct(Math.abs(d), 1) + (d >= 0 ? ' acima' : ' abaixo') };
    }
    // "x% acima da cotação"; em cartão estreito, " da cotação" some da tela (o leitor de tela lê).
    function setChip(c, vs, atyp) {
      var s = vs ? vs.text : '';
      if (c.chipText.textContent !== s) {
        c.chipText.textContent = s;
        c.chipTail.textContent = vs ? ' da cotação' : '';
      }
      // Com provento atípico o chip fica neutro: a distância para a cotação não merece destaque.
      c.chip.className = 'iaw-calc-chip' + (vs ? (vs.up ? ' is-up' : ' is-down') + (atyp ? ' is-atyp' : '') : '');
    }
    /* Média de proventos acima de 25% da cotação (o mesmo teto da aba DY do ranking): provento
       extraordinário ou lançamento repetido na fonte. O número continua, com o aviso. */
    function atypical(m, inp) {
      if (!inp || inp.manual || m === 'graham') return '';
      var d = m === 'bazin' ? inp.divB : inp.divG;
      return pos(d) && pos(inp.price) && d / inp.price > 0.25 ? 'Provento atípico (' + f.pct(d / inp.price, 1) + ' da cotação).' : '';
    }
    function winLabel(w) { return w === '1' ? '1 ano' : w + ' anos'; }
    function usedText(m, inp) {
      if (!inp) return '';
      if (m === 'graham') return 'LPA ' + (isNum(inp.lpa) ? f.brl(inp.lpa) : '—') + ' · VPA ' + (isNum(inp.vpa) ? f.brl(inp.vpa) : '—');
      if (m === 'bazin') return inp.manual ? 'Dividendo: ' + (isNum(inp.divB) ? f.brl(inp.divB) : '—') + ' por ação' : 'Média de ' + winLabel(S.p.bw) + ': ' + f.brl(inp.divB) + ' por ação';
      var d1 = isNum(inp.divG) ? inp.divG * (1 + S.p.g / 100) : NaN;
      return 'D₀ ' + (isNum(inp.divG) ? f.brl(inp.divG) : '—') + ' · D₁ ' + (isNum(d1) ? f.brl(d1) : '—');
    }
    function valueText(s, v) {
      if (s.key === 'margin') return f.num(v, 0) + '%';
      return f.num(v, s.dec) + s.unit;
    }

    function render() {
      var inp = inputs();
      var res = compute(inp);
      R = res;
      var price = inp ? inp.price : NaN;

      // Ação escolhida, data e links
      if (S.mode === 'acao' && inp) {
        txt(assetT, S.t);
        txt(assetName, inp.x.name || '');
        txt(assetPrice, 'Cotação ' + f.brl(inp.x.price));
        if (page) {
          assetLink.setAttribute('href', '/' + S.t + '/');
          txt(assetLink, 'Análise completa de ' + S.t);
          assetLink.hidden = false;
        }
      } else if (S.mode === 'acao') {
        txt(assetT, '');
        txt(assetName, S.state === 'carregando' ? 'Carregando os dados das ações…' : '');
        txt(assetPrice, '');
        assetLink.hidden = true;
      }
      // A data é da base das ações: no modo "Digitar números" ela não vale para nada na tela.
      txt(dateEl, S.date && S.mode === 'acao' ? (page ? 'Dados de ' : ' · dados de ') + f.date(S.date) : '');
      txt(msg, S.msg);
      retry.hidden = S.state !== 'erro';

      // Cartões
      for (var i = 0; i < METHODS.length; i++) {
        var m = METHODS[i].id;
        var c = ui.cards[m];
        var v = res[m];
        txt(c.val, money(v));
        var vs = versus(v, price);
        var atyp = v >= 0.005 ? atypical(m, inp) : '';
        setChip(c, vs, atyp);
        txt(c.why, v >= 0.005 ? (vs ? atyp : (S.mode === 'manual' ? 'Digite a cotação para comparar.' : '')) : reason(m, inp));
        if (c.used) txt(c.used, usedText(m, inp));
        if (c.win) c.win.hidden = S.mode === 'manual';
      }

      // Premissas: valores, texto acessível com o resultado e preenchimento da trilha
      for (var j = 0; j < ui.sliders.length; j++) {
        var sl = ui.sliders[j];
        var cur = S.p[sl.s.key];
        if (parseFloat(sl.input.value) !== cur) sl.input.value = String(cur);
        var shown = valueText(sl.s, cur);
        txt(sl.out, shown);
        var rv = R[sl.m];
        var kind = sl.m === 'bazin' ? 'preço teto' : 'preço justo';
        sl.input.setAttribute('aria-valuetext', shown + '; ' + kind + ' ' + (rv >= 0.005 ? f.brl(rv) : 'não se aplica'));
        var pct = (cur - sl.s.min) / (sl.s.max - sl.s.min) * 100;
        sl.input.style.setProperty('--iaw-calc-p', Math.max(0, Math.min(100, pct)).toFixed(1) + '%');
      }
      for (var key in ui.wins) if (has(ui.wins, key)) {
        for (var w = 0; w < ui.wins[key].length; w++) {
          var r = ui.wins[key][w];
          var want = r.value === S.p[key];
          if (r.checked !== want) r.checked = want;
        }
      }

      if (page) {
        var custom = !allDefault();
        stateEl.className = 'iaw-calc-state' + (custom ? ' is-custom' : '');
        txt(stateLabel, custom ? 'Premissas alteradas por você' : 'Premissas padrão do site');
        // aria-disabled (e não disabled): o botão continua focável e o foco do teclado não se perde.
        reset.setAttribute('aria-disabled', custom ? 'false' : 'true');
        drawChart(res, price, inp);
        if (cta) cta.hidden = S.mode !== 'acao' || !inp;
        manualPanel.hidden = S.mode !== 'manual';
        pickPanel.hidden = S.mode !== 'acao';
      }
    }

    function drawChart(res, price, inp) {
      var vals = [res.graham, res.bazin, res.gordon];
      var max = 0;
      for (var i = 0; i < vals.length; i++) if (vals[i] > max) max = vals[i];
      var hasPrice = pos(price);
      // Mesma escala da página do ticker, com teto em 4× a cotação (barra além do teto fica cheia).
      var scale = hasPrice ? Math.max(price * 1.5, Math.min(max, price * 4)) * 1.08 : max * 1.08;
      var parts = [];
      for (var k = 0; k < METHODS.length; k++) {
        var M = METHODS[k];
        var b = ui.bars[M.id];
        var v = res[M.id];
        var frac = scale > 0 && v >= 0.005 ? Math.min(1, v / scale) : 0;
        b.fill.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
        b.fill.className = 'iaw-calc-fill' + (hasPrice && v >= 0.005 && !atypical(M.id, inp) ? (v >= price ? ' is-up' : ' is-down') : '') + (frac >= 1 ? ' is-over' : '');
        txt(b.v, money(v));
        parts.push(M.name + ' ' + (v >= 0.005 ? f.brl(v) : 'não se aplica'));
      }
      pline.style.transform = 'translateX(' + (hasPrice && scale > 0 ? (price / scale * 100).toFixed(2) : '0') + '%)';
      pline.style.opacity = hasPrice ? '1' : '0';
      txt(legend, hasPrice ? 'Linha tracejada: cotação de ' + f.brl(price) + '.' : 'Digite a cotação para ver a linha de comparação.');
      chart.setAttribute('aria-label', 'Comparação dos três métodos' + (hasPrice ? ' com a cotação de ' + f.brl(price) : '') + ': ' + parts.join('; ') + '.');
    }

    function summary() {
      return S.t + ': Graham ' + money(R.graham) + '; Bazin, preço teto ' + money(R.bazin) + '; Gordon ' + money(R.gordon) + '.';
    }
    function choose(t, byUser) {
      if (!S.data || !has(S.data, t)) return;
      S.t = t;
      S.msg = '';
      input.value = t;
      closeList();
      if (byUser) { interact(); setUrl(t); }
      syncCtas(t);
      render();
      if (byUser) announce(summary());
    }
    function setMode(mode) {
      if (S.mode === mode) return;
      S.mode = mode;
      interact();
      render();
    }

    /* ── Montagem ── */
    var pickPanel = h('div', { 'class': 'iaw-calc-pick' }, [
      h('label', { 'for': inputId, 'class': 'iaw-calc-label' }, 'Ação da B3'),
      h('div', { 'class': 'iaw-calc-combo' }, [icon, input, list]),
      h('p', { 'class': 'iaw-calc-asset' }, [assetT, assetName, assetPrice, page ? assetLink : null]),
      h('div', { 'class': 'iaw-calc-msgs' }, [msg, retry])
    ]);
    var manualPanel = null;
    var stateEl = null;
    var stateLabel = null;
    var reset = null;
    var chart = null;
    var legend = null;
    var pline = null;
    var root;

    var cards = h('div', { 'class': 'iaw-calc-cards' }, [card(METHODS[0]), card(METHODS[1]), card(METHODS[2])]);

    if (page) {
      var modeName = id + '-modo';
      var mkMode = function (value, label) {
        var r = h('input', { type: 'radio', name: modeName, value: value, 'class': 'iaw-calc-seg-input' });
        r.checked = value === S.mode;
        r.addEventListener('change', function () { if (r.checked) setMode(value); });
        return h('label', { 'class': 'iaw-calc-seg-opt' }, [r, h('span', null, label)]);
      };
      var modes = h('fieldset', { 'class': 'iaw-calc-seg iaw-calc-modes' }, [
        h('legend', { 'class': 'iaw-sr' }, 'Como calcular'),
        mkMode('acao', 'Ação da B3'),
        mkMode('manual', 'Digitar números')
      ]);
      manualPanel = h('div', { 'class': 'iaw-calc-manual', hidden: true }, [
        h('div', { 'class': 'iaw-calc-nums' }, [
          numField('price', 'Cotação (opcional)'),
          numField('lpa', 'LPA'),
          numField('vpa', 'VPA'),
          numField('div', 'Dividendo por ação (média anual)')
        ]),
        h('p', { id: manualHintId, 'class': 'iaw-calc-hint' }, 'Valores em reais por ação, com vírgula nos centavos. Graham usa LPA e VPA; Bazin e Gordon, o dividendo.')
      ]);
      pline = h('span', { 'class': 'iaw-calc-pline' });
      legend = h('p', { 'class': 'iaw-calc-legend' });
      var barKids = [];
      for (var bi = 0; bi < METHODS.length; bi++) barKids = barKids.concat(chartRow(METHODS[bi]));
      barKids.push(h('span', { 'class': 'iaw-calc-plane', 'aria-hidden': 'true' }, [pline]));
      chart = h('div', { 'class': 'iaw-calc-chart', role: 'img', 'aria-label': 'Comparação dos três métodos com a cotação' }, [
        h('p', { 'class': 'iaw-calc-chart-title', 'aria-hidden': 'true' }, 'Comparação com a cotação'),
        h('div', { 'class': 'iaw-calc-bars', 'aria-hidden': 'true' }, barKids),
        legend
      ]);
      stateLabel = h('span', null, 'Premissas padrão do site');
      stateEl = h('span', { 'class': 'iaw-calc-state' }, [stateLabel]);
      reset = h('button', { type: 'button', 'class': 'iaw-btn iaw-calc-reset' }, 'Voltar ao padrão');
      reset.addEventListener('click', function () {
        if (allDefault()) return;
        S.p = copy(DEF);
        interact();
        render();
        announce('Premissas padrão do site de volta. ' + (S.mode === 'acao' && S.t ? summary() : ''));
      });
      root = h('div', { 'class': 'iaw-calc iaw-calc--page' }, [
        h('div', { 'class': 'iaw-calc-top' }, [modes, dateEl]),
        pickPanel,
        manualPanel,
        cards,
        chart,
        h('div', { 'class': 'iaw-calc-foot' }, [
          h('div', { 'class': 'iaw-calc-foot-l' }, [stateEl, reset]),
          cta,
          h('p', { 'class': 'iaw-calc-note' }, 'Cálculo no seu navegador, sem IA. Na plataforma, a aba Preço justo usa outras premissas padrão.')
        ]),
        status
      ]);
    } else {
      // Tile (≈300×220): o nome da ferramenta fica no cartão de fora; a data vai para a nota.
      root = h('div', { 'class': 'iaw-calc iaw-calc--tile' }, [
        pickPanel,
        cards,
        h('p', { 'class': 'iaw-calc-note' }, ['Premissas padrão do site, sem IA', dateEl]),
        status
      ]);
    }

    function boot(d) {
      if (!d || typeof d !== 'object') throw new Error('valuations.json inválido');
      var data = {};
      var index = [];
      for (var k in d) {
        if (!has(d, k) || !TICKER_RE.test(k)) continue;
        var x = d[k];
        if (!x || typeof x !== 'object' || !pos(x.price)) continue;
        data[k] = x;
        index.push({ t: k, name: String(x.name || ''), w: words(x.name) });
      }
      if (!index.length) throw new Error('valuations.json sem ações');
      S.data = data;
      S.index = index;
      S.date = typeof d._quoteDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d._quoteDate) ? d._quoteDate : '';
      S.state = 'pronto';
      el.setAttribute('data-calc', 'pronto');
      var want = page ? fromUrl() : '';
      var first = want && has(data, want) ? want : has(data, DEFAULT_T) ? DEFAULT_T : index[0].t;
      choose(first, false);
      if (want && !has(data, want)) {
        S.msg = want + ' não está na base desta calculadora. Escolha outra ação ou use Digitar números.';
        render();
      }
    }
    function load() {
      S.state = 'carregando';
      S.msg = '';
      render();
      ctx.fetchJSON(ctx.src(DATA_URL)).then(function (d) {
        try { boot(d); } catch (e) { fail(); }
      }, function () { fail(); });
    }
    function fail() {
      S.state = 'erro';
      S.msg = page ? 'Não foi possível carregar os dados das ações agora. Tente de novo ou use Digitar números.' : 'Não foi possível carregar os dados agora.';
      el.setAttribute('data-calc', 'erro');
      render();
    }

    clear(el);
    el.appendChild(root);
    load();

    return {
      start: function () {},
      stop: function () {},
      destroy: function () { clear(el); }
    };
  });
})();
