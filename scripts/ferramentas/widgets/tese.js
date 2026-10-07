/* Widget "tese" (SPEC §4; SPEC-v2 §B9, §E5, §E6): o cartão de Minhas Teses da "Ação A", empresa
   fictícia, com preço-alvo, confiança (1 a 10) e os 6 critérios que a plataforma confere uma vez por
   dia: ROE mínimo, P/L máximo, DY mínimo, Dív. Líq./EBITDA máximo, Margem EBITDA mínima e Margem
   líquida mínima. A sequência mostra duas conferências diárias: no dia 1 todos os critérios seguem de
   pé; no dia 2 sai um balanço novo, a dívida passa do limite e o critério vira ✗. Na página, o aviso
   "Critério da tese violado" aparece como chega nos planos pagos: no resumo da manhã, não na hora.

   ILUSTRATIVO (selo visível): nenhum ticker. Os números são os da Ação A do exemplo da página
   (content/tese.ts: cotação R$ 35, alvo R$ 42, confiança 7/10, os mesmos 6 limites). O ✓/✗ sai da
   regra do app (valor do dia contra o mínimo ou o máximo), não de uma tabela pronta. Minhas Teses não
   usa IA, e o widget não mostra IA.

   Tamanhos: 'page' (~640×360; cabe na altura reservada pelo quadro: 266 px úteis no celular e 326 px
   a partir de 640 px) com os rótulos da tela, o valor de hoje e os botões Dia 1, Dia 2 e Pausar;
   'tile' (~300×220, landing) compacto, com a pausa no topo. Abaixo de 400 px de tela, a página usa
   rótulos curtos (o rótulo completo continua para o leitor de tela).
   Movimento: só opacity e transform (CSS); o laço é o único do runtime; a troca automática não é
   anunciada (aria-live="off"), a escolha da pessoa é ("polite"). Com movimento reduzido, desenha
   direto o quadro final (dia 2) e os botões trocam o dia sem animar.

   Também registra 'tese-modelo': o botão "Copiar modelo" da versão em texto do modelo de tese (seção
   SSR tese-modelo, sections/tese.tsx). Sem JS, o texto do servidor continua selecionável. */
