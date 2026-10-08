/* Widget "buffett": Indicador de Buffett do Brasil (valor de mercado da B3 ÷ PIB de 12 meses),
   série mensal REAL desde 2000, lida de /macro/indicador-de-buffett/dados.json (gerado pelo
   scripts/macro; mesmo número da página /macro/indicador-de-buffett/).

   Dado real, sem selo: número do dia com a data, faixa entre os quartis (p25–p75) e a média
   desde 2000 como régua, e os meses estimados marcados (estimatedRanges do arquivo) — no
   cursor, mês estimado aparece como "estimado". Nada de "bolsa barata/cara" como conselho: só a
   faixa histórica que o próprio arquivo traz (band).

   Movimento (só transform e opacity): a linha se desenha por um recorte cujo retângulo cresce com
   scale(t, 1) e a cabeça dourada anda com translate, com o número acompanhando o mês. Desenha uma
   vez quando entra na tela (pelo laço único do runtime); fora da tela, pausado ou com movimento
   reduzido, vai direto ao quadro final. Mouse, toque ou setas (com o gráfico em foco) mostram o
   mês e o valor na linha de leitura abaixo do gráfico (nada de tooltip vazando do quadro).

   Tamanhos: 'tile' 2x1 (landing, ~600×220) e 'page'; abaixo de 400 px, layout compacto. */
