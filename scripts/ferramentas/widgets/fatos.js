/* Widget "fatos" (SPEC §4; SPEC-v2 §C Fatos, §E5, §E6): o feed com os documentos REAIS mais
   recentes da CVM (fatos relevantes e comunicados ao mercado que têm resumo gerado por IA), lido
   de /ferramentas/fatos-relevantes/dados.json (data.ts buildFatos; formato em DADOS-API.md §2).

   O movimento é o dado: os documentos entram um a um no topo da lista, na ordem em que entraram no
   feed (do mais antigo para o mais novo da janela), e o leitor mostra o resumo de cada um. A lista
   termina nos mais recentes, para um pouco e recomeça. Nada inventado: nenhum número, nenhum
   ticker fora do JSON e nenhum selo de ilustração (o dado é real). A data mostrada é a de
   publicação na CVM; a hora é sempre "entrou no feed às HH:MM" (não é a publicação nem a entrega
   de alerta). Texto do JSON entra só por textContent (ctx.h); href só interno e conferido.

   Interação: passar o mouse, tocar ou focar uma linha mostra o resumo dela (setas ↑/↓, Home e End
   andam pela lista); com o ponteiro ou o foco dentro do quadro, a lista não anda. Botão
   Pausar/Retomar (WCAG 2.2.2). Movimento reduzido: o quadro final (os mais recentes), sem
   animação e sem botão.

   Tamanhos: 'page' (~640×360): lista e leitor lado a lado a partir de 640 px de tela, empilhados
   abaixo disso (compacto < 400 px). 'tile' (~300×220, landing): lista curta e leitor com 3
   linhas de resumo; span 2x1/2x2 põe lado a lado. Alturas fixas: trocar de documento não mexe na
   altura do quadro.

   Só transform e opacity animam: cada linha fica em translateY(n × 100%) da própria altura (a
   altura inclui o espaço entre as linhas) e desliza com transição; a entrada é um keyframe de
   opacidade; a linha que sai some por opacidade; o leitor troca com fade. As animações de
   entrada só são ligadas com o quadro rodando (ctx.running()): pausado, o CSS do runtime congela
   as animações, e um elemento novo ficaria parado no primeiro quadro (invisível). */
