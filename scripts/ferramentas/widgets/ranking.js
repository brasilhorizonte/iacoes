/* Widget "ranking" (SPEC §4; SPEC-v2 §E5 e §E6): as quatro abas do ranking do dia — DY 12m, P/L,
   P/VP e ROE — com DADO REAL do build (/ferramentas/ranking-de-acoes/dados.json, formato em
   DADOS-API §1). Sem selo: o número vem do build e a data aparece no quadro.

   - Página (size 'page', ~640×360): os 8 primeiros da aba (6 abaixo de 640 px), com o setor, a
     barra do indicador e, à direita, a média de 5 anos (aba DY) ou a mediana do setor (demais).
   - Landing (size 'tile', ~300×220): os 5 primeiros da aba, abas curtas e pausa compacta.
   - Trocar de aba reordena com FLIP: as posições antigas são medidas com offsetTop (ignora o
     transform da entrada da seção na landing) no measure() do laço único; as escritas vão no
     mutate(). Só transform e opacity animam (barras com scaleX): a linha que continua desliza até
     a posição nova; a que entra sobe com opacidade.
   - Sequência automática pelas abas enquanto o quadro está em tela (laço único, até 30 fps). Para
     com o mouse ou o foco dentro do quadro e por 10 s depois de um clique; botão Pausar/Retomar.
     Com movimento reduzido: sem sequência e sem animação, o quadro final direto.
   - Abas com teclado (setas, Home e End; tabindex móvel). Cada linha é um link para /TICKER/ (o
     quadro nunca fica dentro de <a>). Texto do JSON entra só por textContent (ctx.h).
   - Honestidade (SPEC §1): só a ordem do indicador, sem rótulo de valor; "não é recomendação" no
     quadro da landing (na página, a legenda do quadro diz o mesmo). */
