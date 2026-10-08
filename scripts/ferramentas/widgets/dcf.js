/* Widget "dcf" (SPEC §4; SPEC-v2 §E5 e §E6): tabela de sensibilidade WACC × g do preço justo por
   ação da Empresa A, uma empresa FICTÍCIA. Cada célula é o DCF inteiro recalculado (10 anos de FCFF
   + perpetuidade de Gordon − dívida líquida ÷ ações), com o WACC da linha e o g da coluna.

   ILUSTRATIVO (selo visível): nenhum ticker, nenhum dado de mercado. As premissas são as de
   scripts/ferramentas/content/dcf.ts (EXEMPLO), que monta o exemplo numérico da página com a mesma
   conta: mudou lá, mude aqui (o caso base, WACC 16% e g 4%, dá R$ 25,09 por ação).

   Interação: passar o mouse, tocar ou focar uma célula realça a linha e a coluna e mostra a leitura
   ("se o WACC sobe 1 p.p., o valor cai X%"). Teclado: a tabela é UMA parada de Tab (tabindex
   móvel) e as setas, Home e End andam pelas células. Sem interação, um passeio lento mostra como o
   valor reage ao WACC e ao g (para com o botão de pausa, fora da tela e com movimento reduzido).

   Tamanhos (lê a largura real do quadro):
   - tile (landing, bento 2×1 ≈ 620×220): 5×5; ≥ 470 px de largura, leitura ao lado da tabela;
     abaixo disso, leitura condensada embaixo;
   - page (≈ 640×360): 7×7 a partir de 640 px, 5×5 abaixo; leitura ao lado a partir de 540 px,
     condensada embaixo no celular (cabe nos 300 px que a página reserva).
   Só transform e opacity animam: a cruz (linha + coluna) e o anel da célula escolhida são camadas
   (::after e ::before) que entram por opacidade. */