(function () {
  var DEFAULT_URL = '/ferramentas/fatos-relevantes/dados.json';
  var TYPES = {
    FR: { code: 'FR', label: 'Fato Relevante' },
    CM: { code: 'CM', label: 'Comunicado ao Mercado' }
  };
  var TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var BR_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
  var STEP = { page: 4500, tile: 4000 };
  var END_HOLD = 6000;
  var USER_HOLD = 6000;
  var LEAVE_HOLD = 2500;
  /* Documentos que chegam depois do quadro inicial, a cada volta. */
  var ARRIVALS = 5;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function now() { return new Date().getTime(); }

  function clean(v, max) {
    var s = String(v == null ? '' : v).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    if (max && s.length > max) s = s.slice(0, max - 1).replace(/[\s,;:.]+$/, '') + '…';
    return s;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* Item do dados.json → item do widget (ou null). Só FR/CM, ticker no padrão da B3, data
     AAAA-MM-DD, resumo de verdade e link interno que aponte para o próprio ticker. */
  function normalize(x) {
    if (!x || typeof x !== 'object') return null;
    var type = typeof x.type === 'string' && has(TYPES, x.type) ? x.type : '';
    var t = String(x.t || '');
    var url = String(x.url || '');
    var date = String(x.publishedDate || x.date || '');
    var summary = clean(x.summary, 320);
    if (!type || !TICKER_RE.test(t) || !DATE_RE.test(date) || summary.length < 20) return null;
    if (url !== '/' + t + '/' && url !== '/airton/' + t + '/') return null;
    var feed = clean(x.feedLabel, 60);
    if (feed.indexOf('entrou no feed') !== 0) feed = /^\d{2}:\d{2}$/.test(String(x.time || '')) ? 'entrou no feed às ' + x.time : '';
    return {
      type: type,
      t: t,
      name: clean(x.name, 90),
      title: clean(x.title, 200) || TYPES[type].label,
      summary: summary,
      url: url,
      airton: url.charAt(1) === 'a',
      date: date,
      feed: feed
    };
  }

  window.IAFerr.register('fatos', function (el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var page = ctx.size === 'page';
    var wide = !page && (ctx.span === '2x1' || ctx.span === '2x2');
    var step = page ? STEP.page : STEP.tile;
    var narrowMq = page && window.matchMedia ? window.matchMedia('(max-width: 639px)') : null;
    var readerId = ctx.uid('iaw-fatos-leitor');

    var items = [];      /* válidos, do mais novo para o mais antigo (ordem do JSON) */
    var win = [];        /* janela da volta atual, do mais antigo para o mais novo */
    var rows = [];       /* linhas da lista, de cima para baixo: { it, li, btn, slot } */
    var V = 3;           /* linhas visíveis */
    var next = 0;        /* próximo documento de `win` a entrar */
    var selected = null;
    var auto = !ctx.reduced;
    var ready = false;
    var phase = 'run';   /* 'run' (chegando) | 'end' (nos mais recentes, antes de recomeçar) */
    var acc = 0;
    var hold = 0;
    var pointerIn = false;
    var focusIn = false;
    var lastTouch = 0;
    var cancelLoop = null;
    var latestBR = '';
    var root = null;
    var list = null;
    var reader = null;
    var pauseBtn = null;

    function sizeClass() {
      return 'iaw-fatos iaw-fatos--' + (page ? 'page' : 'tile') + (wide ? ' iaw-fatos--wide' : '');
    }

    function visibleRows() {
      if (page) return narrowMq && narrowMq.matches ? 3 : 5;
      return wide ? 5 : 3;
    }

    function shortDate(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

    function pill(type, full) {
      var ty = TYPES[type];
      return h('span', { 'class': 'iaw-fatos-pill' + (full ? ' iaw-fatos-pill--full' : ''), 'data-type': type }, full ? ty.label : ty.code);
    }

    function head(withPause) {
      return h('div', { 'class': 'iaw-fatos-head' }, [
        h('span', { 'class': 'iaw-fatos-prompt', 'aria-hidden': 'true' }, '>_'),
        h('span', { 'class': 'iaw-fatos-title' }, 'Feed da CVM'),
        page && latestBR ? h('span', { 'class': 'iaw-fatos-latest' }, 'mais recente: ' + latestBR) : null,
        withPause && !page ? pauseBtn : null
      ]);
    }

    /* --- Linhas da lista --- */

    function place(r) {
      var tr = 'translateY(' + (r.slot * 100) + '%)';
      r.li.style.webkitTransform = tr;
      r.li.style.transform = tr;
    }

    function makeRow(it) {
      var ty = TYPES[it.type];
      var btn = h('button', {
        type: 'button',
        'class': 'iaw-fatos-row',
        'aria-pressed': 'false',
        'aria-controls': readerId,
        'aria-label': ty.label + ' de ' + it.t + (it.name ? ', ' + it.name : '') + ', publicado em ' + ctx.fmt.date(it.date)
      }, [
        pill(it.type, false),
        h('span', { 'class': 'iaw-fatos-row-t' }, it.t),
        h('span', { 'class': 'iaw-fatos-row-name' }, it.name),
        h('span', { 'class': 'iaw-fatos-row-date' }, shortDate(it.date))
      ]);
      var li = h('li', { 'class': 'iaw-fatos-slot' }, btn);
      var row = { it: it, li: li, btn: btn, slot: 0 };
      btn.addEventListener('click', function () { choose(row, true); });
      btn.addEventListener('focus', function () { choose(row, false); });
      btn.addEventListener('mouseenter', function () { if (now() - lastTouch > 800) choose(row, false); });
      btn.addEventListener('keydown', function (ev) { onKey(ev, row); });
      return row;
    }

    function addRow(it, slot, atTop) {
      var row = makeRow(it);
      row.slot = slot;
      place(row);
      if (ctx.running() && !ctx.reduced) row.li.className += ' is-new';
      if (atTop && list.firstChild) list.insertBefore(row.li, list.firstChild);
      else list.appendChild(row.li);
      if (atTop) rows.unshift(row); else rows.push(row);
      return row;
    }

    function leave(r) {
      r.li.className = 'iaw-fatos-slot is-out';
      r.li.setAttribute('aria-hidden', 'true');
      r.btn.setAttribute('tabindex', '-1');
    }

    /* Tira da lista as linhas que já saíram (todas, com `all`). */
    function purge(all) {
      for (var i = rows.length - 1; i >= 0; i--) {
        if (!all && rows[i].slot < V) continue;
        if (rows[i].li.parentNode) rows[i].li.parentNode.removeChild(rows[i].li);
        rows.splice(i, 1);
      }
    }

    function shown() {
      var out = [];
      for (var i = 0; i < rows.length; i++) if (rows[i].slot < V) out.push(rows[i]);
      return out;
    }

    /* --- Leitor --- */

    function makeDoc(it) {
      var ty = TYPES[it.type];
      var meta = page
        ? [h('span', { 'class': 'iaw-fatos-doc-date' }, 'Publicado na CVM em ' + ctx.fmt.date(it.date)), it.feed ? h('span', { 'class': 'iaw-fatos-doc-feed' }, cap(it.feed)) : null]
        : [ctx.fmt.date(it.date) + (it.feed ? ' · ' + it.feed : '')];
      var link = h('a', {
        'class': page ? 'iaw-fatos-doc-link' : 'iaw-fatos-doc-titlelink',
        href: it.url,
        onclick: function () { ctx.track('fatos'); }
      }, page ? (it.airton ? 'Documentos de ' + it.t + ' na CVM' : 'Análise de ' + it.t) : it.title);
      var kids = [];
      if (page) {
        kids.push(h('p', { 'class': 'iaw-fatos-doc-top' }, [pill(it.type, true), h('span', { 'class': 'iaw-fatos-doc-t' }, it.t), it.name ? h('span', { 'class': 'iaw-fatos-doc-name' }, it.name) : null]));
        kids.push(h('p', { 'class': 'iaw-fatos-doc-title' }, it.title));
      } else {
        kids.push(h('p', { 'class': 'iaw-fatos-doc-title' }, [h('span', { 'class': 'iaw-sr' }, ty.label + ' de ' + it.t + ': '), link]));
      }
      kids.push(h('p', { 'class': 'iaw-fatos-doc-sum' }, [h('span', { 'class': 'iaw-fatos-ai' }, page ? 'Resumo gerado por IA' : 'Resumo por IA'), ' ', it.summary]));
      kids.push(h('p', { 'class': 'iaw-fatos-doc-meta' }, meta));
      if (page) kids.push(h('p', { 'class': 'iaw-fatos-doc-go' }, [link, h('span', { 'aria-hidden': 'true' }, ' →')]));
      return h('div', { 'class': 'iaw-fatos-doc' + (ctx.running() && !ctx.reduced ? ' is-new' : '') }, kids);
    }

    function select(it, byUser) {
      if (!it) return;
      for (var i = 0; i < rows.length; i++) {
        var on = rows[i].it === it;
        rows[i].btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        rows[i].btn.className = 'iaw-fatos-row' + (on ? ' is-on' : '');
      }
      /* Só a escolha da pessoa é anunciada; a troca automática fica em silêncio. */
      reader.setAttribute('aria-live', byUser ? 'polite' : 'off');
      if (selected === it) return;
      selected = it;
      reader.innerHTML = '';
      reader.appendChild(makeDoc(it));
    }

    function choose(row, tracked) {
      if (row.slot >= V) return;
      hold = USER_HOLD;
      if (tracked) ctx.track('fatos');
      select(row.it, true);
    }

    function onKey(ev, row) {
      var k = ev.key || ev.keyCode;
      var vis = shown();
      var i = -1;
      for (var j = 0; j < vis.length; j++) if (vis[j] === row) i = j;
      var to = -1;
      if (k === 'ArrowDown' || k === 'Down' || k === 40) to = i + 1;
      else if (k === 'ArrowUp' || k === 'Up' || k === 38) to = i - 1;
      else if (k === 'Home' || k === 36) to = 0;
      else if (k === 'End' || k === 35) to = vis.length - 1;
      else return;
      if (ev.preventDefault) ev.preventDefault();
      if (to < 0 || to >= vis.length || to === i) return;
      ctx.track('fatos');
      vis[to].btn.focus();
    }

    /* --- Sequência --- */

    function windowOf() {
      var w = items.slice(0, Math.min(items.length, V + ARRIVALS));
      w.reverse();
      return w;
    }

    /* Quadro inicial de uma volta: os V mais antigos da janela (o mais novo deles em cima). Com
       movimento reduzido, direto o quadro final: os V mais recentes. */
    function reset() {
      V = visibleRows();
      win = windowOf();
      purge(true);
      selected = null;
      var start = ctx.reduced || win.length <= V ? Math.max(0, win.length - V) : 0;
      var first = win.slice(start, start + V);
      for (var i = first.length - 1, s = 0; i >= 0; i--, s++) addRow(first[i], s, false);
      next = start + first.length;
      phase = next < win.length ? 'run' : 'end';
      acc = 0;
      select(first[first.length - 1], false);
    }

    function arrive() {
      purge(false);
      var it = win[next];
      next += 1;
      for (var i = 0; i < rows.length; i++) {
        rows[i].slot += 1;
        place(rows[i]);
        if (rows[i].slot >= V) leave(rows[i]);
      }
      addRow(it, 0, true);
      select(it, false);
      if (next >= win.length) phase = 'end';
    }

    function animates() { return ready && !ctx.reduced && win.length > V; }

    function frame(dt) {
      if (!auto || pointerIn || focusIn) return;
      if (hold > 0) { hold -= dt; return; }
      acc += dt;
      if (phase === 'run') {
        if (acc >= step) { acc = 0; arrive(); }
      } else if (acc >= END_HOLD) {
        reset();
      }
    }

    function startLoop() { if (!cancelLoop && animates()) cancelLoop = ctx.loop(frame, { fps: 12 }); }
    function stopLoop() { if (cancelLoop) { cancelLoop(); cancelLoop = null; } }

    /* --- Pausa --- */

    function icon(playing) {
      return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' },
        playing
          ? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
          : [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
    }

    function setAuto(on) {
      auto = on;
      if (!pauseBtn) return;
      pauseBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
      pauseBtn.setAttribute('aria-label', on ? 'Pausar a chegada dos documentos' : 'Retomar a chegada dos documentos');
      if (page) pauseBtn.textContent = on ? 'Pausar' : 'Retomar';
      else { pauseBtn.textContent = ''; pauseBtn.appendChild(icon(on)); }
    }

    /* --- Montagem --- */

    function status(msg) {
      return h('div', { 'class': sizeClass() + ' is-status' }, [head(false), h('p', { 'class': 'iaw-fatos-status' }, msg)]);
    }

    function build(d) {
      var raw = d && d.items && d.items.length ? d.items : [];
      for (var i = 0; i < raw.length; i++) {
        var it = normalize(raw[i]);
        if (it) items.push(it);
      }
      if (!items.length) { fail(); return; }
      latestBR = d && BR_DATE_RE.test(String(d.updatedBR || '')) ? d.updatedBR : ctx.fmt.date(items[0].date);
      V = visibleRows();
      var moving = !ctx.reduced && items.length > V;
      if (moving) {
        pauseBtn = h('button', { type: 'button', 'class': page ? 'iaw-btn iaw-fatos-pause' : 'iaw-fatos-pause-icon', 'aria-pressed': 'false' });
        pauseBtn.addEventListener('click', function () { setAuto(!auto); ctx.track('fatos'); });
        setAuto(auto);
      }
      list = h('ol', { 'class': 'iaw-fatos-list', 'aria-label': 'Documentos mais recentes (escolha um para ler o resumo)' });
      reader = h('div', { 'class': 'iaw-fatos-reader', id: readerId, 'aria-live': 'off' });
      var body = h('div', { 'class': 'iaw-fatos-body' }, [list, reader]);
      var foot = page ? h('div', { 'class': 'iaw-fatos-foot' }, [
        /* A legenda das etiquetas; o aviso sobre o resumo fica no leitor e na legenda da página. */
        h('p', { 'class': 'iaw-fatos-note' }, 'FR = Fato Relevante · CM = Comunicado ao Mercado · na ordem em que entraram no feed'),
        moving ? pauseBtn : null
      ]) : null;
      root = h('div', { 'class': sizeClass() }, [head(moving), body, foot]);
      if (!el.getAttribute('aria-label')) {
        root.setAttribute('role', 'group');
        root.setAttribute('aria-label', 'Feed com os documentos mais recentes da CVM e o resumo gerado por IA de cada um');
      }
      /* Ponteiro (mouse) ou foco de teclado na lista ou no leitor seguram a sequência; o botão de
         pausa fica fora dessa área, então "Retomar" vale na hora. Toque não prende: a escolha
         segura alguns segundos e a lista volta a andar. */
      root.addEventListener('touchstart', function () { lastTouch = now(); }, { passive: true });
      root.addEventListener('mousedown', function () { lastTouch = now(); });
      body.addEventListener('mouseenter', function () { if (now() - lastTouch > 800) pointerIn = true; });
      body.addEventListener('mouseleave', function () { if (pointerIn) { pointerIn = false; hold = Math.max(hold, LEAVE_HOLD); } });
      body.addEventListener('focusin', function () { focusIn = now() - lastTouch > 800; });
      body.addEventListener('focusout', function (ev) {
        var to = ev.relatedTarget;
        if (focusIn && !(to && body.contains(to))) { focusIn = false; hold = Math.max(hold, LEAVE_HOLD); }
      });
      reset();
      el.innerHTML = '';
      el.appendChild(root);
      ready = true;
      if (ctx.running()) startLoop();
    }

    function fail() {
      /* Página: fica a lista do servidor (dado real). Landing: aviso curto, sem nada inventado. */
      if (serverContent && !(root && root.parentNode === el)) return;
      stopLoop();
      ready = false;
      el.innerHTML = '';
      el.appendChild(status('Os documentos não carregaram agora. Tente de novo mais tarde.'));
    }

    function built(d) {
      try { build(d); } catch (e) {
        if (window.console && window.console.warn) window.console.warn('[ferramentas] fatos: dado não montou', e);
        fail();
      }
    }

    function load() {
      var own = ctx.src('');
      var go = function (url) { ctx.fetchJSON(url).then(built, fail); };
      if (own) { go(own); return; }
      /* Sem data-src (landing): o caminho publicado (com o prefixo da prévia, se houver). */
      var I = window.IAFerr;
      if (I && I.published) {
        I.published().then(function (p) { go((p && p.data && p.data.fatos) || DEFAULT_URL); }, function () { go(DEFAULT_URL); });
      } else go(DEFAULT_URL);
    }

    function onViewport() { if (ready) { reset(); stopLoop(); if (ctx.running()) startLoop(); } }

    var serverContent = /\S/.test(el.textContent || '');
    if (!serverContent) {
      el.innerHTML = '';
      el.appendChild(status('Carregando os documentos mais recentes…'));
    }
    if (narrowMq) {
      if (narrowMq.addEventListener) narrowMq.addEventListener('change', onViewport);
      else if (narrowMq.addListener) narrowMq.addListener(onViewport);
    }
    load();

    return {
      start: function () { startLoop(); },
      stop: function () { stopLoop(); },
      destroy: function () {
        stopLoop();
        if (narrowMq) {
          if (narrowMq.removeEventListener) narrowMq.removeEventListener('change', onViewport);
          else if (narrowMq.removeListener) narrowMq.removeListener(onViewport);
        }
        el.innerHTML = '';
      }
    };
  });
})();
