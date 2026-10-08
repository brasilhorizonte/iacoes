/* Widget "radar" (SPEC §4): as 6 listas do Radar de oportunidades como cartões que se acendem
   em sequência, cada um mostrando a regra real da tela Radar do app.

   ILUSTRATIVO (selo visível): nenhum ticker e nenhuma contagem. Os papéis são "Ação A", "Ação B"...
   e foram distribuídos para ensinar a lógica real: Oportunidades Claras reúne quem está em
   Distorções de Valuation E em mais uma lista; a Ação F está também em Riscos Elevados, porque as
   listas não se excluem. Passar o mouse, tocar ou focar um cartão mostra a regra dele.

   Tamanhos: 'page' (~640×360, página da ferramenta) mostra os papéis de exemplo em cada cartão e o
   botão "Pausar" embaixo (abaixo de 400 px de tela, layout compacto: os papéis viram etiquetas
   "A", "C", "F" numa linha); 'tile' (~300×220, landing) mostra só os nomes curtos, a regra resumida
   e um botão de pausa compacto no topo (o movimento automático sempre tem como parar). */
(function () {
  var LISTS = [
    { name: 'Oportunidades Claras', tile: 'Oportunidades', tone: 'gold', items: ['A', 'C', 'F'],
      rule: 'tem Nota Qualitativa, está em Distorções de Valuation e em pelo menos mais uma lista (Reprecificação, PEG ou Small Caps Ignoradas).',
      ruleTile: 'está em Distorções e em mais uma lista, e tem Nota Qualitativa.',
      extra: 'No exemplo, as ações A, C e F cumprem isso; a F também está em Riscos Elevados, porque as listas não se excluem.' },
    { name: 'Reprecificação (Momentum)', tile: 'Reprecificação', tone: 'emerald', items: ['A', 'D', 'G'],
      rule: 'crescimento do lucro acima de 10%, ROA acima de 10% e P/L abaixo de 20.',
      ruleTile: 'lucro crescendo mais de 10%, ROA acima de 10% e P/L abaixo de 20.' },
    { name: 'Distorções de Valuation', tile: 'Distorções', tone: 'blue', items: ['A', 'C', 'F'],
      rule: 'P/L positivo e abaixo de 50% da média de P/L do setor.',
      ruleTile: 'P/L positivo e abaixo da metade da média do setor.' },
    { name: 'PEG Ratio (< 1)', tile: 'PEG < 1', tone: 'teal', items: ['C', 'D', 'H'],
      rule: 'P/L dividido pelo crescimento do lucro abaixo de 1, com os dois positivos.',
      ruleTile: 'P/L ÷ crescimento do lucro abaixo de 1.' },
    { name: 'Small Caps Ignoradas', tile: 'Small Caps', tone: 'purple', items: ['F', 'J', 'K'],
      rule: 'valor de mercado abaixo de R$ 2 bilhões e volume do último pregão abaixo de 80% da média de 10 pregões.',
      ruleTile: 'valor de mercado abaixo de R$ 2 bi e volume do dia abaixo de 80% da média.' },
    { name: 'Riscos Elevados', tile: 'Riscos', tone: 'red', items: ['B', 'F', 'L'],
      rule: 'Dívida líquida/EBITDA acima de 3,5, ou lucro caindo mais de 10% com Dívida/EBITDA acima de 2.',
      ruleTile: 'Dív. líq./EBITDA acima de 3,5, ou lucro caindo mais de 10% com Dív./EBITDA acima de 2.' }
  ];

  window.IAFerr.register('radar', function (el, ctx) {
    var h = ctx.h;
    var svg = ctx.svg;
    var page = ctx.size === 'page';
    var step = page ? 2600 : 2200;
    var active = 0;
    var auto = !ctx.reduced;
    var hold = 0;
    var acc = 0;
    var cancelLoop = null;
    var cards = [];
    var rows = [];

    var rule = h('p', { 'class': 'iaw-radar-rule', 'aria-live': 'off' });
    var pause = h('button', { type: 'button', 'class': page ? 'iaw-btn iaw-radar-pause' : 'iaw-radar-pause-icon', 'aria-pressed': 'false' });
    var grid = h('div', { 'class': 'iaw-radar-grid', role: 'group', 'aria-label': 'As seis listas do Radar (escolha uma para ver a regra)' });

    function select(i, byUser) {
      active = i;
      acc = 0;
      if (byUser) {
        hold = 6000;
        rule.setAttribute('aria-live', 'polite');
        ctx.track('radar');
      }
      paint();
    }

    LISTS.forEach(function (L, i) {
      var list = null;
      if (page) {
        list = h('span', { 'class': 'iaw-radar-rows', 'aria-hidden': 'true' });
        L.items.forEach(function (letter) {
          var row = h('span', { 'class': 'iaw-radar-row', 'data-letter': letter }, [
            h('span', { 'class': 'iaw-radar-row-name' }, [h('span', { 'class': 'iaw-radar-row-pre' }, 'Ação '), letter]),
            h('span', { 'class': 'iaw-radar-row-bar' })
          ]);
          rows.push(row);
          list.appendChild(row);
        });
      }
      var card = h('button', {
        type: 'button',
        'class': 'iaw-radar-card',
        'data-tone': L.tone,
        'aria-pressed': 'false',
        'aria-label': L.name + ': ' + L.rule
      }, [
        h('span', { 'class': 'iaw-radar-head' }, [
          h('span', { 'class': 'iaw-radar-dot', 'aria-hidden': 'true' }),
          h('span', { 'class': 'iaw-radar-name' }, page ? L.name : L.tile)
        ]),
        list
      ]);
      card.addEventListener('mouseenter', function () { select(i, true); });
      card.addEventListener('focus', function () { select(i, true); });
      card.addEventListener('click', function () { select(i, true); });
      cards.push(card);
      grid.appendChild(card);
    });

    function paint() {
      var L = LISTS[active];
      var cross = active === 0 ? L.items : [];
      for (var i = 0; i < cards.length; i++) {
        var on = i === active;
        cards[i].className = 'iaw-radar-card' + (on ? ' is-on' : '');
        cards[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      for (var j = 0; j < rows.length; j++) {
        var match = cross.indexOf(rows[j].getAttribute('data-letter')) >= 0 && !cards[0].contains(rows[j]);
        rows[j].className = 'iaw-radar-row' + (match ? ' is-match' : '');
      }
      rule.textContent = '';
      rule.appendChild(h('strong', null, L.name + ': '));
      rule.appendChild(document.createTextNode(page ? L.rule + (L.extra ? ' ' + L.extra : '') : L.ruleTile));
    }

    function frame(dt) {
      if (!auto) return;
      if (hold > 0) { hold -= dt; return; }
      acc += dt;
      if (acc >= step) {
        acc = 0;
        active = (active + 1) % LISTS.length;
        // Troca automática não é anunciada (senão o leitor de tela lê uma regra a cada 2,6 s
        // depois do primeiro toque): só a lista escolhida pela pessoa vira aria-live polite.
        rule.setAttribute('aria-live', 'off');
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
      pause.setAttribute('aria-label', on ? 'Pausar a sequência das listas' : 'Retomar a sequência das listas');
      if (page) pause.textContent = on ? 'Pausar' : 'Retomar';
      else { pause.textContent = ''; pause.appendChild(icon(on)); }
    }
    pause.addEventListener('click', function () { setAuto(!auto); ctx.track('radar'); });
    setAuto(auto);

    var top = h('div', { 'class': 'iaw-radar-top' }, [
      h('span', { 'class': 'iaw-radar-title' }, page ? 'Radar & Distorções' : 'Radar'),
      h('span', { 'class': 'iaw-radar-top-right' }, [ctx.seal('Exemplo ilustrativo'), !page && !ctx.reduced ? pause : null])
    ]);
    var foot = page ? h('div', { 'class': 'iaw-radar-foot' }, [
      ctx.reduced ? null : pause,
      h('span', { 'class': 'iaw-radar-note' }, '6 regras fixas · sem IA · sem tickers no exemplo')
    ]) : null;

    var root = h('div', { 'class': 'iaw-radar ' + (page ? 'iaw-radar--page' : 'iaw-radar--tile') }, [top, grid, rule, foot]);
    paint();
    el.innerHTML = '';
    el.appendChild(root);

    return {
      start: function () { if (!cancelLoop && !ctx.reduced) cancelLoop = ctx.loop(frame); },
      stop: function () { if (cancelLoop) { cancelLoop(); cancelLoop = null; } },
      destroy: function () { if (cancelLoop) cancelLoop(); cancelLoop = null; el.innerHTML = ''; }
    };
  });
})();
