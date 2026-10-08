/* IAções: runtime dos widgets das ferramentas (SPEC §4; SPEC-v2 §E2, §E4, §E5, §E6).
   ES5 puro, sem import/export. Vai primeiro no bundle /assets/js/ferramentas.js (montado por
   scripts/ferramentas/bundle.ts), carregado com defer nas páginas /ferramentas/ e na landing.

   ── 1. Registrar um widget (scripts/ferramentas/widgets/<id>.js, + <id>.css opcional) ───────
     IAFerr.register('<id>', function (el, ctx) {
       // monte fora do DOM e troque o conteúdo de `el` no fim (se a factory lançar erro, o
       // runtime devolve o conteúdo do servidor e marca data-ia-state="erro")
       return {
         start: function () {},    // ligou: em tela, aba visível e não pausado
         stop: function () {},     // desligou (saiu da tela, aba escondida, pauseAll): pare tudo
         destroy: function () {}   // opcional
       };
     });
     Widget pesado (hoje só `calc`) vai para assets/js/ferramentas-calc.js (bundle.ts, SEPARATE),
     carregado só na página dele; o registro é igual.

   ── 2. Marcação (servidor ou landing) ────────────────────────────────────────────────────
     <div data-ia-widget="<id>" data-size="tile|page" [data-span="1x1|2x1|2x2"]
          [data-src="/url.json"] [data-ia-tool="<id da ferramenta>"]>conteúdo sem JS</div>
     - <script type="application/json">{...}</script> dentro do elemento vira ctx.config.
     - data-ia-tool: só monta se a ferramenta estiver publicada (/ferramentas/publicadas.json,
       campo ids); senão fica o conteúdo do servidor e data-ia-state="indisponivel".
     - NUNCA dentro de <a>: o runtime recusa montar (data-ia-state="erro"); o link da ferramenta
       fica fora do quadro.
     - Reserve a altura do quadro no CSS da própria página (min-height) — o bundle chega depois
       (defer) e o quadro não pode pular (CLS). Tamanhos: tile ≈ 300×220 (1x1), 620×220 (2x1),
       620×460 (2x2); page ≈ 640×360 (min-height 300 px no celular, 360 px a partir de 640 px).

   ── 3. Estados que o runtime escreve no elemento ─────────────────────────────────────────
     data-ia-state = ok | erro | indisponivel | aguardando
     data-ia-run   = 1 (animando) | 0 (parado: fora da tela, aba escondida, pausado) — o CSS do
                     runtime congela as animações CSS do quadro com 0.
     data-ia-paused = true enquanto pausado por pauseAll().

   ── 4. ctx (segundo argumento da factory) ────────────────────────────────────────────────
     id, el, size ('tile' | 'page'), span ('1x1' | '2x1' | '2x2'),
     reduced     prefers-reduced-motion (valor atual): desenhe direto o QUADRO FINAL, sem animar;
     config      JSON do <script type="application/json"> do elemento;
     src(url)    data-src do elemento ou a URL padrão;
     fetchJSON(url)  Promise com cache por URL (os quadros da landing dividem o mesmo arquivo);
     fmt         pt-BR: num, brl, pct (fração), mult, big, date (AAAA-MM-DD → DD/MM/AAAA);
     track(nome) _iaTrack('tool_interact', nome), uma vez por página;
     h(tag, attrs, filhos) / svg(tag, attrs, filhos)  montam DOM (attrs.text = textContent;
                 on<evento> = listener); texto de JSON entra só assim, nunca por innerHTML;
     seal(texto) selo "Exemplo ilustrativo" (obrigatório sem dado real);
     uid(prefixo), running(), paused();
     loop(fn(dt, t), { fps })  laço ÚNICO de animação do runtime (um requestAnimationFrame para
                 todos os widgets). fps padrão 30 (teto dos loops decorativos), máximo 60; dt =
                 ms reais desde a chamada anterior. Só roda com o widget ligado e nunca com
                 reduced. Devolve a função que cancela.
     measure(fn) / mutate(fn)  agenda no próximo quadro do laço único: todas as leituras de
                 layout (measure) antes das escritas (mutate) de todos os widgets — use no FLIP.
                 Durante a entrada da seção (animation-timeline), meça com offsetTop/offsetLeft,
                 que ignoram transform.

   ── 5. API global: window.IAFerr ─────────────────────────────────────────────────────────
     register(id, factory), mount(raiz?), destroy(el), fmt, fetchJSON, h, svg, reduced(),
     pauseAll(raiz?) / resumeAll(raiz?) / paused(raiz?)
                 pausa (stop + congela CSS) e retoma os widgets da raiz (padrão: a página).
                 Dispara 'iaferr:pause' / 'iaferr:resume' (CustomEvent que borbulha) na raiz,
                 com detail { paused, root }.
     Botão "Pausar animações" sem JS próprio (WCAG 2.2.2):
       <button type="button" data-ia-pause="#ferramentas">Pausar animações</button>
       O runtime liga o clique, alterna aria-pressed e o rótulo (data-label-pause /
       data-label-resume; padrão "Pausar animações" / "Retomar animações"; se houver um filho
       [data-ia-pause-label], só ele muda). data-ia-pause="" = a página inteira.
     published()  Promise com /ferramentas/publicadas.json: { v, hub, ids, tools, data, assets }.
     O runtime dispara 'iaferr:ready' no document quando sobe (arquivos separados esperam por ele).

   ── 6. CSS ───────────────────────────────────────────────────────────────────────────────
     Página SEM <link> para /assets/css/ferramentas.css (a landing): o runtime injeta o CSS com o
     ?v= do build (CSS_VERSION), sem bloquear a renderização, e só monta os widgets depois que
     ele carrega (até lá fica o conteúdo do servidor). <link media="print" onload=...> também
     serve. Páginas /ferramentas/ mantêm o <link> no <head>.

   ── 7. Regras para quem escreve widget ───────────────────────────────────────────────────
     número só de dado real do build e com a data; sem dado real, selo (ctx.seal()) e rótulos
     "Ação A", "Ação B"... — nunca ticker real em posição inventada; classes .iaw-<id>-*; anime só
     transform e opacity (barras com scaleX); hover sempre com equivalente por foco/teclado;
     controles com rótulo; gráfico com role="img" + aria-label; texto em ouro sobre branco usa
     #8A6A24; nada de tooltip vazando do quadro (o quadro tem contain: layout paint). */
