/* Widget "backtest" (SPEC §4; SPEC-v2 §B8, §E5 e §E6): Ibovespa × CDI REAIS, lidos de
   /ferramentas/backtest-de-carteira/dados.json (séries mensais base 100, DADOS-API §3).

   Abas 1, 5, 10 e 15 anos: cada uma redesenha as duas curvas a partir de base 100 no início do
   horizonte (série[último − 12N] … série[último]). Passar o mouse, tocar ou focar o gráfico e usar
   as setas mostra o mês e o retorno acumulado de cada série desde o início do período; a leitura
   fica acima do gráfico (nada de tooltip vazando do quadro). Os números são os mesmos da tabela da
   página (sections/backtest.tsx): mesma conta, sobre a mesma série.

   Dado real, sem selo: nenhum número inventado e nenhuma curva "Sua carteira" (a carteira de cada
   pessoa só entra no gráfico na plataforma). Perto dos números: a data dos dados e a nota do
   Ibovespa que vem do próprio arquivo (ibov.note), mais "CDI: taxa bruta, sem custos nem impostos".

   Movimento (só transform e opacity): as curvas se desenham por um recorte (clipPath) cujo
   retângulo cresce com scale(t, 1); as cabeças das curvas andam com translate, com o mês e os
   números acompanhando. Só anima em tela, pelo laço único do runtime; fora da tela, pausado ou com
   movimento reduzido, desenha direto o quadro final.

   Tamanhos: 'page' (página da ferramenta; altura fixa igual ao min-height do quadro menos o
   respiro: 266 px abaixo de 640 px de tela e 326 px acima, sem salto de layout) e 'tile'
   (landing, ~300×220: abas curtas e troca de período sozinha a cada poucos segundos, com botão
   de pausa). Abaixo de 400 px de tela, layout compacto. */
