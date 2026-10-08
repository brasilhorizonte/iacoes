/* Widget "markowitz" (SPEC §4; SPEC-v2 §B7, §E5, §E6): port fiel do MarkowitzExplainer do app
   (otimizador/components/MarkowitzExplainer.tsx, 30/09/2026). Ciclo contínuo de 18 s em 4 atos:
     1. cada ATIVO é um ponto de risco × retorno esperado;
     2. carteiras sorteadas com os mesmos ativos e pesos diferentes viram a nuvem (cada ponto é
        uma CARTEIRA, nunca um ativo), com a barra de pesos trocando a cada 270 ms;
     3. a borda de cima da nuvem vira a fronteira eficiente (curva dourada se desenhando);
     4. a reta da taxa livre gira até tocar a fronteira: a tangência ("maior Sharpe") e os pesos
        dela, acima da barra fina "sua carteira hoje".
   Mesma geometria (viewBox 360×220), mesmo sorteio determinístico (LCG, semente 11: 260 carteiras
   e 24 conjuntos de pesos, na mesma ordem de consumo), mesmas fases e suavização (smoothstep).

   ILUSTRATIVO (selo visível): ativos "Ação A"…"Ação E" (o original usava tickers reais em posições
   inventadas), eixos sem números. A barra "sua carteira hoje" é normalizada para 100% (no original
   somava 65%). Legenda honesta: o sorteio só desenha a nuvem; a fronteira e a tangência saem da
   conta exata.

   Diferenças técnicas em relação ao original (mesmo resultado na tela):
     - só transform e opacity animam: a fronteira se revela por um recorte (clipPath) que avança
       pelo comprimento da curva, a reta gira com rotate(), a tangência assenta com scale(), as
       barras de pesos usam translate + scaleX e o progresso usa scaleX;
     - o laço é o laço único do runtime (30 fps), que só roda com o quadro em tela;
     - movimento reduzido: quadro final completo e parado (t = 0,90, barras 100% opacas);
     - a barra de progresso virou 5 botões, um por etapa: dá para ir a uma etapa pelo teclado
       (tocando, a etapa recomeça; pausado ou com movimento reduzido, mostra o quadro dela pronto);
     - o texto do SVG cresce quando o gráfico fica pequeno (ResizeObserver), para continuar legível
       no quadro da landing (tile) e na página (page). */