(function () {
  var URL_PADRAO = '/macro/indicador-de-buffett/dados.json';
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DESENHO_MS = 1800;

  function lista(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function num1(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function mesAno(ym) { return MESES[parseInt(ym.slice(5, 7), 10) - 1] + '/' + ym.slice(0, 4); }
  function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function preparar(d) {
    if (!d || !lista(d.series) || d.series.length < 24 || !(d.value > 0)) return null;
    var meses = [], vals = [];
    for (var i = 0; i < d.series.length; i++) {
      var p = d.series[i];
      if (!lista(p) || !/^\d{4}-\d{2}$/.test(String(p[0])) || !(p[1] > 0)) return null;
      meses.push(String(p[0])); vals.push(p[1]);
    }
    var est = lista(d.estimatedRanges) ? d.estimatedRanges.filter(function (r) { return r && /^\d{4}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}$/.test(r.to); }) : [];
    return { meses: meses, vals: vals, est: est, d: d };
  }
  function estimado(S, ym) {
    for (var i = 0; i < S.est.length; i++) if (ym >= S.est[i].from && ym <= S.est[i].to) return true;
    return false;
  }

  IAFerr.register('buffett', function (el, ctx) {
    var h = ctx.h, svg = ctx.svg;
    var S = null, raf = null, feito = false, cur = -1;
    var root = h('div', { 'class': 'iaw-bf iaw-bf-' + ctx.size });
    el.innerHTML = '';
    el.appendChild(root);
    root.appendChild(h('p', { 'class': 'iaw-bf-msg' }, 'Carregando a série…'));

    var refs = {};
    function montar() {
      var d = S.d, n = S.vals.length;
      var W = Math.max(260, Math.round(el.clientWidth || 600));
      var H = ctx.size === 'page' ? 220 : 116;
      var padL = 30, padR = 12, padT = 8, padB = 18;
      var lo = Math.min.apply(null, S.vals), hi = Math.max.apply(null, S.vals);
      lo = Math.floor((lo - 4) / 10) * 10; hi = Math.ceil((hi + 4) / 10) * 10;
      function x(i) { return padL + (W - padL - padR) * i / (n - 1); }
      function y(v) { return padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo)); }
      refs.x = x; refs.y = y;

      var topo = h('div', { 'class': 'iaw-bf-top' }, [
        h('div', { 'class': 'iaw-bf-head' }, [
          h('span', { 'class': 'iaw-bf-k' }, 'Indicador de Buffett do Brasil'),
          h('span', { 'class': 'iaw-bf-v' }, [refs.num = h('b', { 'class': 'iaw-mono' }, num1(d.value) + '%'), ' do PIB']),
          h('span', { 'class': 'iaw-bf-d' }, 'Fechamento oficial da B3 em ' + d.dateBR)
        ]),
        h('span', { 'class': 'iaw-bf-band' }, (d.band || '') + (typeof d.percentile === 'number' ? ' · percentil ' + d.percentile : ''))
      ]);

      var cid = ctx.uid('bfclip');
      var g = svg('svg', {
        'class': 'iaw-bf-svg', viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, preserveAspectRatio: 'none',
        role: 'img',
        'aria-label': 'Indicador de Buffett do Brasil, de ' + mesAno(S.meses[0]) + ' a ' + mesAno(S.meses[n - 1]) + ': ' + num1(d.value) + '% do PIB em ' + d.dateBR + ', ' + (d.band || '') + '. Média desde ' + (d.since || S.meses[0].slice(0, 4)) + ': ' + num1(d.mean) + '%.'
      });
      var defs = svg('defs');
      var clipRect = svg('rect', { x: 0, y: 0, width: W, height: H });
      defs.appendChild(svg('clipPath', { id: cid }, [clipRect]));
      g.appendChild(defs);
      // meses estimados
      S.est.forEach(function (r) {
        var a = S.meses.indexOf(r.from), b = S.meses.indexOf(r.to);
        if (a < 0) a = 0; if (b < 0) b = n - 1;
        g.appendChild(svg('rect', { 'class': 'iaw-bf-est', x: x(a), y: padT, width: Math.max(1, x(b) - x(a)), height: H - padT - padB }));
      });
      // faixa p25–p75 e média
      if (d.p25 > 0 && d.p75 > 0) g.appendChild(svg('rect', { 'class': 'iaw-bf-iqr', x: padL, y: y(d.p75), width: W - padL - padR, height: Math.max(1, y(d.p25) - y(d.p75)) }));
      if (d.mean > 0) g.appendChild(svg('line', { 'class': 'iaw-bf-mean', x1: padL, x2: W - padR, y1: y(d.mean), y2: y(d.mean) }));
      // eixo y (3 marcas) e anos
      [lo, (lo + hi) / 2, hi].forEach(function (v) {
        g.appendChild(svg('text', { 'class': 'iaw-bf-ax', x: padL - 5, y: y(v) + 3, 'text-anchor': 'end' }, String(Math.round(v)) + '%'));
      });
      for (var yy = parseInt(S.meses[0].slice(0, 4), 10); yy <= parseInt(S.meses[n - 1].slice(0, 4), 10); yy++) {
        if (yy % (W < 420 ? 10 : 5) !== 0) continue;
        var ix = S.meses.indexOf(yy + '-01');
        if (ix >= 0) g.appendChild(svg('text', { 'class': 'iaw-bf-ax', x: x(ix), y: H - 4, 'text-anchor': 'middle' }, String(yy)));
      }
      // linha (recortada para o desenho)
      var dpath = '';
      for (var i = 0; i < n; i++) dpath += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(S.vals[i]).toFixed(1);
      var linha = svg('g', { 'clip-path': 'url(#' + cid + ')' }, [svg('path', { 'class': 'iaw-bf-line', d: dpath })]);
      g.appendChild(linha);
      refs.clip = clipRect;
      refs.cursor = svg('line', { 'class': 'iaw-bf-cur', x1: 0, x2: 0, y1: padT, y2: H - padB });
      refs.cursor.style.opacity = '0';
      g.appendChild(refs.cursor);
      refs.headG = svg('g', { 'class': 'iaw-bf-headg' }, [svg('circle', { 'class': 'iaw-bf-dot', cx: 0, cy: 0, r: 4.5 })]);
      g.appendChild(refs.headG);

      var foco = h('div', { 'class': 'iaw-bf-plot', tabindex: '0', 'aria-label': 'Gráfico do Indicador de Buffett. Use as setas para percorrer os meses.' }, [g]);
      refs.leitura = h('p', { 'class': 'iaw-bf-read', 'aria-live': 'polite' });
      var rodape = h('p', { 'class': 'iaw-bf-src' }, 'Valor de mercado da B3 ÷ PIB de 12 meses. Faixa = entre os quartis desde ' + (d.since || '2000') + '; linha tracejada = média; sombreado claro = meses estimados.');

      root.innerHTML = '';
      root.appendChild(topo);
      root.appendChild(foco);
      root.appendChild(refs.leitura);
      if (ctx.size === 'page') root.appendChild(rodape);
      leituraPadrao();

      function aponta(ev) {
        var r = g.getBoundingClientRect();
        var px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
        var i = Math.round((px - padL) / (W - padL - padR) * (n - 1));
        mostrar(Math.max(0, Math.min(n - 1, i)));
        ctx.track('buffett-cursor');
      }
      g.addEventListener('mousemove', aponta);
      g.addEventListener('touchstart', aponta, { passive: true });
      g.addEventListener('touchmove', aponta, { passive: true });
      g.addEventListener('mouseleave', function () { esconder(); });
      foco.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
        if (ev.preventDefault) ev.preventDefault();
        var i = cur < 0 ? n - 1 : cur;
        if (k === 'ArrowLeft') i = Math.max(0, i - 1);
        if (k === 'ArrowRight') i = Math.min(n - 1, i + 1);
        if (k === 'Home') i = 0;
        if (k === 'End') i = n - 1;
        mostrar(i);
      });
      foco.addEventListener('blur', esconder);
      quadro(feito || ctx.reduced ? 1 : 0);
    }

    function leituraPadrao() {
      var d = S.d;
      refs.leitura.textContent = 'Média desde ' + (d.since || S.meses[0].slice(0, 4)) + ': ' + num1(d.mean) + '% · faixa usual ' + num1(d.p25) + '% a ' + num1(d.p75) + '% · mínima ' + num1(d.min.value) + '% (' + d.min.month + ') · máxima ' + num1(d.max.value) + '% (' + d.max.month + ')';
    }
    function mostrar(i) {
      cur = i;
      var ym = S.meses[i];
      refs.cursor.setAttribute('transform', 'translate(' + refs.x(i).toFixed(1) + ',0)');
      refs.cursor.style.opacity = '1';
      refs.leitura.textContent = mesAno(ym) + ': ' + num1(S.vals[i]) + '% do PIB' + (estimado(S, ym) ? ' (estimado)' : '') + (i === S.vals.length - 1 ? ' · último fechamento oficial' : '');
    }
    function esconder() { cur = -1; if (refs.cursor) refs.cursor.style.opacity = '0'; if (S) leituraPadrao(); }

    // t de 0 a 1: recorte, cabeça e número acompanham o mês
    function quadro(t) {
      var n = S.vals.length, k = suave(t), i = Math.max(0, Math.min(n - 1, Math.round(k * (n - 1))));
      var W = refs.x(n - 1) + 12;
      refs.clip.setAttribute('transform', 'scale(' + Math.max(0.0001, (refs.x(i) + 2) / W).toFixed(4) + ',1)');
      refs.headG.setAttribute('transform', 'translate(' + refs.x(i).toFixed(1) + ',' + refs.y(S.vals[i]).toFixed(1) + ')');
      refs.num.textContent = num1(t >= 1 ? S.d.value : S.vals[i]) + '%';
    }

    function desenhar() {
      if (feito || !S || ctx.reduced) { if (S) quadro(1); feito = true; return; }
      var t0 = null;
      raf = ctx.loop(function (dt) {
        t0 = (t0 || 0) + dt;
        var t = Math.min(1, t0 / DESENHO_MS);
        quadro(t);
        if (t >= 1) { feito = true; if (raf) { raf(); raf = null; } }
      }, { fps: 60 });
    }

    var pronto = ctx.fetchJSON(ctx.src(URL_PADRAO)).then(function (d) {
      S = preparar(d);
      if (!S) throw new Error('série inválida');
      montar();
    });
    pronto.then(null, function () {
      root.innerHTML = '';
      root.appendChild(h('p', { 'class': 'iaw-bf-msg' }, 'Não deu para carregar a série agora. O número do dia está na página do indicador.'));
    });

    var ligado = false;
    return {
      start: function () { ligado = true; pronto.then(function () { if (ligado) desenhar(); }); },
      stop: function () { ligado = false; if (raf) { raf(); raf = null; } if (S && refs.clip && !feito) quadro(1); feito = feito || !!S; },
      destroy: function () { if (raf) raf(); }
    };
  });
})();
