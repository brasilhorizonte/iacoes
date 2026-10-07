/* IAções: runtime dos widgets das ferramentas (SPEC §4).
   ES5 puro, sem import/export. Vai primeiro no bundle /assets/js/ferramentas.js (montado por
   scripts/ferramentas/bundle.ts), carregado com defer nas páginas /ferramentas/ e na landing.

   Contrato com cada widget (widgets/<id>.js):

     IAFerr.register('<id>', function (el, ctx) {
       // construa fora do DOM e troque o conteúdo de `el` no fim (se a factory lançar erro, o
       // runtime devolve o conteúdo do servidor)
       return { start: function () {}, stop: function () {}, destroy: function () {} };
     });

   Marcação (servidor ou landing):
     <div data-ia-widget="<id>" data-size="tile|page" [data-src="/url.json"]>conteúdo sem JS</div>
     Opcional: <script type="application/json">{...}</script> dentro do elemento vira ctx.config.

   O runtime liga (start) quando o elemento entra na tela e a aba está visível, e desliga (stop)
   quando sai ou a aba some. Com prefers-reduced-motion, ctx.reduced = true e o widget desenha
   direto o quadro final, sem animação.

   ctx: id, el, size ('tile' na landing, 'page' na página da ferramenta), reduced, config,
        src(urlPadrao) -> data-src ou a URL padrão, fetchJSON(url) com cache, fmt (pt-BR: num,
        brl, pct, mult, big, date), track(nome) -> _iaTrack('tool_interact', nome) uma vez por
        página, h(tag, attrs, filhos) e svg(tag, attrs, filhos) para montar DOM, seal(texto) ->
        selo "Exemplo ilustrativo", loop(fn(dt, t)) -> rAF que só roda com o widget ligado
        (devolve a função que cancela), uid(prefixo) e running().

   Regras para quem escreve widget: texto vindo de JSON (resumos da CVM, nomes) entra sempre por
   textContent/h(), nunca por innerHTML; número só de dado real do build e com a data; sem dado
   real, selo "Exemplo ilustrativo" (ctx.seal()) e rótulos "Ação A", "Ação B"... — nunca ticker
   real em posição inventada; classes prefixadas .iaw-<id>-*. */
