/**
 * Empacotador dos widgets (SPEC §4): concatena widgets/_runtime.js + widgets/<id>.js em
 * assets/js/ferramentas.js e widgets/_runtime.css + widgets/<id>.css em
 * assets/css/ferramentas.css, a cada geração.
 *
 * Exceção documentada ao "tudo inline": o mesmo código serve as páginas de ferramenta e a
 * landing. O hash do conteúdo vai no ?v= de quem carrega, então o cache do GitHub Pages nunca
 * serve código velho e, sem mudança nos fontes, o HTML sai idêntico entre builds.
 *
 * JS puro lido de arquivo, sem template literal do TS em volta (regra regex-escaping): o que
 * está no .js é o que vai para o navegador, byte a byte. Cada widget roda isolado (try/catch):
 * um widget quebrado não derruba os outros nem a página.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const WIDGETS_DIR = join(__dirname, 'widgets');
export const JS_PATH = '/assets/js/ferramentas.js';
export const CSS_PATH = '/assets/css/ferramentas.css';

export const hashOf = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 10);

export interface BundleSources {
  js: string;
  css: string;
  /** ids dos widgets incluídos (widgets/<id>.js), em ordem. */
  widgets: string[];
}

const HEADER_JS = '/* IAções: widgets das ferramentas. Gerado por scripts/ferramentas/bundle.ts a cada build (não edite: fontes em scripts/ferramentas/widgets/). */\n';
const HEADER_CSS = '/* IAções: estilos dos widgets das ferramentas. Gerado por scripts/ferramentas/bundle.ts (fontes em scripts/ferramentas/widgets/). */\n';

const read = (f: string) => readFileSync(f, 'utf-8').replace(/^﻿/, '').replace(/\r\n/g, '\n');

/** Monta o conteúdo do bundle (sem escrever nada). */
export function bundleSources(dir = WIDGETS_DIR): BundleSources {
  const runtime = join(dir, '_runtime.js');
  if (!existsSync(runtime)) throw new Error(`runtime ausente: ${runtime}`);
  const files = readdirSync(dir).sort();
  const widgets = files.filter((f) => f.endsWith('.js') && !f.startsWith('_') && !f.startsWith('.')).map((f) => f.slice(0, -3));
  let js = HEADER_JS + read(runtime).trim() + '\n';
  for (const id of widgets) {
    // Isolamento: escopo próprio e erro de carga só desativa este widget (o runtime avisa no console).
    js += `\n/* --- widgets/${id}.js --- */\n;(function () {\ntry {\n${read(join(dir, `${id}.js`)).trim()}\n} catch (e) { if (window.console) console.warn('[ferramentas] widget ${id} não carregou', e); }\n})();\n`;
  }
  let css = HEADER_CSS;
  if (existsSync(join(dir, '_runtime.css'))) css += read(join(dir, '_runtime.css')).trim() + '\n';
  for (const f of files.filter((x) => x.endsWith('.css') && !x.startsWith('_') && !x.startsWith('.'))) {
    css += `\n/* --- widgets/${f} --- */\n${read(join(dir, f)).trim()}\n`;
  }
  return { js, css, widgets };
}

export interface BundleResult {
  widgets: string[];
  jsHash: string;
  cssHash: string;
  /** Caminhos públicos com ?v=hash (prefixe com o basePath na prévia). */
  jsUrl: string;
  cssUrl: string;
}

/** Escreve os dois arquivos em `outRoot` (raiz do site ou preview/) e devolve os hashes. */
export function writeBundle(outRoot: string, dir = WIDGETS_DIR): BundleResult {
  const src = bundleSources(dir);
  const jsHash = hashOf(src.js);
  const cssHash = hashOf(src.css);
  mkdirSync(join(outRoot, 'assets', 'js'), { recursive: true });
  mkdirSync(join(outRoot, 'assets', 'css'), { recursive: true });
  writeFileSync(join(outRoot, JS_PATH), src.js, 'utf-8');
  writeFileSync(join(outRoot, CSS_PATH), src.css, 'utf-8');
  return { widgets: src.widgets, jsHash, cssHash, jsUrl: `${JS_PATH}?v=${jsHash}`, cssUrl: `${CSS_PATH}?v=${cssHash}` };
}

/**
 * Atualiza o ?v= de quem carrega o bundle num HTML escrito à mão (a landing). Só troca o que já
 * existe no formato `/assets/js/ferramentas.js?v=…` e `/assets/css/ferramentas.css?v=…`.
 */
export function stampAssetVersions(html: string, h: { jsHash: string; cssHash: string }): string {
  return html
    .replace(/(\/assets\/js\/ferramentas\.js)\?v=[A-Za-z0-9_-]*/g, `$1?v=${h.jsHash}`)
    .replace(/(\/assets\/css\/ferramentas\.css)\?v=[A-Za-z0-9_-]*/g, `$1?v=${h.cssHash}`);
}