(function (w, d) {
  'use strict';
  if (w.IAFerr && w.IAFerr.register) return;

  // Preenchido pelo bundle.ts com o hash do CSS principal (injeção não-bloqueante).
  var CSS_VERSION = '';
  var JS_FILE = '/assets/js/ferramentas.js';
  var CSS_FILE = '/assets/css/ferramentas.css';
  var PUBLISHED_FILE = '/ferramentas/publicadas.json';

  var factories = {};
  var instances = [];
  var cache = {};
  var tracked = {};
  var pausedRoots = [];
  var mq = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uidN = 0;

  function warn(msg, e) {
    try { if (w.console && w.console.warn) w.console.warn('[ferramentas] ' + msg, e || ''); } catch (_) { /* nada */ }
  }
  function indexOf(list, x) {
    for (var i = 0; i < list.length; i++) if (list[i] === x) return i;
    return -1;
  }
  function emit(target, name, detail) {
    var ev = null;
    try { ev = new w.CustomEvent(name, { bubbles: true, detail: detail }); } catch (e) {
      try { ev = d.createEvent('CustomEvent'); ev.initCustomEvent(name, true, false, detail); } catch (e2) { ev = null; }
    }
    try { if (ev && target && target.dispatchEvent) target.dispatchEvent(ev); } catch (e3) { warn('evento ' + name, e3); }
  }

  // --- De onde o bundle foi carregado ('' na raiz, '/preview/<id>' na prévia) ---
  function attr(el, k) { return (el && el.getAttribute && el.getAttribute(k)) || ''; }
  function srcOf(s) { return (s && (s.src || attr(s, 'src'))) || ''; }
  function ownScript() {
    var s = d.currentScript;
    if (s && srcOf(s).indexOf(JS_FILE) >= 0) return s;
    var all = d.getElementsByTagName ? d.getElementsByTagName('script') : [];
    for (var i = 0; i < all.length; i++) if (srcOf(all[i]).indexOf(JS_FILE) >= 0) return all[i];
    return null;
  }
  var own = ownScript();
  var base = own ? srcOf(own).slice(0, srcOf(own).indexOf(JS_FILE)) : '';

  // --- Formatação pt-BR (mesmas regras de scripts/ticker/lib/format.ts) ---
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function num(n, dec) {
    if (!isNum(n)) return '—';
    dec = dec == null ? 2 : dec;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function brl(n, dec) { return isNum(n) ? 'R$ ' + num(n, dec == null ? 2 : dec) : '—'; }
  function pct(frac, dec) { return isNum(frac) ? num(frac * 100, dec == null ? 1 : dec) + '%' : '—'; }
  function mult(n, dec) { return isNum(n) && n !== 0 ? num(n, dec == null ? 1 : dec) + 'x' : '—'; }
  function big(n) {
    if (!isNum(n) || n === 0) return '—';
    var a = Math.abs(n), v = n, s = '';
    if (a >= 1e12) { v = n / 1e12; s = ' tri'; } else if (a >= 1e9) { v = n / 1e9; s = ' bi'; } else if (a >= 1e6) { v = n / 1e6; s = ' mi'; }
    return 'R$ ' + num(v, Math.abs(v) >= 100 ? 0 : 1) + s;
  }
  function date(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || '');
  }
  var fmt = { num: num, brl: brl, pct: pct, mult: mult, big: big, date: date };

  // --- JSON com cache por URL (os widgets da landing dividem o mesmo arquivo) ---
  function rejected(err) {
    if (w.Promise) return w.Promise.reject(err);
    return { then: function (ok, fail) { if (fail) fail(err); return this; }, 'catch': function (fail) { fail(err); return this; } };
  }
  function fetchJSON(url) {
    if (!w.fetch) return rejected(new Error('fetch indisponível'));
    if (!cache[url]) {
      cache[url] = w.fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + url);
        return r.json();
      });
      cache[url].then(null, function () { delete cache[url]; });
    }
    return cache[url];
  }
  function published() { return fetchJSON(base + PUBLISHED_FILE); }

  // --- DOM ---
  function setAttrs(el, attrs) {
    if (!attrs) return;
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = String(v);
      else if (k === 'style' && typeof v === 'object') { for (var s in v) if (Object.prototype.hasOwnProperty.call(v, s)) el.style[s] = v[s]; }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  function append(el, kids) {
    if (kids == null || kids === false) return;
    if (Object.prototype.toString.call(kids) === '[object Array]') {
      for (var i = 0; i < kids.length; i++) append(el, kids[i]);
      return;
    }
    el.appendChild(typeof kids === 'object' ? kids : d.createTextNode(String(kids)));
  }
  function h(tag, attrs, kids) { var el = d.createElement(tag); setAttrs(el, attrs); append(el, kids); return el; }
  function svg(tag, attrs, kids) { var el = d.createElementNS(SVGNS, tag); setAttrs(el, attrs); append(el, kids); return el; }

  function track(name) {
    if (!name || tracked[name]) return;
    tracked[name] = 1;
    try { if (typeof w._iaTrack === 'function') w._iaTrack('tool_interact', name); } catch (e) { /* tracking nunca quebra o widget */ }
  }

  // --- Laço ÚNICO de animação: um requestAnimationFrame para todos os widgets ---
  var raf = w.requestAnimationFrame ? function (f) { return w.requestAnimationFrame(f); } : function (f) { return w.setTimeout(function () { f(new Date().getTime()); }, 16); };
  var rafOn = false;
  var last = 0;
  var reads = [];
  var writes = [];
  function runAll(list, what) {
    for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { warn(what, e); } }
  }
  function tick(t) {
    var any = false;
    var dt = last ? Math.max(0, Math.min(t - last, 100)) : 16;
    last = t;
    var r = reads; reads = [];
    runAll(r, 'erro em measure()');
    if (!reduced) {
      for (var i = 0; i < instances.length; i++) {
        var inst = instances[i];
        if (!inst.running || !inst.loops.length) continue;
        any = true;
        for (var j = 0; j < inst.loops.length; j++) {
          var L = inst.loops[j];
          L.acc += dt;
          // Tolerância de 4 ms: a 60 Hz, 30 fps = um quadro sim, outro não (33,3 ms).
          if (!L.fresh && L.acc < L.every - 4) continue;
          var step = L.fresh ? dt : L.acc;
          L.fresh = false;
          L.acc = 0;
          try { L.fn(step, t); } catch (e) { warn(inst.id + ': erro no loop', e); inst.loops.splice(j, 1); j--; }
        }
      }
    }
    var wq = writes; writes = [];
    runAll(wq, 'erro em mutate()');
    if (any || reads.length || writes.length) raf(tick); else { rafOn = false; last = 0; }
  }
  function kick() { if (!rafOn) { rafOn = true; last = 0; raf(tick); } }

  // --- Ciclo de vida ---
  function find(el) {
    for (var i = 0; i < instances.length; i++) if (instances[i].el === el) return instances[i];
    return null;
  }
  function contains(root, el) {
    if (!root || root === d) return true;
    if (root.contains) return root.contains(el);
    for (var p = el; p; p = p.parentNode) if (p === root) return true;
    return false;
  }
  function pausedByRoot(el) {
    for (var i = 0; i < pausedRoots.length; i++) if (contains(pausedRoots[i], el)) return true;
    return false;
  }
  function update(inst) {
    var want = !!(inst.api && inst.visible && !d.hidden && !inst.paused);
    if (want === inst.running) return;
    inst.running = want;
    inst.el.setAttribute('data-ia-run', want ? '1' : '0');
    if (want) for (var i = 0; i < inst.loops.length; i++) { inst.loops[i].fresh = true; inst.loops[i].acc = 0; }
    try { if (want) inst.api.start(); else inst.api.stop(); } catch (e) { warn(inst.id + (want ? ': erro em start()' : ': erro em stop()'), e); }
    if (want && inst.loops.length && !reduced) kick();
  }
  function makeCtx(inst) {
    var el = inst.el;
    var cfg = {};
    var js = el.querySelector ? el.querySelector('script[type="application/json"]') : null;
    if (js) { try { cfg = JSON.parse(js.textContent || '{}') || {}; } catch (e) { warn(inst.id + ': config inválida', e); } }
    var span = attr(el, 'data-span');
    var ctx = {
      id: inst.id,
      el: el,
      size: attr(el, 'data-size') === 'page' ? 'page' : 'tile',
      span: span === '2x1' || span === '2x2' ? span : '1x1',
      reduced: reduced,
      config: cfg,
      src: function (url) { return attr(el, 'data-src') || url; },
      fetchJSON: fetchJSON,
      fmt: fmt,
      h: h,
      svg: svg,
      seal: function (text) { return h('span', { 'class': 'iaw-seal' }, text || 'Exemplo ilustrativo'); },
      uid: function (p) { uidN += 1; return (p || 'iaw') + '-' + uidN; },
      track: function (name) { track(name || inst.id); },
      loop: function (fn, opts) {
        var fps = opts && isNum(opts.fps) ? Math.max(1, Math.min(60, opts.fps)) : 30;
        var L = { fn: fn, every: 1000 / fps, acc: 0, fresh: true };
        inst.loops.push(L);
        if (inst.running && !reduced) kick();
        return function () { var i = indexOf(inst.loops, L); if (i >= 0) inst.loops.splice(i, 1); };
      },
      measure: function (fn) { reads.push(fn); kick(); },
      mutate: function (fn) { writes.push(fn); kick(); },
      running: function () { return inst.running; },
      paused: function () { return inst.paused; }
    };
    // ctx.reduced acompanha a preferência do sistema mesmo se ela mudar com a página aberta.
    try { Object.defineProperty(ctx, 'reduced', { get: function () { return reduced; }, enumerable: true }); } catch (e) { /* ES3: fica o valor inicial */ }
    return ctx;
  }

  var io = null;
  if ('IntersectionObserver' in w) {
    // Liga quando qualquer parte do quadro entra na tela e desliga quando sai inteiro: nada anima
    // fora da tela.
    io = new w.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var inst = find(entries[i].target);
        if (!inst) continue;
        inst.visible = !!entries[i].isIntersecting;
        update(inst);
      }
    }, { threshold: 0 });
  }

  function insideLink(el) {
    for (var p = el.parentNode; p && p !== d; p = p.parentNode) if (p.tagName && String(p.tagName).toUpperCase() === 'A') return true;
    return false;
  }

  function create(el) {
    var id = el.getAttribute('data-ia-widget');
    var f = factories[id];
    if (!f) return;
    if (insideLink(el)) {
      el.setAttribute('data-ia-state', 'erro');
      warn(id + ': widget dentro de <a> não monta (ponha o link fora do quadro)');
      return;
    }
    var inst = { el: el, id: id, api: null, visible: false, running: false, paused: pausedByRoot(el), loops: [] };
    var before = el.innerHTML;
    try {
      var api = f(el, makeCtx(inst));
      if (!api || typeof api.start !== 'function' || typeof api.stop !== 'function') throw new Error('a factory precisa devolver { start, stop }');
      inst.api = api;
    } catch (e) {
      el.innerHTML = before;
      el.setAttribute('data-ia-state', 'erro');
      warn(id + ': não montou', e);
      return;
    }
    el.setAttribute('data-ia-state', 'ok');
    el.setAttribute('data-ia-run', '0');
    if (inst.paused) el.setAttribute('data-ia-paused', 'true');
    instances.push(inst);
    if (io) io.observe(el); else { inst.visible = true; update(inst); }
  }

  function mountOne(el) {
    var tool = attr(el, 'data-ia-tool');
    if (!tool) { create(el); return; }
    // Quadro da landing ligado à página da ferramenta: só monta se ela estiver publicada.
    el.setAttribute('data-ia-state', 'aguardando');
    published().then(function (p) {
      var ok = !!(p && p.ids && indexOf(p.ids, tool) >= 0);
      if (!ok) { el.setAttribute('data-ia-state', 'indisponivel'); return; }
      el.removeAttribute('data-ia-state');
      create(el);
    }, function (e) {
      el.setAttribute('data-ia-state', 'indisponivel');
      warn('publicadas.json indisponível: ' + tool + ' fica com o conteúdo do servidor', e);
    });
  }

  // --- CSS sem bloquear a página ---
  var cssState = '';   // '' (não conferido) | 'ok' | 'erro'
  var cssWait = null;
  function findCssLink() {
    var links = d.getElementsByTagName ? d.getElementsByTagName('link') : [];
    for (var i = 0; i < links.length; i++) if (attr(links[i], 'href').indexOf(CSS_FILE) >= 0) return links[i];
    return null;
  }
  function whenCss(cb) {
    if (cssState) { cb(cssState === 'ok'); return; }
    if (cssWait) { cssWait.push(cb); return; }
    cssWait = [cb];
    var done = function (ok) {
      if (cssState) return;
      cssState = ok ? 'ok' : 'erro';   // falha é definitiva: widget sem CSS é pior que o conteúdo do servidor
      var q = cssWait; cssWait = null;
      if (!ok) warn('o CSS dos widgets não carregou: fica o conteúdo do servidor');
      for (var i = 0; i < q.length; i++) q[i](!!ok);
    };
    var link = findCssLink();
    if (link && link.media === 'print') {
      // <link media="print" onload="this.media='all'">: espera carregar (ou já carregou).
      var swap = function () { if (link.media === 'print') link.media = 'all'; done(true); };
      if (link.sheet) swap();
      else { link.addEventListener('load', swap); link.addEventListener('error', function () { done(false); }); }
    } else if (link || !own || !d.head) {
      // <link> comum no <head> (já aplicado antes do defer) ou runtime fora do arquivo do bundle.
      done(true);
    } else {
      var css = d.createElement('link');
      css.rel = 'stylesheet';
      css.setAttribute('href', base + CSS_FILE + (CSS_VERSION ? '?v=' + CSS_VERSION : ''));
      css.setAttribute('data-iaferr', 'css');
      css.onload = function () { done(true); };
      css.onerror = function () { done(false); };
      d.head.appendChild(css);
    }
  }

  function mount(root) {
    if (d.readyState === 'loading') return;   // o DOMContentLoaded chama de novo
    wireButtons(root);
    var els = (root || d).querySelectorAll('[data-ia-widget]');
    var pending = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-ia-state')) continue;   // já montado, aguardando ou falhou
      if (!factories[el.getAttribute('data-ia-widget')]) continue;   // sem registro: fica o conteúdo do servidor
      pending.push(el);
    }
    if (!pending.length) return;
    whenCss(function (ok) {
      if (!ok) return;
      for (var j = 0; j < pending.length; j++) if (!pending[j].getAttribute('data-ia-state')) mountOne(pending[j]);
    });
  }

  function destroy(el) {
    var inst = find(el);
    if (!inst) return;
    try { if (inst.running) inst.api.stop(); if (inst.api.destroy) inst.api.destroy(); } catch (e) { warn(inst.id + ': erro em destroy()', e); }
    if (io) io.unobserve(el);
    instances.splice(indexOf(instances, inst), 1);
    el.removeAttribute('data-ia-state');
    el.removeAttribute('data-ia-run');
    el.removeAttribute('data-ia-paused');
  }

  // --- Pausar / retomar (WCAG 2.2.2) ---
  function rootIndex(root) { return indexOf(pausedRoots, root || d); }
  function paused(root) {
    if (rootIndex(root) >= 0) return true;
    for (var i = 0; i < pausedRoots.length; i++) if (pausedRoots[i] === d) return true;
    return false;
  }
  function setPaused(root, on) {
    var r = root || d;
    if (on) { if (rootIndex(r) < 0) pausedRoots.push(r); }
    else {
      for (var k = pausedRoots.length - 1; k >= 0; k--) if (contains(r, pausedRoots[k])) pausedRoots.splice(k, 1);
    }
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!contains(r, inst.el)) continue;
      inst.paused = on ? true : pausedByRoot(inst.el);
      if (inst.paused) inst.el.setAttribute('data-ia-paused', 'true'); else inst.el.removeAttribute('data-ia-paused');
      update(inst);
    }
    syncButtons();
    emit(r, on ? 'iaferr:pause' : 'iaferr:resume', { paused: on, root: r });
  }
  function pauseAll(root) { setPaused(root, true); }
  function resumeAll(root) { setPaused(root, false); }

  var buttons = [];
  function buttonRoot(btn) {
    var sel = attr(btn, 'data-ia-pause');
    var r = null;
    if (sel) { try { r = d.querySelector(sel); } catch (e) { warn('data-ia-pause com seletor inválido: ' + sel, e); } }
    return r || d;
  }
  function syncButtons() {
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var on = paused(buttonRoot(b));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var label = on ? (attr(b, 'data-label-resume') || 'Retomar animações') : (attr(b, 'data-label-pause') || 'Pausar animações');
      var target = b.querySelector ? b.querySelector('[data-ia-pause-label]') : null;
      (target || b).textContent = label;
    }
  }
  function wireButtons(root) {
    var list = (root || d).querySelectorAll ? (root || d).querySelectorAll('[data-ia-pause]') : [];
    var added = false;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (indexOf(buttons, b) >= 0) continue;
      buttons.push(b);
      added = true;
      b.addEventListener('click', function (ev) {
        var r = buttonRoot(ev.currentTarget || this);
        if (paused(r)) resumeAll(r); else pauseAll(r);
      });
    }
    if (added) syncButtons();
  }

  // --- Subida ---
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var run = function () { scheduled = false; mount(); };
    if (w.Promise) w.Promise.resolve().then(run); else w.setTimeout(run, 0);
  }

  function register(id, factory) {
    if (typeof factory !== 'function') { warn('register("' + id + '"): factory inválida'); return; }
    factories[id] = factory;
    schedule();
  }

  d.addEventListener('visibilitychange', function () {
    for (var i = 0; i < instances.length; i++) update(instances[i]);
  });
  // Com defer o documento já está lido: agenda a montagem (liga também os botões de pausa).
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { mount(); }); else schedule();
  if (mq) {
    var onMq = function (e) { reduced = !!e.matches; if (!reduced) for (var i = 0; i < instances.length; i++) if (instances[i].running && instances[i].loops.length) kick(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  w.IAFerr = {
    version: '2',
    register: register,
    mount: mount,
    destroy: destroy,
    fmt: fmt,
    fetchJSON: fetchJSON,
    published: published,
    h: h,
    svg: svg,
    reduced: function () { return reduced; },
    pauseAll: pauseAll,
    resumeAll: resumeAll,
    paused: paused
  };
  emit(d, 'iaferr:ready', { version: '2' });
})(window, document);