(function (w, d) {
  'use strict';
  if (w.IAFerr && w.IAFerr.register) return;

  var factories = {};
  var instances = [];
  var cache = {};
  var tracked = {};
  var mq = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uidN = 0;

  function warn(msg, e) {
    try { if (w.console && w.console.warn) w.console.warn('[ferramentas] ' + msg, e || ''); } catch (_) { /* nada */ }
  }

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
  function fetchJSON(url) {
    if (!w.fetch) {
      var err = new Error('fetch indisponível');
      if (w.Promise) return w.Promise.reject(err);
      return { then: function (ok, fail) { if (fail) fail(err); return this; }, 'catch': function (fail) { fail(err); return this; } };
    }
    if (!cache[url]) {
      cache[url] = w.fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + url);
        return r.json();
      });
      cache[url].then(null, function () { delete cache[url]; });
    }
    return cache[url];
  }

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

  // --- Laço de animação compartilhado (só para widgets ligados) ---
  var raf = w.requestAnimationFrame ? function (f) { return w.requestAnimationFrame(f); } : function (f) { return w.setTimeout(function () { f(new Date().getTime()); }, 16); };
  var rafOn = false;
  var last = 0;
  function tick(t) {
    var any = false;
    var dt = last ? Math.min(t - last, 64) : 16;
    last = t;
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!inst.running || !inst.loops.length) continue;
      any = true;
      for (var j = 0; j < inst.loops.length; j++) {
        try { inst.loops[j](dt, t); } catch (e) { warn(inst.id + ': erro no loop', e); inst.loops.splice(j, 1); j--; }
      }
    }
    if (any) raf(tick); else { rafOn = false; last = 0; }
  }
  function kick() { if (!rafOn) { rafOn = true; last = 0; raf(tick); } }

  // --- Ciclo de vida ---
  function find(el) {
    for (var i = 0; i < instances.length; i++) if (instances[i].el === el) return instances[i];
    return null;
  }
  function update(inst) {
    var want = !!(inst.api && inst.visible && !d.hidden);
    if (want === inst.running) return;
    inst.running = want;
    try { if (want) inst.api.start(); else inst.api.stop(); } catch (e) { warn(inst.id + (want ? ': erro em start()' : ': erro em stop()'), e); }
    if (want && inst.loops.length) kick();
  }
  function makeCtx(inst) {
    var el = inst.el;
    var cfg = {};
    var js = el.querySelector ? el.querySelector('script[type="application/json"]') : null;
    if (js) { try { cfg = JSON.parse(js.textContent || '{}') || {}; } catch (e) { warn(inst.id + ': config inválida', e); } }
    return {
      id: inst.id,
      el: el,
      size: el.getAttribute('data-size') === 'page' ? 'page' : 'tile',
      reduced: reduced,
      config: cfg,
      src: function (url) { return el.getAttribute('data-src') || url; },
      fetchJSON: fetchJSON,
      fmt: fmt,
      h: h,
      svg: svg,
      seal: function (text) { return h('span', { 'class': 'iaw-seal' }, text || 'Exemplo ilustrativo'); },
      uid: function (p) { uidN += 1; return (p || 'iaw') + '-' + uidN; },
      track: function (name) { track(name || inst.id); },
      loop: function (fn) {
        inst.loops.push(fn);
        if (inst.running) kick();
        return function () { var i = inst.loops.indexOf(fn); if (i >= 0) inst.loops.splice(i, 1); };
      },
      running: function () { return inst.running; }
    };
  }

  var io = null;
  if ('IntersectionObserver' in w) {
    io = new w.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var inst = find(entries[i].target);
        if (!inst) continue;
        inst.visible = entries[i].isIntersecting;
        update(inst);
      }
    }, { threshold: 0.15 });
  }

  function mount(root) {
    var els = (root || d).querySelectorAll('[data-ia-widget]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-ia-state')) continue;   // já montado (ou falhou)
      var id = el.getAttribute('data-ia-widget');
      var f = factories[id];
      if (!f) continue;   // widget não registrado: fica o conteúdo do servidor
      var inst = { el: el, id: id, api: null, visible: false, running: false, loops: [] };
      var before = el.innerHTML;
      try {
        var api = f(el, makeCtx(inst));
        if (!api || typeof api.start !== 'function' || typeof api.stop !== 'function') throw new Error('a factory precisa devolver { start, stop }');
        inst.api = api;
      } catch (e) {
        el.innerHTML = before;
        el.setAttribute('data-ia-state', 'erro');
        warn(id + ': não montou', e);
        continue;
      }
      el.setAttribute('data-ia-state', 'ok');
      instances.push(inst);
      if (io) io.observe(el); else { inst.visible = true; update(inst); }
    }
  }

  function destroy(el) {
    var inst = find(el);
    if (!inst) return;
    try { if (inst.running) inst.api.stop(); if (inst.api.destroy) inst.api.destroy(); } catch (e) { warn(inst.id + ': erro em destroy()', e); }
    if (io) io.unobserve(el);
    instances.splice(instances.indexOf(inst), 1);
    el.removeAttribute('data-ia-state');
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var run = function () { scheduled = false; if (d.readyState !== 'loading') mount(); };
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
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { mount(); });
  if (mq) {
    var onMq = function (e) { reduced = !!e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  w.IAFerr = {
    version: '1',
    register: register,
    mount: mount,
    destroy: destroy,
    fmt: fmt,
    fetchJSON: fetchJSON,
    h: h,
    svg: svg,
    reduced: function () { return reduced; }
  };
})(window, document);
