/* Widget "nota" (SPEC §4; SPEC-v2 §C Nota): checklist dos 6 pilares da nota qualitativa.

   Um código, três modos:
   - 'page' (página /ferramentas/nota-qualitativa/): CHECKLIST INTERATIVO. A pessoa dá a própria nota
     de 1 (Fraco) a 4 (Forte) a cada pilar, guiada por perguntas curtas, e vê a nota final ponderada
     como no app: média das 53 perguntas, ou seja, cada pilar pesa pelo número de perguntas
     (11, 10, 10, 10, 6 e 6). As notas são da pessoa: nada vem da base da plataforma e nada é enviado
     nem guardado. No resultado, o ticker digitado abre a página da ação no app, onde a nota de cada
     empresa fica aberta a qualquer conta.
   - 'tile' (bento da landing, 1x1): DEMONSTRAÇÃO com selo "Exemplo ilustrativo". A Ação A e a Ação B,
     fictícias, recebem nota pilar a pilar e a nota final ponderada acompanha. Os perfis são opostos de
     propósito: a B tem média simples maior e nota final menor, porque é forte nos pilares com menos
     perguntas. Passar o mouse, tocar ou focar um pilar mostra o peso dele.
   - data-mode="ativo" (seção SSR "nota-ativo"): só a caixa "ticker → página da ação no app".

   Régua de cor do app (qualitativoDisplay.tsx): acima de 3,2 ouro; de 2,9 a 3,2 petróleo; abaixo de
   2,9 vermelho. Escala sempre de 1 a 4 (nunca 0 a 4). Só transform e opacity animam: os segmentos
   enchem com scaleX e o marcador da régua anda com translateX. */
