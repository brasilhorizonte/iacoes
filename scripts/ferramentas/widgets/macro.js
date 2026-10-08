/* Widget "macro": termômetro do Painel Macro com VALORES FICTÍCIOS (decisão do dono em
   07/10/2026). O selo e a linha de aviso dizem isso o tempo todo, e a página leva aos valores
   reais na plataforma. Os números são redondos e fixos de propósito: nada aqui vem de dado real
   nem tenta parecer o valor do dia.

   Cada card: rótulo do painel, valor fictício, uma linha de tendência fictícia (se desenha com
   scale no recorte, só transform) e, nos que têm par no Focus, a etiqueta de leitura
   (Favorável / Neutro / Atenção), como no app. Desenha uma vez quando entra na tela; com
   movimento reduzido, quadro final direto. Foco ou toque num card mostra a explicação dele. */
(function () {
  var CARDS = [
    { k: 'IPCA 12M', v: '4,5%', s: 'Neutro', t: 'Inflação oficial em 12 meses', p: [5.2, 5.0, 4.9, 4.7, 4.8, 4.6, 4.5] },
    { k: 'Selic', v: '12,0%', s: 'Atenção', t: 'Taxa básica de juros, ao ano', p: [10.5, 11.0, 11.5, 12.0, 12.0, 12.0, 12.0] },
    { k: 'USD/BRL', v: 'R$ 5,00', s: 'Neutro', t: 'Dólar em reais', p: [5.3, 5.4, 5.2, 5.1, 5.0, 5.05, 5.0] },
    { k: 'IGP-M 12M', v: '3,0%', s: '', t: 'Inflação do IGP-M em 12 meses', p: [4.0, 3.6, 3.2, 3.5, 3.1, 2.9, 3.0] },
    { k: 'Desemprego', v: '6,0%', s: '', t: 'Taxa de desocupação (PNAD)', p: [7.0, 6.8, 6.6, 6.4, 6.3, 6.1, 6.0] },
    { k: 'Dívida/PIB', v: '80,0%', s: '', t: 'Dívida bruta do governo geral', p: [76, 77, 77.5, 78, 79, 79.5, 80] }
  ];
  var CLS = { 'Favorável': 'ok', 'Neutro': 'mid', 'Atenção': 'warn' };
  var DESENHO_MS = 1200;
  function suave(t) { return 1 - Math.pow(1 - t, 3); }

  IAFerr.register('macro', function (el, ctx) {
    var h = ctx.h, svg = ctx.svg;
    var clips = [], nums = [], raf = null, feito = false;
    var root = h('div', { 'class': 'iaw-mc iaw-mc-' + ctx.size });
    var aviso = h('div', { 'class': 'iaw-mc-top' }, [
      h('span', { 'class': 'iaw-mc-k' }, 'Termômetro macro'),
      ctx.seal('Valores fictícios')
    ]);
    var grid = h('div', { 'class': 'iaw-mc-grid', role: 'list' });
    var leitura = h('p', { 'class': 'iaw-mc-read', 'aria-live': 'polite' }, 'Exemplo com valores fictícios. Os valores reais, com a data de cada dado, ficam no Painel Macro da plataforma.');
    var cards = ctx.size === 'tile' && ctx.span === '1x1' ? CARDS.slice(0, 4) : CARDS;

    cards.forEach(function (c, i) {
      var W = 100, H = 28, lo = Math.min.apply(null, c.p), hi = Math.max.apply(null, c.p);
      if (hi === lo) hi = lo + 1;
      var d = '';
      for (var j = 0; j < c.p.length; j++) d += (j ? 'L' : 'M') + (W * j / (c.p.length - 1)).toFixed(1) + ' ' + (H - 3 - (H - 6) * (c.p[j] - lo) / (hi - lo)).toFixed(1);
      var cid = ctx.uid('mcclip');
      var rect = svg('rect', { x: 0, y: 0, width: W, height: H });
      clips.push(rect);
      var spark = svg('svg', { 'class': 'iaw-mc-spark', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
        svg('defs', null, [svg('clipPath', { id: cid }, [rect])]),
        svg('path', { d: d, 'clip-path': 'url(#' + cid + ')' })
      ]);
      var card = h('div', { 'class': 'iaw-mc-card', role: 'listitem', tabindex: '0', 'aria-label': c.k + ': ' + c.v + ' (valor fictício). ' + c.t + '.' }, [
        h('div', { 'class': 'iaw-mc-row' }, [
          h('span', { 'class': 'iaw-mc-lbl' }, c.k),
          c.s ? h('span', { 'class': 'iaw-mc-st iaw-mc-' + CLS[c.s] }, c.s) : null
        ]),
        h('b', { 'class': 'iaw-mc-v iaw-mono' }, c.v),
        spark
      ]);
      var mostra = function () { leitura.textContent = c.k + ': ' + c.t + '. Valor fictício: no Painel Macro da plataforma aparece o valor real e a data do dado.'; ctx.track('macro-card'); };
      card.addEventListener('focus', mostra);
      card.addEventListener('mouseenter', mostra);
      card.addEventListener('click', mostra);
      nums.push(card);
      grid.appendChild(card);
    });

    root.appendChild(aviso);
    root.appendChild(grid);
    root.appendChild(leitura);
    el.innerHTML = '';
    el.appendChild(root);

    function quadro(t) {
      var k = suave(t);
      for (var i = 0; i < clips.length; i++) {
        var ki = Math.max(0, Math.min(1, k * 1.25 - i * 0.05));
        clips[i].setAttribute('transform', 'scale(' + Math.max(0.0001, ki).toFixed(4) + ',1)');
        nums[i].style.opacity = String(0.35 + 0.65 * Math.min(1, ki * 1.6));
      }
    }
    quadro(ctx.reduced ? 1 : 0);

    function desenhar() {
      if (feito || ctx.reduced) { quadro(1); feito = true; return; }
      var acc = 0;
      raf = ctx.loop(function (dt) {
        acc += dt;
        var t = Math.min(1, acc / DESENHO_MS);
        quadro(t);
        if (t >= 1) { feito = true; if (raf) { raf(); raf = null; } }
      }, { fps: 60 });
    }

    return {
      start: function () { desenhar(); },
      stop: function () { if (raf) { raf(); raf = null; } quadro(1); feito = true; },
      destroy: function () { if (raf) raf(); }
    };
  });
})();