(function () {
  var W = 360;
  var CYCLE_MS = 18000;
  var FPS = 30;
  /* Fases do ciclo, em fração do ciclo (iguais às do original). */
  var P_CLOUD = 0.14;
  var P_FRONTIER = 0.5;
  var P_TANGENCY = 0.64;
  var P_WEIGHTS = 0.82;
  var P_RESET = 0.96;
  /* Quadro do movimento reduzido: tudo desenhado, barras com a opacidade final. */
  var FINAL_T = 0.9;

  var STEPS = [
    { at: 0, end: P_CLOUD, rest: 0.13, title: 'Cada ativo tem risco e retorno',
      text: 'Risco (volatilidade) no eixo de baixo; retorno esperado em 12 meses no lateral. O retorno é premissa sua: vem do seu preço-alvo.' },
    { at: P_CLOUD, end: P_FRONTIER, rest: 0.4999, title: 'Cada ponto é uma carteira sorteada',
      text: 'Os mesmos ativos, com pesos diferentes. A nuvem fica à esquerda dos ativos porque a correlação entre eles é menor que 1: juntos, oscilam menos.' },
    { at: P_FRONTIER, end: P_TANGENCY, rest: 0.6399, title: 'A borda de cima é a fronteira eficiente',
      text: 'Para cada nível de risco, a carteira de maior retorno esperado. A fronteira sai de uma conta exata; o sorteio só desenha o terreno.' },
    { at: P_TANGENCY, end: P_WEIGHTS, rest: 0.8, title: 'A reta da taxa livre encontra a tangência',
      text: 'Onde a reta toca a fronteira está a carteira de maior índice de Sharpe: o melhor retorno acima da taxa livre por unidade de risco.' },
    { at: P_WEIGHTS, end: 1, rest: FINAL_T, title: 'Esses são os pesos que o relatório compara com os seus',
      text: 'A barra fina é a sua carteira hoje. Na plataforma, você muda as premissas, a parte em CDI e os limites por ativo, e a conta refaz tudo.' }
  ];

  /* ── Geometria (viewBox 360×220): ativos nos cantos do conjunto viável, nuvem à esquerda ── */
  var ASSETS = [[118, 150], [176, 76], [226, 118], [268, 66], [304, 170]];
  var LETTERS = ['A', 'B', 'C', 'D', 'E'];
  var RF = [50, 126];
  var TG = [132, 62];
  var SLOPE = (RF[1] - TG[1]) / (TG[0] - RF[0]);
  var CAL_LEN = 330 - RF[0];
  var FRONTIER = 'M78 148 C 84 110, 104 78, 132 62 S 220 50, 268 66';
  var TOP = [[78, 148], [104, 92], [132, 62], [200, 52], [268, 66], [304, 170]];
  var BOTTOM = [[78, 148], [130, 176], [220, 188], [304, 170]];
  /* As duas cúbicas da fronteira (o "S" espelha o controle 104,78 em torno de 132,62). */
  var CURVES = [[[78, 148], [84, 110], [104, 78], [132, 62]], [[132, 62], [160, 46], [220, 50], [268, 66]]];

  function lerp(pts, x) {
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        var x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return pts[pts.length - 1][1];
  }

  /* Sorteio determinístico: LCG das constantes do Numerical Recipes, semente 11 (o produto fica
     abaixo de 2^53, então a conta é exata e a nuvem é a mesma em todo carregamento). Primeiro a
     nuvem (x, depois o mínimo de duas uniformes: mais carteiras perto da fronteira), depois os 24
     conjuntos de pesos: a mesma ordem de consumo do original. */
  var seed = 11;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  var CLOUD = [];
  var i;
  for (i = 0; i < 260; i++) {
    var cx = 80 + rnd() * 222;
    var top = lerp(TOP, cx) + 2;
    var bottom = lerp(BOTTOM, cx) - 3;
    CLOUD.push([cx, top + Math.min(rnd(), rnd()) * Math.max(0, bottom - top)]);
  }
  /* Pesos sorteados que a barra mostra durante a nuvem (somam 100%; nenhum perto de zero). */
  var WEIGHT_SETS = [];
  for (i = 0; i < 24; i++) {
    var raw = [];
    var sum = 0;
    for (var k = 0; k < ASSETS.length; k++) { raw.push(0.05 + rnd()); sum += raw[k]; }
    for (k = 0; k < raw.length; k++) raw[k] = raw[k] / sum;
    WEIGHT_SETS.push(raw);
  }
  var TANGENCY_WEIGHTS = [0.14, 0.25, 0.18, 0.25, 0.18];
  /* "Sua carteira hoje": as proporções do original (8, 8, 15, 22, 12), normalizadas para 100%. */
  var CURRENT_WEIGHTS = (function () {
    var w = [0.08, 0.08, 0.15, 0.22, 0.12];
    var s = 0;
    var j;
    for (j = 0; j < w.length; j++) s += w[j];
    for (j = 0; j < w.length; j++) w[j] = w[j] / s;
    return w;
  })();

  /* Comprimento acumulado da fronteira → x: o recorte avança pelo comprimento da curva, como o
     stroke-dashoffset do original (pathLength = 1). */
  var ARC = [[0, 78]];
  var ARC_LEN = (function () {
    var len = 0;
    var px = 78;
    var py = 148;
    for (var c = 0; c < CURVES.length; c++) {
      var p = CURVES[c];
      for (var s = 1; s <= 48; s++) {
        var u = s / 48;
        var v = 1 - u;
        var x = v * v * v * p[0][0] + 3 * v * v * u * p[1][0] + 3 * v * u * u * p[2][0] + u * u * u * p[3][0];
        var y = v * v * v * p[0][1] + 3 * v * v * u * p[1][1] + 3 * v * u * u * p[2][1] + u * u * u * p[3][1];
        len += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
        ARC.push([len, x]);
        px = x;
        py = y;
      }
    }
    return len;
  })();
  function revealX(f) {
    if (f <= 0) return 0;
    if (f >= 1) return W;
    var target = f * ARC_LEN;
    for (var j = 1; j < ARC.length; j++) {
      if (ARC[j][0] >= target) {
        var a = ARC[j - 1];
        var b = ARC[j];
        return a[1] + ((target - a[0]) / (b[0] - a[0])) * (b[1] - a[1]) + 1.5;   // + meia ponta redonda
      }
    }
    return W;
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  /* 0 → 1 dentro de [a, b], com suavização (smoothstep do original). */
  function ease(t, a, b) {
    var u = clamp01((t - a) / (b - a));
    return u * u * (3 - 2 * u);
  }
  function stepAt(t) {
    for (var j = STEPS.length - 1; j > 0; j--) if (t >= STEPS[j].at) return j;
    return 0;
  }
  function fix(n, d) { return String(Math.round(n * d) / d); }

  window.IAFerr.register('markowitz', function (el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var page = ctx.size === 'page';
    /* Quadro da landing com altura reservada (a .tool-w do bento): o widget ocupa o quadro inteiro
       e o gráfico encolhe para caber. Sem altura (ou no teste), o widget segue o fluxo normal.
       O min-height do CSS vale mesmo antes do layout (seção ainda fora da tela). */
    function reservedHeight() {
      var hh = el.clientHeight || 0;
      try {
        if (window.getComputedStyle) {
          var mh = parseFloat(window.getComputedStyle(el).minHeight);
          if (mh > hh) hh = mh;
        }
      } catch (err) { /* sem estilo calculado: fica a altura medida */ }
      return hh;
    }
    var fill = !page && reservedHeight() >= 200;
    var uid = ctx.uid('iaw-mk');
    var t = ctx.reduced ? FINAL_T : 0;
    var playing = !ctx.reduced;
    var cancelLoop = null;
    var ro = null;
    var lastK = null;
    var shown = 0;
    var active = -1;
    var bw = WEIGHT_SETS[0].slice();

    /* Escritas só quando o valor muda (o laço roda a 30 fps). */
    function node(n) { return { n: n, op: null, tf: null }; }
    function setOp(w, v) {
      var r = v <= 0.001 ? 0 : v >= 0.999 ? 1 : Math.round(v * 1000) / 1000;
      if (w.op !== r) { w.op = r; w.n.style.opacity = String(r); }
    }
    function setTf(w, s) {
      if (w.tf !== s) { w.tf = s; w.n.setAttribute('transform', s); }
    }
    function setCss(w, s) {
      if (w.tf !== s) { w.tf = s; w.n.style.transform = s; }
    }

    // ── SVG ──────────────────────────────────────────────────────────────
    var clipId = uid + '-clip';
    /* A reta da taxa livre sai do gráfico pelo topo (como no original): recortada no viewBox,
       para não aparecer na sobra do quadro quando o gráfico fica centralizado (landing). */
    var viewId = uid + '-view';
    var clipRect = node(svg('rect', { x: '0', y: '0', width: '1', height: '220' }));
    var dots = [];
    for (var d = 0; d < CLOUD.length; d++) {
      dots.push(svg('circle', { cx: fix(CLOUD[d][0], 10), cy: fix(CLOUD[d][1], 10), r: '2.2', 'class': 'iaw-mk-dot', style: { opacity: '0' } }));
    }
    var ring = node(svg('circle', { cx: '0', cy: '0', r: '6', 'class': 'iaw-mk-ring' }));
    var cloudG = node(svg('g', null, [dots, ring.n]));
    var frontier = node(svg('path', { d: FRONTIER, 'class': 'iaw-mk-frontier', 'clip-path': 'url(#' + clipId + ')' }));

    var assetG = [];
    var assetNodes = [];
    for (var a = 0; a < ASSETS.length; a++) {
      var g = node(svg('g', null, [
        svg('circle', { cx: String(ASSETS[a][0]), cy: String(ASSETS[a][1]), r: '5', 'class': 'iaw-mk-a' + a }),
        svg('text', { x: String(ASSETS[a][0] + 8), y: String(ASSETS[a][1]), dy: '.36em', 'class': 'iaw-mk-t iaw-mk-t-asset', text: 'Ação ' + LETTERS[a] })
      ]));
      assetG.push(g);
      assetNodes.push(g.n);
    }
    var assetsG = node(svg('g', null, assetNodes));

    var calLine = node(svg('line', { x1: String(RF[0]), y1: String(RF[1]), x2: String(RF[0] + CAL_LEN), y2: String(RF[1]), 'class': 'iaw-mk-cal' }));
    var calG = node(svg('g', { 'clip-path': 'url(#' + viewId + ')' }, [
      svg('circle', { cx: String(RF[0]), cy: String(RF[1]), r: '4', 'class': 'iaw-mk-rf' }),
      svg('text', { x: String(RF[0] + 7), y: String(RF[1]), dy: '1.44em', 'class': 'iaw-mk-t iaw-mk-t-rf', text: 'taxa livre' }),
      calLine.n
    ]));
    var tanDot = node(svg('circle', { cx: '0', cy: '0', r: '7', 'class': 'iaw-mk-tan' }));
    var tanG = node(svg('g', null, [
      tanDot.n,
      svg('text', { x: String(TG[0] + 11), y: String(TG[1]), dy: '.4em', 'class': 'iaw-mk-t iaw-mk-t-sharpe', text: 'maior Sharpe' })
    ]));

    var segs = [];
    var segNodes = [];
    for (var s = 0; s < ASSETS.length; s++) {
      var r = node(svg('rect', { x: '0', y: '0', width: '1', height: '10', 'class': 'iaw-mk-a' + s }));
      segs.push(r);
      segNodes.push(r.n);
    }
    var barLabel = svg('text', { x: '236', y: '13', dy: '.4em', 'class': 'iaw-mk-t iaw-mk-t-bar', text: 'pesos desta carteira' });
    var barLabelText = 'pesos desta carteira';
    var barG = node(svg('g', null, [
      svg('rect', { x: '60', y: '8', width: '170', height: '10', rx: '3', 'class': 'iaw-mk-track' }),
      segNodes,
      barLabel
    ]));
    var curNodes = [svg('rect', { x: '60', y: '24', width: '170', height: '6', rx: '2', 'class': 'iaw-mk-track' })];
    var acc = 0;
    for (s = 0; s < CURRENT_WEIGHTS.length; s++) {
      curNodes.push(svg('rect', { x: fix(60 + acc * 170, 100), y: '24', width: fix(CURRENT_WEIGHTS[s] * 170, 100), height: '6', 'class': 'iaw-mk-a' + s + ' iaw-mk-cur-seg' }));
      acc += CURRENT_WEIGHTS[s];
    }
    curNodes.push(svg('text', { x: '236', y: '27', dy: '.36em', 'class': 'iaw-mk-t iaw-mk-t-bar', text: 'sua carteira hoje' }));
    var curG = node(svg('g', null, curNodes));

    var plotSvg = svg('svg', {
      viewBox: '0 0 360 220',
      'class': 'iaw-mk-svg',
      role: 'img',
      focusable: 'false',
      'aria-label': 'Animação ilustrativa da teoria de Markowitz com cinco ações fictícias, de A a E: cada ação é um ponto de risco e retorno esperado; carteiras sorteadas formam uma nuvem; a borda de cima da nuvem é a fronteira eficiente; a reta da taxa livre gira até tocar a fronteira na carteira de maior índice de Sharpe; por fim, os pesos dessa carteira aparecem acima dos pesos da carteira atual.'
    }, [
      svg('defs', null, [
        svg('clipPath', { id: clipId }, [clipRect.n]),
        svg('clipPath', { id: viewId }, [svg('rect', { x: '0', y: '0', width: '360', height: '220' })])
      ]),
      svg('line', { x1: '50', y1: '195', x2: '340', y2: '195', 'class': 'iaw-mk-axis' }),
      svg('line', { x1: '50', y1: '22', x2: '50', y2: '195', 'class': 'iaw-mk-axis' }),
      svg('text', { x: '195', y: '214', 'text-anchor': 'middle', 'class': 'iaw-mk-t iaw-mk-t-axis', text: 'Risco (volatilidade)' }),
      svg('text', { x: '16', y: '108', 'text-anchor': 'middle', transform: 'rotate(-90 16 108)', 'class': 'iaw-mk-t iaw-mk-t-axis', text: 'Retorno esperado' }),
      cloudG.n,
      frontier.n,
      assetsG.n,
      calG.n,
      tanG.n,
      barG.n,
      curG.n
    ]);
    var plot = h('div', { 'class': 'iaw-mk-plot' }, [plotSvg]);

    // ── Legenda (as 5 etapas empilhadas na mesma célula: a altura é a da maior, nada pula) ──
    var stepEls = [];
    for (var e = 0; e < STEPS.length; e++) {
      stepEls.push(h('div', { 'class': 'iaw-mk-step', 'aria-hidden': 'true' }, [
        h('p', { 'class': 'iaw-mk-step-title' }, STEPS[e].title),
        h('p', { 'class': 'iaw-mk-step-text' }, STEPS[e].text)
      ]));
    }
    var cap = node(h('div', { 'class': 'iaw-mk-cap' }, stepEls));

    // ── Controles: pausar/retomar e as 5 etapas (o progresso de cada uma enche com scaleX) ──
    var pauseBtn = h('button', { type: 'button', 'class': 'iaw-mk-play', 'aria-pressed': 'false' });
    var segBtns = [];
    var fills = [];
    for (var b = 0; b < STEPS.length; b++) {
      var fillEl = node(h('span', { 'class': 'iaw-mk-seg-fill' }));
      fills.push(fillEl);
      var btn = h('button', {
        type: 'button',
        'class': 'iaw-mk-seg',
        style: { flexGrow: String(Math.round((STEPS[b].end - STEPS[b].at) * 100)) },
        'aria-label': 'Etapa ' + (b + 1) + ' de ' + STEPS.length + ': ' + STEPS[b].title
      }, [h('span', { 'class': 'iaw-mk-seg-bar' }, [fillEl.n])]);
      btn.addEventListener('click', jumper(b));
      segBtns.push(btn);
    }
    var prog = h('div', { 'class': 'iaw-mk-prog', role: 'group', 'aria-label': 'Etapas da animação' }, segBtns);
    var ctrl = h('div', { 'class': 'iaw-mk-ctrl' }, [ctx.reduced ? null : pauseBtn, prog]);

    var topBar = h('div', { 'class': 'iaw-mk-top' }, [
      h('span', { 'class': 'iaw-mk-over' }, 'Como funciona'),
      ctx.seal('Exemplo ilustrativo')
    ]);
    /* Só a etapa escolhida pela pessoa é anunciada (a troca automática, a cada poucos segundos,
       não: leria um texto novo sem parar). */
    var live = h('span', { 'class': 'iaw-sr', 'aria-live': 'polite' });
    var inner = h('div', { 'class': 'iaw-mk-in' }, [topBar, plot, cap.n, ctrl]);
    var root = h('div', { 'class': 'iaw-mk ' + (page ? 'iaw-mk--page' : 'iaw-mk--tile') + (fill ? ' iaw-mk--fill' : '') }, [inner, live]);

    // ── Desenho de um quadro (fórmulas do MarkowitzExplainer.tsx:130-149) ──
    function draw(now, dt) {
      var fade = 1 - ease(now, P_RESET, 1);
      var k;

      // 1. Ativos: o grupo acende e cada um entra com atraso de i · 0,018 do ciclo.
      setOp(assetsG, ease(now, 0, 0.08) * fade);
      for (k = 0; k < assetG.length; k++) setOp(assetG[k], ease(now, k * 0.018, k * 0.018 + 0.03));

      // 2. Nuvem: carteiras na ordem do sorteio (só o trecho que mudou é reescrito).
      var cloudOn = ease(now, P_CLOUD, P_FRONTIER);
      var vis = Math.floor(cloudOn * CLOUD.length);
      if (vis !== shown) {
        for (k = Math.min(vis, shown); k < Math.max(vis, shown); k++) dots[k].style.opacity = k < vis ? '1' : '0';
        shown = vis;
      }
      setOp(cloudG, fade);
      var inCloud = now >= P_CLOUD && now < P_FRONTIER;
      if (inCloud && vis > 0) {
        setTf(ring, 'translate(' + fix(CLOUD[vis - 1][0], 10) + ' ' + fix(CLOUD[vis - 1][1], 10) + ')');
        setOp(ring, 1);
      } else {
        setOp(ring, 0);
      }

      // 3. Fronteira: o recorte avança pelo comprimento da curva.
      var drawn = ease(now, P_FRONTIER, P_TANGENCY);
      setTf(clipRect, 'scale(' + fix(revealX(drawn), 100) + ' 1)');
      setOp(frontier, drawn > 0 ? fade : 0);

      // 4. Reta da taxa livre girando até a tangência, e o ponto "maior Sharpe" assentando.
      var swing = ease(now, P_TANGENCY, P_TANGENCY + 0.1);
      setOp(calG, now >= P_TANGENCY ? fade : 0);
      setTf(calLine, 'rotate(' + fix(-Math.atan(SLOPE * swing) * 180 / Math.PI, 100) + ' ' + RF[0] + ' ' + RF[1] + ')');
      var tanOn = ease(now, P_TANGENCY + 0.09, P_TANGENCY + 0.13) * fade;
      setOp(tanG, tanOn);
      setTf(tanDot, 'translate(' + TG[0] + ' ' + TG[1] + ') scale(' + fix((7 + 3 * (1 - tanOn)) / 7, 1000) + ')');

      // Barras: a carteira sorteada agora (troca a cada 0,27 s) ou, no fim, a da tangência.
      var weightsOn = ease(now, P_WEIGHTS, P_WEIGHTS + 0.05) * fade;
      var drawIdx = Math.max(0, Math.min(WEIGHT_SETS.length - 1, Math.floor(((now - P_CLOUD) / (P_FRONTIER - P_CLOUD)) * WEIGHT_SETS.length)));
      var target = weightsOn > 0 ? TANGENCY_WEIGHTS : WEIGHT_SETS[drawIdx];
      var follow = 1 - Math.exp(-dt / 100);   // ≈ a transição de 300 ms do original
      var x = 0;
      for (k = 0; k < segs.length; k++) {
        bw[k] += (target[k] - bw[k]) * follow;
        setTf(segs[k], 'translate(' + fix(60 + x * 170, 100) + ' 8) scale(' + fix(bw[k] * 170, 100) + ' 1)');
        x += bw[k];
      }
      var label = weightsOn > 0 ? 'pesos da tangência' : 'pesos desta carteira';
      if (label !== barLabelText) { barLabelText = label; barLabel.textContent = label; }
      setOp(barG, (inCloud ? cloudOn : weightsOn) * fade);
      setOp(curG, weightsOn);

      // Legenda da fase e progresso de cada etapa.
      var si = stepAt(now);
      if (si !== active) {
        for (k = 0; k < stepEls.length; k++) {
          stepEls[k].className = 'iaw-mk-step' + (k === si ? ' is-on' : '');
          stepEls[k].setAttribute('aria-hidden', k === si ? 'false' : 'true');
          if (k === si) segBtns[k].setAttribute('aria-current', 'step'); else segBtns[k].removeAttribute('aria-current');
        }
        active = si;
      }
      setOp(cap, 0.35 + 0.65 * ease(now, STEPS[si].at, STEPS[si].at + 0.03));
      for (k = 0; k < fills.length; k++) {
        setCss(fills[k], 'scaleX(' + fix(clamp01((now - STEPS[k].at) / (STEPS[k].end - STEPS[k].at)), 1000) + ')');
      }
    }

    function frame(dt) {
      t = (t + dt / CYCLE_MS) % 1;
      draw(t, dt);
    }
    function startLoop() {
      if (!cancelLoop && playing && !ctx.reduced) cancelLoop = ctx.loop(frame, { fps: FPS });
    }
    function stopLoop() {
      if (cancelLoop) { cancelLoop(); cancelLoop = null; }
    }

    function icon(isPlaying) {
      return svg('svg', { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true', focusable: 'false' },
        isPlaying
          ? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
          : [svg('path', { d: 'M4.5 2.5v11l9-5.5z' })]);
    }
    function syncPause() {
      var label = playing ? 'Pausar animação' : 'Retomar animação';
      pauseBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
      pauseBtn.setAttribute('aria-label', label);
      pauseBtn.setAttribute('title', label);
      pauseBtn.textContent = '';
      pauseBtn.appendChild(icon(playing));
    }
    pauseBtn.addEventListener('click', function () {
      playing = !playing;
      syncPause();
      if (playing) { if (ctx.running()) startLoop(); } else stopLoop();
      ctx.track('markowitz');
    });
    syncPause();

    /* Ir a uma etapa: tocando, ela recomeça do início; pausado (ou com movimento reduzido), mostra
       o quadro dela pronto. */
    function jumper(n) {
      return function () {
        ctx.track('markowitz');
        live.textContent = 'Etapa ' + (n + 1) + ' de ' + STEPS.length + ': ' + STEPS[n].title + '. ' + STEPS[n].text;
        if (playing && !ctx.reduced) {
          t = STEPS[n].at + 0.0001;
          draw(t, 0);
        } else {
          t = STEPS[n].rest;
          draw(t, Infinity);
        }
      };
    }

    /* Texto do SVG legível no tamanho em que o gráfico aparece: --iaw-mk-k = 1 ÷ escala do viewBox
       (o CSS limita cada rótulo entre o tamanho original e um teto que não estoura o quadro). */
    function setScale(width, height) {
      if (!(width > 0)) return;
      var sc = height > 0 ? Math.min(width / W, height / 220) : width / W;
      var kk = Math.round((1 / sc) * 100) / 100;
      if (kk !== lastK && root.style && root.style.setProperty) {
        lastK = kk;
        root.style.setProperty('--iaw-mk-k', String(kk));
      }
    }
    if (window.ResizeObserver) {
      try {
        ro = new window.ResizeObserver(function (entries) {
          var rect = entries && entries[0] && entries[0].contentRect;
          if (rect) setScale(rect.width, rect.height);
        });
        ro.observe(plotSvg);
      } catch (err) { ro = null; }
    }

    draw(t, Infinity);
    el.innerHTML = '';
    el.appendChild(root);
    /* Tamanho inicial medido na montagem (uma leitura de layout): o ResizeObserver só entrega a
       primeira medida no próximo quadro pintado, que não acontece com a aba escondida. */
    if (plotSvg.getBoundingClientRect) {
      var box = plotSvg.getBoundingClientRect();
      setScale(box.width, box.height);
    }

    return {
      start: startLoop,
      stop: stopLoop,
      destroy: function () {
        stopLoop();
        if (ro) { ro.disconnect(); ro = null; }
        el.innerHTML = '';
      }
    };
  });
})();