(function () {
  var PILLARS = [
    { name: 'Governança', short: 'Governança', n: 11,
      lead: 'Quem controla a empresa e como decide.',
      qs: ['O controlador também é o CEO?',
        'Quantos conselheiros são independentes? E o free float?',
        'Os investimentos e dividendos dos últimos anos deram retorno?'] },
    { name: 'Management', short: 'Management', n: 10,
      lead: 'Quem administra e o que já entregou.',
      qs: ['CEO e CFO têm histórico de bons resultados?',
        'A empresa cumpre o guidance que divulga?',
        'Os executivos têm ações da empresa? Há plano de sucessão?'] },
    { name: 'Indústria', short: 'Indústria', n: 10,
      lead: 'O setor em que a empresa compete.',
      qs: ['O setor está crescendo, maduro ou encolhendo?',
        'Depende muito de juros, câmbio, PIB ou commodities?',
        'Poucas empresas dividem o mercado, ou há muita competição?'] },
    { name: 'Vantagens Competitivas / Barreiras à Entrada', short: 'Vantagens', n: 10,
      lead: 'O que protege o negócio da concorrência.',
      qs: ['Tem escala ou custo menor que os concorrentes?',
        'Tem marca, tecnologia, licença ou distribuição difícil de copiar?',
        'As margens ficam acima das dos pares?'] },
    { name: 'Poder de Barganha', short: 'Barganha', n: 6,
      lead: 'Quem dita preço e condições: a empresa, os fornecedores ou os clientes.',
      qs: ['Depende de poucos fornecedores ou de poucos clientes?',
        'Trocar de fornecedor custa caro para os clientes dela?',
        'Há substitutos baratos? É fácil um concorrente entrar?'] },
    { name: 'Riscos e Estrutura', short: 'Riscos', n: 6,
      lead: 'O que pode dar errado no negócio e no balanço.',
      qs: ['Regulação ou contratos com o governo pesam na receita?',
        'A dívida está sob controle diante do EBITDA?',
        'A ação tem liquidez? O negócio exige muito capital?'] }
  ];
  var TOTAL = 53;
  var LEVELS = ['Fraco', 'Médio', 'Satisfatório', 'Forte'];
  /* Empresas fictícias (selo visível). A: 158/53 = 2,98 (média simples 2,83). B: 154/53 = 2,91
     (média simples 3,00). */
  var EXAMPLES = [
    { label: 'Ação A', g: [4, 3, 3, 3, 2, 2] },
    { label: 'Ação B', g: [2, 3, 3, 3, 4, 3] }
  ];
  var BAND_TEXT = { alto: 'acima de 3,2', medio: 'de 2,9 a 3,2', baixo: 'abaixo de 2,9' };
  /* Deep link da página da ação (Visão geral): o mesmo formato do link "ver na plataforma" das páginas
     de ticker (sem "?" no next, o app ignora o que o login cola no fim). */
  var APP_ASSET = 'https://app.brasilhorizonte.com.br/authnew?ref=iacoes&utm_medium=ferramentas&next=';
  var TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;

  function weighted(g) {
    var s = 0;
    var n = 0;
    for (var i = 0; i < PILLARS.length; i++) if (g[i]) { s += g[i] * PILLARS[i].n; n += PILLARS[i].n; }
    return n ? s / n : null;
  }
  function simple(g) {
    var s = 0;
    var k = 0;
    for (var i = 0; i < g.length; i++) if (g[i]) { s += g[i]; k += 1; }
    return k ? s / k : null;
  }
  function count(g) {
    var k = 0;
    for (var i = 0; i < g.length; i++) if (g[i]) k += 1;
    return k;
  }
  /* A nota do app tem 2 casas; a cor sai da nota já arredondada. */
  function round2(v) { return Math.round(v * 100) / 100; }
  function band(v) { return v > 3.2 ? 'alto' : v >= 2.9 ? 'medio' : 'baixo'; }
  function share(ctx, i) { return ctx.fmt.num(PILLARS[i].n / TOTAL * 100, 1) + '%'; }

  /* Quatro segmentos (1 a 4) que enchem com scaleX; a cor segue a régua (classe is-g1..is-g4). */
  function segs(h) {
    var list = [];
    var el = h('span', { 'class': 'iaw-nota-segs', 'aria-hidden': 'true' });
    for (var s = 0; s < 4; s++) {
      var seg = h('span', { 'class': 'iaw-nota-seg' }, [h('i', null)]);
      list.push(seg);
      el.appendChild(seg);
    }
    return { el: el, list: list };
  }
  function paintSegs(sg, g) {
    sg.el.className = 'iaw-nota-segs' + (g ? ' is-g' + g : '');
    for (var s = 0; s < sg.list.length; s++) sg.list[s].className = 'iaw-nota-seg' + (s < g ? ' is-on' : '');
  }

  function clearTimer(t) { if (t !== null && window.clearTimeout) window.clearTimeout(t); }

  /* Caixa "ticker → página da ação no app". O link só ganha href com um ticker válido (sem href, o <a>
     sai da ordem de tabulação e a dica explica o que falta). Sugestões: /tickers.json (páginas do
     site), baixado só no primeiro foco. */
  function buildCompare(ctx, uid, labelText) {
    var h = ctx.h;
    var inId = uid + '-tk';
    var listId = uid + '-tl';
    var input = h('input', {
      id: inId, type: 'text', 'class': 'iaw-nota-cmp-in iaw-mono', placeholder: 'Ex.: VALE3', maxlength: '7',
      autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-describedby': uid + '-tkh'
    });
    var go = h('a', { 'class': 'iaw-nota-cmp-go is-off', 'aria-disabled': 'true', 'data-cta': 'tool-nota-ativo' }, 'Entrar para ver a nota');
    var datalist = h('datalist', { id: listId });
    var hint = h('p', { 'class': 'iaw-nota-cmp-hint', id: uid + '-tkh' }, [
      'Abre a página da ação na plataforma. Ela pede login; quando a empresa tem nota, ela aparece até na conta grátis. Não sabe o ticker? Procure em ',
      h('a', { href: '/acoes/' }, 'Ações da B3'),
      '.'
    ]);
    var loaded = false;

    function update() {
      var t = String(input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
      if (input.value !== t) input.value = t;
      if (TICKER_RE.test(t)) {
        go.setAttribute('href', APP_ASSET + encodeURIComponent('/ativo/' + t));
        go.removeAttribute('aria-disabled');
        go.className = 'iaw-nota-cmp-go';
        go.textContent = 'Entrar para ver a nota de ' + t;
      } else {
        go.removeAttribute('href');
        go.setAttribute('aria-disabled', 'true');
        go.className = 'iaw-nota-cmp-go is-off';
        go.textContent = 'Entrar para ver a nota';
      }
    }
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    input.addEventListener('keydown', function (ev) {
      if (ev && ev.key === 'Enter' && go.getAttribute('href')) {
        if (ev.preventDefault) ev.preventDefault();
        if (go.click) go.click();
      }
    });
    input.addEventListener('focus', function () {
      if (loaded) return;
      loaded = true;
      ctx.fetchJSON('/tickers.json').then(function (rows) {
        if (!rows || !rows.length) return;
        var ts = [];
        for (var i = 0; i < rows.length; i++) {
          var t = rows[i] && rows[i].ticker;
          if (typeof t === 'string' && TICKER_RE.test(t)) ts.push(t);
        }
        ts.sort();
        for (var j = 0; j < ts.length; j++) datalist.appendChild(h('option', { value: ts[j] }));
        if (ts.length) input.setAttribute('list', listId);
      }, function () { /* sem a lista, o campo continua livre */ });
    });
    go.addEventListener('click', function (ev) {
      if (!go.getAttribute('href')) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (input.focus) input.focus();
        return;
      }
      ctx.track('nota');
      // Mesmo tratamento dos CTAs do site: UTMs, cta_click e redirecionamento (head tracking).
      if (typeof window._iaClick === 'function') window._iaClick(ev);
    });

    return h('div', { 'class': 'iaw-nota-cmp' }, [
      h('label', { 'class': 'iaw-nota-cmp-l', 'for': inId }, labelText),
      h('div', { 'class': 'iaw-nota-cmp-row' }, [input, go]),
      datalist,
      hint
    ]);
  }

  /* Régua 1–4 com as três faixas do app e o marcador da nota (translateX em % da própria largura). */
  function buildScale(ctx) {
    var h = ctx.h;
    var mark = h('span', { 'class': 'iaw-nota-mk is-off' }, [h('i', null)]);
    var el = h('div', { 'class': 'iaw-nota-scale', role: 'img', 'aria-label': 'Régua de 1 a 4, ainda sem nota' }, [
      h('span', { 'class': 'iaw-nota-track' }, [
        h('span', { 'class': 'iaw-nota-zone is-baixo' }),
        h('span', { 'class': 'iaw-nota-zone is-medio' }),
        h('span', { 'class': 'iaw-nota-zone is-alto' }),
        mark
      ]),
      h('span', { 'class': 'iaw-nota-ticks', 'aria-hidden': 'true' }, [
        h('span', { 'class': 'iaw-nota-tick', style: { left: '0%' } }, '1'),
        h('span', { 'class': 'iaw-nota-tick', style: { left: '63.333%' } }, '2,9'),
        h('span', { 'class': 'iaw-nota-tick', style: { left: '73.333%' } }, '3,2'),
        h('span', { 'class': 'iaw-nota-tick', style: { left: '100%' } }, '4')
      ])
    ]);
    return {
      el: el,
      set: function (v) {
        if (v === null) {
          mark.className = 'iaw-nota-mk is-off';
          el.setAttribute('aria-label', 'Régua de 1 a 4, ainda sem nota');
          return;
        }
        var b = band(v);
        var pct = Math.max(0, Math.min(1, (v - 1) / 3)) * 100;
        mark.style.transform = 'translateX(' + pct.toFixed(2) + '%)';
        mark.className = 'iaw-nota-mk is-' + b;
        el.setAttribute('aria-label', 'Régua de 1 a 4: sua nota ' + ctx.fmt.num(v, 2) + ' fica na faixa ' + BAND_TEXT[b] + ' da régua de cor da plataforma');
      }
    };
  }

  // ─── Página: checklist interativo ───────────────────────────────────────

  function mountPage(el, ctx) {
    var h = ctx.h;
    var fmt = ctx.fmt;
    var uid = ctx.uid('iaw-nota');
    var grades = [0, 0, 0, 0, 0, 0];
    var cur = 0;            // 0..5 = pilar; 6 = resultado
    var timer = null;

    var live = h('p', { 'class': 'iaw-sr', 'aria-live': 'polite' });
    function say(t) { live.textContent = t; }

    var finalV = h('span', { 'class': 'iaw-nota-final-v iaw-mono' }, '—');
    var finalSub = h('span', { 'class': 'iaw-nota-final-sub' }, '0 de 6 pilares');
    var head = h('div', { 'class': 'iaw-nota-head' }, [
      h('div', { 'class': 'iaw-nota-head-l' }, [
        h('span', { 'class': 'iaw-nota-kicker' }, 'Checklist dos 6 pilares'),
        h('span', { 'class': 'iaw-nota-tag' }, 'Suas notas, de 1 a 4')
      ]),
      h('p', { 'class': 'iaw-nota-final' }, [
        h('span', { 'class': 'iaw-nota-final-k' }, 'Nota final'),
        h('span', { 'class': 'iaw-nota-final-num' }, [finalV, h('span', { 'class': 'iaw-nota-final-of' }, '/ 4')]),
        finalSub
      ])
    ]);

    // Navegação pelos pilares (cada um mostra a nota dada) + resultado.
    var pills = [];
    var nav = h('ol', { 'class': 'iaw-nota-nav', 'aria-label': 'Pilares da nota qualitativa' });
    PILLARS.forEach(function (P, i) {
      var sg = segs(h);
      var gEl = h('span', { 'class': 'iaw-nota-pill-g iaw-mono', 'aria-hidden': 'true' }, '–');
      var b = h('button', { type: 'button', 'class': 'iaw-nota-pill' }, [
        h('span', { 'class': 'iaw-nota-pill-name', 'aria-hidden': 'true' }, P.short),
        h('span', { 'class': 'iaw-nota-pill-n', 'aria-hidden': 'true' }, P.n + ' perg.'),
        gEl,
        sg.el
      ]);
      b.addEventListener('click', function () { go(i, true); });
      pills.push({ b: b, sg: sg, g: gEl });
      nav.appendChild(h('li', null, [b]));
    });
    var resBtn = h('button', { type: 'button', 'class': 'iaw-nota-pill iaw-nota-pill--res' }, 'Ver resultado');
    resBtn.addEventListener('click', function () { go(6, true); });
    nav.appendChild(h('li', { 'class': 'iaw-nota-nav-res' }, [resBtn]));

    // Passo: um pilar por vez, com as perguntas-guia e as 4 notas.
    var stepMeta = h('p', { 'class': 'iaw-nota-step-meta' });
    var stepName = h('p', { 'class': 'iaw-nota-step-name' });
    var stepLead = h('p', { 'class': 'iaw-nota-step-lead' });
    var stepQs = h('ul', { 'class': 'iaw-nota-qs' });
    var groupLabel = h('span', { 'class': 'iaw-sr', id: uid + '-g' });
    var grid = h('div', { 'class': 'iaw-nota-grades', role: 'group', 'aria-labelledby': uid + '-g' });
    var gradeBtns = [];
    for (var v = 1; v <= 4; v++) {
      (function (val) {
        var b = h('button', { type: 'button', 'class': 'iaw-nota-grade', 'aria-pressed': 'false', 'aria-label': val + ', ' + LEVELS[val - 1] }, [
          h('span', { 'class': 'iaw-nota-grade-n iaw-mono', 'aria-hidden': 'true' }, String(val)),
          h('span', { 'class': 'iaw-nota-grade-l', 'aria-hidden': 'true' }, LEVELS[val - 1])
        ]);
        // detail > 0 = clique de mouse ou toque: avança sozinho. Teclado (detail 0) fica no pilar.
        b.addEventListener('click', function (ev) { grade(val, !!(ev && ev.detail > 0)); });
        gradeBtns.push(b);
        grid.appendChild(b);
      })(v);
    }
    var prev = h('button', { type: 'button', 'class': 'iaw-btn' }, 'Anterior');
    var next = h('button', { type: 'button', 'class': 'iaw-btn iaw-nota-next' }, 'Próximo pilar');
    prev.addEventListener('click', function () { if (cur > 0) go(cur - 1, true); });
    next.addEventListener('click', function () { go(cur + 1, true); });
    var step = h('div', { 'class': 'iaw-nota-step' }, [
      stepMeta, stepName, stepLead, stepQs, groupLabel, grid,
      h('p', { 'class': 'iaw-nota-hint' }, 'Sem informação para responder? A metodologia usa 2.'),
      h('div', { 'class': 'iaw-nota-step-nav' }, [prev, next])
    ]);

    // Resultado: nota final, régua, média simples e o link para a página da ação.
    var resV = h('span', { 'class': 'iaw-nota-res-v iaw-mono' }, '—');
    var resBand = h('p', { 'class': 'iaw-nota-res-band' });
    var scale = buildScale(ctx);
    var resNote = h('p', { 'class': 'iaw-nota-res-note' });
    var review = h('button', { type: 'button', 'class': 'iaw-btn' }, 'Revisar os pilares');
    var again = h('button', { type: 'button', 'class': 'iaw-btn' }, 'Recomeçar');
    review.addEventListener('click', function () { go(0, true); });
    again.addEventListener('click', function () {
      grades = [0, 0, 0, 0, 0, 0];
      go(0, false);
      say('Checklist zerado. Pilar 1 de 6: ' + PILLARS[0].name + '.');
    });
    var res = h('div', { 'class': 'iaw-nota-res', hidden: true }, [
      h('p', { 'class': 'iaw-nota-res-k' }, 'Sua nota final'),
      h('p', { 'class': 'iaw-nota-res-row' }, [resV, h('span', { 'class': 'iaw-nota-res-of' }, '/ 4')]),
      scale.el,
      resBand,
      resNote,
      buildCompare(ctx, uid, 'Compare com a nota da plataforma'),
      h('div', { 'class': 'iaw-nota-res-actions' }, [review, again])
    ]);

    var panel = h('div', { 'class': 'iaw-nota-panel' }, [step, res]);
    var root = h('div', { 'class': 'iaw-nota iaw-nota--page' }, [head, h('div', { 'class': 'iaw-nota-body' }, [nav, panel]), live]);

    function nextOpen(i) {
      for (var k = i + 1; k < 6; k++) if (!grades[k]) return k;
      for (var j = 0; j < i; j++) if (!grades[j]) return j;
      return 6;
    }
    function partial(n) {
      var falta = 6 - n;
      return (falta === 1 ? 'Falta 1 pilar' : 'Faltam ' + falta + ' pilares') + ': a nota considera só ' +
        (n === 1 ? 'o pilar marcado' : 'os ' + n + ' marcados') + ', cada um com o seu peso.';
    }
    function resultPhrase() {
      var f = weighted(grades);
      if (f === null) return 'Resultado: marque ao menos um pilar para ver a nota.';
      return 'Resultado: nota final ' + fmt.num(round2(f), 2) + ' de 4, com ' + count(grades) + ' de 6 pilares.';
    }

    function paint() {
      var f = weighted(grades);
      var n = count(grades);
      if (f === null) {
        finalV.textContent = '—';
        finalV.className = 'iaw-nota-final-v iaw-mono';
      } else {
        finalV.textContent = fmt.num(round2(f), 2);
        finalV.className = 'iaw-nota-final-v iaw-mono is-' + band(round2(f));
      }
      finalSub.textContent = n + ' de 6 pilares';

      for (var i = 0; i < 6; i++) {
        var p = pills[i];
        var g = grades[i];
        paintSegs(p.sg, g);
        p.g.textContent = g ? String(g) : '–';
        p.g.className = 'iaw-nota-pill-g iaw-mono' + (g ? ' is-g' + g : '');
        p.b.className = 'iaw-nota-pill' + (i === cur ? ' is-cur' : '') + (g ? ' is-done' : '');
        if (i === cur) p.b.setAttribute('aria-current', 'step'); else p.b.removeAttribute('aria-current');
        p.b.setAttribute('aria-label', PILLARS[i].name + ', ' + PILLARS[i].n + ' de 53 perguntas: ' + (g ? 'nota ' + g + ', ' + LEVELS[g - 1] : 'sem nota'));
      }
      resBtn.className = 'iaw-nota-pill iaw-nota-pill--res' + (cur === 6 ? ' is-cur' : '');
      if (cur === 6) resBtn.setAttribute('aria-current', 'step'); else resBtn.removeAttribute('aria-current');

      if (cur === 6) {
        step.setAttribute('hidden', '');
        res.removeAttribute('hidden');
        if (f === null) {
          resV.textContent = '—';
          resV.className = 'iaw-nota-res-v iaw-mono';
          resBand.textContent = 'Marque ao menos um pilar para ver a nota.';
          resNote.textContent = '';
          scale.set(null);
        } else {
          var r = round2(f);
          resV.textContent = fmt.num(r, 2);
          resV.className = 'iaw-nota-res-v iaw-mono is-' + band(r);
          resBand.textContent = 'Na régua de cor da plataforma, a nota fica na faixa ' + BAND_TEXT[band(r)] + '.';
          resNote.textContent = n < 6 ? partial(n) : 'Média simples dos 6 pilares: ' + fmt.num(round2(simple(grades)), 2) +
            '. A nota final pesa cada pilar pelo número de perguntas, como a plataforma.';
          scale.set(r);
        }
        return;
      }

      res.setAttribute('hidden', '');
      step.removeAttribute('hidden');
      var P = PILLARS[cur];
      stepMeta.textContent = 'Pilar ' + (cur + 1) + ' de 6 · ' + P.n + ' de 53 perguntas';
      stepMeta.appendChild(h('span', { 'class': 'iaw-nota-step-pct' }, ' (' + share(ctx, cur) + ' da nota)'));
      stepName.textContent = P.name;
      stepLead.textContent = P.lead;
      stepQs.textContent = '';
      for (var q = 0; q < P.qs.length; q++) stepQs.appendChild(h('li', null, P.qs[q]));
      groupLabel.textContent = 'Sua nota para ' + P.name + ', de 1 (Fraco) a 4 (Forte)';
      for (var k = 0; k < 4; k++) {
        var on = grades[cur] === k + 1;
        gradeBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false');
        gradeBtns[k].className = 'iaw-nota-grade' + (on ? ' is-on is-g' + (k + 1) : '');
      }
      if (cur === 0) prev.setAttribute('aria-disabled', 'true'); else prev.removeAttribute('aria-disabled');
      next.textContent = cur === 5 ? 'Ver resultado' : 'Próximo pilar';
    }

    function go(i, byUser) {
      clearTimer(timer);
      timer = null;
      cur = Math.max(0, Math.min(6, i));
      paint();
      if (byUser) {
        ctx.track('nota');
        say(cur === 6 ? resultPhrase() : 'Pilar ' + (cur + 1) + ' de 6: ' + PILLARS[cur].name + '.');
      }
    }

    function grade(val, pointer) {
      if (cur > 5) return;
      var i = cur;
      clearTimer(timer);
      timer = null;
      grades[i] = val;
      ctx.track('nota');
      paint();
      var n = count(grades);
      var msg = PILLARS[i].name + ': ' + val + ', ' + LEVELS[val - 1] + '. Nota final' + (n < 6 ? ' parcial' : '') + ': ' +
        fmt.num(round2(weighted(grades)), 2) + '.';
      if (pointer) {
        var nxt = nextOpen(i);
        msg += nxt === 6 ? ' Todos os pilares marcados: veja o resultado.' : ' Próximo: ' + PILLARS[nxt].name + '.';
        // Pausa curta para a escolha aparecer antes de trocar de pilar (não é animação).
        timer = window.setTimeout(function () { timer = null; cur = nxt; paint(); }, 320);
      }
      say(msg);
    }

    paint();
    el.innerHTML = '';
    el.appendChild(root);
    return {
      start: function () {},
      stop: function () {},
      destroy: function () { clearTimer(timer); timer = null; el.innerHTML = ''; }
    };
  }

  // ─── Landing: demonstração ilustrativa ──────────────────────────────────

  function mountTile(el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var fmt = ctx.fmt;
    var STEP = 430;
    var PRE = 600;
    var HOLD = 4200;
    var ex = 0;
    var k = 6;                       // pilares já marcados no exemplo da vez
    var phase = 'hold';              // começa com a Ação A completa (quadro útil mesmo parado)
    var acc = ctx.reduced ? 0 : HOLD - 2200;
    var freeze = 0;                  // pausa curta depois de a pessoa apontar um pilar
    var auto = !ctx.reduced;
    var cancelLoop = null;

    var exLabel = h('span', { 'class': 'iaw-nota-ex' });
    var pause = h('button', { type: 'button', 'class': 'iaw-nota-pause', 'aria-pressed': 'false' });
    var top = h('div', { 'class': 'iaw-nota-ttop' }, [
      exLabel,
      h('span', { 'class': 'iaw-nota-ttop-r' }, [ctx.seal('Exemplo ilustrativo'), ctx.reduced ? null : pause])
    ]);
    var rows = [];
    var list = h('ol', { 'class': 'iaw-nota-rows', 'aria-label': 'Notas de exemplo por pilar' });
    PILLARS.forEach(function (P, i) {
      var sg = segs(h);
      var gEl = h('span', { 'class': 'iaw-nota-row-g iaw-mono', 'aria-hidden': 'true' }, '–');
      var b = h('button', { type: 'button', 'class': 'iaw-nota-row' }, [
        h('span', { 'class': 'iaw-nota-row-name', 'aria-hidden': 'true' }, P.short),
        sg.el,
        gEl
      ]);
      b.addEventListener('mouseenter', function () { info(i); });
      b.addEventListener('focus', function () { info(i); });
      b.addEventListener('click', function () { info(i); });
      rows.push({ b: b, sg: sg, g: gEl });
      list.appendChild(h('li', null, [b]));
    });
    var tFinal = h('span', { 'class': 'iaw-nota-tfinal iaw-mono' }, '—');
    var tSimple = h('span', { 'class': 'iaw-nota-tsimple' });
    var tNote = h('p', { 'class': 'iaw-nota-tnote', 'aria-live': 'off' });
    var foot = h('div', { 'class': 'iaw-nota-tfoot' }, [
      h('p', { 'class': 'iaw-nota-tline' }, [
        h('span', { 'class': 'iaw-nota-tk' }, 'Nota final'),
        tFinal,
        h('span', { 'class': 'iaw-nota-tof' }, '/ 4'),
        tSimple
      ]),
      tNote
    ]);

    function current() {
      var g = EXAMPLES[ex].g;
      var out = [];
      for (var i = 0; i < 6; i++) out.push(i < k ? g[i] : 0);
      return out;
    }
    function paint() {
      var g = current();
      exLabel.textContent = EXAMPLES[ex].label;
      for (var i = 0; i < 6; i++) {
        var r = rows[i];
        var v = g[i];
        paintSegs(r.sg, v);
        r.g.textContent = v ? String(v) : '–';
        r.g.className = 'iaw-nota-row-g iaw-mono' + (v ? ' is-g' + v : '');
        r.b.setAttribute('aria-label', PILLARS[i].name + (v ? ': nota ' + v + ', ' + LEVELS[v - 1] + ', no exemplo' : ': ainda sem nota no exemplo') +
          '. ' + PILLARS[i].n + ' de 53 perguntas, ' + share(ctx, i) + ' da nota final.');
      }
      var f = weighted(g);
      if (f === null) {
        tFinal.textContent = '—';
        tFinal.className = 'iaw-nota-tfinal iaw-mono';
      } else {
        tFinal.textContent = fmt.num(round2(f), 2);
        tFinal.className = 'iaw-nota-tfinal iaw-mono is-' + band(round2(f));
      }
      tSimple.textContent = k === 6 ? 'média simples ' + fmt.num(round2(simple(g)), 2) : '';
      tNote.textContent = k === 6 ? 'Cada pilar pesa pelo nº de perguntas.' : k ? 'Nota parcial: ' + k + ' de 6 pilares.' : 'Marcando os 6 pilares…';
    }
    function info(i) {
      freeze = 6000;
      tNote.textContent = PILLARS[i].short + ': ' + PILLARS[i].n + ' de 53 perguntas, ' + share(ctx, i) + ' da nota.';
      ctx.track('nota');
    }
    function frame(dt) {
      if (!auto) return;
      if (freeze > 0) { freeze -= dt; if (freeze <= 0) paint(); return; }
      acc += dt;
      if (phase === 'pre') {
        if (acc >= PRE) { acc = 0; phase = 'fill'; }
      } else if (phase === 'fill') {
        if (acc >= STEP) { acc = 0; k += 1; if (k >= 6) phase = 'hold'; paint(); }
      } else if (acc >= HOLD) {
        acc = 0;
        ex = (ex + 1) % EXAMPLES.length;
        k = 0;
        phase = 'pre';
        paint();
      }
    }

    function icon(playing) {
      return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' },
        playing
          ? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
          : [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
    }
    function setAuto(on) {
      auto = on;
      pause.setAttribute('aria-pressed', on ? 'false' : 'true');
      pause.setAttribute('aria-label', on ? 'Pausar a demonstração' : 'Retomar a demonstração');
      pause.textContent = '';
      pause.appendChild(icon(on));
    }
    pause.addEventListener('click', function () { setAuto(!auto); ctx.track('nota'); });
    setAuto(auto);

    var root = h('div', {
      'class': 'iaw-nota iaw-nota--tile',
      role: 'group',
      'aria-label': 'Demonstração ilustrativa do checklist da nota qualitativa, com empresas fictícias: cada pilar recebe uma nota de 1 a 4 e a nota final pesa os pilares pelo número de perguntas'
    }, [top, list, foot]);
    paint();
    el.innerHTML = '';
    el.appendChild(root);

    return {
      start: function () { if (!cancelLoop && !ctx.reduced) cancelLoop = ctx.loop(frame); },
      stop: function () { if (cancelLoop) { cancelLoop(); cancelLoop = null; } },
      destroy: function () { if (cancelLoop) cancelLoop(); cancelLoop = null; el.innerHTML = ''; }
    };
  }

  // ─── Seção "Ver a nota de uma empresa": só a caixa ticker → app ─────────

  function mountAtivo(el, ctx) {
    var root = ctx.h('div', { 'class': 'iaw-nota iaw-nota--ativo' }, [buildCompare(ctx, ctx.uid('iaw-nota'), 'Ticker da ação')]);
    el.innerHTML = '';
    el.appendChild(root);
    return {
      start: function () {},
      stop: function () {},
      destroy: function () { el.innerHTML = ''; }
    };
  }

  window.IAFerr.register('nota', function (el, ctx) {
    if (el.getAttribute('data-mode') === 'ativo') return mountAtivo(el, ctx);
    return ctx.size === 'page' ? mountPage(el, ctx) : mountTile(el, ctx);
  });
})();