(function () {
  var URL_PADRAO = '/ferramentas/backtest-de-carteira/dados.json';
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* Cores das séries (as mesmas da tabela da página), conferidas com o validador de paleta:
     contraste de pelo menos 3:1 no branco e bem distintas sob protanopia e deuteranopia. Texto
     nunca usa a cor da série: a identidade vem do traço ao lado do nome. */
  var COR = { ibov: '#0B6E99', cdi: '#A3802A' };
  var DESENHO_MS = 1300;   // desenho das curvas
  var CICLO_MS = 5600;     // troca de período no quadro da landing
  var ESPERA_MS = 10000;   // depois de um toque, a troca automática espera

  function lista(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function positivo(n) { return typeof n === 'number' && isFinite(n) && n > 0; }
  function partes(ym) { return { a: parseInt(String(ym).slice(0, 4), 10), m: parseInt(String(ym).slice(5, 7), 10) }; }
  function mesAno(ym) { var p = partes(ym); return MESES[p.m - 1] + '/' + p.a; }
  function mesCurto(ym) { var p = partes(ym); return MESES[p.m - 1] + '/' + String(p.a).slice(2); }
  function mesLongo(ym) { var p = partes(ym); return MESES_LONGOS[p.m - 1] + ' de ' + p.a; }
  function anos(n) { return n + (n === 1 ? ' ano' : ' anos'); }
  function indice(arr, x) { for (var i = 0; i < arr.length; i++) if (arr[i] === x) return i; return -1; }
  function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* Confere o arquivo e devolve as séries prontas, ou null (fica o conteúdo do servidor). */
  function preparar(d) {
    if (!d || !d.ibov || !d.cdi || !lista(d.ibov.series) || !lista(d.cdi.series)) return null;
    var a = d.ibov.series;
    var b = d.cdi.series;
    if (a.length !== b.length || a.length < 13) return null;
    var meses = [];
    var ibov = [];
    var cdi = [];
    for (var i = 0; i < a.length; i++) {
      if (!lista(a[i]) || !lista(b[i]) || a[i][0] !== b[i][0] || !/^\d{4}-\d{2}$/.test(String(a[i][0]))) return null;
      if (!positivo(a[i][1]) || !positivo(b[i][1])) return null;
      meses.push(String(a[i][0]));
      ibov.push(a[i][1]);
      cdi.push(b[i][1]);
    }
    var maximo = Math.floor((a.length - 1) / 12);
    var fonte = lista(d.table) && d.table.length ? d.table : [{ years: 1 }, { years: 5 }, { years: 10 }, { years: 15 }];
    var hs = [];
    for (var j = 0; j < fonte.length; j++) {
      var y = fonte[j] && fonte[j].years;
      if (typeof y === 'number' && y >= 1 && y <= maximo && y === Math.floor(y) && indice(hs, y) < 0) hs.push(y);
    }
    hs.sort(function (x, z) { return x - z; });
    if (!hs.length) return null;
    return {
      meses: meses,
      ibov: ibov,
      cdi: cdi,
      horizontes: hs,
      data: /^\d{4}-\d{2}-\d{2}$/.test(String(d.updated)) ? String(d.updated) : '',
      nota: typeof d.ibov.note === 'string' ? d.ibov.note : '',
      nomeIbov: typeof d.ibov.name === 'string' && d.ibov.name ? d.ibov.name : 'Ibovespa',
      nomeCdi: typeof d.cdi.name === 'string' && d.cdi.name ? d.cdi.name : 'CDI'
    };
  }

  /* Horizonte de N anos: os 12N + 1 últimos meses, rebaseados em 100 no primeiro. */
  function janela(D, n) {
    var fim = D.meses.length - 1;
    var ini = fim - 12 * n;
    var w = { anos: n, meses: [], ibov: [], cdi: [] };
    for (var i = ini; i <= fim; i++) {
      w.meses.push(D.meses[i]);
      w.ibov.push(D.ibov[i] / D.ibov[ini] * 100);
      w.cdi.push(D.cdi[i] / D.cdi[ini] * 100);
    }
    return w;
  }

  /* Passo "redondo" do eixo (em pontos percentuais) para cerca de `alvo` marcas. */
  function passo(faixa, alvo) {
    var bruto = faixa / Math.max(1, alvo);
    if (!(bruto > 0)) return 10;
    var mag = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10));
    var opcoes = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < opcoes.length; i++) if (opcoes[i] * mag >= bruto) return opcoes[i] * mag;
    return 10 * mag;
  }

  window.IAFerr.register('backtest', function (el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var fmt = ctx.fmt;
    var pagina = ctx.size === 'page';
    var D = null;            // dados preparados
    var W = null;            // janela do período escolhido
    var atual = -1;          // índice do período em D.horizontes
    var rodando = false;     // ligado pelo runtime (em tela, aba visível, sem pausa)
    var destruido = false;
    var revelarAoLigar = false;
    var anim = null;         // { t } enquanto as curvas se desenham
    var prog = 1;            // progresso do desenho (0 a 1)
    var geo = null;          // geometria do último desenho
    var cursor = null;       // mês sob o cursor (null = fim do período)
    var focado = false;
    var auto = !pagina && !ctx.reduced;   // o quadro da landing troca de período sozinho
    var espera = 0;
    var acum = 0;
    var paraDesenho = null;
    var paraCiclo = null;
    var ro = null;
    var aoRedimensionar = null;
    var aoPausar = null;
    var aoImprimir = null;
    var abas = [];
    var idPainel = ctx.uid('iaw-bt-painel');
    var idClip = ctx.uid('iaw-bt-clip');
    var ui = {};

    function sinal(frac) {
      var r = Math.round(frac * 1000) / 1000;
      if (r === 0) return '0,0%';
      return (r > 0 ? '+' : '') + fmt.pct(frac, 1);
    }
    function limpar(g) { g.textContent = ''; }

    function medir() {
      var w = (ui.plot && ui.plot.clientWidth) || 0;
      var hh = (ui.plot && ui.plot.clientHeight) || 0;
      if (w < 60 || hh < 40) return { w: pagina ? 600 : 280, h: pagina ? 170 : 90, falso: true };
      return { w: w, h: hh };
    }

    function rotuloY(v, st) {
      var dec = st % 1 === 0 ? 0 : 1;
      if (Math.abs(v) < st / 1000) return '0%';
      return (v > 0 ? '+' : '') + fmt.num(v, dec) + '%';
    }

    /* Marcas do eixo X: trimestres no horizonte curto; viradas de ano (de 1 em 1, 2, 3, 5 ou 10
       anos) nos longos, sem passar do que cabe na largura. */
    function marcasX(w, pw) {
      var n = w.meses.length;
      var maximo = Math.max(3, Math.floor(pw / 48));
      var out = [];
      var i;
      var p;
      if (w.anos <= 2) {
        for (i = 0; i < n; i++) { p = partes(w.meses[i]); if (p.m % 3 === 0) out.push({ k: i, t: mesCurto(w.meses[i]) }); }
      } else {
        var opcoes = [1, 2, 3, 5, 10];
        var s = 10;
        for (var j = 0; j < opcoes.length; j++) {
          var c = 0;
          for (i = 0; i < n; i++) { p = partes(w.meses[i]); if (p.m === 1 && p.a % opcoes[j] === 0) c++; }
          if (c <= maximo) { s = opcoes[j]; break; }
        }
        for (i = 0; i < n; i++) { p = partes(w.meses[i]); if (p.m === 1 && p.a % s === 0) out.push({ k: i, t: String(p.a) }); }
      }
      if (out.length > maximo) {
        var pulo = Math.ceil(out.length / maximo);
        var menos = [];
        for (i = 0; i < out.length; i += pulo) menos.push(out[i]);
        out = menos;
      }
      return out;
    }

    function caminho(vals, X, Y) {
      var d = '';
      for (var i = 0; i < vals.length; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(vals[i]).toFixed(1);
      return d;
    }

    function desenhar(t) {
      if (!W) return;
      var largo = pagina && t.w >= 480;
      var m = pagina ? { l: 46, r: largo ? 76 : 12, t: 8, b: 22 } : { l: 38, r: 8, t: 6, b: 17 };
      var pw = Math.max(20, t.w - m.l - m.r);
      var ph = Math.max(20, t.h - m.t - m.b);
      var n = W.meses.length;
      var minV = 0;
      var maxV = 0;
      var i;
      for (i = 0; i < n; i++) {
        minV = Math.min(minV, W.ibov[i] - 100, W.cdi[i] - 100);
        maxV = Math.max(maxV, W.ibov[i] - 100, W.cdi[i] - 100);
      }
      // Domínio = extremos reais com 5% de folga (o 0% sempre dentro); marcas nos múltiplos do passo.
      var faixa = maxV - minV || 1;
      var st = passo(faixa, pagina && ph >= 140 ? 4 : 3);
      var lo = minV - faixa * 0.05;
      var hi = maxV + faixa * 0.05;
      var X = function (k) { return m.l + (n > 1 ? k / (n - 1) : 0) * pw; };
      var Y = function (v) { return m.t + (hi - (v - 100)) / (hi - lo) * ph; };
      geo = { m: m, pw: pw, ph: ph, X: X, Y: Y, n: n, w: t.w, h: t.h };

      ui.svg.setAttribute('width', String(t.w));
      ui.svg.setAttribute('height', String(t.h));
      ui.svg.setAttribute('viewBox', '0 0 ' + t.w + ' ' + t.h);

      // Grade e eixo Y (retorno acumulado desde o início; 0% = base 100).
      limpar(ui.grade);
      for (var j = Math.ceil(lo / st); j <= Math.floor(hi / st); j++) {
        var v = j * st;
        var y = Math.round(Y(100 + v)) + 0.5;
        ui.grade.appendChild(svg('line', { x1: m.l, x2: (m.l + pw).toFixed(1), y1: y, y2: y, 'class': Math.abs(v) < st / 1000 ? 'iaw-backtest-base' : 'iaw-backtest-grid' }));
        ui.grade.appendChild(svg('text', { x: m.l - 6, y: y, dy: '0.32em', 'text-anchor': 'end', 'class': 'iaw-backtest-tick iaw-mono', text: rotuloY(v, st) }));
      }

      // Eixo X.
      limpar(ui.eixoX);
      var mx = marcasX(W, pw);
      for (i = 0; i < mx.length; i++) {
        var x = X(mx[i].k);
        var ancora = x - m.l < 16 ? 'start' : m.l + pw - x < 16 ? 'end' : 'middle';
        ui.eixoX.appendChild(svg('text', { x: x.toFixed(1), y: m.t + ph + (pagina ? 16 : 13), 'text-anchor': ancora, 'class': 'iaw-backtest-tick iaw-mono', text: mx[i].t }));
      }

      ui.pIbov.setAttribute('d', caminho(W.ibov, X, Y));
      ui.pCdi.setAttribute('d', caminho(W.cdi, X, Y));
      ui.clip.setAttribute('x', String(m.l - 3));
      ui.clip.setAttribute('y', '0');
      ui.clip.setAttribute('width', String(pw + 6));
      ui.clip.setAttribute('height', String(t.h));
      ui.cruz.setAttribute('y1', String(m.t));
      ui.cruz.setAttribute('y2', String(m.t + ph));

      // Rótulos diretos no fim das curvas (só no quadro largo e quando não se encostam).
      var yi = Y(W.ibov[n - 1]);
      var yc = Y(W.cdi[n - 1]);
      var cabe = largo && Math.abs(yi - yc) >= 14;
      ui.rIbov.setAttribute('x', (X(n - 1) + 9).toFixed(1));
      ui.rIbov.setAttribute('y', (yi + 4).toFixed(1));
      ui.rCdi.setAttribute('x', (X(n - 1) + 9).toFixed(1));
      ui.rCdi.setAttribute('y', (yc + 4).toFixed(1));
      ui.rotulos.style.display = cabe ? '' : 'none';

      aplicar(prog);
      mostrarCursor();
    }

    /* Quadro do desenho: recorte até o progresso e cabeças das curvas na ponta, com o mês real e
       os números reais daquele mês na leitura. */
    function aplicar(p) {
      if (!geo || !W) return;
      var e = p >= 1 ? 1 : suave(Math.max(0, p));
      var L = geo.m.l;
      ui.clip.setAttribute('transform', 'translate(' + L + ' 0) scale(' + Math.max(e, 0.0005).toFixed(4) + ' 1) translate(' + (-L) + ' 0)');
      var n = geo.n;
      var f = e * (n - 1);
      var k0 = Math.min(n - 1, Math.floor(f));
      var k1 = Math.min(n - 1, k0 + 1);
      var fr = f - k0;
      var x = geo.X(f).toFixed(1);
      var yi = geo.Y(W.ibov[k0] + (W.ibov[k1] - W.ibov[k0]) * fr).toFixed(1);
      var yc = geo.Y(W.cdi[k0] + (W.cdi[k1] - W.cdi[k0]) * fr).toFixed(1);
      ui.cabIbov.setAttribute('transform', 'translate(' + x + ' ' + yi + ')');
      ui.cabCdi.setAttribute('transform', 'translate(' + x + ' ' + yc + ')');
      ui.rotulos.setAttribute('class', 'iaw-backtest-labels' + (e >= 1 ? ' is-on' : ''));
      if (cursor === null) ler(e >= 1 ? null : k0);
    }

    function ler(k) {
      var n = W.meses.length;
      var i = k === null ? n - 1 : k;
      ui.vIbov.textContent = sinal(W.ibov[i] / 100 - 1);
      ui.vCdi.textContent = sinal(W.cdi[i] / 100 - 1);
      ui.quando.textContent = k === null
        ? mesAno(W.meses[0]) + ' a ' + mesAno(W.meses[n - 1])
        : mesAno(W.meses[i]) + ' · desde ' + mesAno(W.meses[0]);
    }

    function textoMes(i) {
      return mesLongo(W.meses[i]) + ': ' + D.nomeIbov + ' ' + sinal(W.ibov[i] / 100 - 1) + ', ' + D.nomeCdi + ' ' + sinal(W.cdi[i] / 100 - 1) + ' desde ' + mesLongo(W.meses[0]);
    }

    function resumo() {
      var n = W.meses.length;
      return anos(W.anos) + ', de ' + mesAno(W.meses[0]) + ' a ' + mesAno(W.meses[n - 1]) + ': ' + D.nomeIbov + ' ' + sinal(W.ibov[n - 1] / 100 - 1) + ' e ' + D.nomeCdi + ' ' + sinal(W.cdi[n - 1] / 100 - 1);
    }

    function mostrarCursor() {
      if (!geo || !W) return;
      var on = cursor !== null && prog >= 1;
      if (on) {
        var x = geo.X(cursor).toFixed(1);
        ui.cruz.setAttribute('transform', 'translate(' + x + ' 0)');
        ui.curIbov.setAttribute('transform', 'translate(' + x + ' ' + geo.Y(W.ibov[cursor]).toFixed(1) + ')');
        ui.curCdi.setAttribute('transform', 'translate(' + x + ' ' + geo.Y(W.cdi[cursor]).toFixed(1) + ')');
      }
      ui.cursor.setAttribute('class', 'iaw-backtest-cur' + (on ? ' is-on' : ''));
    }

    function slider(k) {
      var i = k === null ? W.meses.length - 1 : k;
      ui.hit.setAttribute('aria-valuemax', String(W.meses.length - 1));
      ui.hit.setAttribute('aria-valuenow', String(i));
      ui.hit.setAttribute('aria-valuetext', textoMes(i));
    }

    function porCursor(k) {
      if (!W) return;
      if (anim) terminar();
      cursor = k;
      ler(k);
      mostrarCursor();
      slider(k);
    }

    // --- Desenho animado (laço único do runtime, só em tela) ---
    function soltarDesenho() { if (paraDesenho) { var c = paraDesenho; paraDesenho = null; c(); } }
    function garantirDesenho() {
      if (paraDesenho) return;
      paraDesenho = ctx.loop(function (dt) {
        if (!anim) { soltarDesenho(); return; }
        anim.t = Math.min(1, anim.t + dt / DESENHO_MS);
        prog = anim.t;
        aplicar(prog);
        if (anim.t >= 1) { anim = null; mostrarCursor(); soltarDesenho(); }
      }, { fps: 60 });
    }
    function comecar() { anim = { t: 0 }; prog = 0; aplicar(0); mostrarCursor(); garantirDesenho(); }
    function terminar() { anim = null; prog = 1; soltarDesenho(); aplicar(1); mostrarCursor(); }

    // --- Troca automática de período (só no quadro da landing) ---
    function soltarCiclo() { if (paraCiclo) { var c = paraCiclo; paraCiclo = null; c(); } }
    function garantirCiclo() {
      if (paraCiclo || !auto || !rodando || ctx.reduced || !D || D.horizontes.length < 2) return;
      paraCiclo = ctx.loop(function (dt) {
        if (!auto || anim) return;
        if (espera > 0) { espera -= dt; return; }
        acum += dt;
        if (acum >= CICLO_MS) { acum = 0; escolher((atual + 1) % D.horizontes.length, false); }
      }, { fps: 4 });
    }
    function interagiu() { ctx.track('backtest'); espera = ESPERA_MS; acum = 0; }

    function escolher(i, doUsuario, inicial) {
      if (!D || i < 0 || i >= D.horizontes.length) return;
      if (i === atual && W) { if (doUsuario) interagiu(); return; }
      atual = i;
      W = janela(D, D.horizontes[i]);
      for (var j = 0; j < abas.length; j++) {
        var on = j === i;
        abas[j].setAttribute('aria-selected', on ? 'true' : 'false');
        abas[j].setAttribute('tabindex', on ? '0' : '-1');
        abas[j].className = 'iaw-backtest-tab' + (on ? ' is-on' : '');
      }
      ui.painel.setAttribute('aria-labelledby', abas[i].id);
      ui.svg.setAttribute('aria-label', 'Retorno acumulado em ' + anos(W.anos) + ', de ' + mesLongo(W.meses[0]) + ' a ' + mesLongo(W.meses[W.meses.length - 1]) + ', base 100 no início: ' + D.nomeIbov + ' ' + sinal(W.ibov[W.ibov.length - 1] / 100 - 1) + ' e ' + D.nomeCdi + ' ' + sinal(W.cdi[W.cdi.length - 1] / 100 - 1) + (D.data ? '. Dados até ' + fmt.date(D.data) : '') + '.');
      cursor = focado ? W.meses.length - 1 : null;
      desenhar(medir());
      slider(cursor);
      if (doUsuario) {
        interagiu();
        ui.anuncio.textContent = resumo() + '.';
      }
      if (inicial) {
        if (ctx.reduced || ctx.paused()) terminar();
        else if (rodando) comecar();
        else { revelarAoLigar = true; prog = 0; aplicar(0); }
      } else if (rodando && !ctx.reduced) comecar();
      else terminar();
    }

    function teclaAba(ev) {
      var i = indice(abas, ev.currentTarget || this);
      var n = abas.length;
      var j = i;
      switch (ev.key) {
        case 'ArrowRight': case 'Right': j = (i + 1) % n; break;
        case 'ArrowLeft': case 'Left': j = (i - 1 + n) % n; break;
        case 'Home': j = 0; break;
        case 'End': j = n - 1; break;
        default: return;
      }
      ev.preventDefault();
      abas[j].focus();
      escolher(j, true);
    }

    function teclaGrafico(ev) {
      if (!W) return;
      var n = W.meses.length;
      var k = cursor === null ? n - 1 : cursor;
      var novo = k;
      switch (ev.key) {
        case 'ArrowLeft': case 'Left': case 'ArrowDown': case 'Down': novo = k - 1; break;
        case 'ArrowRight': case 'Right': case 'ArrowUp': case 'Up': novo = k + 1; break;
        case 'PageDown': novo = k - 12; break;
        case 'PageUp': novo = k + 12; break;
        case 'Home': novo = 0; break;
        case 'End': novo = n - 1; break;
        default: return;
      }
      ev.preventDefault();
      porCursor(Math.max(0, Math.min(n - 1, novo)));
      interagiu();
    }

    function xParaMes(clientX) {
      var r = ui.hit.getBoundingClientRect();
      var k = Math.round((clientX - r.left - geo.m.l) / geo.pw * (geo.n - 1));
      return Math.max(0, Math.min(geo.n - 1, k));
    }
    function aoMover(ev) {
      if (!W || !geo) return;
      var p = ev.touches && ev.touches.length ? ev.touches[0] : ev;
      if (typeof p.clientX !== 'number') return;
      porCursor(xParaMes(p.clientX));
      interagiu();
    }
    function aoSair(ev) {
      // No toque, o "sair" vem logo depois de levantar o dedo: a leitura fica até o próximo toque.
      if (ev && ev.pointerType === 'touch') return;
      if (!focado) porCursor(null);
    }

    function icone(pausado) {
      return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' },
        pausado
          ? [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]
          : [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]);
    }
    function definirAuto(on) {
      auto = on;
      if (ui.pausa) {
        ui.pausa.setAttribute('aria-pressed', on ? 'false' : 'true');
        ui.pausa.setAttribute('title', on ? 'Pausar a troca de período' : 'Retomar a troca de período');
        ui.pausa.textContent = '';
        ui.pausa.appendChild(icone(!on));
      }
      if (on) garantirCiclo(); else soltarCiclo();
    }

    function montar() {
      // Topo: título, data dos dados (página) ou período (landing) e, na landing, a pausa.
      ui.quando = h('span', { 'class': 'iaw-backtest-when iaw-mono' });
      ui.pausa = !pagina && !ctx.reduced
        ? h('button', { type: 'button', 'class': 'iaw-backtest-pause', 'aria-label': 'Pausar a troca automática de período', 'aria-pressed': 'false' })
        : null;
      var dataTxt = D.data ? (pagina ? 'dados até ' : 'até ') + fmt.date(D.data) : '';
      var topo = h('div', { 'class': 'iaw-backtest-top' }, [
        h('span', { 'class': 'iaw-backtest-title' }, D.nomeIbov + ' × ' + D.nomeCdi),
        h('span', { 'class': 'iaw-backtest-top-right' }, [pagina ? h('span', { 'class': 'iaw-backtest-date' }, dataTxt) : ui.quando, ui.pausa])
      ]);

      // Abas dos períodos.
      ui.lista = h('div', { 'class': 'iaw-backtest-tabs', role: 'tablist', 'aria-label': 'Período do gráfico' });
      for (var i = 0; i < D.horizontes.length; i++) {
        (function (i) {
          var b = h('button', { type: 'button', role: 'tab', id: ctx.uid('iaw-bt-aba'), 'class': 'iaw-backtest-tab', 'aria-selected': 'false', 'aria-controls': idPainel, tabindex: '-1' }, anos(D.horizontes[i]));
          b.addEventListener('click', function () { escolher(i, true); });
          b.addEventListener('keydown', teclaAba);
          abas.push(b);
          ui.lista.appendChild(b);
        })(i);
      }

      // Leitura: mês e retorno acumulado de cada série (o fim do período, ou o mês do cursor).
      ui.vIbov = h('span', { 'class': 'iaw-backtest-num iaw-mono' });
      ui.vCdi = h('span', { 'class': 'iaw-backtest-num iaw-mono' });
      var item = function (cor, nome, valor) {
        return h('span', { 'class': 'iaw-backtest-val' }, [
          h('span', { 'class': 'iaw-backtest-key', style: { borderTopColor: cor }, 'aria-hidden': 'true' }),
          h('span', { 'class': 'iaw-backtest-name' }, nome),
          valor
        ]);
      };
      var leitura = h('div', { 'class': 'iaw-backtest-read' }, [pagina ? ui.quando : null, item(COR.ibov, D.nomeIbov, ui.vIbov), item(COR.cdi, D.nomeCdi, ui.vCdi)]);

      // Gráfico (SVG com role="img") e, por cima, a área de leitura por mouse, toque e teclado.
      ui.clip = svg('rect', { x: '0', y: '0', width: '0', height: '0' });
      ui.grade = svg('g', { 'aria-hidden': 'true' });
      ui.eixoX = svg('g', { 'aria-hidden': 'true' });
      ui.pIbov = svg('path', { 'class': 'iaw-backtest-line', stroke: COR.ibov });
      ui.pCdi = svg('path', { 'class': 'iaw-backtest-line', stroke: COR.cdi });
      ui.cruz = svg('line', { 'class': 'iaw-backtest-cross', x1: '0', x2: '0', y1: '0', y2: '0' });
      ui.curIbov = svg('circle', { 'class': 'iaw-backtest-dot', r: '4.5', fill: COR.ibov });
      ui.curCdi = svg('circle', { 'class': 'iaw-backtest-dot', r: '4.5', fill: COR.cdi });
      ui.cursor = svg('g', { 'class': 'iaw-backtest-cur' }, [ui.cruz, ui.curIbov, ui.curCdi]);
      ui.cabIbov = svg('circle', { 'class': 'iaw-backtest-dot', r: '4', fill: COR.ibov });
      ui.cabCdi = svg('circle', { 'class': 'iaw-backtest-dot', r: '4', fill: COR.cdi });
      ui.rIbov = svg('text', { 'class': 'iaw-backtest-label', text: D.nomeIbov });
      ui.rCdi = svg('text', { 'class': 'iaw-backtest-label', text: D.nomeCdi });
      ui.rotulos = svg('g', { 'class': 'iaw-backtest-labels', 'aria-hidden': 'true' }, [ui.rIbov, ui.rCdi]);
      ui.svg = svg('svg', { 'class': 'iaw-backtest-svg', role: 'img', focusable: 'false' }, [
        svg('defs', null, [svg('clipPath', { id: idClip }, [ui.clip])]),
        ui.grade,
        ui.eixoX,
        svg('g', { 'clip-path': 'url(#' + idClip + ')' }, [ui.pCdi, ui.pIbov]),
        ui.cursor,
        ui.cabCdi,
        ui.cabIbov,
        ui.rotulos
      ]);
      ui.hit = h('div', {
        'class': 'iaw-backtest-hit',
        tabindex: '0',
        role: 'slider',
        'aria-label': 'Mês do gráfico',
        'aria-orientation': 'horizontal',
        'aria-valuemin': '0'
      });
      ui.plot = h('div', { 'class': 'iaw-backtest-plot' }, [ui.svg, ui.hit]);
      ui.painel = h('div', { 'class': 'iaw-backtest-panel', role: 'tabpanel', id: idPainel }, [leitura, ui.plot]);

      // Nota perto dos números (vem do arquivo: ibov.note) e anúncio da troca de período.
      var nota = (D.nota ? D.nomeIbov + ': ' + D.nota + '. ' : '') + D.nomeCdi + ': taxa bruta. Sem custos nem impostos.';
      if (!pagina && D.data) nota = 'Dados até ' + fmt.date(D.data) + '. ' + nota;
      ui.anuncio = h('span', { 'class': 'iaw-sr', 'aria-live': 'polite' });
      var raiz = h('div', { 'class': 'iaw-backtest ' + (pagina ? 'iaw-backtest--page' : 'iaw-backtest--tile') }, [
        topo,
        ui.lista,
        ui.painel,
        h('p', { 'class': 'iaw-backtest-foot' }, nota),
        ui.anuncio
      ]);

      if (window.PointerEvent) {
        ui.hit.addEventListener('pointermove', aoMover);
        ui.hit.addEventListener('pointerdown', aoMover);
        ui.hit.addEventListener('pointerleave', aoSair);
      } else {
        ui.hit.addEventListener('mousemove', aoMover);
        ui.hit.addEventListener('mouseleave', aoSair);
        ui.hit.addEventListener('touchstart', aoMover);
        ui.hit.addEventListener('touchmove', aoMover);
      }
      ui.hit.addEventListener('focus', function () { focado = true; if (cursor === null && W) porCursor(W.meses.length - 1); });
      ui.hit.addEventListener('blur', function () { focado = false; porCursor(null); });
      ui.hit.addEventListener('keydown', teclaGrafico);
      if (ui.pausa) ui.pausa.addEventListener('click', function () { definirAuto(!auto); ctx.track('backtest'); });

      el.innerHTML = '';
      el.appendChild(raiz);

      // Tamanho real do quadro: redesenha (sem animar) quando ele muda.
      var redimensionar = function () {
        if (!W || destruido) return;
        var t = medir();
        if (geo && !t.falso && t.w === geo.w && t.h === geo.h) return;
        desenhar(t);
      };
      try {
        if (window.ResizeObserver) {
          ro = new window.ResizeObserver(function () { redimensionar(); });
          ro.observe(ui.plot);
        } else if (window.addEventListener) {
          aoRedimensionar = redimensionar;
          window.addEventListener('resize', aoRedimensionar);
        }
      } catch (e) { /* sem observador: fica o tamanho medido agora */ }
      // Pausado antes de entrar na tela (botão "Pausar animações"): mostra o quadro final.
      aoPausar = function () { if (revelarAoLigar && ctx.paused()) { revelarAoLigar = false; terminar(); } };
      if (document.addEventListener) document.addEventListener('iaferr:pause', aoPausar);
      // Impressão (ou aba que nunca ficou visível): o papel sai com as curvas inteiras.
      aoImprimir = function () { revelarAoLigar = false; if (prog < 1 || anim) terminar(); };
      if (window.addEventListener) window.addEventListener('beforeprint', aoImprimir);
      if (ui.pausa) definirAuto(auto);
    }

    ctx.fetchJSON(ctx.src(URL_PADRAO)).then(function (d) {
      if (destruido) return;
      var P = preparar(d);
      if (!P) { el.setAttribute('data-iaw-backtest', 'sem-dado'); return; }
      D = P;
      montar();
      escolher(D.horizontes.length - 1, false, true);   // começa no período mais longo
      garantirCiclo();
    }, function () {
      if (!destruido) el.setAttribute('data-iaw-backtest', 'sem-dado');   // fica o conteúdo do servidor
    });

    return {
      start: function () {
        rodando = true;
        if (!D) return;
        if (revelarAoLigar) {
          revelarAoLigar = false;
          if (ctx.reduced) terminar(); else comecar();
        }
        garantirCiclo();
      },
      stop: function () {
        rodando = false;
        revelarAoLigar = false;
        if (anim || prog < 1) terminar();
        soltarDesenho();
        soltarCiclo();
      },
      destroy: function () {
        destruido = true;
        soltarDesenho();
        soltarCiclo();
        if (ro) { try { ro.disconnect(); } catch (e) { /* nada */ } ro = null; }
        if (aoRedimensionar && window.removeEventListener) window.removeEventListener('resize', aoRedimensionar);
        if (aoPausar && document.removeEventListener) document.removeEventListener('iaferr:pause', aoPausar);
        if (aoImprimir && window.removeEventListener) window.removeEventListener('beforeprint', aoImprimir);
        el.innerHTML = '';
      }
    };
  });
})();
