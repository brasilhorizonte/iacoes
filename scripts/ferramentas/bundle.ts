/**
 * Empacotador dos widgets (SPEC §4, SPEC-v2 §E4). A cada geração escreve:
 *
 *   assets/js/ferramentas.js        runtime (widgets/_runtime.js) + widgets leves
 *   assets/css/ferramentas.css      widgets/_runtime.css + CSS dos widgets leves
 *   assets/js/ferramentas-calc.js   só o widget pesado `calc` (carregado só na página da calculadora)
 *   assets/css/ferramentas-calc.css só o CSS dele (se houver)
 *
 * Grupos separados em SEPARATE (widget pesado → arquivo próprio; a landing nunca baixa). O hash do
 * conteúdo vai no ?v= de quem carrega, então o cache do GitHub Pages nunca serve código velho e,
 * sem mudança nos fontes, o HTML sai idêntico entre builds. O hash do CSS principal é gravado no
 * runtime (CSS_VERSION): sem <link> na página, o runtime injeta o CSS certo sem bloquear.
 *
 * JS puro lido de arquivo, sem template literal do TS em volta (regra regex-escaping). Cada widget
 * roda isolado: erro de execução fica no try/catch dele; erro de SINTAXE (que derrubaria o bundle
 * inteiro) tira só aquele widget do bundle e vira aviso no log. Minificação simples: comentários
 * fora (impressão pelo compilador do TypeScript, que preserva o código) e CSS sem comentários nem
 * espaços sobrando.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Script } from 'node:vm';
import * as ts from 'typescript';

export const WIDGETS_DIR = join(__dirname, 'widgets');
export const JS_PATH = '/assets/js/ferramentas.js';
export const CSS_PATH = '/assets/css/ferramentas.css';

/** Widgets pesados em arquivo próprio: grupo → widgets. Só a página que usa carrega o arquivo. */
export const SEPARATE: Readonly<Record<string, readonly string[]>> = { calc: ['calc'] };

export const groupJsPath = (g: string): string => (g === 'main' ? JS_PATH : `/assets/js/ferramentas-${g}.js`);
export const groupCssPath = (g: string): string => (g === 'main' ? CSS_PATH : `/assets/css/ferramentas-${g}.css`);

export const hashOf = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 10);

/** Linha do runtime que recebe o hash do CSS principal (contrato com widgets/_runtime.js). */
const CSS_VERSION_RE = /var CSS_VERSION = '[^']*';/;

const HEADER_JS = '/* IAções: widgets das ferramentas. Gerado por scripts/ferramentas/bundle.ts a cada build (não edite: fontes em scripts/ferramentas/widgets/). */\n';
const HEADER_CSS = '/* IAções: estilos dos widgets das ferramentas. Gerado por scripts/ferramentas/bundle.ts (fontes em scripts/ferramentas/widgets/). */\n';

const read = (f: string) => readFileSync(f, 'utf-8').replace(/^﻿/, '').replace(/\r\n/g, '\n');

export interface GroupSources {
  /** 'main' ou a chave de SEPARATE. */
  name: string;
  widgets: string[];
  js: string;
  css: string;
}

export interface BundleSources {
  /** Grupo principal (runtime + widgets leves). */
  js: string;
  css: string;
  widgets: string[];
  /** Grupos separados com ao menos um widget presente. */
  groups: GroupSources[];
  /** Widgets fora do bundle por erro de sintaxe (o resto funciona). */
  skipped: { id: string; reason: string }[];
}

export interface BundleOptions {
  /** Tira comentários do JS e espaços do CSS (padrão: true no writeBundle, false no bundleSources). */
  minify?: boolean;
}

// ─── Minificação simples ──────────────────────────────────────────────────

/**
 * JS sem comentários, reimpresso pelo compilador do TypeScript (não muda o código), e sem o recuo
 * das linhas. Tirar o recuo é seguro em ES5 (o teste garante que os fontes são ES5): sem template
 * literal, o único token que atravessa linha é string com barra no fim da linha — e essa linha
 * seguinte fica intacta. As quebras de linha ficam (nada de depender de ASI).
 */
export function minifyJs(code: string): string {
  const sf = ts.createSourceFile('bundle.js', code, ts.ScriptTarget.ES5, true, ts.ScriptKind.JS);
  const printed = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(sf);
  const lines = printed.split('\n');
  return lines.map((l, i) => (i > 0 && /\\$/.test(lines[i - 1]) ? l : l.replace(/^[ \t]+/, ''))).join('\n');
}

