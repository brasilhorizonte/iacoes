/* IAções: widgets das ferramentas. Gerado por scripts/ferramentas/bundle.ts a cada build (não edite: fontes em scripts/ferramentas/widgets/). */
(function (w, d) {
'use strict';
if (w.IAFerr && w.IAFerr.register)
return;
var CSS_VERSION = 'e5bfa0e75f';
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
try {
if (w.console && w.console.warn)
w.console.warn('[ferramentas] ' + msg, e || '');
}
catch (_) { }
}
function indexOf(list, x) {
for (var i = 0; i < list.length; i++)
if (list[i] === x)
return i;
return -1;
}
function emit(target, name, detail) {
var ev = null;
try {
ev = new w.CustomEvent(name, { bubbles: true, detail: detail });
}
catch (e) {
try {
ev = d.createEvent('CustomEvent');
ev.initCustomEvent(name, true, false, detail);
}
catch (e2) {
ev = null;
}
}
try {
if (ev && target && target.dispatchEvent)
target.dispatchEvent(ev);
}
catch (e3) {
warn('evento ' + name, e3);
}
}
function attr(el, k) { return (el && el.getAttribute && el.getAttribute(k)) || ''; }
function srcOf(s) { return (s && (s.src || attr(s, 'src'))) || ''; }
function ownScript() {
var s = d.currentScript;
if (s && srcOf(s).indexOf(JS_FILE) >= 0)
return s;
var all = d.getElementsByTagName ? d.getElementsByTagName('script') : [];
for (var i = 0; i < all.length; i++)
if (srcOf(all[i]).indexOf(JS_FILE) >= 0)
return all[i];
return null;
}
var own = ownScript();
var base = own ? srcOf(own).slice(0, srcOf(own).indexOf(JS_FILE)) : '';
function isNum(n) { return typeof n === 'number' && isFinite(n); }
function num(n, dec) {
if (!isNum(n))
return '—';
dec = dec == null ? 2 : dec;
return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function brl(n, dec) { return isNum(n) ? 'R$ ' + num(n, dec == null ? 2 : dec) : '—'; }
function pct(frac, dec) { return isNum(frac) ? num(frac * 100, dec == null ? 1 : dec) + '%' : '—'; }
function mult(n, dec) { return isNum(n) && n !== 0 ? num(n, dec == null ? 1 : dec) + 'x' : '—'; }
function big(n) {
if (!isNum(n) || n === 0)
return '—';
var a = Math.abs(n), v = n, s = '';
if (a >= 1e12) {
v = n / 1e12;
s = ' tri';
}
else if (a >= 1e9) {
v = n / 1e9;
s = ' bi';
}
else if (a >= 1e6) {
v = n / 1e6;
s = ' mi';
}
return 'R$ ' + num(v, Math.abs(v) >= 100 ? 0 : 1) + s;
}
function date(iso) {
var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || '');
}
var fmt = { num: num, brl: brl, pct: pct, mult: mult, big: big, date: date };
function rejected(err) {
if (w.Promise)
return w.Promise.reject(err);
return { then: function (ok, fail) { if (fail)
fail(err); return this; }, 'catch': function (fail) { fail(err); return this; } };
}
function fetchJSON(url) {
if (!w.fetch)
return rejected(new Error('fetch indisponível'));
if (!cache[url]) {
cache[url] = w.fetch(url, { credentials: 'same-origin' }).then(function (r) {
if (!r.ok)
throw new Error('HTTP ' + r.status + ' em ' + url);
return r.json();
});
cache[url].then(null, function () { delete cache[url]; });
}
return cache[url];
}
function published() { return fetchJSON(base + PUBLISHED_FILE); }
function setAttrs(el, attrs) {
if (!attrs)
return;
for (var k in attrs) {
if (!Object.prototype.hasOwnProperty.call(attrs, k))
continue;
var v = attrs[k];
if (v == null || v === false)
continue;
if (k === 'text')
el.textContent = String(v);
else if (k === 'style' && typeof v === 'object') {
for (var s in v)
if (Object.prototype.hasOwnProperty.call(v, s))
el.style[s] = v[s];
}
else if (k.slice(0, 2) === 'on' && typeof v === 'function')
el.addEventListener(k.slice(2), v);
else
el.setAttribute(k, v === true ? '' : String(v));
}
}
function append(el, kids) {
if (kids == null || kids === false)
return;
if (Object.prototype.toString.call(kids) === '[object Array]') {
for (var i = 0; i < kids.length; i++)
append(el, kids[i]);
return;
}
el.appendChild(typeof kids === 'object' ? kids : d.createTextNode(String(kids)));
}
function h(tag, attrs, kids) { var el = d.createElement(tag); setAttrs(el, attrs); append(el, kids); return el; }
function svg(tag, attrs, kids) { var el = d.createElementNS(SVGNS, tag); setAttrs(el, attrs); append(el, kids); return el; }
function track(name) {
if (!name || tracked[name])
return;
tracked[name] = 1;
try {
if (typeof w._iaTrack === 'function')
w._iaTrack('tool_interact', name);
}
catch (e) { }
}
var raf = w.requestAnimationFrame ? function (f) { return w.requestAnimationFrame(f); } : function (f) { return w.setTimeout(function () { f(new Date().getTime()); }, 16); };
var rafOn = false;
var last = 0;
var reads = [];
var writes = [];
function runAll(list, what) {
for (var i = 0; i < list.length; i++) {
try {
list[i]();
}
catch (e) {
warn(what, e);
}
}
}
function tick(t) {
var any = false;
var dt = last ? Math.max(0, Math.min(t - last, 100)) : 16;
last = t;
var r = reads;
reads = [];
runAll(r, 'erro em measure()');
if (!reduced) {
for (var i = 0; i < instances.length; i++) {
var inst = instances[i];
if (!inst.running || !inst.loops.length)
continue;
any = true;
for (var j = 0; j < inst.loops.length; j++) {
var L = inst.loops[j];
L.acc += dt;
if (!L.fresh && L.acc < L.every - 4)
continue;
var step = L.fresh ? dt : L.acc;
L.fresh = false;
L.acc = 0;
try {
L.fn(step, t);
}
catch (e) {
warn(inst.id + ': erro no loop', e);
inst.loops.splice(j, 1);
j--;
}
}
}
}
var wq = writes;
writes = [];
runAll(wq, 'erro em mutate()');
if (any || reads.length || writes.length)
raf(tick);
else {
rafOn = false;
last = 0;
}
}
function kick() { if (!rafOn) {
rafOn = true;
last = 0;
raf(tick);
} }
function find(el) {
for (var i = 0; i < instances.length; i++)
if (instances[i].el === el)
return instances[i];
return null;
}
function contains(root, el) {
if (!root || root === d)
return true;
if (root.contains)
return root.contains(el);
for (var p = el; p; p = p.parentNode)
if (p === root)
return true;
return false;
}
function pausedByRoot(el) {
for (var i = 0; i < pausedRoots.length; i++)
if (contains(pausedRoots[i], el))
return true;
return false;
}
function update(inst) {
var want = !!(inst.api && inst.visible && !d.hidden && !inst.paused);
if (want === inst.running)
return;
inst.running = want;
inst.el.setAttribute('data-ia-run', want ? '1' : '0');
if (want)
for (var i = 0; i < inst.loops.length; i++) {
inst.loops[i].fresh = true;
inst.loops[i].acc = 0;
}
try {
if (want)
inst.api.start();
else
inst.api.stop();
}
catch (e) {
warn(inst.id + (want ? ': erro em start()' : ': erro em stop()'), e);
}
if (want && inst.loops.length && !reduced)
kick();
}
function makeCtx(inst) {
var el = inst.el;
var cfg = {};
var js = el.querySelector ? el.querySelector('script[type="application/json"]') : null;
if (js) {
try {
cfg = JSON.parse(js.textContent || '{}') || {};
}
catch (e) {
warn(inst.id + ': config inválida', e);
}
}
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
if (inst.running && !reduced)
kick();
return function () { var i = indexOf(inst.loops, L); if (i >= 0)
inst.loops.splice(i, 1); };
},
measure: function (fn) { reads.push(fn); kick(); },
mutate: function (fn) { writes.push(fn); kick(); },
running: function () { return inst.running; },
paused: function () { return inst.paused; }
};
try {
Object.defineProperty(ctx, 'reduced', { get: function () { return reduced; }, enumerable: true });
}
catch (e) { }
return ctx;
}
var io = null;
if ('IntersectionObserver' in w) {
io = new w.IntersectionObserver(function (entries) {
for (var i = 0; i < entries.length; i++) {
var inst = find(entries[i].target);
if (!inst)
continue;
inst.visible = !!entries[i].isIntersecting;
update(inst);
}
}, { threshold: 0 });
}
function insideLink(el) {
for (var p = el.parentNode; p && p !== d; p = p.parentNode)
if (p.tagName && String(p.tagName).toUpperCase() === 'A')
return true;
return false;
}
function create(el) {
var id = el.getAttribute('data-ia-widget');
var f = factories[id];
if (!f)
return;
if (insideLink(el)) {
el.setAttribute('data-ia-state', 'erro');
warn(id + ': widget dentro de <a> não monta (ponha o link fora do quadro)');
return;
}
var inst = { el: el, id: id, api: null, visible: false, running: false, paused: pausedByRoot(el), loops: [] };
var before = el.innerHTML;
try {
var api = f(el, makeCtx(inst));
if (!api || typeof api.start !== 'function' || typeof api.stop !== 'function')
throw new Error('a factory precisa devolver { start, stop }');
inst.api = api;
}
catch (e) {
el.innerHTML = before;
el.setAttribute('data-ia-state', 'erro');
warn(id + ': não montou', e);
return;
}
el.setAttribute('data-ia-state', 'ok');
el.setAttribute('data-ia-run', '0');
if (inst.paused)
el.setAttribute('data-ia-paused', 'true');
instances.push(inst);
if (io)
io.observe(el);
else {
inst.visible = true;
update(inst);
}
}
function mountOne(el) {
var tool = attr(el, 'data-ia-tool');
if (!tool) {
create(el);
return;
}
el.setAttribute('data-ia-state', 'aguardando');
published().then(function (p) {
var ok = !!(p && p.ids && indexOf(p.ids, tool) >= 0);
if (!ok) {
el.setAttribute('data-ia-state', 'indisponivel');
return;
}
el.removeAttribute('data-ia-state');
create(el);
}, function (e) {
el.setAttribute('data-ia-state', 'indisponivel');
warn('publicadas.json indisponível: ' + tool + ' fica com o conteúdo do servidor', e);
});
}
var cssState = '';
var cssWait = null;
function findCssLink() {
var links = d.getElementsByTagName ? d.getElementsByTagName('link') : [];
for (var i = 0; i < links.length; i++)
if (attr(links[i], 'href').indexOf(CSS_FILE) >= 0)
return links[i];
return null;
}
function whenCss(cb) {
if (cssState) {
cb(cssState === 'ok');
return;
}
if (cssWait) {
cssWait.push(cb);
return;
}
cssWait = [cb];
var done = function (ok) {
if (cssState)
return;
cssState = ok ? 'ok' : 'erro';
var q = cssWait;
cssWait = null;
if (!ok)
warn('o CSS dos widgets não carregou: fica o conteúdo do servidor');
for (var i = 0; i < q.length; i++)
q[i](!!ok);
};
var link = findCssLink();
if (link && link.media === 'print') {
var swap = function () { if (link.media === 'print')
link.media = 'all'; done(true); };
if (link.sheet)
swap();
else {
link.addEventListener('load', swap);
link.addEventListener('error', function () { done(false); });
}
}
else if (link || !own || !d.head) {
done(true);
}
else {
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
if (d.readyState === 'loading')
return;
wireButtons(root);
var els = (root || d).querySelectorAll('[data-ia-widget]');
var pending = [];
for (var i = 0; i < els.length; i++) {
var el = els[i];
if (el.getAttribute('data-ia-state'))
continue;
if (!factories[el.getAttribute('data-ia-widget')])
continue;
pending.push(el);
}
if (!pending.length)
return;
whenCss(function (ok) {
if (!ok)
return;
for (var j = 0; j < pending.length; j++)
if (!pending[j].getAttribute('data-ia-state'))
mountOne(pending[j]);
});
}
function destroy(el) {
var inst = find(el);
if (!inst)
return;
try {
if (inst.running)
inst.api.stop();
if (inst.api.destroy)
inst.api.destroy();
}
catch (e) {
warn(inst.id + ': erro em destroy()', e);
}
if (io)
io.unobserve(el);
instances.splice(indexOf(instances, inst), 1);
el.removeAttribute('data-ia-state');
el.removeAttribute('data-ia-run');
el.removeAttribute('data-ia-paused');
}
function rootIndex(root) { return indexOf(pausedRoots, root || d); }
function paused(root) {
if (rootIndex(root) >= 0)
return true;
for (var i = 0; i < pausedRoots.length; i++)
if (pausedRoots[i] === d)
return true;
return false;
}
function setPaused(root, on) {
var r = root || d;
if (on) {
if (rootIndex(r) < 0)
pausedRoots.push(r);
}
else {
for (var k = pausedRoots.length - 1; k >= 0; k--)
if (contains(r, pausedRoots[k]))
pausedRoots.splice(k, 1);
}
for (var i = 0; i < instances.length; i++) {
var inst = instances[i];
if (!contains(r, inst.el))
continue;
inst.paused = on ? true : pausedByRoot(inst.el);
if (inst.paused)
inst.el.setAttribute('data-ia-paused', 'true');
else
inst.el.removeAttribute('data-ia-paused');
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
if (sel) {
try {
r = d.querySelector(sel);
}
catch (e) {
warn('data-ia-pause com seletor inválido: ' + sel, e);
}
}
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
if (indexOf(buttons, b) >= 0)
continue;
buttons.push(b);
added = true;
b.addEventListener('click', function (ev) {
var r = buttonRoot(ev.currentTarget || this);
if (paused(r))
resumeAll(r);
else
pauseAll(r);
});
}
if (added)
syncButtons();
}
var scheduled = false;
function schedule() {
if (scheduled)
return;
scheduled = true;
var run = function () { scheduled = false; mount(); };
if (w.Promise)
w.Promise.resolve().then(run);
else
w.setTimeout(run, 0);
}
function register(id, factory) {
if (typeof factory !== 'function') {
warn('register("' + id + '"): factory inválida');
return;
}
factories[id] = factory;
schedule();
}
d.addEventListener('visibilitychange', function () {
for (var i = 0; i < instances.length; i++)
update(instances[i]);
});
if (d.readyState === 'loading')
d.addEventListener('DOMContentLoaded', function () { mount(); });
else
schedule();
if (mq) {
var onMq = function (e) { reduced = !!e.matches; if (!reduced)
for (var i = 0; i < instances.length; i++)
if (instances[i].running && instances[i].loops.length)
kick(); };
if (mq.addEventListener)
mq.addEventListener('change', onMq);
else if (mq.addListener)
mq.addListener(onMq);
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
;
(function () {
try {
(function () {
var URL_PADRAO = '/ferramentas/backtest-de-carteira/dados.json';
var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
var MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
var COR = { ibov: '#0B6E99', cdi: '#A3802A' };
var DESENHO_MS = 1300;
var CICLO_MS = 5600;
var ESPERA_MS = 10000;
function lista(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
function positivo(n) { return typeof n === 'number' && isFinite(n) && n > 0; }
function partes(ym) { return { a: parseInt(String(ym).slice(0, 4), 10), m: parseInt(String(ym).slice(5, 7), 10) }; }
function mesAno(ym) { var p = partes(ym); return MESES[p.m - 1] + '/' + p.a; }
function mesCurto(ym) { var p = partes(ym); return MESES[p.m - 1] + '/' + String(p.a).slice(2); }
function mesLongo(ym) { var p = partes(ym); return MESES_LONGOS[p.m - 1] + ' de ' + p.a; }
function anos(n) { return n + (n === 1 ? ' ano' : ' anos'); }
function indice(arr, x) { for (var i = 0; i < arr.length; i++)
if (arr[i] === x)
return i; return -1; }
function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function preparar(d) {
if (!d || !d.ibov || !d.cdi || !lista(d.ibov.series) || !lista(d.cdi.series))
return null;
var a = d.ibov.series;
var b = d.cdi.series;
if (a.length !== b.length || a.length < 13)
return null;
var meses = [];
var ibov = [];
var cdi = [];
for (var i = 0; i < a.length; i++) {
if (!lista(a[i]) || !lista(b[i]) || a[i][0] !== b[i][0] || !/^\d{4}-\d{2}$/.test(String(a[i][0])))
return null;
if (!positivo(a[i][1]) || !positivo(b[i][1]))
return null;
meses.push(String(a[i][0]));
ibov.push(a[i][1]);
cdi.push(b[i][1]);
}
var maximo = Math.floor((a.length - 1) / 12);
var fonte = lista(d.table) && d.table.length ? d.table : [{ years: 1 }, { years: 5 }, { years: 10 }, { years: 15 }];
var hs = [];
for (var j = 0; j < fonte.length; j++) {
var y = fonte[j] && fonte[j].years;
if (typeof y === 'number' && y >= 1 && y <= maximo && y === Math.floor(y) && indice(hs, y) < 0)
hs.push(y);
}
hs.sort(function (x, z) { return x - z; });
if (!hs.length)
return null;
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
function passo(faixa, alvo) {
var bruto = faixa / Math.max(1, alvo);
if (!(bruto > 0))
return 10;
var mag = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10));
var opcoes = [1, 2, 2.5, 5, 10];
for (var i = 0; i < opcoes.length; i++)
if (opcoes[i] * mag >= bruto)
return opcoes[i] * mag;
return 10 * mag;
}
window.IAFerr.register('backtest', function (el, ctx) {
var h = ctx.h;
var svg = ctx.svg;
var fmt = ctx.fmt;
var pagina = ctx.size === 'page';
var D = null;
var W = null;
var atual = -1;
var rodando = false;
var destruido = false;
var revelarAoLigar = false;
var anim = null;
var prog = 1;
var geo = null;
var cursor = null;
var focado = false;
var auto = !pagina && !ctx.reduced;
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
if (r === 0)
return '0,0%';
return (r > 0 ? '+' : '') + fmt.pct(frac, 1);
}
function limpar(g) { g.textContent = ''; }
function medir() {
var w = (ui.plot && ui.plot.clientWidth) || 0;
var hh = (ui.plot && ui.plot.clientHeight) || 0;
if (w < 60 || hh < 40)
return { w: pagina ? 600 : 280, h: pagina ? 170 : 90, falso: true };
return { w: w, h: hh };
}
function rotuloY(v, st) {
var dec = st % 1 === 0 ? 0 : 1;
if (Math.abs(v) < st / 1000)
return '0%';
return (v > 0 ? '+' : '') + fmt.num(v, dec) + '%';
}
function marcasX(w, pw) {
var n = w.meses.length;
var maximo = Math.max(3, Math.floor(pw / 48));
var out = [];
var i;
var p;
if (w.anos <= 2) {
for (i = 0; i < n; i++) {
p = partes(w.meses[i]);
if (p.m % 3 === 0)
out.push({ k: i, t: mesCurto(w.meses[i]) });
}
}
else {
var opcoes = [1, 2, 3, 5, 10];
var s = 10;
for (var j = 0; j < opcoes.length; j++) {
var c = 0;
for (i = 0; i < n; i++) {
p = partes(w.meses[i]);
if (p.m === 1 && p.a % opcoes[j] === 0)
c++;
}
if (c <= maximo) {
s = opcoes[j];
break;
}
}
for (i = 0; i < n; i++) {
p = partes(w.meses[i]);
if (p.m === 1 && p.a % s === 0)
out.push({ k: i, t: String(p.a) });
}
}
if (out.length > maximo) {
var pulo = Math.ceil(out.length / maximo);
var menos = [];
for (i = 0; i < out.length; i += pulo)
menos.push(out[i]);
out = menos;
}
return out;
}
function caminho(vals, X, Y) {
var d = '';
for (var i = 0; i < vals.length; i++)
d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(vals[i]).toFixed(1);
return d;
}
function desenhar(t) {
if (!W)
return;
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
limpar(ui.grade);
for (var j = Math.ceil(lo / st); j <= Math.floor(hi / st); j++) {
var v = j * st;
var y = Math.round(Y(100 + v)) + 0.5;
ui.grade.appendChild(svg('line', { x1: m.l, x2: (m.l + pw).toFixed(1), y1: y, y2: y, 'class': Math.abs(v) < st / 1000 ? 'iaw-backtest-base' : 'iaw-backtest-grid' }));
ui.grade.appendChild(svg('text', { x: m.l - 6, y: y, dy: '0.32em', 'text-anchor': 'end', 'class': 'iaw-backtest-tick iaw-mono', text: rotuloY(v, st) }));
}
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
function aplicar(p) {
if (!geo || !W)
return;
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
if (cursor === null)
ler(e >= 1 ? null : k0);
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
if (!geo || !W)
return;
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
if (!W)
return;
if (anim)
terminar();
cursor = k;
ler(k);
mostrarCursor();
slider(k);
}
function soltarDesenho() { if (paraDesenho) {
var c = paraDesenho;
paraDesenho = null;
c();
} }
function garantirDesenho() {
if (paraDesenho)
return;
paraDesenho = ctx.loop(function (dt) {
if (!anim) {
soltarDesenho();
return;
}
anim.t = Math.min(1, anim.t + dt / DESENHO_MS);
prog = anim.t;
aplicar(prog);
if (anim.t >= 1) {
anim = null;
mostrarCursor();
soltarDesenho();
}
}, { fps: 60 });
}
function comecar() { anim = { t: 0 }; prog = 0; aplicar(0); mostrarCursor(); garantirDesenho(); }
function terminar() { anim = null; prog = 1; soltarDesenho(); aplicar(1); mostrarCursor(); }
function soltarCiclo() { if (paraCiclo) {
var c = paraCiclo;
paraCiclo = null;
c();
} }
function garantirCiclo() {
if (paraCiclo || !auto || !rodando || ctx.reduced || !D || D.horizontes.length < 2)
return;
paraCiclo = ctx.loop(function (dt) {
if (!auto || anim)
return;
if (espera > 0) {
espera -= dt;
return;
}
acum += dt;
if (acum >= CICLO_MS) {
acum = 0;
escolher((atual + 1) % D.horizontes.length, false);
}
}, { fps: 4 });
}
function interagiu() { ctx.track('backtest'); espera = ESPERA_MS; acum = 0; }
function escolher(i, doUsuario, inicial) {
if (!D || i < 0 || i >= D.horizontes.length)
return;
if (i === atual && W) {
if (doUsuario)
interagiu();
return;
}
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
if (ctx.reduced || ctx.paused())
terminar();
else if (rodando)
comecar();
else {
revelarAoLigar = true;
prog = 0;
aplicar(0);
}
}
else if (rodando && !ctx.reduced)
comecar();
else
terminar();
}
function teclaAba(ev) {
var i = indice(abas, ev.currentTarget || this);
var n = abas.length;
var j = i;
switch (ev.key) {
case 'ArrowRight':
case 'Right':
j = (i + 1) % n;
break;
case 'ArrowLeft':
case 'Left':
j = (i - 1 + n) % n;
break;
case 'Home':
j = 0;
break;
case 'End':
j = n - 1;
break;
default: return;
}
ev.preventDefault();
abas[j].focus();
escolher(j, true);
}
function teclaGrafico(ev) {
if (!W)
return;
var n = W.meses.length;
var k = cursor === null ? n - 1 : cursor;
var novo = k;
switch (ev.key) {
case 'ArrowLeft':
case 'Left':
case 'ArrowDown':
case 'Down':
novo = k - 1;
break;
case 'ArrowRight':
case 'Right':
case 'ArrowUp':
case 'Up':
novo = k + 1;
break;
case 'PageDown':
novo = k - 12;
break;
case 'PageUp':
novo = k + 12;
break;
case 'Home':
novo = 0;
break;
case 'End':
novo = n - 1;
break;
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
if (!W || !geo)
return;
var p = ev.touches && ev.touches.length ? ev.touches[0] : ev;
if (typeof p.clientX !== 'number')
return;
porCursor(xParaMes(p.clientX));
interagiu();
}
function aoSair(ev) {
if (ev && ev.pointerType === 'touch')
return;
if (!focado)
porCursor(null);
}
function icone(pausado) {
return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' }, pausado
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
if (on)
garantirCiclo();
else
soltarCiclo();
}
function montar() {
ui.quando = h('span', { 'class': 'iaw-backtest-when iaw-mono' });
ui.pausa = !pagina && !ctx.reduced
? h('button', { type: 'button', 'class': 'iaw-backtest-pause', 'aria-label': 'Pausar a troca automática de período', 'aria-pressed': 'false' })
: null;
var dataTxt = D.data ? (pagina ? 'dados até ' : 'até ') + fmt.date(D.data) : '';
var topo = h('div', { 'class': 'iaw-backtest-top' }, [
h('span', { 'class': 'iaw-backtest-title' }, D.nomeIbov + ' × ' + D.nomeCdi),
h('span', { 'class': 'iaw-backtest-top-right' }, [pagina ? h('span', { 'class': 'iaw-backtest-date' }, dataTxt) : ui.quando, ui.pausa])
]);
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
var nota = (D.nota ? D.nomeIbov + ': ' + D.nota + '. ' : '') + D.nomeCdi + ': taxa bruta. Sem custos nem impostos.';
if (!pagina && D.data)
nota = 'Dados até ' + fmt.date(D.data) + '. ' + nota;
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
}
else {
ui.hit.addEventListener('mousemove', aoMover);
ui.hit.addEventListener('mouseleave', aoSair);
ui.hit.addEventListener('touchstart', aoMover);
ui.hit.addEventListener('touchmove', aoMover);
}
ui.hit.addEventListener('focus', function () { focado = true; if (cursor === null && W)
porCursor(W.meses.length - 1); });
ui.hit.addEventListener('blur', function () { focado = false; porCursor(null); });
ui.hit.addEventListener('keydown', teclaGrafico);
if (ui.pausa)
ui.pausa.addEventListener('click', function () { definirAuto(!auto); ctx.track('backtest'); });
el.innerHTML = '';
el.appendChild(raiz);
var redimensionar = function () {
if (!W || destruido)
return;
var t = medir();
if (geo && !t.falso && t.w === geo.w && t.h === geo.h)
return;
desenhar(t);
};
try {
if (window.ResizeObserver) {
ro = new window.ResizeObserver(function () { redimensionar(); });
ro.observe(ui.plot);
}
else if (window.addEventListener) {
aoRedimensionar = redimensionar;
window.addEventListener('resize', aoRedimensionar);
}
}
catch (e) { }
aoPausar = function () { if (revelarAoLigar && ctx.paused()) {
revelarAoLigar = false;
terminar();
} };
if (document.addEventListener)
document.addEventListener('iaferr:pause', aoPausar);
aoImprimir = function () { revelarAoLigar = false; if (prog < 1 || anim)
terminar(); };
if (window.addEventListener)
window.addEventListener('beforeprint', aoImprimir);
if (ui.pausa)
definirAuto(auto);
}
ctx.fetchJSON(ctx.src(URL_PADRAO)).then(function (d) {
if (destruido)
return;
var P = preparar(d);
if (!P) {
el.setAttribute('data-iaw-backtest', 'sem-dado');
return;
}
D = P;
montar();
escolher(D.horizontes.length - 1, false, true);
garantirCiclo();
}, function () {
if (!destruido)
el.setAttribute('data-iaw-backtest', 'sem-dado');
});
return {
start: function () {
rodando = true;
if (!D)
return;
if (revelarAoLigar) {
revelarAoLigar = false;
if (ctx.reduced)
terminar();
else
comecar();
}
garantirCiclo();
},
stop: function () {
rodando = false;
revelarAoLigar = false;
if (anim || prog < 1)
terminar();
soltarDesenho();
soltarCiclo();
},
destroy: function () {
destruido = true;
soltarDesenho();
soltarCiclo();
if (ro) {
try {
ro.disconnect();
}
catch (e) { }
ro = null;
}
if (aoRedimensionar && window.removeEventListener)
window.removeEventListener('resize', aoRedimensionar);
if (aoPausar && document.removeEventListener)
document.removeEventListener('iaferr:pause', aoPausar);
if (aoImprimir && window.removeEventListener)
window.removeEventListener('beforeprint', aoImprimir);
el.innerHTML = '';
}
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget backtest não carregou', e);
}
})();
;
(function () {
try {
(function () {
var URL_PADRAO = '/macro/indicador-de-buffett/dados.json';
var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
var DESENHO_MS = 1800;
function lista(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
function num1(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function mesAno(ym) { return MESES[parseInt(ym.slice(5, 7), 10) - 1] + '/' + ym.slice(0, 4); }
function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function preparar(d) {
if (!d || !lista(d.series) || d.series.length < 24 || !(d.value > 0))
return null;
var meses = [], vals = [];
for (var i = 0; i < d.series.length; i++) {
var p = d.series[i];
if (!lista(p) || !/^\d{4}-\d{2}$/.test(String(p[0])) || !(p[1] > 0))
return null;
meses.push(String(p[0]));
vals.push(p[1]);
}
var est = lista(d.estimatedRanges) ? d.estimatedRanges.filter(function (r) { return r && /^\d{4}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}$/.test(r.to); }) : [];
return { meses: meses, vals: vals, est: est, d: d };
}
function estimado(S, ym) {
for (var i = 0; i < S.est.length; i++)
if (ym >= S.est[i].from && ym <= S.est[i].to)
return true;
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
lo = Math.floor((lo - 4) / 10) * 10;
hi = Math.ceil((hi + 4) / 10) * 10;
function x(i) { return padL + (W - padL - padR) * i / (n - 1); }
function y(v) { return padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo)); }
refs.x = x;
refs.y = y;
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
S.est.forEach(function (r) {
var a = S.meses.indexOf(r.from), b = S.meses.indexOf(r.to);
if (a < 0)
a = 0;
if (b < 0)
b = n - 1;
g.appendChild(svg('rect', { 'class': 'iaw-bf-est', x: x(a), y: padT, width: Math.max(1, x(b) - x(a)), height: H - padT - padB }));
});
if (d.p25 > 0 && d.p75 > 0)
g.appendChild(svg('rect', { 'class': 'iaw-bf-iqr', x: padL, y: y(d.p75), width: W - padL - padR, height: Math.max(1, y(d.p25) - y(d.p75)) }));
if (d.mean > 0)
g.appendChild(svg('line', { 'class': 'iaw-bf-mean', x1: padL, x2: W - padR, y1: y(d.mean), y2: y(d.mean) }));
[lo, (lo + hi) / 2, hi].forEach(function (v) {
g.appendChild(svg('text', { 'class': 'iaw-bf-ax', x: padL - 5, y: y(v) + 3, 'text-anchor': 'end' }, String(Math.round(v)) + '%'));
});
for (var yy = parseInt(S.meses[0].slice(0, 4), 10); yy <= parseInt(S.meses[n - 1].slice(0, 4), 10); yy++) {
if (yy % (W < 420 ? 10 : 5) !== 0)
continue;
var ix = S.meses.indexOf(yy + '-01');
if (ix >= 0)
g.appendChild(svg('text', { 'class': 'iaw-bf-ax', x: x(ix), y: H - 4, 'text-anchor': 'middle' }, String(yy)));
}
var dpath = '';
for (var i = 0; i < n; i++)
dpath += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(S.vals[i]).toFixed(1);
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
if (ctx.size === 'page')
root.appendChild(rodape);
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
if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End')
return;
if (ev.preventDefault)
ev.preventDefault();
var i = cur < 0 ? n - 1 : cur;
if (k === 'ArrowLeft')
i = Math.max(0, i - 1);
if (k === 'ArrowRight')
i = Math.min(n - 1, i + 1);
if (k === 'Home')
i = 0;
if (k === 'End')
i = n - 1;
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
function esconder() { cur = -1; if (refs.cursor)
refs.cursor.style.opacity = '0'; if (S)
leituraPadrao(); }
function quadro(t) {
var n = S.vals.length, k = suave(t), i = Math.max(0, Math.min(n - 1, Math.round(k * (n - 1))));
var W = refs.x(n - 1) + 12;
refs.clip.setAttribute('transform', 'scale(' + Math.max(0.0001, (refs.x(i) + 2) / W).toFixed(4) + ',1)');
refs.headG.setAttribute('transform', 'translate(' + refs.x(i).toFixed(1) + ',' + refs.y(S.vals[i]).toFixed(1) + ')');
refs.num.textContent = num1(t >= 1 ? S.d.value : S.vals[i]) + '%';
}
function desenhar() {
if (feito || !S || ctx.reduced) {
if (S)
quadro(1);
feito = true;
return;
}
var t0 = null;
raf = ctx.loop(function (dt) {
t0 = (t0 || 0) + dt;
var t = Math.min(1, t0 / DESENHO_MS);
quadro(t);
if (t >= 1) {
feito = true;
if (raf) {
raf();
raf = null;
}
}
}, { fps: 60 });
}
var pronto = ctx.fetchJSON(ctx.src(URL_PADRAO)).then(function (d) {
S = preparar(d);
if (!S)
throw new Error('série inválida');
montar();
});
pronto.then(null, function () {
root.innerHTML = '';
root.appendChild(h('p', { 'class': 'iaw-bf-msg' }, 'Não deu para carregar a série agora. O número do dia está na página do indicador.'));
});
var ligado = false;
return {
start: function () { ligado = true; pronto.then(function () { if (ligado)
desenhar(); }); },
stop: function () { ligado = false; if (raf) {
raf();
raf = null;
} if (S && refs.clip && !feito)
quadro(1); feito = feito || !!S; },
destroy: function () { if (raf)
raf(); }
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget buffett não carregou', e);
}
})();
;
(function () {
try {
(function () {
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
var WACC = [0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19];
var G = [0.025, 0.03, 0.035, 0.04, 0.045, 0.05, 0.055];
var C = 3;
var TOUR = [[0, 0], [1, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-2, 0], [-1, 0], [0, 0], [0, 1], [0, 2], [0, 1], [0, 0], [0, -1], [0, -2], [0, -1]];
var STEP_MS = 2200;
var HOLD_MS = 6000;
var MINUS = '−';
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
function preco(fcff, wacc, g) {
var somaVp = 0;
for (var t = 1; t <= fcff.length; t++)
somaVp += fcff[t - 1] / Math.pow(1 + wacc, t);
var n = fcff.length;
var vt = (fcff[n - 1] * (1 + g)) / (wacc - g);
var vpVt = vt / Math.pow(1 + wacc, n);
var ev = somaVp + vpVt;
var dividaLiquida = EX.dividaBruta - EX.caixa;
var equity = ev - dividaLiquida;
return equity / EX.acoes;
}
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
for (var j = 0; j < G.length; j++)
grid[i].push(preco(fcff, WACC[i], G[j]));
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
var pause = h('button', { type: 'button', 'class': 'iaw-dcf-pause', 'aria-pressed': 'false' });
function icon(playing) {
return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' }, playing
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
if (ctx.reduced)
pause.setAttribute('hidden', '');
var top = h('div', { 'class': 'iaw-dcf-top' }, [
h('span', { 'class': 'iaw-dcf-title' }, [h('span', { 'class': 'iaw-dcf-title-pre' }, 'Sensibilidade · '), 'WACC × g']),
h('span', { 'class': 'iaw-dcf-top-r' }, [ctx.seal('Exemplo ilustrativo'), pause])
]);
var foot = null;
if (page) {
var legend = h('span', { 'class': 'iaw-dcf-legend', 'aria-hidden': 'true' }, [h('span', null, 'menor')]);
for (var hv = -4; hv <= 4; hv++)
legend.appendChild(h('i', { 'class': 'iaw-dcf-sw', 'data-heat': hv }));
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
function clamp(k) { return k < lo ? lo : k > hi ? hi : k; }
function paint() {
for (var r = 0; r < cells.length; r++) {
rowHeads[r].className = 'iaw-dcf-rh' + (r === sel.r ? ' is-on' : '');
for (var c = 0; c < cells[r].length; c++) {
var on = r === sel.r && c === sel.c;
var cls = 'iaw-dcf-cell' + (outer(r) || outer(c) ? ' iaw-dcf-out' : '') + (r === C && c === C ? ' is-base' : '') +
(r === sel.r || c === sel.c ? ' is-cross' : '') + (on ? ' is-sel' : '');
var td = cells[r][c];
if (td.className !== cls)
td.className = cls;
td.setAttribute('aria-selected', on ? 'true' : 'false');
td.setAttribute('tabindex', on ? '0' : '-1');
}
}
for (var k = 0; k < colHeads.length; k++)
colHeads[k].className = 'iaw-dcf-ch' + (outer(k) ? ' iaw-dcf-out' : '') + (k === sel.c ? ' is-on' : '');
var v = grid[sel.r][sel.c];
var d = v / base - 1;
var isBase = sel.r === C && sel.c === C;
readK.textContent = 'WACC ' + pw(WACC[sel.r]) + ' · g ' + pg(G[sel.c]);
readV.textContent = fmt.brl(v);
readD.textContent = isBase ? 'caso base' : signed(d) + ' vs. caso base';
readD.className = 'iaw-dcf-read-d' + (isBase ? '' : d > 0 ? ' is-up' : ' is-down');
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
if (k === 'ArrowUp' || k === 'Up')
r -= 1;
else if (k === 'ArrowDown' || k === 'Down')
r += 1;
else if (k === 'ArrowLeft' || k === 'Left')
c -= 1;
else if (k === 'ArrowRight' || k === 'Right')
c += 1;
else if (k === 'Home')
c = lo;
else if (k === 'End')
c = hi;
else
return;
if (ev.preventDefault)
ev.preventDefault();
select(r, c, true);
var td = cells[sel.r][sel.c];
if (td.focus)
td.focus();
}
function layout() {
var w = el.clientWidth || 0;
var nextCompact = page ? !w || w < 640 : true;
var nextWide = page ? w >= 540 : (w ? w >= 470 : ctx.span !== '1x1');
if (root.className && nextCompact === compact && nextWide === wide)
return;
compact = nextCompact;
wide = nextWide;
lo = compact ? 1 : 0;
hi = compact ? WACC.length - 2 : WACC.length - 1;
root.className = 'iaw-dcf ' + (page ? 'iaw-dcf--page' : 'iaw-dcf--tile') + (compact ? ' is-compact' : '') + (wide ? ' is-wide' : '');
select(sel.r, sel.c, false);
}
function frame(dt) {
if (!auto || kbd)
return;
if (hold > 0) {
hold -= dt;
return;
}
acc += dt;
if (acc < STEP_MS)
return;
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
}
else if (window.addEventListener) {
onResize = function () { layout(); };
window.addEventListener('resize', onResize);
}
function stop() { if (cancelLoop) {
cancelLoop();
cancelLoop = null;
} }
return {
start: function () {
if (ctx.reduced) {
pause.setAttribute('hidden', '');
return;
}
pause.removeAttribute('hidden');
if (!cancelLoop)
cancelLoop = ctx.loop(frame, { fps: 10 });
},
stop: stop,
destroy: function () {
stop();
if (ro)
ro.disconnect();
if (onResize && window.removeEventListener)
window.removeEventListener('resize', onResize);
el.innerHTML = '';
}
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget dcf não carregou', e);
}
})();
;
(function () {
try {
(function () {
var DEFAULT_URL = '/ferramentas/fatos-relevantes/dados.json';
var TYPES = {
FR: { code: 'FR', label: 'Fato Relevante' },
CM: { code: 'CM', label: 'Comunicado ao Mercado' }
};
var TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var BR_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
var STEP = { page: 4500, tile: 4000 };
var END_HOLD = 6000;
var USER_HOLD = 6000;
var LEAVE_HOLD = 2500;
var ARRIVALS = 5;
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function now() { return new Date().getTime(); }
function clean(v, max) {
var s = String(v == null ? '' : v).replace(/\s+/g, ' ').replace(/^ | $/g, '');
if (max && s.length > max)
s = s.slice(0, max - 1).replace(/[\s,;:.]+$/, '') + '…';
return s;
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function normalize(x) {
if (!x || typeof x !== 'object')
return null;
var type = typeof x.type === 'string' && has(TYPES, x.type) ? x.type : '';
var t = String(x.t || '');
var url = String(x.url || '');
var date = String(x.publishedDate || x.date || '');
var summary = clean(x.summary, 320);
if (!type || !TICKER_RE.test(t) || !DATE_RE.test(date) || summary.length < 20)
return null;
if (url !== '/' + t + '/' && url !== '/airton/' + t + '/')
return null;
var feed = clean(x.feedLabel, 60);
if (feed.indexOf('entrou no feed') !== 0)
feed = /^\d{2}:\d{2}$/.test(String(x.time || '')) ? 'entrou no feed às ' + x.time : '';
return {
type: type,
t: t,
name: clean(x.name, 90),
title: clean(x.title, 200) || TYPES[type].label,
summary: summary,
url: url,
airton: url.charAt(1) === 'a',
date: date,
feed: feed
};
}
window.IAFerr.register('fatos', function (el, ctx) {
var h = ctx.h;
var svg = ctx.svg;
var page = ctx.size === 'page';
var wide = !page && (ctx.span === '2x1' || ctx.span === '2x2');
var step = page ? STEP.page : STEP.tile;
var narrowMq = page && window.matchMedia ? window.matchMedia('(max-width: 639px)') : null;
var readerId = ctx.uid('iaw-fatos-leitor');
var items = [];
var win = [];
var rows = [];
var V = 3;
var next = 0;
var selected = null;
var auto = !ctx.reduced;
var ready = false;
var phase = 'run';
var acc = 0;
var hold = 0;
var pointerIn = false;
var focusIn = false;
var lastTouch = 0;
var cancelLoop = null;
var latestBR = '';
var root = null;
var list = null;
var reader = null;
var pauseBtn = null;
function sizeClass() {
return 'iaw-fatos iaw-fatos--' + (page ? 'page' : 'tile') + (wide ? ' iaw-fatos--wide' : '');
}
function visibleRows() {
if (page)
return narrowMq && narrowMq.matches ? 3 : 5;
return wide ? 5 : 3;
}
function shortDate(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
function pill(type, full) {
var ty = TYPES[type];
return h('span', { 'class': 'iaw-fatos-pill' + (full ? ' iaw-fatos-pill--full' : ''), 'data-type': type }, full ? ty.label : ty.code);
}
function head(withPause) {
return h('div', { 'class': 'iaw-fatos-head' }, [
h('span', { 'class': 'iaw-fatos-prompt', 'aria-hidden': 'true' }, '>_'),
h('span', { 'class': 'iaw-fatos-title' }, 'Feed da CVM'),
page && latestBR ? h('span', { 'class': 'iaw-fatos-latest' }, 'mais recente: ' + latestBR) : null,
withPause && !page ? pauseBtn : null
]);
}
function place(r) {
var tr = 'translateY(' + (r.slot * 100) + '%)';
r.li.style.webkitTransform = tr;
r.li.style.transform = tr;
}
function makeRow(it) {
var ty = TYPES[it.type];
var btn = h('button', {
type: 'button',
'class': 'iaw-fatos-row',
'aria-pressed': 'false',
'aria-controls': readerId,
'aria-label': ty.label + ' de ' + it.t + (it.name ? ', ' + it.name : '') + ', publicado em ' + ctx.fmt.date(it.date)
}, [
pill(it.type, false),
h('span', { 'class': 'iaw-fatos-row-t' }, it.t),
h('span', { 'class': 'iaw-fatos-row-name' }, it.name),
h('span', { 'class': 'iaw-fatos-row-date' }, shortDate(it.date))
]);
var li = h('li', { 'class': 'iaw-fatos-slot' }, btn);
var row = { it: it, li: li, btn: btn, slot: 0 };
btn.addEventListener('click', function () { choose(row, true); });
btn.addEventListener('focus', function () { choose(row, false); });
btn.addEventListener('mouseenter', function () { if (now() - lastTouch > 800)
choose(row, false); });
btn.addEventListener('keydown', function (ev) { onKey(ev, row); });
return row;
}
function addRow(it, slot, atTop) {
var row = makeRow(it);
row.slot = slot;
place(row);
if (ctx.running() && !ctx.reduced)
row.li.className += ' is-new';
if (atTop && list.firstChild)
list.insertBefore(row.li, list.firstChild);
else
list.appendChild(row.li);
if (atTop)
rows.unshift(row);
else
rows.push(row);
return row;
}
function leave(r) {
r.li.className = 'iaw-fatos-slot is-out';
r.li.setAttribute('aria-hidden', 'true');
r.btn.setAttribute('tabindex', '-1');
}
function purge(all) {
for (var i = rows.length - 1; i >= 0; i--) {
if (!all && rows[i].slot < V)
continue;
if (rows[i].li.parentNode)
rows[i].li.parentNode.removeChild(rows[i].li);
rows.splice(i, 1);
}
}
function shown() {
var out = [];
for (var i = 0; i < rows.length; i++)
if (rows[i].slot < V)
out.push(rows[i]);
return out;
}
function makeDoc(it) {
var ty = TYPES[it.type];
var meta = page
? [h('span', { 'class': 'iaw-fatos-doc-date' }, 'Publicado na CVM em ' + ctx.fmt.date(it.date)), it.feed ? h('span', { 'class': 'iaw-fatos-doc-feed' }, cap(it.feed)) : null]
: [ctx.fmt.date(it.date) + (it.feed ? ' · ' + it.feed : '')];
var link = h('a', {
'class': page ? 'iaw-fatos-doc-link' : 'iaw-fatos-doc-titlelink',
href: it.url,
onclick: function () { ctx.track('fatos'); }
}, page ? (it.airton ? 'Documentos de ' + it.t + ' na CVM' : 'Análise de ' + it.t) : it.title);
var kids = [];
if (page) {
kids.push(h('p', { 'class': 'iaw-fatos-doc-top' }, [pill(it.type, true), h('span', { 'class': 'iaw-fatos-doc-t' }, it.t), it.name ? h('span', { 'class': 'iaw-fatos-doc-name' }, it.name) : null]));
kids.push(h('p', { 'class': 'iaw-fatos-doc-title' }, it.title));
}
else {
kids.push(h('p', { 'class': 'iaw-fatos-doc-title' }, [h('span', { 'class': 'iaw-sr' }, ty.label + ' de ' + it.t + ': '), link]));
}
kids.push(h('p', { 'class': 'iaw-fatos-doc-sum' }, [h('span', { 'class': 'iaw-fatos-ai' }, page ? 'Resumo gerado por IA' : 'Resumo por IA'), ' ', it.summary]));
kids.push(h('p', { 'class': 'iaw-fatos-doc-meta' }, meta));
if (page)
kids.push(h('p', { 'class': 'iaw-fatos-doc-go' }, [link, h('span', { 'aria-hidden': 'true' }, ' →')]));
return h('div', { 'class': 'iaw-fatos-doc' + (ctx.running() && !ctx.reduced ? ' is-new' : '') }, kids);
}
function select(it, byUser) {
if (!it)
return;
for (var i = 0; i < rows.length; i++) {
var on = rows[i].it === it;
rows[i].btn.setAttribute('aria-pressed', on ? 'true' : 'false');
rows[i].btn.className = 'iaw-fatos-row' + (on ? ' is-on' : '');
}
reader.setAttribute('aria-live', byUser ? 'polite' : 'off');
if (selected === it)
return;
selected = it;
reader.innerHTML = '';
reader.appendChild(makeDoc(it));
}
function choose(row, tracked) {
if (row.slot >= V)
return;
hold = USER_HOLD;
if (tracked)
ctx.track('fatos');
select(row.it, true);
}
function onKey(ev, row) {
var k = ev.key || ev.keyCode;
var vis = shown();
var i = -1;
for (var j = 0; j < vis.length; j++)
if (vis[j] === row)
i = j;
var to = -1;
if (k === 'ArrowDown' || k === 'Down' || k === 40)
to = i + 1;
else if (k === 'ArrowUp' || k === 'Up' || k === 38)
to = i - 1;
else if (k === 'Home' || k === 36)
to = 0;
else if (k === 'End' || k === 35)
to = vis.length - 1;
else
return;
if (ev.preventDefault)
ev.preventDefault();
if (to < 0 || to >= vis.length || to === i)
return;
ctx.track('fatos');
vis[to].btn.focus();
}
function windowOf() {
var w = items.slice(0, Math.min(items.length, V + ARRIVALS));
w.reverse();
return w;
}
function reset() {
V = visibleRows();
win = windowOf();
purge(true);
selected = null;
var start = ctx.reduced || win.length <= V ? Math.max(0, win.length - V) : 0;
var first = win.slice(start, start + V);
for (var i = first.length - 1, s = 0; i >= 0; i--, s++)
addRow(first[i], s, false);
next = start + first.length;
phase = next < win.length ? 'run' : 'end';
acc = 0;
select(first[first.length - 1], false);
}
function arrive() {
purge(false);
var it = win[next];
next += 1;
for (var i = 0; i < rows.length; i++) {
rows[i].slot += 1;
place(rows[i]);
if (rows[i].slot >= V)
leave(rows[i]);
}
addRow(it, 0, true);
select(it, false);
if (next >= win.length)
phase = 'end';
}
function animates() { return ready && !ctx.reduced && win.length > V; }
function frame(dt) {
if (!auto || pointerIn || focusIn)
return;
if (hold > 0) {
hold -= dt;
return;
}
acc += dt;
if (phase === 'run') {
if (acc >= step) {
acc = 0;
arrive();
}
}
else if (acc >= END_HOLD) {
reset();
}
}
function startLoop() { if (!cancelLoop && animates())
cancelLoop = ctx.loop(frame, { fps: 12 }); }
function stopLoop() { if (cancelLoop) {
cancelLoop();
cancelLoop = null;
} }
function icon(playing) {
return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' }, playing
? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
: [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
}
function setAuto(on) {
auto = on;
if (!pauseBtn)
return;
pauseBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
pauseBtn.setAttribute('aria-label', on ? 'Pausar a chegada dos documentos' : 'Retomar a chegada dos documentos');
if (page)
pauseBtn.textContent = on ? 'Pausar' : 'Retomar';
else {
pauseBtn.textContent = '';
pauseBtn.appendChild(icon(on));
}
}
function status(msg) {
return h('div', { 'class': sizeClass() + ' is-status' }, [head(false), h('p', { 'class': 'iaw-fatos-status' }, msg)]);
}
function build(d) {
var raw = d && d.items && d.items.length ? d.items : [];
for (var i = 0; i < raw.length; i++) {
var it = normalize(raw[i]);
if (it)
items.push(it);
}
if (!items.length) {
fail();
return;
}
latestBR = d && BR_DATE_RE.test(String(d.updatedBR || '')) ? d.updatedBR : ctx.fmt.date(items[0].date);
V = visibleRows();
var moving = !ctx.reduced && items.length > V;
if (moving) {
pauseBtn = h('button', { type: 'button', 'class': page ? 'iaw-btn iaw-fatos-pause' : 'iaw-fatos-pause-icon', 'aria-pressed': 'false' });
pauseBtn.addEventListener('click', function () { setAuto(!auto); ctx.track('fatos'); });
setAuto(auto);
}
list = h('ol', { 'class': 'iaw-fatos-list', 'aria-label': 'Documentos mais recentes (escolha um para ler o resumo)' });
reader = h('div', { 'class': 'iaw-fatos-reader', id: readerId, 'aria-live': 'off' });
var body = h('div', { 'class': 'iaw-fatos-body' }, [list, reader]);
var foot = page ? h('div', { 'class': 'iaw-fatos-foot' }, [
h('p', { 'class': 'iaw-fatos-note' }, 'FR = Fato Relevante · CM = Comunicado ao Mercado · na ordem em que entraram no feed'),
moving ? pauseBtn : null
]) : null;
root = h('div', { 'class': sizeClass() }, [head(moving), body, foot]);
if (!el.getAttribute('aria-label')) {
root.setAttribute('role', 'group');
root.setAttribute('aria-label', 'Feed com os documentos mais recentes da CVM e o resumo gerado por IA de cada um');
}
root.addEventListener('touchstart', function () { lastTouch = now(); }, { passive: true });
root.addEventListener('mousedown', function () { lastTouch = now(); });
body.addEventListener('mouseenter', function () { if (now() - lastTouch > 800)
pointerIn = true; });
body.addEventListener('mouseleave', function () { if (pointerIn) {
pointerIn = false;
hold = Math.max(hold, LEAVE_HOLD);
} });
body.addEventListener('focusin', function () { focusIn = now() - lastTouch > 800; });
body.addEventListener('focusout', function (ev) {
var to = ev.relatedTarget;
if (focusIn && !(to && body.contains(to))) {
focusIn = false;
hold = Math.max(hold, LEAVE_HOLD);
}
});
reset();
el.innerHTML = '';
el.appendChild(root);
ready = true;
if (ctx.running())
startLoop();
}
function fail() {
if (serverContent && !(root && root.parentNode === el))
return;
stopLoop();
ready = false;
el.innerHTML = '';
el.appendChild(status('Os documentos não carregaram agora. Tente de novo mais tarde.'));
}
function built(d) {
try {
build(d);
}
catch (e) {
if (window.console && window.console.warn)
window.console.warn('[ferramentas] fatos: dado não montou', e);
fail();
}
}
function load() {
var own = ctx.src('');
var go = function (url) { ctx.fetchJSON(url).then(built, fail); };
if (own) {
go(own);
return;
}
var I = window.IAFerr;
if (I && I.published) {
I.published().then(function (p) { go((p && p.data && p.data.fatos) || DEFAULT_URL); }, function () { go(DEFAULT_URL); });
}
else
go(DEFAULT_URL);
}
function onViewport() { if (ready) {
reset();
stopLoop();
if (ctx.running())
startLoop();
} }
var serverContent = /\S/.test(el.textContent || '');
if (!serverContent) {
el.innerHTML = '';
el.appendChild(status('Carregando os documentos mais recentes…'));
}
if (narrowMq) {
if (narrowMq.addEventListener)
narrowMq.addEventListener('change', onViewport);
else if (narrowMq.addListener)
narrowMq.addListener(onViewport);
}
load();
return {
start: function () { startLoop(); },
stop: function () { stopLoop(); },
destroy: function () {
stopLoop();
if (narrowMq) {
if (narrowMq.removeEventListener)
narrowMq.removeEventListener('change', onViewport);
else if (narrowMq.removeListener)
narrowMq.removeListener(onViewport);
}
el.innerHTML = '';
}
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget fatos não carregou', e);
}
})();
;
(function () {
try {
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
if (hi === lo)
hi = lo + 1;
var d = '';
for (var j = 0; j < c.p.length; j++)
d += (j ? 'L' : 'M') + (W * j / (c.p.length - 1)).toFixed(1) + ' ' + (H - 3 - (H - 6) * (c.p[j] - lo) / (hi - lo)).toFixed(1);
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
if (feito || ctx.reduced) {
quadro(1);
feito = true;
return;
}
var acc = 0;
raf = ctx.loop(function (dt) {
acc += dt;
var t = Math.min(1, acc / DESENHO_MS);
quadro(t);
if (t >= 1) {
feito = true;
if (raf) {
raf();
raf = null;
}
}
}, { fps: 60 });
}
return {
start: function () { desenhar(); },
stop: function () { if (raf) {
raf();
raf = null;
} quadro(1); feito = true; },
destroy: function () { if (raf)
raf(); }
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget macro não carregou', e);
}
})();
;
(function () {
try {
(function () {
var W = 360;
var CYCLE_MS = 18000;
var FPS = 30;
var P_CLOUD = 0.14;
var P_FRONTIER = 0.5;
var P_TANGENCY = 0.64;
var P_WEIGHTS = 0.82;
var P_RESET = 0.96;
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
var ASSETS = [[118, 150], [176, 76], [226, 118], [268, 66], [304, 170]];
var LETTERS = ['A', 'B', 'C', 'D', 'E'];
var RF = [50, 126];
var TG = [132, 62];
var SLOPE = (RF[1] - TG[1]) / (TG[0] - RF[0]);
var CAL_LEN = 330 - RF[0];
var FRONTIER = 'M78 148 C 84 110, 104 78, 132 62 S 220 50, 268 66';
var TOP = [[78, 148], [104, 92], [132, 62], [200, 52], [268, 66], [304, 170]];
var BOTTOM = [[78, 148], [130, 176], [220, 188], [304, 170]];
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
var WEIGHT_SETS = [];
for (i = 0; i < 24; i++) {
var raw = [];
var sum = 0;
for (var k = 0; k < ASSETS.length; k++) {
raw.push(0.05 + rnd());
sum += raw[k];
}
for (k = 0; k < raw.length; k++)
raw[k] = raw[k] / sum;
WEIGHT_SETS.push(raw);
}
var TANGENCY_WEIGHTS = [0.14, 0.25, 0.18, 0.25, 0.18];
var CURRENT_WEIGHTS = (function () {
var w = [0.08, 0.08, 0.15, 0.22, 0.12];
var s = 0;
var j;
for (j = 0; j < w.length; j++)
s += w[j];
for (j = 0; j < w.length; j++)
w[j] = w[j] / s;
return w;
})();
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
if (f <= 0)
return 0;
if (f >= 1)
return W;
var target = f * ARC_LEN;
for (var j = 1; j < ARC.length; j++) {
if (ARC[j][0] >= target) {
var a = ARC[j - 1];
var b = ARC[j];
return a[1] + ((target - a[0]) / (b[0] - a[0])) * (b[1] - a[1]) + 1.5;
}
}
return W;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function ease(t, a, b) {
var u = clamp01((t - a) / (b - a));
return u * u * (3 - 2 * u);
}
function stepAt(t) {
for (var j = STEPS.length - 1; j > 0; j--)
if (t >= STEPS[j].at)
return j;
return 0;
}
function fix(n, d) { return String(Math.round(n * d) / d); }
window.IAFerr.register('markowitz', function (el, ctx) {
var h = ctx.h;
var svg = ctx.svg;
var page = ctx.size === 'page';
function reservedHeight() {
var hh = el.clientHeight || 0;
try {
if (window.getComputedStyle) {
var mh = parseFloat(window.getComputedStyle(el).minHeight);
if (mh > hh)
hh = mh;
}
}
catch (err) { }
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
function node(n) { return { n: n, op: null, tf: null }; }
function setOp(w, v) {
var r = v <= 0.001 ? 0 : v >= 0.999 ? 1 : Math.round(v * 1000) / 1000;
if (w.op !== r) {
w.op = r;
w.n.style.opacity = String(r);
}
}
function setTf(w, s) {
if (w.tf !== s) {
w.tf = s;
w.n.setAttribute('transform', s);
}
}
function setCss(w, s) {
if (w.tf !== s) {
w.tf = s;
w.n.style.transform = s;
}
}
var clipId = uid + '-clip';
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
var stepEls = [];
for (var e = 0; e < STEPS.length; e++) {
stepEls.push(h('div', { 'class': 'iaw-mk-step', 'aria-hidden': 'true' }, [
h('p', { 'class': 'iaw-mk-step-title' }, STEPS[e].title),
h('p', { 'class': 'iaw-mk-step-text' }, STEPS[e].text)
]));
}
var cap = node(h('div', { 'class': 'iaw-mk-cap' }, stepEls));
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
var live = h('span', { 'class': 'iaw-sr', 'aria-live': 'polite' });
var inner = h('div', { 'class': 'iaw-mk-in' }, [topBar, plot, cap.n, ctrl]);
var root = h('div', { 'class': 'iaw-mk ' + (page ? 'iaw-mk--page' : 'iaw-mk--tile') + (fill ? ' iaw-mk--fill' : '') }, [inner, live]);
function draw(now, dt) {
var fade = 1 - ease(now, P_RESET, 1);
var k;
setOp(assetsG, ease(now, 0, 0.08) * fade);
for (k = 0; k < assetG.length; k++)
setOp(assetG[k], ease(now, k * 0.018, k * 0.018 + 0.03));
var cloudOn = ease(now, P_CLOUD, P_FRONTIER);
var vis = Math.floor(cloudOn * CLOUD.length);
if (vis !== shown) {
for (k = Math.min(vis, shown); k < Math.max(vis, shown); k++)
dots[k].style.opacity = k < vis ? '1' : '0';
shown = vis;
}
setOp(cloudG, fade);
var inCloud = now >= P_CLOUD && now < P_FRONTIER;
if (inCloud && vis > 0) {
setTf(ring, 'translate(' + fix(CLOUD[vis - 1][0], 10) + ' ' + fix(CLOUD[vis - 1][1], 10) + ')');
setOp(ring, 1);
}
else {
setOp(ring, 0);
}
var drawn = ease(now, P_FRONTIER, P_TANGENCY);
setTf(clipRect, 'scale(' + fix(revealX(drawn), 100) + ' 1)');
setOp(frontier, drawn > 0 ? fade : 0);
var swing = ease(now, P_TANGENCY, P_TANGENCY + 0.1);
setOp(calG, now >= P_TANGENCY ? fade : 0);
setTf(calLine, 'rotate(' + fix(-Math.atan(SLOPE * swing) * 180 / Math.PI, 100) + ' ' + RF[0] + ' ' + RF[1] + ')');
var tanOn = ease(now, P_TANGENCY + 0.09, P_TANGENCY + 0.13) * fade;
setOp(tanG, tanOn);
setTf(tanDot, 'translate(' + TG[0] + ' ' + TG[1] + ') scale(' + fix((7 + 3 * (1 - tanOn)) / 7, 1000) + ')');
var weightsOn = ease(now, P_WEIGHTS, P_WEIGHTS + 0.05) * fade;
var drawIdx = Math.max(0, Math.min(WEIGHT_SETS.length - 1, Math.floor(((now - P_CLOUD) / (P_FRONTIER - P_CLOUD)) * WEIGHT_SETS.length)));
var target = weightsOn > 0 ? TANGENCY_WEIGHTS : WEIGHT_SETS[drawIdx];
var follow = 1 - Math.exp(-dt / 100);
var x = 0;
for (k = 0; k < segs.length; k++) {
bw[k] += (target[k] - bw[k]) * follow;
setTf(segs[k], 'translate(' + fix(60 + x * 170, 100) + ' 8) scale(' + fix(bw[k] * 170, 100) + ' 1)');
x += bw[k];
}
var label = weightsOn > 0 ? 'pesos da tangência' : 'pesos desta carteira';
if (label !== barLabelText) {
barLabelText = label;
barLabel.textContent = label;
}
setOp(barG, (inCloud ? cloudOn : weightsOn) * fade);
setOp(curG, weightsOn);
var si = stepAt(now);
if (si !== active) {
for (k = 0; k < stepEls.length; k++) {
stepEls[k].className = 'iaw-mk-step' + (k === si ? ' is-on' : '');
stepEls[k].setAttribute('aria-hidden', k === si ? 'false' : 'true');
if (k === si)
segBtns[k].setAttribute('aria-current', 'step');
else
segBtns[k].removeAttribute('aria-current');
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
if (!cancelLoop && playing && !ctx.reduced)
cancelLoop = ctx.loop(frame, { fps: FPS });
}
function stopLoop() {
if (cancelLoop) {
cancelLoop();
cancelLoop = null;
}
}
function icon(isPlaying) {
return svg('svg', { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true', focusable: 'false' }, isPlaying
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
if (playing) {
if (ctx.running())
startLoop();
}
else
stopLoop();
ctx.track('markowitz');
});
syncPause();
function jumper(n) {
return function () {
ctx.track('markowitz');
live.textContent = 'Etapa ' + (n + 1) + ' de ' + STEPS.length + ': ' + STEPS[n].title + '. ' + STEPS[n].text;
if (playing && !ctx.reduced) {
t = STEPS[n].at + 0.0001;
draw(t, 0);
}
else {
t = STEPS[n].rest;
draw(t, Infinity);
}
};
}
function setScale(width, height) {
if (!(width > 0))
return;
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
if (rect)
setScale(rect.width, rect.height);
});
ro.observe(plotSvg);
}
catch (err) {
ro = null;
}
}
draw(t, Infinity);
el.innerHTML = '';
el.appendChild(root);
if (plotSvg.getBoundingClientRect) {
var box = plotSvg.getBoundingClientRect();
setScale(box.width, box.height);
}
return {
start: startLoop,
stop: stopLoop,
destroy: function () {
stopLoop();
if (ro) {
ro.disconnect();
ro = null;
}
el.innerHTML = '';
}
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget markowitz não carregou', e);
}
})();
;
(function () {
try {
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
var EXAMPLES = [
{ label: 'Ação A', g: [4, 3, 3, 3, 2, 2] },
{ label: 'Ação B', g: [2, 3, 3, 3, 4, 3] }
];
var BAND_TEXT = { alto: 'acima de 3,2', medio: 'de 2,9 a 3,2', baixo: 'abaixo de 2,9' };
var APP_ASSET = 'https://app.brasilhorizonte.com.br/authnew?ref=iacoes&utm_medium=ferramentas&next=';
var TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;
function weighted(g) {
var s = 0;
var n = 0;
for (var i = 0; i < PILLARS.length; i++)
if (g[i]) {
s += g[i] * PILLARS[i].n;
n += PILLARS[i].n;
}
return n ? s / n : null;
}
function simple(g) {
var s = 0;
var k = 0;
for (var i = 0; i < g.length; i++)
if (g[i]) {
s += g[i];
k += 1;
}
return k ? s / k : null;
}
function count(g) {
var k = 0;
for (var i = 0; i < g.length; i++)
if (g[i])
k += 1;
return k;
}
function round2(v) { return Math.round(v * 100) / 100; }
function band(v) { return v > 3.2 ? 'alto' : v >= 2.9 ? 'medio' : 'baixo'; }
function share(ctx, i) { return ctx.fmt.num(PILLARS[i].n / TOTAL * 100, 1) + '%'; }
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
for (var s = 0; s < sg.list.length; s++)
sg.list[s].className = 'iaw-nota-seg' + (s < g ? ' is-on' : '');
}
function clearTimer(t) { if (t !== null && window.clearTimeout)
window.clearTimeout(t); }
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
if (input.value !== t)
input.value = t;
if (TICKER_RE.test(t)) {
go.setAttribute('href', APP_ASSET + encodeURIComponent('/ativo/' + t));
go.removeAttribute('aria-disabled');
go.className = 'iaw-nota-cmp-go';
go.textContent = 'Entrar para ver a nota de ' + t;
}
else {
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
if (ev.preventDefault)
ev.preventDefault();
if (go.click)
go.click();
}
});
input.addEventListener('focus', function () {
if (loaded)
return;
loaded = true;
ctx.fetchJSON('/tickers.json').then(function (rows) {
if (!rows || !rows.length)
return;
var ts = [];
for (var i = 0; i < rows.length; i++) {
var t = rows[i] && rows[i].ticker;
if (typeof t === 'string' && TICKER_RE.test(t))
ts.push(t);
}
ts.sort();
for (var j = 0; j < ts.length; j++)
datalist.appendChild(h('option', { value: ts[j] }));
if (ts.length)
input.setAttribute('list', listId);
}, function () { });
});
go.addEventListener('click', function (ev) {
if (!go.getAttribute('href')) {
if (ev && ev.preventDefault)
ev.preventDefault();
if (input.focus)
input.focus();
return;
}
ctx.track('nota');
if (typeof window._iaClick === 'function')
window._iaClick(ev);
});
return h('div', { 'class': 'iaw-nota-cmp' }, [
h('label', { 'class': 'iaw-nota-cmp-l', 'for': inId }, labelText),
h('div', { 'class': 'iaw-nota-cmp-row' }, [input, go]),
datalist,
hint
]);
}
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
function mountPage(el, ctx) {
var h = ctx.h;
var fmt = ctx.fmt;
var uid = ctx.uid('iaw-nota');
var grades = [0, 0, 0, 0, 0, 0];
var cur = 0;
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
b.addEventListener('click', function (ev) { grade(val, !!(ev && ev.detail > 0)); });
gradeBtns.push(b);
grid.appendChild(b);
})(v);
}
var prev = h('button', { type: 'button', 'class': 'iaw-btn' }, 'Anterior');
var next = h('button', { type: 'button', 'class': 'iaw-btn iaw-nota-next' }, 'Próximo pilar');
prev.addEventListener('click', function () { if (cur > 0)
go(cur - 1, true); });
next.addEventListener('click', function () { go(cur + 1, true); });
var step = h('div', { 'class': 'iaw-nota-step' }, [
stepMeta, stepName, stepLead, stepQs, groupLabel, grid,
h('p', { 'class': 'iaw-nota-hint' }, 'Sem informação para responder? A metodologia usa 2.'),
h('div', { 'class': 'iaw-nota-step-nav' }, [prev, next])
]);
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
for (var k = i + 1; k < 6; k++)
if (!grades[k])
return k;
for (var j = 0; j < i; j++)
if (!grades[j])
return j;
return 6;
}
function partial(n) {
var falta = 6 - n;
return (falta === 1 ? 'Falta 1 pilar' : 'Faltam ' + falta + ' pilares') + ': a nota considera só ' +
(n === 1 ? 'o pilar marcado' : 'os ' + n + ' marcados') + ', cada um com o seu peso.';
}
function resultPhrase() {
var f = weighted(grades);
if (f === null)
return 'Resultado: marque ao menos um pilar para ver a nota.';
return 'Resultado: nota final ' + fmt.num(round2(f), 2) + ' de 4, com ' + count(grades) + ' de 6 pilares.';
}
function paint() {
var f = weighted(grades);
var n = count(grades);
if (f === null) {
finalV.textContent = '—';
finalV.className = 'iaw-nota-final-v iaw-mono';
}
else {
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
if (i === cur)
p.b.setAttribute('aria-current', 'step');
else
p.b.removeAttribute('aria-current');
p.b.setAttribute('aria-label', PILLARS[i].name + ', ' + PILLARS[i].n + ' de 53 perguntas: ' + (g ? 'nota ' + g + ', ' + LEVELS[g - 1] : 'sem nota'));
}
resBtn.className = 'iaw-nota-pill iaw-nota-pill--res' + (cur === 6 ? ' is-cur' : '');
if (cur === 6)
resBtn.setAttribute('aria-current', 'step');
else
resBtn.removeAttribute('aria-current');
if (cur === 6) {
step.setAttribute('hidden', '');
res.removeAttribute('hidden');
if (f === null) {
resV.textContent = '—';
resV.className = 'iaw-nota-res-v iaw-mono';
resBand.textContent = 'Marque ao menos um pilar para ver a nota.';
resNote.textContent = '';
scale.set(null);
}
else {
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
for (var q = 0; q < P.qs.length; q++)
stepQs.appendChild(h('li', null, P.qs[q]));
groupLabel.textContent = 'Sua nota para ' + P.name + ', de 1 (Fraco) a 4 (Forte)';
for (var k = 0; k < 4; k++) {
var on = grades[cur] === k + 1;
gradeBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false');
gradeBtns[k].className = 'iaw-nota-grade' + (on ? ' is-on is-g' + (k + 1) : '');
}
if (cur === 0)
prev.setAttribute('aria-disabled', 'true');
else
prev.removeAttribute('aria-disabled');
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
if (cur > 5)
return;
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
timer = window.setTimeout(function () { timer = null; cur = nxt; paint(); }, 320);
}
say(msg);
}
paint();
el.innerHTML = '';
el.appendChild(root);
return {
start: function () { },
stop: function () { },
destroy: function () { clearTimer(timer); timer = null; el.innerHTML = ''; }
};
}
function mountTile(el, ctx) {
var h = ctx.h;
var svg = ctx.svg;
var fmt = ctx.fmt;
var STEP = 430;
var PRE = 600;
var HOLD = 4200;
var ex = 0;
var k = 6;
var phase = 'hold';
var acc = ctx.reduced ? 0 : HOLD - 2200;
var freeze = 0;
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
for (var i = 0; i < 6; i++)
out.push(i < k ? g[i] : 0);
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
}
else {
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
if (!auto)
return;
if (freeze > 0) {
freeze -= dt;
if (freeze <= 0)
paint();
return;
}
acc += dt;
if (phase === 'pre') {
if (acc >= PRE) {
acc = 0;
phase = 'fill';
}
}
else if (phase === 'fill') {
if (acc >= STEP) {
acc = 0;
k += 1;
if (k >= 6)
phase = 'hold';
paint();
}
}
else if (acc >= HOLD) {
acc = 0;
ex = (ex + 1) % EXAMPLES.length;
k = 0;
phase = 'pre';
paint();
}
}
function icon(playing) {
return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' }, playing
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
start: function () { if (!cancelLoop && !ctx.reduced)
cancelLoop = ctx.loop(frame); },
stop: function () { if (cancelLoop) {
cancelLoop();
cancelLoop = null;
} },
destroy: function () { if (cancelLoop)
cancelLoop(); cancelLoop = null; el.innerHTML = ''; }
};
}
function mountAtivo(el, ctx) {
var root = ctx.h('div', { 'class': 'iaw-nota iaw-nota--ativo' }, [buildCompare(ctx, ctx.uid('iaw-nota'), 'Ticker da ação')]);
el.innerHTML = '';
el.appendChild(root);
return {
start: function () { },
stop: function () { },
destroy: function () { el.innerHTML = ''; }
};
}
window.IAFerr.register('nota', function (el, ctx) {
if (el.getAttribute('data-mode') === 'ativo')
return mountAtivo(el, ctx);
return ctx.size === 'page' ? mountPage(el, ctx) : mountTile(el, ctx);
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget nota não carregou', e);
}
})();
;
(function () {
try {
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
if (!auto)
return;
if (hold > 0) {
hold -= dt;
return;
}
acc += dt;
if (acc >= step) {
acc = 0;
active = (active + 1) % LISTS.length;
rule.setAttribute('aria-live', 'off');
paint();
}
}
function icon(playing) {
return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' }, playing
? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
: [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
}
function setAuto(on) {
auto = on;
pause.setAttribute('aria-pressed', on ? 'false' : 'true');
pause.setAttribute('aria-label', on ? 'Pausar a sequência das listas' : 'Retomar a sequência das listas');
if (page)
pause.textContent = on ? 'Pausar' : 'Retomar';
else {
pause.textContent = '';
pause.appendChild(icon(on));
}
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
start: function () { if (!cancelLoop && !ctx.reduced)
cancelLoop = ctx.loop(frame); },
stop: function () { if (cancelLoop) {
cancelLoop();
cancelLoop = null;
} },
destroy: function () { if (cancelLoop)
cancelLoop(); cancelLoop = null; el.innerHTML = ''; }
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget radar não carregou', e);
}
})();
;
(function () {
try {
(function () {
var KEYS = ['dy', 'pl', 'pvp', 'roe'];
var TAB = { dy: 'DY 12m', pl: 'P/L', pvp: 'P/VP', roe: 'ROE' };
var TAB_TILE = { dy: 'DY', pl: 'P/L', pvp: 'P/VP', roe: 'ROE' };
var TAB_NAME = { dy: 'DY de 12 meses', pl: 'P/L', pvp: 'P/VP', roe: 'ROE' };
var ORDER = { dy: 'Maior DY de 12 meses primeiro', pl: 'Menor P/L primeiro', pvp: 'Menor P/VP primeiro', roe: 'Maior ROE primeiro' };
var ORDER_TILE = { dy: 'Maior DY 12m primeiro', pl: 'Menor P/L primeiro', pvp: 'Menor P/VP primeiro', roe: 'Maior ROE primeiro' };
var DEFAULT_SRC = '/ferramentas/ranking-de-acoes/dados.json';
var HOLD = 10000;
function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function indexOf(list, x) { for (var i = 0; i < list.length; i++)
if (list[i] === x)
return i; return -1; }
function valid(d) {
if (!d || !d.top || !d.rows || !d.rows.length)
return false;
for (var i = 0; i < KEYS.length; i++)
if (!d.top[KEYS[i]] || !d.top[KEYS[i]].length)
return false;
return true;
}
window.IAFerr.register('ranking', function (el, ctx) {
var h = ctx.h;
var fmt = ctx.fmt;
var page = ctx.size === 'page';
var mq = page && window.matchMedia ? window.matchMedia('(max-width: 639px)') : null;
var step = page ? 4600 : 4200;
var uid = ctx.uid('iaw-rk');
var data = null;
var byT = {};
var medians = null;
var has5y = false;
var hasMed = false;
var cur = 'dy';
var auto = !ctx.reduced;
var hold = 0;
var acc = 0;
var hovering = false;
var cancelLoop = null;
var busyUntil = 0;
var pending = false;
var flipSeq = 0;
var rows = {};
var shown = [];
var tabs = {};
var root = null;
var list = null;
var panel = null;
var sub = null;
var subMain = null;
var subExtra = null;
var dirEl = null;
var pause = null;
function now() { return new Date().getTime(); }
function rowCount() { return page ? (mq && mq.matches ? 6 : 8) : 5; }
function fmtVal(k, v) { return k === 'dy' || k === 'roe' ? fmt.pct(v, 1) : fmt.mult(v, 2); }
function medianOf(r, k) {
var sm = medians && r.sector && has(medians, r.sector) ? medians[r.sector] : null;
return sm && isNum(sm[k]) ? sm[k] : null;
}
function altOf(r, k) {
if (k === 'dy')
return isNum(r.dy5y) ? '5 anos ' + fmt.pct(r.dy5y, 1) : '';
var m = medianOf(r, k);
return m === null ? '' : 'setor ' + fmtVal(k, m);
}
function altSpoken(r, k) {
if (k === 'dy')
return isNum(r.dy5y) ? 'média de 5 anos ' + fmt.pct(r.dy5y, 1) : '';
var m = medianOf(r, k);
return m === null ? '' : 'mediana do setor ' + fmtVal(k, m);
}
function listFor(k) {
var top = data.top[k] || [];
var out = [];
var max = rowCount();
for (var i = 0; i < top.length && out.length < max; i++)
if (has(byT, top[i]))
out.push(top[i]);
return out;
}
function scales(k, ts) {
var max = 0;
var out = {};
var i;
var v;
for (i = 0; i < ts.length; i++) {
v = byT[ts[i]][k];
if (isNum(v) && v > max)
max = v;
}
for (i = 0; i < ts.length; i++) {
v = byT[ts[i]][k];
out[ts[i]] = max > 0 && isNum(v) && v > 0 ? Math.max(0.04, v / max) : 0;
}
return out;
}
function onRow() {
ctx.track('ranking');
try {
if (typeof window._iaTrack === 'function')
window._iaTrack('cta_click', page ? 'tool-ranking-widget' : 'lp-tool-ranking-row');
}
catch (e) { }
}
function makeRow(t) {
var r = byT[t];
var p = {
pos: h('span', { 'class': 'iaw-ranking-pos iaw-mono', 'aria-hidden': 'true' }),
fill: h('span', { 'class': 'iaw-ranking-fill' }),
val: h('span', { 'class': 'iaw-ranking-val iaw-mono' }),
alt: page ? h('span', { 'class': 'iaw-ranking-alt iaw-mono' }) : null,
a: null,
scale: 0
};
var kids = [p.pos, h('span', { 'class': 'iaw-ranking-tk iaw-mono' }, t)];
if (page)
kids.push(h('span', { 'class': 'iaw-ranking-sector' }, r.sector || ''));
kids.push(h('span', { 'class': 'iaw-ranking-bar', 'aria-hidden': 'true' }, p.fill));
kids.push(p.val);
if (p.alt)
kids.push(p.alt);
p.a = h('a', { 'class': 'iaw-ranking-link', href: '/' + t + '/', onclick: onRow }, kids);
var li = h('li', { 'class': 'iaw-ranking-row', 'data-t': t }, p.a);
li._rk = p;
return li;
}
function fillRow(li, k, i) {
var p = li._rk;
var r = byT[li.getAttribute('data-t')];
var v = fmtVal(k, r[k]);
var extra = altSpoken(r, k);
p.pos.textContent = String(i + 1);
p.val.textContent = v;
if (p.alt)
p.alt.textContent = altOf(r, k);
p.a.setAttribute('aria-label', r.t + (r.sector ? ' (' + r.sector + ')' : '') + ': ' + (i + 1) + 'º lugar, ' + TAB_NAME[k] + ' ' + v + (extra ? ', ' + extra : ''));
}
function renderStatic(k) {
var ts = listFor(k);
var sc = scales(k, ts);
flipSeq += 1;
list.textContent = '';
root.setAttribute('data-k', k);
for (var i = 0; i < ts.length; i++) {
var li = rows[ts[i]] || (rows[ts[i]] = makeRow(ts[i]));
var st = li.style;
var fs = li._rk.fill.style;
fillRow(li, k, i);
st.transition = '';
st.transitionDelay = '';
st.transform = '';
st.opacity = '';
fs.transition = 'none';
fs.transitionDelay = '';
fs.transform = 'scaleX(' + sc[ts[i]] + ')';
li._rk.scale = sc[ts[i]];
list.appendChild(li);
}
shown = ts;
}
function flip(k, first, base, gap) {
var seq = (flipSeq += 1);
var ts = listFor(k);
var sc = scales(k, ts);
var entering = {};
busyUntil = now() + 700;
list.textContent = '';
root.setAttribute('data-k', k);
for (var i = 0; i < ts.length; i++) {
var t = ts[i];
var li = rows[t] || (rows[t] = makeRow(t));
var st = li.style;
var fs = li._rk.fill.style;
fillRow(li, k, i);
st.transition = 'none';
st.transitionDelay = '';
fs.transition = 'none';
fs.transitionDelay = '';
if (has(first, t) && gap > 0) {
var dy = first[t] - (base + i * gap);
st.transform = dy ? 'translateY(' + dy + 'px)' : '';
st.opacity = '';
fs.transform = 'scaleX(' + li._rk.scale + ')';
}
else {
entering[t] = 1;
st.transform = 'translateY(' + Math.round(gap > 0 ? gap * 0.6 : 12) + 'px)';
st.opacity = '0';
fs.transform = 'scaleX(0)';
}
list.appendChild(li);
}
shown = ts;
ctx.mutate(function () {
if (seq !== flipSeq)
return;
for (var j = 0; j < ts.length; j++) {
var row = rows[ts[j]];
var s2 = row.style;
var f2 = row._rk.fill.style;
var delay = entering[ts[j]] ? j * 40 : 0;
s2.transition = '';
f2.transition = '';
s2.transitionDelay = delay ? delay + 'ms' : '';
f2.transitionDelay = (delay + 60) + 'ms';
s2.transform = '';
s2.opacity = '';
f2.transform = 'scaleX(' + sc[ts[j]] + ')';
row._rk.scale = sc[ts[j]];
}
});
}
function paint(byUser) {
for (var i = 0; i < KEYS.length; i++) {
var k = KEYS[i];
var on = k === cur;
tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
tabs[k].setAttribute('tabindex', on ? '0' : '-1');
tabs[k].className = 'iaw-ranking-tab' + (on ? ' is-on' : '');
}
panel.setAttribute('aria-labelledby', uid + '-' + cur);
if (sub) {
sub.setAttribute('aria-live', byUser ? 'polite' : 'off');
subMain.textContent = ORDER[cur];
subExtra.textContent = cur === 'dy' ? (has5y ? ' · à direita, a média de 5 anos' : '') : (hasMed ? ' · à direita, a mediana do setor' : '');
}
if (dirEl)
dirEl.textContent = ORDER_TILE[cur];
}
function show(k, byUser) {
if (!data)
return;
if (k === cur && shown.length) {
paint(byUser);
return;
}
cur = k;
paint(byUser);
if (pending)
return;
if (ctx.reduced || !ctx.running() || now() < busyUntil || !shown.length) {
renderStatic(cur);
return;
}
pending = true;
ctx.measure(function () {
var first = {};
var i;
for (i = 0; i < shown.length; i++)
if (rows[shown[i]])
first[shown[i]] = rows[shown[i]].offsetTop;
var r0 = rows[shown[0]];
var r1 = shown.length > 1 ? rows[shown[1]] : null;
var base = r0 ? r0.offsetTop : 0;
var gap = r1 ? r1.offsetTop - base : (r0 ? r0.offsetHeight : 0);
ctx.mutate(function () {
pending = false;
if (gap > 0)
flip(cur, first, base, gap);
else
renderStatic(cur);
});
});
}
function userPick(k) {
hold = HOLD;
acc = 0;
ctx.track('ranking');
show(k, true);
}
function onKey(e) {
var k = (e.currentTarget || this).getAttribute('data-k');
var i = indexOf(KEYS, k);
var key = e.key || '';
var j;
if (key === 'ArrowRight' || key === 'Right')
j = i + 1;
else if (key === 'ArrowLeft' || key === 'Left')
j = i - 1;
else if (key === 'Home')
j = 0;
else if (key === 'End')
j = KEYS.length - 1;
else
return;
if (e.preventDefault)
e.preventDefault();
j = (j + KEYS.length) % KEYS.length;
userPick(KEYS[j]);
tabs[KEYS[j]].focus();
}
function focusInside() {
var ae = document.activeElement;
return !!(ae && root && root.contains && ae !== document.body && root.contains(ae));
}
function frame(dt) {
if (!auto || !data || hovering || focusInside())
return;
if (hold > 0) {
hold -= dt;
return;
}
acc += dt;
if (acc >= step) {
acc = 0;
show(KEYS[(indexOf(KEYS, cur) + 1) % KEYS.length], false);
}
}
function startLoop() { if (!cancelLoop && !ctx.reduced && data)
cancelLoop = ctx.loop(frame); }
function stopLoop() { if (cancelLoop) {
cancelLoop();
cancelLoop = null;
} }
function icon(playing) {
var s = ctx.svg;
return s('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false' }, playing
? [s('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), s('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
: [s('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
}
function setAuto(on) {
auto = on;
acc = 0;
if (!pause)
return;
pause.setAttribute('aria-pressed', on ? 'false' : 'true');
pause.setAttribute('aria-label', on ? 'Pausar a troca automática de abas' : 'Retomar a troca automática de abas');
if (page)
pause.textContent = on ? 'Pausar' : 'Retomar';
else {
pause.textContent = '';
pause.appendChild(icon(on));
}
}
function build() {
var tablist = h('div', { 'class': 'iaw-ranking-tabs', role: 'tablist', 'aria-label': 'Indicador do ranking' });
for (var i = 0; i < KEYS.length; i++) {
(function (k) {
var b = h('button', {
type: 'button',
role: 'tab',
id: uid + '-' + k,
'class': 'iaw-ranking-tab',
'aria-controls': uid + '-painel',
'aria-selected': 'false',
'data-k': k
}, page ? TAB[k] : TAB_TILE[k]);
if (!page && TAB_TILE[k] !== TAB_NAME[k])
b.setAttribute('aria-label', TAB_NAME[k]);
b.addEventListener('click', function () { userPick(k); });
b.addEventListener('keydown', onKey);
tabs[k] = b;
tablist.appendChild(b);
})(KEYS[i]);
}
if (!ctx.reduced) {
pause = h('button', { type: 'button', 'class': page ? 'iaw-btn iaw-ranking-pause' : 'iaw-ranking-pause-icon', 'aria-pressed': 'false' });
pause.addEventListener('click', function () { setAuto(!auto); ctx.track('ranking'); });
setAuto(auto);
}
list = h('ol', { 'class': 'iaw-ranking-list' });
panel = h('div', { 'class': 'iaw-ranking-panel', role: 'tabpanel', id: uid + '-painel', 'aria-labelledby': uid + '-dy' }, list);
var bi = data.minMarketCap / 1e9;
var cap = isNum(bi) && bi > 0 ? (bi % 1 === 0 ? String(bi) : fmt.num(bi, 1)) : '';
var foot;
if (page) {
subMain = h('span', null, '');
subExtra = h('span', { 'class': 'iaw-ranking-sub-extra' });
sub = h('p', { 'class': 'iaw-ranking-sub', 'aria-live': 'off' }, [subMain, subExtra]);
foot = h('p', { 'class': 'iaw-ranking-foot' }, [
h('span', null, ['Dados de ', h('strong', null, data.dateBR || fmt.date(data.date))]),
isNum(data.count) && cap ? h('span', { 'class': 'iaw-ranking-foot-extra' }, data.count + ' empresas a partir de R$ ' + cap + ' bi') : null
]);
}
else {
dirEl = h('strong', null, '');
foot = h('div', { 'class': 'iaw-ranking-foot' }, [
h('span', null, [dirEl, ' · ' + (data.dateBR || fmt.date(data.date))]),
h('span', null, 'Ordenação por indicador, não é recomendação.')
]);
}
root = h('div', { 'class': 'iaw-ranking ' + (page ? 'iaw-ranking--page' : 'iaw-ranking--tile'), 'data-k': cur }, [
h('div', { 'class': 'iaw-ranking-top' }, [tablist, pause]),
sub,
panel,
foot
]);
root.addEventListener('mouseenter', function () { hovering = true; });
root.addEventListener('mouseleave', function () { hovering = false; });
renderStatic(cur);
paint(false);
el.innerHTML = '';
el.appendChild(root);
if (ctx.running())
startLoop();
}
function fail(e) {
try {
if (window.console && window.console.warn)
window.console.warn('[ferramentas] ranking: dado indisponível', e || '');
}
catch (x) { }
if (page || root)
return;
el.innerHTML = '';
el.appendChild(h('p', { 'class': 'iaw-ranking-erro' }, 'O ranking não carregou agora. Recarregue a página para tentar de novo.'));
}
function load() {
var s = ctx.src('');
if (s)
return ctx.fetchJSON(s);
var I = window.IAFerr;
if (I && I.published) {
return I.published().then(function (p) {
return ctx.fetchJSON((p && p.data && p.data.ranking) || DEFAULT_SRC);
}, function () { return ctx.fetchJSON(DEFAULT_SRC); });
}
return ctx.fetchJSON(DEFAULT_SRC);
}
function onMq() { if (data && root)
renderStatic(cur); }
if (mq) {
if (mq.addEventListener)
mq.addEventListener('change', onMq);
else if (mq.addListener)
mq.addListener(onMq);
}
load().then(function (d) {
if (!valid(d))
throw new Error('dados.json do ranking sem as quatro abas');
for (var i = 0; i < d.rows.length; i++)
if (d.rows[i] && d.rows[i].t)
byT[d.rows[i].t] = d.rows[i];
data = d;
medians = d.sectorMedian && typeof d.sectorMedian === 'object' ? d.sectorMedian : null;
for (var t in byT) {
if (!has(byT, t))
continue;
if (isNum(byT[t].dy5y))
has5y = true;
if (medians && byT[t].sector && has(medians, byT[t].sector))
hasMed = true;
}
build();
}).then(null, fail);
return {
start: function () { startLoop(); },
stop: function () { stopLoop(); },
destroy: function () {
stopLoop();
if (mq) {
if (mq.removeEventListener)
mq.removeEventListener('change', onMq);
else if (mq.removeListener)
mq.removeListener(onMq);
}
if (root)
el.innerHTML = '';
}
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget ranking não carregou', e);
}
})();
;
(function () {
try {
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
var SLOT = 380;
function passes(c, d) { return c.op === 'min' ? c.v[d] >= c.lim : c.v[d] <= c.lim; }
function brokenCount(d) {
var n = 0;
for (var i = 0; i < CRIT.length; i++)
if (!passes(CRIT[i], d))
n += 1;
return n;
}
window.IAFerr.register('tese', function (el, ctx) {
var h = ctx.h;
var svg = ctx.svg;
var fmt = ctx.fmt;
var page = ctx.size === 'page';
var reduced = !!ctx.reduced;
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
if (kind === 'ok')
return svg('svg', a, [svg('circle', { cx: '8', cy: '8', r: '7.25' }), svg('path', { d: 'M4.7 8.3l2.2 2.2 4.4-4.7' })]);
if (kind === 'no')
return svg('svg', a, [svg('circle', { cx: '8', cy: '8', r: '7.25' }), svg('path', { d: 'M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2' })]);
return svg('svg', a, [svg('circle', { cx: '8', cy: '8', r: '2.6' })]);
}
function playIcon(playing) {
return svg('svg', { viewBox: '0 0 16 16', width: '12', height: '12', 'aria-hidden': 'true', focusable: 'false', 'class': 'iaw-tese-pi' }, playing
? [svg('rect', { x: '3', y: '2.5', width: '3.5', height: '11', rx: '1' }), svg('rect', { x: '9.5', y: '2.5', width: '3.5', height: '11', rx: '1' })]
: [svg('path', { d: 'M4 2.5v11l9.5-5.5z' })]);
}
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
if (!pause)
return;
pause.setAttribute('aria-pressed', on ? 'false' : 'true');
pause.setAttribute('aria-label', on ? 'Pausar a conferência automática' : 'Retomar a conferência automática');
pause.textContent = '';
pause.appendChild(playIcon(on));
if (page)
pause.appendChild(h('span', { 'class': 'iaw-tese-pause-txt' }, on ? 'Pausar' : 'Retomar'));
if (on)
startLoop();
else
stopLoop();
}
if (pause)
pause.addEventListener('click', function () { ctx.track('tese'); setAuto(!auto); });
function stateAt(x) {
var s = { day: 0, done: 0, chk: -1, sum: false, alert: false };
var start = T_CHECK1;
var end = END1;
if (x >= T_DAY2) {
s.day = 1;
start = T_CHECK2;
end = END2;
}
if (x >= start) {
s.done = Math.min(CRIT.length, Math.floor((x - start) / SLOT));
if (s.done < CRIT.length)
s.chk = s.done;
}
s.sum = x >= end;
s.alert = page && s.day === 1 && x >= T_ALERT;
return s;
}
function finalAt(d) { return d === 0 ? END1 : (page ? T_ALERT : END2); }
var flip = false;
var tone = ' is-ok';
function setDay(d) {
for (var i = 0; i < rows.length; i++)
rows[i].val.textContent = value(CRIT[i], d);
alvoNum.textContent = fmt.brl(ALVO);
alvoUp.textContent = ' (+' + fmt.pct(upside(d), 1) + ')';
price.textContent = fmt.brl(DAYS[d].price);
note.textContent = DAYS[d].note;
if (dayChip)
dayChip.textContent = 'dia ' + (d + 1);
for (var j = 0; j < dayBtns.length; j++)
dayBtns[j].setAttribute('aria-pressed', j === d ? 'true' : 'false');
if (cur && ctx.running() && !ctx.reduced) {
flip = !flip;
root.setAttribute('data-flash', flip ? 'a' : 'b');
}
else if (root)
root.removeAttribute('data-flash');
}
function paint(s) {
var dayChanged = !cur || cur.day !== s.day;
if (dayChanged)
setDay(s.day);
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
for (var k = 0; k < CRIT.length && !first; k++)
if (!passes(CRIT[k], s.day))
first = CRIT[k];
var head = n + ' de ' + CRIT.length + ' critérios ' + (n === 1 ? 'quebrou' : 'quebraram');
sumLong.textContent = bad ? head + ': ' + first.noun + (first.op === 'max' ? ' acima de ' : ' abaixo de ') + (first.kind === 'pct' ? fmt.pct(first.lim, 0) : fmt.mult(first.lim, 1)) : 'Todos os critérios com dado seguem de pé';
sumShort.textContent = bad ? head : 'Todos os critérios de pé';
sumIcon.textContent = '';
sumIcon.appendChild(icon(bad ? 'no' : 'ok'));
}
if (s.sum)
tone = bad ? ' is-bad' : ' is-ok';
sum.className = 'iaw-tese-sum' + (s.sum ? ' is-on' : '') + tone;
sum.setAttribute('aria-hidden', s.sum ? 'false' : 'true');
}
if (notice && (!cur || cur.alert !== s.alert)) {
notice.className = 'iaw-tese-alert' + (s.alert ? ' is-on' : '');
notice.setAttribute('aria-hidden', s.alert ? 'false' : 'true');
}
cur = s;
}
function frame(dt) {
if (!auto)
return;
if (hold > 0) {
hold -= dt;
return;
}
if (live) {
out.setAttribute('aria-live', 'off');
live = false;
}
t += dt;
if (t >= CYCLE)
t = t % CYCLE;
paint(stateAt(t));
}
function startLoop() { if (!cancelLoop && auto && running && !ctx.reduced)
cancelLoop = ctx.loop(frame); }
function stopLoop() { if (cancelLoop) {
cancelLoop();
cancelLoop = null;
} }
function choose(d) {
ctx.track('tese');
out.setAttribute('aria-live', 'polite');
live = true;
t = finalAt(d);
hold = 7000;
paint(stateAt(t));
}
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
}
else {
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
try {
ta.select();
ok = !!document.execCommand('copy');
}
catch (e) {
ok = false;
}
document.body.removeChild(ta);
return ok;
}
function copyText(text, done) {
var nav = window.navigator;
var fallback = function () { done(legacyCopy(text)); };
if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
try {
nav.clipboard.writeText(text).then(function () { done(true); }, fallback);
return;
}
catch (e) { }
}
fallback();
}
function selectAll(node) {
try {
var sel = window.getSelection ? window.getSelection() : null;
if (!sel || !document.createRange)
return;
var range = document.createRange();
range.selectNodeContents(node);
sel.removeAllRanges();
sel.addRange(range);
}
catch (e) { }
}
window.IAFerr.register('tese-modelo', function (el, ctx) {
var h = ctx.h;
var pre = el.querySelector('pre');
var slot = el.querySelector('[data-tese-copy]');
var tip = el.querySelector('[data-tese-dica]');
if (!pre || !slot)
throw new Error('bloco do modelo sem <pre> ou sem [data-tese-copy]');
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
if (timer && window.clearTimeout)
window.clearTimeout(timer);
timer = window.setTimeout ? window.setTimeout(function () { msg.textContent = ''; timer = null; }, 6000) : null;
}
btn.addEventListener('click', function () {
ctx.track('tese-modelo');
copyText(pre.textContent || '', function (ok) {
if (ok)
say('Modelo copiado. Cole no seu bloco de notas ou planilha.');
else {
selectAll(pre);
say('Não deu para copiar sozinho: o texto ficou selecionado. Use Ctrl+C ou o menu Copiar.');
}
});
});
var tipBefore = tip ? tip.textContent : '';
if (tip)
tip.textContent = 'Copie com o botão ou selecione o texto. Preencha os espaços e deixe em branco o que não usar.';
slot.appendChild(btn);
slot.appendChild(msg);
return {
start: function () { },
stop: function () { },
destroy: function () {
if (timer && window.clearTimeout)
window.clearTimeout(timer);
if (btn.parentNode)
btn.parentNode.removeChild(btn);
if (msg.parentNode)
msg.parentNode.removeChild(msg);
if (tip)
tip.textContent = tipBefore;
}
};
});
})();
}
catch (e) {
if (window.console)
console.warn('[ferramentas] widget tese não carregou', e);
}
})();