(function () {
  var CRIT = [
    { label: 'ROE mínimo', short: 'ROE mín.', noun: 'ROE', op: 'min', lim: 0.15, kind: 'pct', v: [0.182, 0.176] },
    { label: 'P/L máximo', short: 'P/L máx.', noun: 'P/L', op: 'max', lim: 12, kind: 'mult', v: [10.9, 11.0] },
    { label: 'DY mínimo', short: 'DY mín.', noun: 'DY', op: 'min', lim: 0.05, kind: 'pct', v: [0.057, 0.056] },
    { label: 'Dív. Líq./EBITDA máximo', short: 'DL/EBITDA máx.', noun: 'Dív. Líq./EBITDA', op: 'max', lim: 3, kind: 'mult', v: [2.4, 3.2] },
    { label: 'Margem EBITDA mínima', short: 'Mg. EBITDA mín.', noun: 'Margem EBITDA', op: 'min', lim: 0.2, kind: 'pct', v: [0.245, 0.218] },
    { label: 'Margem líquida mínima', short: 'Mg. líquida mín.', noun: 'Margem líquida', op: 'min', lim: 0.1, kind: 'pct', v: [0.123, 0.111] }
  ];
  var DAYS = [
    { price: 35, note: 'conferência do dia' },
    { price: 35.6, note: 'saiu o balanço do trimestre' }
  ];
  var ALVO = 42;
  var CONF = 7;
  var SLOT = 380;   // ms por critério conferido

  function passes(c, d) { return c.op === 'min' ? c.v[d] >= c.lim : c.v[d] <= c.lim; }
  function brokenCount(d) {
    var n = 0;
    for (var i = 0; i < CRIT.length; i++) if (!passes(CRIT[i], d)) n += 1;
    return n;
  }

  window.IAFerr.register('tese', function (el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var fmt = ctx.fmt;
    var page = ctx.size === 'page';
    var reduced = !!ctx.reduced;

    // Linha do tempo de um ciclo (ms): conferência do dia 1, pausa, dia 2, resumo e (página) aviso.
    var T_CHECK1 = 500;
    var END1 = T_CHECK1 + CRIT.length * SLOT;
    var T_DAY2 = END1 + 2600;
    var T_CHECK2 = T_DAY2 + 600;
    var END2 = T_CHECK2 + CRIT.length * SLOT;
    var T_ALERT = END2 + 900;
    var CYCLE = page ? T_ALERT + 3800 : END2 + 3600;

    var t = 0;
    var auto = !reduced;
    var hold = 0;
    var running = false;
    var cancelLoop = null;
    var live = false;
    var cur = null;

    function value(c, d) { return c.kind === 'pct' ? fmt.pct(c.v[d], 1) : fmt.mult(c.v[d], 1); }
    function limit(c) { return (c.op === 'min' ? '≥ ' : '≤ ') + (c.kind === 'pct' ? fmt.pct(c.lim, 0) : fmt.mult(c.lim, 1)); }
    function upside(d) { return (ALVO - DAYS[d].price) / DAYS[d].price; }
    function sr(text) { return h('span', { 'class': 'iaw-sr' }, text); }

    function icon(kind) {
      var a = { viewBox: '0 0 16 16', width: '16', height: '16', 'aria-hidden': 'true', focusable: 'false', 'class': 'iaw-tese-ic iaw-tese-ic-' + kind };
      if (kind === 'ok') return svg('svg', a, [svg('circle', { cx: '8', cy: '8', r: '7.25' }), svg('path', { d: 'M4.7 8.3l2.2 2.2 4.4-4.7' })]);
      if (kind === 'no') return svg('svg', a, [svg('circle', { cx: '8', cy: '8', r: '7.25' }), svg('path', { d: 'M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2' })]);
      return svg('svg', a, [svg('circle', { cx: '8', cy: '8', r: '2.6' })]);
    }
    function playIcon(playing) {
      return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false', 'class': 'iaw-tese-pi' },
        playing
          ? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
          : [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
    }

    // ── Cabeçalho do cartão: Ação A, alvo (com a distância até ele) e confiança ──
    // No celular estreito, o ícone de alvo substitui a palavra (que fica para o leitor de tela) e,
    // abaixo de 350 px, a distância até o alvo também sai da vista (CSS).
    var alvoNum = h('span', { 'class': 'iaw-mono' });
    var alvoUp = h('span', { 'class': 'iaw-mono iaw-tese-up' });
    var alvo = h('span', { 'class': 'iaw-tese-pill iaw-tese-alvo' }, [
      page ? svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false', 'class': 'iaw-tese-alvo-ic' }, [
        svg('circle', { cx: '8', cy: '8', r: '6.25' }), svg('circle', { cx: '8', cy: '8', r: '3' }), svg('circle', { cx: '8', cy: '8', r: '.6' })
      ]) : null,
      h('span', { 'class': 'iaw-tese-alvo-word' }, page ? 'Alvo: ' : 'Alvo '),
      alvoNum,
      alvoUp
    ]);
    var conf = h('span', { 'class': 'iaw-tese-pill iaw-tese-conf' }, [
      page ? h('span', { 'class': 'iaw-tese-conf-word' }, 'Confiança ') : sr('Confiança na tese: '),
      h('span', { 'class': 'iaw-mono' }, CONF + '/10')
    ]);
    var tk = h('span', { 'class': 'iaw-tese-tk' }, 'Ação A');

    // ── Critérios ──
    var rows = [];
    var list = h('ul', { 'class': 'iaw-tese-list', 'aria-label': 'Critérios da tese' });
    for (var i = 0; i < CRIT.length; i++) {
      var c = CRIT[i];
      var val = h('span', { 'class': 'iaw-mono' });
      var status = sr('');
      var label = page
        ? h('span', { 'class': 'iaw-tese-crit' }, [h('span', { 'class': 'iaw-tese-long' }, c.label), h('span', { 'class': 'iaw-tese-short', 'aria-hidden': 'true' }, c.short)])
        : h('span', { 'class': 'iaw-tese-crit' }, c.short);
      var row = h('li', { 'class': 'iaw-tese-row', 'data-st': 'wait' }, [
        label,
        h('span', { 'class': 'iaw-tese-lim iaw-mono' }, limit(c)),
        h('span', { 'class': 'iaw-tese-val' }, [page ? h('span', { 'class': 'iaw-tese-hoje' }, 'hoje ') : sr('hoje '), val]),
        h('span', { 'class': 'iaw-tese-st' }, [icon('wait'), icon('ok'), icon('no')]),
        status
      ]);
      rows.push({ el: row, val: val, status: status, st: '', chk: false });
      list.appendChild(row);
    }

    // ── Resultado da conferência e aviso (o aviso só na página) ──
    var sumIcon = h('span', { 'class': 'iaw-tese-sum-ic', 'aria-hidden': 'true' });
    var sumLong = h('span', { 'class': page ? 'iaw-tese-long' : 'iaw-sr' });
    var sumShort = h('span', { 'class': page ? 'iaw-tese-short' : '', 'aria-hidden': 'true' });
    var sum = h('p', { 'class': 'iaw-tese-sum' }, [sumIcon, sumLong, sumShort]);
    var notice = page ? h('p', { 'class': 'iaw-tese-alert', 'aria-hidden': 'true' }, [
      h('span', { 'class': 'iaw-tese-alert-tag' }, 'Planos pagos'),
      h('span', { 'class': 'iaw-tese-long' }, 'Aviso no resumo da manhã: Critério da tese violado — Ação A'),
      h('span', { 'class': 'iaw-tese-short', 'aria-hidden': 'true' }, 'Aviso no resumo da manhã')
    ]) : null;
    var out = h('div', { 'class': 'iaw-tese-out', 'aria-live': 'off' }, [sum, notice]);

    // ── Controles: dia 1 / dia 2 (página) e pausa ──
    var dayBtns = [];
    var days = null;
    if (page) {
      days = h('span', { 'class': 'iaw-tese-days', role: 'group', 'aria-label': 'Conferência diária' });
      for (var d = 0; d < DAYS.length; d++) {
        (function (dd) {
          var b = h('button', { type: 'button', 'class': 'iaw-tese-day', 'aria-pressed': 'false' }, 'Dia ' + (dd + 1));
          b.addEventListener('click', function () { choose(dd); });
          dayBtns.push(b);
          days.appendChild(b);
        })(d);
      }
    }
    var dayChip = page ? null : h('span', { 'class': 'iaw-tese-daychip' });
    var price = h('span', { 'class': 'iaw-mono' });
    var note = h('span', { 'class': 'iaw-tese-note' });
    var pause = reduced ? null : h('button', { type: 'button', 'class': page ? 'iaw-btn iaw-tese-pause' : 'iaw-tese-pause-icon', 'aria-pressed': 'false' });

    function setAuto(on) {
      auto = on;
      if (!pause) return;
      pause.setAttribute('aria-pressed', on ? 'false' : 'true');
      pause.setAttribute('aria-label', on ? 'Pausar a conferência automática' : 'Retomar a conferência automática');
      pause.textContent = '';
      pause.appendChild(playIcon(on));
      if (page) pause.appendChild(h('span', { 'class': 'iaw-tese-pause-txt' }, on ? 'Pausar' : 'Retomar'));
      if (on) startLoop(); else stopLoop();
    }
    if (pause) pause.addEventListener('click', function () { ctx.track('tese'); setAuto(!auto); });

    // ── Estado → DOM (só escreve o que mudou) ──
    function stateAt(x) {
      var s = { day: 0, done: 0, chk: -1, sum: false, alert: false };
      var start = T_CHECK1;
      var end = END1;
      if (x >= T_DAY2) { s.day = 1; start = T_CHECK2; end = END2; }
      if (x >= start) {
        s.done = Math.min(CRIT.length, Math.floor((x - start) / SLOT));
        if (s.done < CRIT.length) s.chk = s.done;
      }
      s.sum = x >= end;
      s.alert = page && s.day === 1 && x >= T_ALERT;
      return s;
    }
    function finalAt(d) { return d === 0 ? END1 : (page ? T_ALERT : END2); }

    var flip = false;
    var tone = ' is-ok';
    function setDay(d) {
      for (var i = 0; i < rows.length; i++) rows[i].val.textContent = value(CRIT[i], d);
      alvoNum.textContent = fmt.brl(ALVO);
      alvoUp.textContent = ' (+' + fmt.pct(upside(d), 1) + ')';
      price.textContent = fmt.brl(DAYS[d].price);
      note.textContent = DAYS[d].note;
      if (dayChip) dayChip.textContent = 'dia ' + (d + 1);
      for (var j = 0; j < dayBtns.length; j++) dayBtns[j].setAttribute('aria-pressed', j === d ? 'true' : 'false');
      // Valores novos do dia "acendem" (opacity), alternando o nome da animação para reiniciá-la. Só
      // com o quadro ligado: parado (fora da tela, aba escondida, pausa geral), a animação CSS fica
      // congelada pelo runtime e o número ficaria apagado.
      if (cur && ctx.running() && !ctx.reduced) { flip = !flip; root.setAttribute('data-flash', flip ? 'a' : 'b'); }
      else if (root) root.removeAttribute('data-flash');
    }

    function paint(s) {
      var dayChanged = !cur || cur.day !== s.day;
      if (dayChanged) setDay(s.day);
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var st = i < s.done ? (passes(CRIT[i], s.day) ? 'ok' : 'no') : 'wait';
        var chk = i === s.chk;
        if (st !== r.st) {
          r.st = st;
          r.el.setAttribute('data-st', st);
          r.status.textContent = st === 'ok' ? ', dentro do limite' : st === 'no' ? ', fora do limite' : ', aguardando a conferência';
        }
        if (chk !== r.chk) {
          r.chk = chk;
          r.el.className = 'iaw-tese-row' + (chk ? ' is-checking' : '');
        }
      }
      if (dayChanged || !cur || cur.sum !== s.sum) {
        var n = brokenCount(s.day);
        var bad = n > 0;
        if (s.sum) {
          var first = null;
          for (var k = 0; k < CRIT.length && !first; k++) if (!passes(CRIT[k], s.day)) first = CRIT[k];
          // "1 de 6 critérios quebrou" (concordância com "1"); "2 de 6 critérios quebraram".
          var head = n + ' de ' + CRIT.length + ' critérios ' + (n === 1 ? 'quebrou' : 'quebraram');
          sumLong.textContent = bad ? head + ': ' + first.noun + (first.op === 'max' ? ' acima de ' : ' abaixo de ') + (first.kind === 'pct' ? fmt.pct(first.lim, 0) : fmt.mult(first.lim, 1)) : 'Todos os critérios com dado seguem de pé';
          sumShort.textContent = bad ? head : 'Todos os critérios de pé';
          sumIcon.textContent = '';
          sumIcon.appendChild(icon(bad ? 'no' : 'ok'));
        }
        // A cor só muda com o resumo à vista: ao sumir, o texto do dia anterior sai com a cor dele.
        if (s.sum) tone = bad ? ' is-bad' : ' is-ok';
        sum.className = 'iaw-tese-sum' + (s.sum ? ' is-on' : '') + tone;
        sum.setAttribute('aria-hidden', s.sum ? 'false' : 'true');
      }
      if (notice && (!cur || cur.alert !== s.alert)) {
        notice.className = 'iaw-tese-alert' + (s.alert ? ' is-on' : '');
        notice.setAttribute('aria-hidden', s.alert ? 'false' : 'true');
      }
      cur = s;
    }

    // ── Laço (o único do runtime) ──
    function frame(dt) {
      if (!auto) return;
      if (hold > 0) { hold -= dt; return; }
      if (live) { out.setAttribute('aria-live', 'off'); live = false; }   // troca automática não é anunciada
      t += dt;
      if (t >= CYCLE) t = t % CYCLE;
      paint(stateAt(t));
    }
    function startLoop() { if (!cancelLoop && auto && running && !ctx.reduced) cancelLoop = ctx.loop(frame); }
    function stopLoop() { if (cancelLoop) { cancelLoop(); cancelLoop = null; } }

    function choose(d) {
      ctx.track('tese');
      out.setAttribute('aria-live', 'polite');
      live = true;
      t = finalAt(d);
      hold = 7000;
      paint(stateAt(t));
    }

    // ── Montagem ──
    var root;
    var cardKids;
    if (page) {
      cardKids = [
        h('div', { 'class': 'iaw-tese-head' }, [tk, alvo, conf]),
        h('div', { 'class': 'iaw-tese-meta' }, [days, h('span', { 'class': 'iaw-tese-px' }, [h('span', { 'class': 'iaw-tese-px-word' }, 'cotação '), price]), h('span', { 'class': 'iaw-tese-sep', 'aria-hidden': 'true' }, '·'), note, pause]),
        list,
        out
      ];
      root = h('div', { 'class': 'iaw-tese iaw-tese--page', role: 'group', 'aria-label': 'Cartão de Minhas Teses da Ação A, empresa fictícia (exemplo ilustrativo)' }, [
        h('div', { 'class': 'iaw-tese-top' }, [h('span', { 'class': 'iaw-tese-title' }, 'Minhas Teses'), ctx.seal('Exemplo ilustrativo')]),
        h('div', { 'class': 'iaw-tese-card' }, cardKids)
      ]);
    } else {
      cardKids = [
        h('div', { 'class': 'iaw-tese-sub' }, [alvo, dayChip]),
        list,
        out
      ];
      root = h('div', { 'class': 'iaw-tese iaw-tese--tile', role: 'group', 'aria-label': 'Cartão de Minhas Teses da Ação A, empresa fictícia (exemplo ilustrativo)' }, [
        h('div', { 'class': 'iaw-tese-top' }, [h('span', { 'class': 'iaw-tese-tile-id' }, [tk, conf]), h('span', { 'class': 'iaw-tese-top-right' }, [ctx.seal('Exemplo ilustrativo'), pause])]),
        h('div', { 'class': 'iaw-tese-card' }, cardKids)
      ]);
    }

    setAuto(auto);
    // Sem movimento: o quadro final (dia 2, com o critério quebrado e, na página, o aviso).
    t = reduced ? finalAt(1) : 0;
    paint(stateAt(t));
    el.innerHTML = '';
    el.appendChild(root);

    return {
      start: function () { running = true; startLoop(); },
      stop: function () { running = false; stopLoop(); },
      destroy: function () { stopLoop(); el.innerHTML = ''; }
    };
  });

  // ── 'tese-modelo': botão "Copiar modelo" na versão em texto do modelo (sections/tese.tsx) ──
  function legacyCopy(text) {
    var ok = false;
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    try { ta.select(); ok = !!document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text, done) {
    var nav = window.navigator;
    var fallback = function () { done(legacyCopy(text)); };
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try { nav.clipboard.writeText(text).then(function () { done(true); }, fallback); return; } catch (e) { /* cai no modo antigo */ }
    }
    fallback();
  }
  function selectAll(node) {
    try {
      var sel = window.getSelection ? window.getSelection() : null;
      if (!sel || !document.createRange) return;
      var range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* sem seleção: a dica do servidor continua valendo */ }
  }

  window.IAFerr.register('tese-modelo', function (el, ctx) {
    var h = ctx.h;
    var pre = el.querySelector('pre');
    var slot = el.querySelector('[data-tese-copy]');
    var tip = el.querySelector('[data-tese-dica]');
    if (!pre || !slot) throw new Error('bloco do modelo sem <pre> ou sem [data-tese-copy]');
    var timer = null;
    var msg = h('span', { 'class': 'iaw-tese-copy-msg', role: 'status', 'aria-live': 'polite' });
    var btn = h('button', { type: 'button', 'class': 'iaw-btn iaw-tese-copy-btn' }, [
      ctx.svg('svg', { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true', focusable: 'false' }, [
        ctx.svg('rect', { x: '5.5', y: '5.5', width: '8', height: '8.5', rx: '1.5' }),
        ctx.svg('path', { d: 'M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v6A1.5 1.5 0 0 0 4 10.5h.5' })
      ]),
      h('span', null, 'Copiar modelo')
    ]);
    function say(text) {
      msg.textContent = text;
      if (timer && window.clearTimeout) window.clearTimeout(timer);
      timer = window.setTimeout ? window.setTimeout(function () { msg.textContent = ''; timer = null; }, 6000) : null;
    }
    btn.addEventListener('click', function () {
      ctx.track('tese-modelo');
      copyText(pre.textContent || '', function (ok) {
        if (ok) say('Modelo copiado. Cole no seu bloco de notas ou planilha.');
        else { selectAll(pre); say('Não deu para copiar sozinho: o texto ficou selecionado. Use Ctrl+C ou o menu Copiar.'); }
      });
    });
    var tipBefore = tip ? tip.textContent : '';
    if (tip) tip.textContent = 'Copie com o botão ou selecione o texto. Preencha os espaços e deixe em branco o que não usar.';
    slot.appendChild(btn);
    slot.appendChild(msg);
    return {
      start: function () {},
      stop: function () {},
      destroy: function () {
        if (timer && window.clearTimeout) window.clearTimeout(timer);
        if (btn.parentNode) btn.parentNode.removeChild(btn);
        if (msg.parentNode) msg.parentNode.removeChild(msg);
        if (tip) tip.textContent = tipBefore;
      }
    };
  });
})();