/** CSS sem comentários e sem espaço sobrando em volta de { } ; (strings entre aspas intactas). */
export function minifyCss(css: string): string {
  let out = '';
  let i = 0;
  let pendingSpace = false;
  const n = css.length;
  const trimEnd = () => { out = out.replace(/\s+$/, ''); };
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      pendingSpace = true;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      if (pendingSpace && out && !/[{};\s]$/.test(out)) out += ' ';
      pendingSpace = false;
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (/\s/.test(c)) { pendingSpace = true; i += 1; continue; }
    if (c === '{' || c === '}' || c === ';') {
      trimEnd();
      if (c === '}' && out.endsWith(';')) out = out.slice(0, -1);
      out += c;
      pendingSpace = false;
      i += 1;
      continue;
    }
    if (pendingSpace && out && !/[{};]$/.test(out)) out += ' ';
    pendingSpace = false;
    out += c;
    i += 1;
  }
  return out.trim();
}

// ─── Montagem ─────────────────────────────────────────────────────────────

/** Erro de sintaxe do código (compila sem executar). */
function syntaxError(code: string, file: string): string | null {
  try {
    new Script(code, { filename: file });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const groupOf = (id: string): string => Object.keys(SEPARATE).find((g) => SEPARATE[g].includes(id)) ?? 'main';

/** Widget no grupo principal: o runtime vem antes no mesmo arquivo. */
const wrapMain = (id: string, src: string) =>
  `\n/* --- widgets/${id}.js --- */\n;(function () {\ntry {\n${src}\n} catch (e) { if (window.console) console.warn('[ferramentas] widget ${id} não carregou', e); }\n})();\n`;

/**
 * Widget em arquivo separado: pode chegar antes do runtime (ordem de carga), então espera o evento
 * 'iaferr:ready' que o runtime dispara ao subir.
 */
const wrapSeparate = (id: string, src: string) =>
  `\n/* --- widgets/${id}.js --- */\n;(function (run) {\n  if (window.IAFerr && window.IAFerr.register) run(); else document.addEventListener('iaferr:ready', run);\n})(function () {\ntry {\n${src}\n} catch (e) { if (window.console) console.warn('[ferramentas] widget ${id} não carregou', e); }\n});\n`;

/** Monta o conteúdo dos arquivos (sem escrever nada). */
export function bundleSources(dir = WIDGETS_DIR, opts: BundleOptions = {}): BundleSources {
  const runtimeFile = join(dir, '_runtime.js');
  if (!existsSync(runtimeFile)) throw new Error(`runtime ausente: ${runtimeFile}`);
  const files = readdirSync(dir).sort();
  const all = files.filter((f) => f.endsWith('.js') && !f.startsWith('_') && !f.startsWith('.')).map((f) => f.slice(0, -3));
  const skipped: { id: string; reason: string }[] = [];
  const code: Record<string, string> = {};
  for (const id of all) {
    const src = read(join(dir, `${id}.js`)).trim();
    const err = syntaxError(wrapMain(id, src), `widgets/${id}.js`);
    if (err) skipped.push({ id, reason: err });
    else code[id] = src;
  }
  const ok = all.filter((id) => id in code);
  const cssOf = (id: string) => (existsSync(join(dir, `${id}.css`)) ? `\n/* --- widgets/${id}.css --- */\n${read(join(dir, `${id}.css`)).trim()}\n` : '');
  const finishCss = (css: string) => (opts.minify ? HEADER_CSS + minifyCss(css) + '\n' : HEADER_CSS + css.trimStart());
  const finishJs = (js: string) => (opts.minify ? HEADER_JS + minifyJs(js) : HEADER_JS + js.trimStart());

  // Grupo principal. CSS primeiro: o hash dele vai para o runtime (injeção não-bloqueante).
  const mainIds = ok.filter((id) => groupOf(id) === 'main');
  // CSS órfão (sem .js) fica no principal, como antes.
  const orphanCss = files.filter((f) => f.endsWith('.css') && !f.startsWith('_') && !f.startsWith('.') && !all.includes(f.slice(0, -4))).map((f) => f.slice(0, -4));
  let mainCss = existsSync(join(dir, '_runtime.css')) ? `${read(join(dir, '_runtime.css')).trim()}\n` : '';
  for (const id of [...mainIds, ...orphanCss].sort()) mainCss += cssOf(id);
  const css = finishCss(mainCss);

  const runtime = read(runtimeFile).trim();
  if (!CSS_VERSION_RE.test(runtime)) throw new Error("runtime sem a linha `var CSS_VERSION = '';` (contrato com o bundle.ts)");
  let mainJs = `${runtime.replace(CSS_VERSION_RE, `var CSS_VERSION = '${hashOf(css)}';`)}\n`;
  for (const id of mainIds) mainJs += wrapMain(id, code[id]);
  const js = finishJs(mainJs);

  const groups: GroupSources[] = [];
  for (const name of Object.keys(SEPARATE)) {
    const ids = SEPARATE[name].filter((id) => id in code);
    if (!ids.length) continue;
    let gJs = '';
    let gCss = '';
    for (const id of ids) { gJs += wrapSeparate(id, code[id]); gCss += cssOf(id); }
    groups.push({ name, widgets: ids, js: finishJs(gJs), css: gCss.trim() ? finishCss(gCss) : '' });
  }
  return { js, css, widgets: mainIds, groups, skipped };
}

export interface BundleFile {
  /** Caminho público (prefixe com o basePath na prévia). */
  path: string;
  hash: string;
  /** path?v=hash */
  url: string;
}

export interface BundleResult {
  /** Widgets do arquivo principal. */
  widgets: string[];
  jsHash: string;
  cssHash: string;
  /** Caminhos públicos com ?v=hash do arquivo principal (prefixe com o basePath na prévia). */
  jsUrl: string;
  cssUrl: string;
  /** Grupos separados escritos nesta execução. */
  groups: Record<string, { widgets: string[]; js: BundleFile; css: BundleFile | null }>;
  /** Widget pesado → URLs do arquivo dele (o page.tsx carrega na página do widget). */
  byWidget: Record<string, { js: string; css: string | null }>;
  skipped: { id: string; reason: string }[];
}

const file = (path: string, content: string): BundleFile => {
  const hash = hashOf(content);
  return { path, hash, url: `${path}?v=${hash}` };
};

/** Escreve os arquivos em `outRoot` (raiz do site ou preview/<id>/) e devolve os hashes. */
export function writeBundle(outRoot: string, dir = WIDGETS_DIR, opts: BundleOptions = {}): BundleResult {
  const src = bundleSources(dir, { minify: opts.minify ?? true });
  for (const [g, s] of [['main', { js: src.js, css: src.css }] as const, ...src.groups.map((x) => [x.name, x] as const)]) {
    const err = syntaxError(s.js, groupJsPath(g));
    if (err) throw new Error(`bundle ${groupJsPath(g)} inválido: ${err}`);
  }
  mkdirSync(join(outRoot, 'assets', 'js'), { recursive: true });
  mkdirSync(join(outRoot, 'assets', 'css'), { recursive: true });
  const main = { js: file(JS_PATH, src.js), css: file(CSS_PATH, src.css) };
  writeFileSync(join(outRoot, JS_PATH), src.js, 'utf-8');
  writeFileSync(join(outRoot, CSS_PATH), src.css, 'utf-8');
  const groups: BundleResult['groups'] = {};
  const byWidget: BundleResult['byWidget'] = {};
  for (const g of src.groups) {
    const js = file(groupJsPath(g.name), g.js);
    writeFileSync(join(outRoot, js.path), g.js, 'utf-8');
    const css = g.css ? file(groupCssPath(g.name), g.css) : null;
    if (css) writeFileSync(join(outRoot, css.path), g.css, 'utf-8');
    groups[g.name] = { widgets: g.widgets, js, css };
    for (const id of g.widgets) byWidget[id] = { js: js.url, css: css?.url ?? null };
  }
  return {
    widgets: src.widgets,
    jsHash: main.js.hash,
    cssHash: main.css.hash,
    jsUrl: main.js.url,
    cssUrl: main.css.url,
    groups,
    byWidget,
    skipped: src.skipped,
  };
}

/**
 * Atualiza o ?v= de quem carrega o bundle num HTML escrito à mão (a landing). Só troca o que já
 * existe no formato `/assets/js/ferramentas.js?v=…` (e os arquivos dos grupos separados, como
 * `/assets/js/ferramentas-calc.js?v=…`).
 */
export function stampAssetVersions(
  html: string,
  h: { jsHash: string; cssHash: string; groups?: Record<string, { js: { hash: string }; css: { hash: string } | null }> },
): string {
  const files: [string, string][] = [[JS_PATH, h.jsHash], [CSS_PATH, h.cssHash]];
  for (const [g, x] of Object.entries(h.groups ?? {})) {
    files.push([groupJsPath(g), x.js.hash]);
    if (x.css) files.push([groupCssPath(g), x.css.hash]);
  }
  let out = html;
  for (const [path, hash] of files) {
    const re = new RegExp(`(${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')})\\?v=[A-Za-z0-9_-]*`, 'g');
    out = out.replace(re, `$1?v=${hash}`);
  }
  return out;
}