(function () {
  var KEYS = ['dy', 'pl', 'pvp', 'roe'];
  var TAB = { dy: 'DY 12m', pl: 'P/L', pvp: 'P/VP', roe: 'ROE' };
  var TAB_TILE = { dy: 'DY', pl: 'P/L', pvp: 'P/VP', roe: 'ROE' };
  var TAB_NAME = { dy: 'DY de 12 meses', pl: 'P/L', pvp: 'P/VP', roe: 'ROE' };
  var ORDER = { dy: 'Maior DY de 12 meses primeiro', pl: 'Menor P/L primeiro', pvp: 'Menor P/VP primeiro', roe: 'Maior ROE primeiro' };
  var ORDER_TILE = { dy: 'Maior DY 12m primeiro', pl: 'Menor P/L primeiro', pvp: 'Menor P/VP primeiro', roe: 'Maior ROE primeiro' };
  var DEFAULT_SRC = '/ferramentas/ranking-de-acoes/dados.json';
  var HOLD = 10000;

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function indexOf(list, x) { for (var i = 0; i < list.length; i++) if (list[i] === x) return i; return -1; }
  function valid(d) {
    if (!d || !d.top || !d.rows || !d.rows.length) return false;
    for (var i = 0; i < KEYS.length; i++) if (!d.top[KEYS[i]] || !d.top[KEYS[i]].length) return false;
    return true;
  }

  window.IAFerr.register('ranking', function (el, ctx) {
    var h = ctx.h;
    var fmt = ctx.fmt;
    var page = ctx.size === 'page';
    var mq = page && window.matchMedia ? window.matchMedia('(max-width: 639px)') : null;
    var step = page ? 4600 : 4200;
    var uid = ctx.uid('iaw-rk');
    var data = null;
    var byT = {};
    var medians = null;
    var has5y = false;
    var hasMed = false;
    var cur = 'dy';
    var auto = !ctx.reduced;
    var hold = 0;
    var acc = 0;
    var hovering = false;
    var cancelLoop = null;
    var busyUntil = 0;
    var pending = false;
    var flipSeq = 0;
    var rows = {};
    var shown = [];
    var tabs = {};
    var root = null;
    var list = null;
    var panel = null;
    var sub = null;
    var subMain = null;
    var subExtra = null;
    var dirEl = null;
    var pause = null;

    function now() { return new Date().getTime(); }
    function rowCount() { return page ? (mq && mq.matches ? 6 : 8) : 5; }
    function fmtVal(k, v) { return k === 'dy' || k === 'roe' ? fmt.pct(v, 1) : fmt.mult(v, 2); }
    function medianOf(r, k) {
      var sm = medians && r.sector && has(medians, r.sector) ? medians[r.sector] : null;
      return sm && isNum(sm[k]) ? sm[k] : null;
    }
    /* Texto da direita (página): média de 5 anos na aba DY; mediana do setor nas demais. */
    function altOf(r, k) {
      if (k === 'dy') return isNum(r.dy5y) ? '5 anos ' + fmt.pct(r.dy5y, 1) : '';
      var m = medianOf(r, k);
      return m === null ? '' : 'setor ' + fmtVal(k, m);
    }
    function altSpoken(r, k) {
      if (k === 'dy') return isNum(r.dy5y) ? 'média de 5 anos ' + fmt.pct(r.dy5y, 1) : '';
      var m = medianOf(r, k);
      return m === null ? '' : 'mediana do setor ' + fmtVal(k, m);
    }

    function listFor(k) {
      var top = data.top[k] || [];
      var out = [];
      var max = rowCount();
      for (var i = 0; i < top.length && out.length < max; i++) if (has(byT, top[i])) out.push(top[i]);
      return out;
    }
    /* Barra proporcional ao valor (o maior da lista visível enche a barra): honesta nas abas de
       "menor primeiro" também — lá o 1º colocado tem a barra mais curta. */
    function scales(k, ts) {
      var max = 0;
      var out = {};
      var i;
      var v;
      for (i = 0; i < ts.length; i++) { v = byT[ts[i]][k]; if (isNum(v) && v > max) max = v; }
      for (i = 0; i < ts.length; i++) { v = byT[ts[i]][k]; out[ts[i]] = max > 0 && isNum(v) && v > 0 ? Math.max(0.04, v / max) : 0; }
      return out;
    }

    function onRow() {
      ctx.track('ranking');
      try { if (typeof window._iaTrack === 'function') window._iaTrack('cta_click', page ? 'tool-ranking-widget' : 'lp-tool-ranking-row'); } catch (e) { /* tracking nunca quebra o widget */ }
    }

    function makeRow(t) {
      var r = byT[t];
      var p = {
        pos: h('span', { 'class': 'iaw-ranking-pos iaw-mono', 'aria-hidden': 'true' }),
        fill: h('span', { 'class': 'iaw-ranking-fill' }),
        val: h('span', { 'class': 'iaw-ranking-val iaw-mono' }),
        alt: page ? h('span', { 'class': 'iaw-ranking-alt iaw-mono' }) : null,
        a: null,
        scale: 0
      };
      var kids = [p.pos, h('span', { 'class': 'iaw-ranking-tk iaw-mono' }, t)];
      if (page) kids.push(h('span', { 'class': 'iaw-ranking-sector' }, r.sector || ''));
      kids.push(h('span', { 'class': 'iaw-ranking-bar', 'aria-hidden': 'true' }, p.fill));
      kids.push(p.val);
      if (p.alt) kids.push(p.alt);
      p.a = h('a', { 'class': 'iaw-ranking-link', href: '/' + t + '/', onclick: onRow }, kids);
      var li = h('li', { 'class': 'iaw-ranking-row', 'data-t': t }, p.a);
      li._rk = p;
      return li;
    }

    function fillRow(li, k, i) {
      var p = li._rk;
      var r = byT[li.getAttribute('data-t')];
      var v = fmtVal(k, r[k]);
      var extra = altSpoken(r, k);
      p.pos.textContent = String(i + 1);
      p.val.textContent = v;
      if (p.alt) p.alt.textContent = altOf(r, k);
      p.a.setAttribute('aria-label', r.t + (r.sector ? ' (' + r.sector + ')' : '') + ': ' + (i + 1) + 'º lugar, ' + TAB_NAME[k] + ' ' + v + (extra ? ', ' + extra : ''));
    }

    /* Sem animação (movimento reduzido, quadro parado ou troca no meio de outra): o quadro final. */
    function renderStatic(k) {
      var ts = listFor(k);
      var sc = scales(k, ts);
      flipSeq += 1;
      list.textContent = '';
      root.setAttribute('data-k', k);
      for (var i = 0; i < ts.length; i++) {
        var li = rows[ts[i]] || (rows[ts[i]] = makeRow(ts[i]));
        var st = li.style;
        var fs = li._rk.fill.style;
        fillRow(li, k, i);
        st.transition = ''; st.transitionDelay = ''; st.transform = ''; st.opacity = '';
        fs.transition = 'none'; fs.transitionDelay = ''; fs.transform = 'scaleX(' + sc[ts[i]] + ')';
        li._rk.scale = sc[ts[i]];
        list.appendChild(li);
      }
      shown = ts;
    }

    /* FLIP: `first` = offsetTop de cada linha antes da troca; `base`/`gap` = topo e passo das linhas
       (altura fixa), então a posição nova sai da conta, sem ler o layout de novo. */
    function flip(k, first, base, gap) {
      var seq = (flipSeq += 1);
      var ts = listFor(k);
      var sc = scales(k, ts);
      var entering = {};
      busyUntil = now() + 700;
      list.textContent = '';
      root.setAttribute('data-k', k);
      for (var i = 0; i < ts.length; i++) {
        var t = ts[i];
        var li = rows[t] || (rows[t] = makeRow(t));
        var st = li.style;
        var fs = li._rk.fill.style;
        fillRow(li, k, i);
        st.transition = 'none'; st.transitionDelay = ''; fs.transition = 'none'; fs.transitionDelay = '';
        if (has(first, t) && gap > 0) {
          var dy = first[t] - (base + i * gap);
          st.transform = dy ? 'translateY(' + dy + 'px)' : '';
          st.opacity = '';
          fs.transform = 'scaleX(' + li._rk.scale + ')';
        } else {
          entering[t] = 1;
          st.transform = 'translateY(' + Math.round(gap > 0 ? gap * 0.6 : 12) + 'px)';
          st.opacity = '0';
          fs.transform = 'scaleX(0)';
        }
        list.appendChild(li);
      }
      shown = ts;
      // Quadro seguinte: solta as transições do CSS e leva cada linha à posição e à barra novas.
      ctx.mutate(function () {
        if (seq !== flipSeq) return;
        for (var j = 0; j < ts.length; j++) {
          var row = rows[ts[j]];
          var s2 = row.style;
          var f2 = row._rk.fill.style;
          var delay = entering[ts[j]] ? j * 40 : 0;
          s2.transition = ''; f2.transition = '';
          s2.transitionDelay = delay ? delay + 'ms' : '';
          f2.transitionDelay = (delay + 60) + 'ms';
          s2.transform = ''; s2.opacity = '';
          f2.transform = 'scaleX(' + sc[ts[j]] + ')';
          row._rk.scale = sc[ts[j]];
        }
      });
    }

    function paint(byUser) {
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        var on = k === cur;
        tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
        tabs[k].setAttribute('tabindex', on ? '0' : '-1');
        tabs[k].className = 'iaw-ranking-tab' + (on ? ' is-on' : '');
      }
      panel.setAttribute('aria-labelledby', uid + '-' + cur);
      if (sub) {
        // Troca automática não é anunciada; a escolhida pela pessoa, sim (aria-live polite).
        sub.setAttribute('aria-live', byUser ? 'polite' : 'off');
        subMain.textContent = ORDER[cur];
        subExtra.textContent = cur === 'dy' ? (has5y ? ' · à direita, a média de 5 anos' : '') : (hasMed ? ' · à direita, a mediana do setor' : '');
      }
      if (dirEl) dirEl.textContent = ORDER_TILE[cur];
    }

    function show(k, byUser) {
      if (!data) return;
      if (k === cur && shown.length) { paint(byUser); return; }
      cur = k;
      paint(byUser);
      if (pending) return;   // o FLIP já agendado desenha a aba atual
      if (ctx.reduced || !ctx.running() || now() < busyUntil || !shown.length) { renderStatic(cur); return; }
      pending = true;
      ctx.measure(function () {
        var first = {};
        var i;
        for (i = 0; i < shown.length; i++) if (rows[shown[i]]) first[shown[i]] = rows[shown[i]].offsetTop;
        var r0 = rows[shown[0]];
        var r1 = shown.length > 1 ? rows[shown[1]] : null;
        var base = r0 ? r0.offsetTop : 0;
        var gap = r1 ? r1.offsetTop - base : (r0 ? r0.offsetHeight : 0);
        ctx.mutate(function () {
          pending = false;
          if (gap > 0) flip(cur, first, base, gap); else renderStatic(cur);
        });
      });
    }

    function userPick(k) {
      hold = HOLD;
      acc = 0;
      ctx.track('ranking');
      show(k, true);
    }

    function onKey(e) {
      var k = (e.currentTarget || this).getAttribute('data-k');
      var i = indexOf(KEYS, k);
      var key = e.key || '';
      var j;
      if (key === 'ArrowRight' || key === 'Right') j = i + 1;
      else if (key === 'ArrowLeft' || key === 'Left') j = i - 1;
      else if (key === 'Home') j = 0;
      else if (key === 'End') j = KEYS.length - 1;
      else return;
      if (e.preventDefault) e.preventDefault();
      j = (j + KEYS.length) % KEYS.length;
      userPick(KEYS[j]);
      tabs[KEYS[j]].focus();
    }

    function focusInside() {
      var ae = document.activeElement;
      return !!(ae && root && root.contains && ae !== document.body && root.contains(ae));
    }

    function frame(dt) {
      if (!auto || !data || hovering || focusInside()) return;
      if (hold > 0) { hold -= dt; return; }
      acc += dt;
      if (acc >= step) {
        acc = 0;
        show(KEYS[(indexOf(KEYS, cur) + 1) % KEYS.length], false);
      }
    }

    function startLoop() { if (!cancelLoop && !ctx.reduced && data) cancelLoop = ctx.loop(frame); }
    function stopLoop() { if (cancelLoop) { cancelLoop(); cancelLoop = null; } }

    function icon(playing) {
      var s = ctx.svg;
      return s('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' },
        playing
          ? [s('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), s('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
          : [s('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
    }
    function setAuto(on) {
      auto = on;
      acc = 0;
      if (!pause) return;
      pause.setAttribute('aria-pressed', on ? 'false' : 'true');
      pause.setAttribute('aria-label', on ? 'Pausar a troca automática de abas' : 'Retomar a troca automática de abas');
      if (page) pause.textContent = on ? 'Pausar' : 'Retomar';
      else { pause.textContent = ''; pause.appendChild(icon(on)); }
    }

    function build() {
      var tablist = h('div', { 'class': 'iaw-ranking-tabs', role: 'tablist', 'aria-label': 'Indicador do ranking' });
      for (var i = 0; i < KEYS.length; i++) {
        (function (k) {
          var b = h('button', {
            type: 'button',
            role: 'tab',
            id: uid + '-' + k,
            'class': 'iaw-ranking-tab',
            'aria-controls': uid + '-painel',
            'aria-selected': 'false',
            'data-k': k
          }, page ? TAB[k] : TAB_TILE[k]);
          if (!page && TAB_TILE[k] !== TAB_NAME[k]) b.setAttribute('aria-label', TAB_NAME[k]);
          b.addEventListener('click', function () { userPick(k); });
          b.addEventListener('keydown', onKey);
          tabs[k] = b;
          tablist.appendChild(b);
        })(KEYS[i]);
      }

      if (!ctx.reduced) {
        pause = h('button', { type: 'button', 'class': page ? 'iaw-btn iaw-ranking-pause' : 'iaw-ranking-pause-icon', 'aria-pressed': 'false' });
        pause.addEventListener('click', function () { setAuto(!auto); ctx.track('ranking'); });
        setAuto(auto);
      }

      list = h('ol', { 'class': 'iaw-ranking-list' });
      panel = h('div', { 'class': 'iaw-ranking-panel', role: 'tabpanel', id: uid + '-painel', 'aria-labelledby': uid + '-dy' }, list);

      var bi = data.minMarketCap / 1e9;
      var cap = isNum(bi) && bi > 0 ? (bi % 1 === 0 ? String(bi) : fmt.num(bi, 1)) : '';
      var foot;
      if (page) {
        subMain = h('span', null, '');
        subExtra = h('span', { 'class': 'iaw-ranking-sub-extra' });
        sub = h('p', { 'class': 'iaw-ranking-sub', 'aria-live': 'off' }, [subMain, subExtra]);
        foot = h('p', { 'class': 'iaw-ranking-foot' }, [
          h('span', null, ['Dados de ', h('strong', null, data.dateBR || fmt.date(data.date))]),
          isNum(data.count) && cap ? h('span', { 'class': 'iaw-ranking-foot-extra' }, data.count + ' empresas a partir de R$ ' + cap + ' bi') : null
        ]);
      } else {
        dirEl = h('strong', null, '');
        foot = h('div', { 'class': 'iaw-ranking-foot' }, [
          h('span', null, [dirEl, ' · ' + (data.dateBR || fmt.date(data.date))]),
          h('span', null, 'Ordenação por indicador, não é recomendação.')
        ]);
      }

      root = h('div', { 'class': 'iaw-ranking ' + (page ? 'iaw-ranking--page' : 'iaw-ranking--tile'), 'data-k': cur }, [
        h('div', { 'class': 'iaw-ranking-top' }, [tablist, pause]),
        sub,
        panel,
        foot
      ]);
      root.addEventListener('mouseenter', function () { hovering = true; });
      root.addEventListener('mouseleave', function () { hovering = false; });

      renderStatic(cur);
      paint(false);
      el.innerHTML = '';
      el.appendChild(root);
      if (ctx.running()) startLoop();
    }

    function fail(e) {
      try { if (window.console && window.console.warn) window.console.warn('[ferramentas] ranking: dado indisponível', e || ''); } catch (x) { /* nada */ }
      if (page || root) return;   // na página fica a tabela do servidor
      el.innerHTML = '';
      el.appendChild(h('p', { 'class': 'iaw-ranking-erro' }, 'O ranking não carregou agora. Recarregue a página para tentar de novo.'));
    }

    function load() {
      var s = ctx.src('');
      if (s) return ctx.fetchJSON(s);
      var I = window.IAFerr;
      // Landing: o caminho do dado vem do publicadas.json (com o prefixo da prévia, quando houver).
      if (I && I.published) {
        return I.published().then(function (p) {
          return ctx.fetchJSON((p && p.data && p.data.ranking) || DEFAULT_SRC);
        }, function () { return ctx.fetchJSON(DEFAULT_SRC); });
      }
      return ctx.fetchJSON(DEFAULT_SRC);
    }

    function onMq() { if (data && root) renderStatic(cur); }
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }

    load().then(function (d) {
      if (!valid(d)) throw new Error('dados.json do ranking sem as quatro abas');
      for (var i = 0; i < d.rows.length; i++) if (d.rows[i] && d.rows[i].t) byT[d.rows[i].t] = d.rows[i];
      data = d;
      medians = d.sectorMedian && typeof d.sectorMedian === 'object' ? d.sectorMedian : null;
      for (var t in byT) {
        if (!has(byT, t)) continue;
        if (isNum(byT[t].dy5y)) has5y = true;
        if (medians && byT[t].sector && has(medians, byT[t].sector)) hasMed = true;
      }
      build();
    }).then(null, fail);

    return {
      start: function () { startLoop(); },
      stop: function () { stopLoop(); },
      destroy: function () {
        stopLoop();
        if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMq); else if (mq.removeListener) mq.removeListener(onMq); }
        if (root) el.innerHTML = '';
      }
    };
  });
})();