(function () {
  // Empresa A (fictícia). R$ milhões; ações em milhões. Igual a EXEMPLO em content/dcf.ts.
  var EX = {
    receita0: 1000,
    crescimento: [0.1, 0.09, 0.08, 0.07, 0.06],
    convergencia: 0.04,
    cpv: 0.6,
    sga: 0.18,
    da: 0.04,
    ir: 0.34,
    capex: 0.06,
    giro: 0.1,
    dividaBruta: 250,
    caixa: 50,
    acoes: 30
  };
  // Eixos (iguais a SENS_WACC e SENS_G em content/dcf.ts); o caso base fica no índice 3.
  var WACC = [0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19];
  var G = [0.025, 0.03, 0.035, 0.04, 0.045, 0.05, 0.055];
  var C = 3;
  // Passeio automático: deslocamentos (linha, coluna) a partir do caso base.
  var TOUR = [[0, 0], [1, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-2, 0], [-1, 0], [0, 0], [0, 1], [0, 2], [0, 1], [0, 0], [0, -1], [0, -2], [0, -1]];
  var STEP_MS = 2200;
  var HOLD_MS = 6000;
  var MINUS = '−';

  // FCFF dos anos 1 a 10: mesma conta de projecao() em content/dcf.ts.
  function fluxos() {
    var out = [];
    var anterior = EX.receita0;
    for (var ano = 1; ano <= 10; ano++) {
      var crescimento = ano <= EX.crescimento.length ? EX.crescimento[ano - 1] : EX.convergencia;
      var receita = anterior * (1 + crescimento);
      var ebitda = receita - receita * EX.cpv - receita * EX.sga;
      var da = receita * EX.da;
      var ebit = ebitda - da;
      var imposto = ebit * EX.ir;
      var nopat = ebit - imposto;
      var capex = receita * EX.capex;
      var giro = (receita - anterior) * EX.giro;
      out.push(nopat + da - capex - giro);
      anterior = receita;
    }
    return out;
  }

  // Preço justo por ação: mesma conta de valor() em content/dcf.ts.
  function preco(fcff, wacc, g) {
    var somaVp = 0;
    for (var t = 1; t <= fcff.length; t++) somaVp += fcff[t - 1] / Math.pow(1 + wacc, t);
    var n = fcff.length;
    var vt = (fcff[n - 1] * (1 + g)) / (wacc - g);
    var vpVt = vt / Math.pow(1 + wacc, n);
    var ev = somaVp + vpVt;
    var dividaLiquida = EX.dividaBruta - EX.caixa;
    var equity = ev - dividaLiquida;
    return equity / EX.acoes;
  }

  // Faixa de cor pela diferença para o caso base: 0 (até 2,5%), ±1 (10%), ±2 (20%), ±3 (30%), ±4.
  function heat(d) {
    var a = Math.abs(d);
    var n = a < 0.025 ? 0 : a < 0.1 ? 1 : a < 0.2 ? 2 : a < 0.3 ? 3 : 4;
    return d < 0 ? -n : n;
  }

  window.IAFerr.register('dcf', function (el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var fmt = ctx.fmt;
    var page = ctx.size === 'page';

    var fcff = fluxos();
    var grid = [];
    for (var i = 0; i < WACC.length; i++) {
      grid.push([]);
      for (var j = 0; j < G.length; j++) grid[i].push(preco(fcff, WACC[i], G[j]));
    }
    var base = grid[C][C];

    var sel = { r: C, c: C };
    var lo = 0;
    var hi = WACC.length - 1;
    var compact = !page;
    var wide = !page && ctx.span !== '1x1';
    var auto = true;
    var hold = 0;
    var acc = 0;
    var step = 0;
    var kbd = false;
    var cancelLoop = null;
    var ro = null;
    var onResize = null;

    function pw(x) { return fmt.pct(x, 0); }
    function pg(x) { return fmt.pct(x, 1); }
    function signed(x) {
      var a = fmt.pct(Math.abs(x), 1);
      return x > 0.0005 ? '+' + a : x < -0.0005 ? MINUS + a : a;
    }
    function outer(k) { return k === 0 || k === WACC.length - 1; }

    // ── Tabela ──
    var hintId = ctx.uid('iaw-dcf-hint');
    var cells = [];
    var rowHeads = [];
    var colHeads = [];
    var table = h('table', {
      'class': 'iaw-dcf-table',
      role: 'grid',
      'aria-label': 'Preço justo por ação da Empresa A, fictícia, para cada WACC (linhas) e crescimento na perpetuidade g (colunas)',
      'aria-describedby': hintId
    });
    var thead = h('thead');
    var headRow = h('tr');
    // Canto com diagonal: "g" (colunas) em cima à direita, "WACC" (linhas) embaixo à esquerda.
    headRow.appendChild(h('th', { 'class': 'iaw-dcf-corner', scope: 'col' }, [
      h('span', { 'class': 'iaw-dcf-corner-g', 'aria-hidden': 'true' }, 'g'),
      h('span', { 'class': 'iaw-dcf-corner-w', 'aria-hidden': 'true' }, 'WACC'),
      h('span', { 'class': 'iaw-sr' }, 'WACC nas linhas, g nas colunas')
    ]));
    for (var cj = 0; cj < G.length; cj++) {
      var ch = h('th', { scope: 'col', 'class': 'iaw-dcf-ch' + (outer(cj) ? ' iaw-dcf-out' : '') }, pg(G[cj]));
      colHeads.push(ch);
      headRow.appendChild(ch);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = h('tbody');
    for (var ri = 0; ri < WACC.length; ri++) {
      var tr = h('tr', { 'class': outer(ri) ? 'iaw-dcf-out' : null });
      var rh = h('th', { scope: 'row', 'class': 'iaw-dcf-rh' }, pw(WACC[ri]));
      rowHeads.push(rh);
      tr.appendChild(rh);
      var row = [];
      for (var ci = 0; ci < G.length; ci++) {
        var v = grid[ri][ci];
        var d = v / base - 1;
        var isBase = ri === C && ci === C;
        var td = h('td', {
          role: 'gridcell',
          tabindex: isBase ? '0' : '-1',
          'aria-selected': isBase ? 'true' : 'false',
          'data-r': ri,
          'data-c': ci,
          'data-heat': heat(d),
          'aria-label': fmt.brl(v) + ' com WACC de ' + pw(WACC[ri]) + ' e g de ' + pg(G[ci]) + (isBase ? ', caso base' : ', ' + signed(d) + ' em relação ao caso base')
        }, fmt.num(v, 1));
        td.addEventListener('mouseenter', onPick);
        td.addEventListener('click', onPick);
        td.addEventListener('focus', onFocus);
        td.addEventListener('blur', onBlur);
        td.addEventListener('keydown', onKey);
        row.push(td);
        tr.appendChild(td);
      }
      cells.push(row);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    // ── Leitura ──
    // Fixo e repetido no rótulo da tabela: fica fora do que o leitor de tela anuncia a cada troca.
    var readX = h('span', { 'class': 'iaw-dcf-read-x', 'aria-hidden': 'true' }, 'Empresa A (fictícia)');
    var readK = h('span', { 'class': 'iaw-dcf-read-k' });
    var readV = h('span', { 'class': 'iaw-dcf-read-v' });
    var readD = h('span', { 'class': 'iaw-dcf-read-d' });
    var readW = h('p', { 'class': 'iaw-dcf-read-l' });
    var readG = h('p', { 'class': 'iaw-dcf-read-l' });
    var readC = h('p', { 'class': 'iaw-dcf-read-c' });
    var read = h('div', { 'class': 'iaw-dcf-read', 'aria-live': 'off', 'aria-atomic': 'true' }, [
      readX,
      h('div', { 'class': 'iaw-dcf-read-head' }, [readK, readV, readD]),
      readW,
      readG,
      readC
    ]);

    // ── Pausa do passeio (WCAG 2.2.2) ──
    var pause = h('button', { type: 'button', 'class': 'iaw-dcf-pause', 'aria-pressed': 'false' });
    function icon(playing) {
      return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' },
        playing
          ? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
          : [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
    }
    function setAuto(on) {
      auto = on;
      hold = 0;
      acc = 0;
      pause.setAttribute('aria-pressed', on ? 'false' : 'true');
      pause.setAttribute('aria-label', on ? 'Pausar o passeio pela tabela' : 'Retomar o passeio pela tabela');
      pause.textContent = '';
      pause.appendChild(icon(on));
    }
    pause.addEventListener('click', function () { setAuto(!auto); ctx.track('dcf'); });
    setAuto(true);
    // Com movimento reduzido nada se move sozinho: sem passeio, sem botão.
    if (ctx.reduced) pause.setAttribute('hidden', '');

    // No quadro estreito o prefixo some (o selo e a pausa ocupam o resto da linha).
    var top = h('div', { 'class': 'iaw-dcf-top' }, [
      h('span', { 'class': 'iaw-dcf-title' }, [h('span', { 'class': 'iaw-dcf-title-pre' }, 'Sensibilidade · '), 'WACC × g']),
      h('span', { 'class': 'iaw-dcf-top-r' }, [ctx.seal('Exemplo ilustrativo'), pause])
    ]);

    var foot = null;
    if (page) {
      var legend = h('span', { 'class': 'iaw-dcf-legend', 'aria-hidden': 'true' }, [h('span', null, 'menor')]);
      for (var hv = -4; hv <= 4; hv++) legend.appendChild(h('i', { 'class': 'iaw-dcf-sw', 'data-heat': hv }));
      legend.appendChild(h('span', null, 'maior que o caso base'));
      foot = h('div', { 'class': 'iaw-dcf-foot' }, [
        legend,
        h('span', { 'class': 'iaw-dcf-note' }, 'Empresa A, fictícia · preço justo por ação, em R$')
      ]);
    }

    var hint = h('p', { id: hintId, 'class': 'iaw-sr' }, 'Use as setas do teclado para percorrer a tabela. A célula de contorno tracejado é o caso base.');
    var axis = h('div', { 'class': 'iaw-dcf-axis', 'aria-hidden': 'true' }, 'g: crescimento na perpetuidade →');
    var gridWrap = h('div', { 'class': 'iaw-dcf-gridwrap' }, [axis, table, hint]);
    var root = h('div', { 'class': 'iaw-dcf' }, [top, h('div', { 'class': 'iaw-dcf-body' }, [gridWrap, read]), foot]);

    // ── Estado → DOM ──
    function clamp(k) { return k < lo ? lo : k > hi ? hi : k; }

    function paint() {
      for (var r = 0; r < cells.length; r++) {
        rowHeads[r].className = 'iaw-dcf-rh' + (r === sel.r ? ' is-on' : '');
        for (var c = 0; c < cells[r].length; c++) {
          var on = r === sel.r && c === sel.c;
          var cls = 'iaw-dcf-cell' + (outer(r) || outer(c) ? ' iaw-dcf-out' : '') + (r === C && c === C ? ' is-base' : '') +
            (r === sel.r || c === sel.c ? ' is-cross' : '') + (on ? ' is-sel' : '');
          var td = cells[r][c];
          if (td.className !== cls) td.className = cls;
          td.setAttribute('aria-selected', on ? 'true' : 'false');
          td.setAttribute('tabindex', on ? '0' : '-1');
        }
      }
      for (var k = 0; k < colHeads.length; k++) colHeads[k].className = 'iaw-dcf-ch' + (outer(k) ? ' iaw-dcf-out' : '') + (k === sel.c ? ' is-on' : '');

      var v = grid[sel.r][sel.c];
      var d = v / base - 1;
      var isBase = sel.r === C && sel.c === C;
      readK.textContent = 'WACC ' + pw(WACC[sel.r]) + ' · g ' + pg(G[sel.c]);
      readV.textContent = fmt.brl(v);
      readD.textContent = isBase ? 'caso base' : signed(d) + ' vs. caso base';
      readD.className = 'iaw-dcf-read-d' + (isBase ? '' : d > 0 ? ' is-up' : ' is-down');

      // Leitura: o vizinho de baixo (WACC +1 p.p.) e o da direita (g +0,5 p.p.); na borda, o outro lado.
      var rw = sel.r < hi ? sel.r + 1 : sel.r - 1;
      var cg = sel.c < hi ? sel.c + 1 : sel.c - 1;
      var dw = grid[rw][sel.c] / v - 1;
      var dg = grid[sel.r][cg] / v - 1;
      var upW = rw > sel.r;
      var upG = cg > sel.c;
      readW.textContent = 'Se o WACC ' + (upW ? 'sobe' : 'cai') + ' 1 p.p.' + (page ? ' (para ' + pw(WACC[rw]) + ')' : '') +
        ', o valor ' + (dw < 0 ? 'cai ' : 'sobe ') + fmt.pct(Math.abs(dw), 1) + '.';
      readG.textContent = 'Se o g ' + (upG ? 'sobe' : 'cai') + ' 0,5 p.p.' + (page ? ' (para ' + pg(G[cg]) + ')' : '') +
        ', o valor ' + (dg < 0 ? 'cai ' : 'sobe ') + fmt.pct(Math.abs(dg), 1) + '.';
      readC.textContent = 'WACC ' + (upW ? '+' : MINUS) + '1 p.p.: ' + signed(dw) + ' · g ' + (upG ? '+' : MINUS) + '0,5 p.p.: ' + signed(dg);
    }

    function select(r, c, byUser) {
      sel.r = clamp(r);
      sel.c = clamp(c);
      if (byUser) {
        hold = HOLD_MS;
        // Só a escolha da pessoa é anunciada; o passeio automático fica em silêncio.
        read.setAttribute('aria-live', 'polite');
        ctx.track('dcf');
      }
      paint();
    }

    function cellOf(t) { return { r: +t.getAttribute('data-r'), c: +t.getAttribute('data-c') }; }
    function onPick() { var p = cellOf(this); select(p.r, p.c, true); }
    function onFocus() { kbd = true; var p = cellOf(this); select(p.r, p.c, true); }
    function onBlur() { kbd = false; hold = HOLD_MS; }
    function onKey(ev) {
      var k = ev.key || '';
      var r = sel.r;
      var c = sel.c;
      if (k === 'ArrowUp' || k === 'Up') r -= 1;
      else if (k === 'ArrowDown' || k === 'Down') r += 1;
      else if (k === 'ArrowLeft' || k === 'Left') c -= 1;
      else if (k === 'ArrowRight' || k === 'Right') c += 1;
      else if (k === 'Home') c = lo;
      else if (k === 'End') c = hi;
      else return;
      if (ev.preventDefault) ev.preventDefault();
      select(r, c, true);
      var td = cells[sel.r][sel.c];
      if (td.focus) td.focus();
    }

    // ── Layout pelo tamanho real do quadro ──
    // page: 7×7 com a leitura ao lado a partir de 640 px; 5×5 ao lado de 540 a 639; abaixo de 540
    // (celular), 5×5 com a leitura condensada embaixo. tile: sempre 5×5; ao lado a partir de 470 px.
    // Largura desconhecida (quadro escondido): o menor layout, até o ResizeObserver avisar.
    function layout() {
      var w = el.clientWidth || 0;
      var nextCompact = page ? !w || w < 640 : true;
      var nextWide = page ? w >= 540 : (w ? w >= 470 : ctx.span !== '1x1');
      if (root.className && nextCompact === compact && nextWide === wide) return;
      compact = nextCompact;
      wide = nextWide;
      lo = compact ? 1 : 0;
      hi = compact ? WACC.length - 2 : WACC.length - 1;
      root.className = 'iaw-dcf ' + (page ? 'iaw-dcf--page' : 'iaw-dcf--tile') + (compact ? ' is-compact' : '') + (wide ? ' is-wide' : '');
      select(sel.r, sel.c, false);
    }

    function frame(dt) {
      if (!auto || kbd) return;
      if (hold > 0) { hold -= dt; return; }
      acc += dt;
      if (acc < STEP_MS) return;
      acc = 0;
      step = (step + 1) % TOUR.length;
      read.setAttribute('aria-live', 'off');
      select(C + TOUR[step][0], C + TOUR[step][1], false);
    }

    root.className = '';
    layout();
    el.innerHTML = '';
    el.appendChild(root);
    layout();
    if (window.ResizeObserver) {
      ro = new window.ResizeObserver(function () { layout(); });
      ro.observe(el);
    } else if (window.addEventListener) {
      onResize = function () { layout(); };
      window.addEventListener('resize', onResize);
    }

    function stop() { if (cancelLoop) { cancelLoop(); cancelLoop = null; } }
    return {
      start: function () {
        if (ctx.reduced) { pause.setAttribute('hidden', ''); return; }
        pause.removeAttribute('hidden');
        if (!cancelLoop) cancelLoop = ctx.loop(frame, { fps: 10 });
      },
      stop: stop,
      destroy: function () {
        stop();
        if (ro) ro.disconnect();
        if (onResize && window.removeEventListener) window.removeEventListener('resize', onResize);
        el.innerHTML = '';
      }
    };
  });
})();
