/**
 * validate-html.ts — Validacao pos-geracao das paginas HTML
 *
 * Verifica problemas comuns que ja causaram bugs em producao:
 * - Regexes quebradas por template literals (backslash engolido)
 * - Links de CTA apontando para destinos errados
 * - Funcoes de tracking ausentes ou corrompidas
 * - Ferramentas: link /ferramentas/... para pagina que nao existe (landing inclusive), widget
 *   dentro de <a>, bundle de widgets ausente, JSON-LD do tipo errado e termo proibido em texto
 *   autoral (blocos data-fonte com dado externo ficam fora, como no gate de marca)
 *
 * Rodar: npm test (apos npm run generate ou generate:test)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
// Ponte LEVE das ferramentas (só fs/path): nada de React nem do registro de conteúdo aqui.
import {
  ferramentasRefs, forbiddenHits, htmlAuthorText, PUBLICADAS_PATH, refCandidates, stripExternal, widgetsInsideLinks,
} from './ferramentas/site';
import type { ToolId } from './ferramentas/types';

const ROOT = join(__dirname, '..');
const REQUIRED_CTA_PATH = '/authnew';
const APP_DOMAIN = 'app.brasilhorizonte.com.br';

interface Issue {
  file: string;
  rule: string;
  detail: string;
}

const issues: Issue[] = [];

/**
 * Defeitos JÁ CONHECIDOS, com dono e prazo. Não é perdão: é a diferença entre um gate
 * que diz "alguém quebrou algo AGORA" e um que vive vermelho e por isso não é lido.
 *
 * ⚠️ Entrada aqui é dívida datada, não exceção permanente. Some da lista quando a tarefa
 * fechar — e, se a tarefa morrer, o defeito volta a reprovar, que é o comportamento certo.
 */
// ⚠️ Vazio de propósito. A única entrada que existiu aqui suprimia `tracking-variables`
// nas calculadoras com o diagnóstico ERRADO: elas nunca tiveram ReferenceError — `_iaD`
// é declarado com `var`, no mesmo <script> e antes do uso. Quem estava quebrado era o
// GATE, que comparava a grafia minificada da IIFE. Suprimir um alarme sem confirmar a
// causa custou um item de bloqueio no runbook e escondeu o defeito real por semanas:
// antes de acrescentar linha aqui, prove o problema no arquivo, não no relatório.
const KNOWN_BROKEN: Array<{ file: RegExp; rule: string; motivo: string }> = [];

const suprimidos: Issue[] = [];

function addIssue(file: string, rule: string, detail: string) {
  const conhecido = KNOWN_BROKEN.find((k) => k.file.test(file) && k.rule === rule);
  if (conhecido) { suprimidos.push({ file, rule, detail }); return; }
  issues.push({ file, rule, detail });
}

// ── Coleta de arquivos HTML gerados ──────────────────────────────

/**
 * Pastas que nunca contêm página publicada. Tudo o mais é varrido.
 *
 * ⚠️ A versão anterior ENUMERAVA o que validar: pasta de ticker casando
 * `^[A-Z]{4}\d{1,2}$`, a landing, /acoes/ e os setores. Com isso, 7 das 359 páginas
 * nunca eram validadas — `airton/`, as 4 calculadoras e, silenciosamente, `B3SA3/`,
 * cujo radical tem um dígito no meio e não casa o regex. Justamente a página do AIrton
 * era a mais desatualizada do site (prometia um trial de 14 dias que não existe mais).
 * Lista de EXCLUSÃO em vez de lista de inclusão: página nova entra no gate sozinha.
 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'scripts', 'assets', '_bmad', '_bmad-output']);

/** Glob do .gitignore → regex (`*`, `?` e `**`), sem âncoras. */
function globToRegex(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return out;
}

/**
 * O que o .gitignore da raiz ignora (`rel` com '/', relativo à raiz). Cobre o que o arquivo usa:
 * comentário, `!` (reinclui), `dir/` (só pasta), padrão com '/' (ancorado na raiz) e sem '/' (casa
 * o nome em qualquer nível), `*`, `?` e `**`. Como no git, a última regra que casa decide.
 */
export function gitignoreMatcher(text: string): (rel: string, isDir: boolean) => boolean {
  const rules: { re: RegExp; neg: boolean; dirOnly: boolean; anchored: boolean }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    const neg = line.startsWith('!');
    if (neg) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.replace(/\/+$/, '');
    const anchored = line.includes('/');
    line = line.replace(/^\/+/, '');
    if (line) rules.push({ re: new RegExp(`^${globToRegex(line)}$`), neg, dirOnly, anchored });
  }
  return (rel, isDir) => {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    let ignored = false;
    for (const r of rules) {
      if (r.dirOnly && !isDir) continue;
      if (r.re.test(r.anchored ? rel : base)) ignored = !r.neg;
    }
    return ignored;
  };
}

/** Matcher do .gitignore de `root` (sem arquivo: nada ignorado). */
export function gitignoreOf(root: string): (rel: string, isDir: boolean) => boolean {
  try { return gitignoreMatcher(readFileSync(join(root, '.gitignore'), 'utf-8')); } catch { return () => false; }
}

/**
 * Todos os index.html publicáveis de `root`. Fora: pastas que começam com '.', SKIP_DIRS e tudo o
 * que o .gitignore ignora (preview/ das prévias locais, node_modules/, .build/...). O que o git
 * ignora nunca é publicado, então nenhuma regra varre esses diretórios: a prévia de um agente
 * (preview/<id>/, com bundle e links de produção simulados) não pode reprovar o gate do site.
 */
export function collectHTMLFiles(root: string = ROOT, ignored: (rel: string, isDir: boolean) => boolean = gitignoreOf(root)): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      const rel = relative(root, full).split(sep).join('/');
      if (ignored(rel, st.isDirectory())) continue;
      if (st.isDirectory()) walk(full);
      else if (entry === 'index.html') files.push(full);
    }
  };

  // ⚠️ Nada de `files.push(landing)` aqui: `walk(root)` já varre a raiz e acha o
  // index.html dela. O push extra validava a landing DUAS vezes (360 coletados para 359
  // arquivos) e reportava em dobro cada issue justamente da página mais importante.
  walk(root);

  return files;
}

// ── Regras de validacao ──────────────────────────────────────────

/** Página que só redireciona (canonical + meta refresh no <head>), como os setores legados e ELET3. */
const isRedirectStub = (html: string): boolean => html.slice(0, 2048).includes('http-equiv="refresh"');

/**
 * RULE: regex-escaping
 * Detecta regexes quebradas por template literals que engolem backslashes.
 * Ex: /Edg\//i no template vira /Edg//i no output — JS interpreta como
 * divisao, causando ReferenceError e matando tracking + CTAs.
 */
function checkRegexEscaping(file: string, html: string) {
  // Pattern: /Something//flags.test — indica regex com barra duplicada
  // que deveria ser /Something\//flags.test
  const brokenRegex = /\/[A-Za-z|]+\/\/[a-z]\.test/g;
  let match: RegExpExecArray | null;
  while ((match = brokenRegex.exec(html)) !== null) {
    addIssue(file, 'regex-escaping', `Regex quebrada encontrada: "${match[0]}" — backslash perdido no template literal`);
  }

  // Pattern: replace(//  — indica regex replace com barra duplicada no inicio
  const brokenReplace = /\.replace\(\/\//g;
  while ((match = brokenReplace.exec(html)) !== null) {
    addIssue(file, 'regex-escaping', `Regex replace quebrada: .replace(// — deveria ser .replace(/\\/ `);
  }
}

/**
 * RULE: cta-links
 * Todos os links para app.brasilhorizonte.com.br devem apontar para /authnew.
 * Links para o dominio raiz sem /authnew nao levam a criacao de conta.
 */
function checkCTALinks(file: string, html: string) {
  const linkPattern = /href="https?:\/\/app\.brasilhorizonte\.com\.br([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1];
    if (!path.startsWith(REQUIRED_CTA_PATH)) {
      addIssue(file, 'cta-links', `CTA link aponta para "${APP_DOMAIN}${path}" — deveria incluir ${REQUIRED_CTA_PATH}`);
    }
  }
}

/**
 * RULE: tracking-functions
 * As funcoes _iaTrack e _iaClick devem estar presentes em ticker pages e index.
 * Se um SyntaxError no script matar a definicao, os CTAs ficam mortos
 * (preventDefault sem redirect).
 * Sector pages nao tem tracking inline — so ticker pages e /acoes/index.html.
 */
function checkTrackingFunctions(file: string, html: string) {
  // Sector pages (acoes/energia/, acoes/saude/, etc.) nao tem tracking script
  const isSectorPage = /^acoes\/[^/]+\/index\.html$/.test(file) && file !== 'acoes/index.html';
  if (isSectorPage) return;
  // Redirect (ticker que mudou de código, ex.: ELET3 → AXIA3): só canonical + meta refresh, sem CTA.
  if (isRedirectStub(html)) return;

  if (!html.includes('function _iaTrack(')) {
    addIssue(file, 'tracking-functions', '_iaTrack nao encontrada no HTML');
  }
  if (!html.includes('function _iaClick(')) {
    addIssue(file, 'tracking-functions', '_iaClick nao encontrada no HTML');
  }
}

/**
 * RULE: tracking-variables
 * As variaveis de contexto (_iaD, _iaS) devem ser definidas antes do uso.
 * Se _iaD for undefined, _iaTrack crasha em _iaD.dt e o redirect nunca roda.
 */
function checkTrackingVariables(file: string, html: string) {
  const uso = html.indexOf('_iaD.dt');
  if (uso === -1) return;

  // ⚠️ A versão anterior comparava a STRING LITERAL `_iaD=(function()` e acusava as 4
  // calculadoras, que são formatadas (`_iaD = (function () {`) em vez de minificadas
  // como as páginas de ticker. O `_iaD` delas sempre esteve definido, com `var`, no
  // mesmo <script> e antes do uso — era falso positivo, e ficou meses suprimido em
  // KNOWN_BROKEN com o diagnóstico errado ("ReferenceError em runtime"). Detectar por
  // FORMA, não por grafia: o minificador é livre para pôr ou tirar espaço.
  const iife = /_iaD\s*=\s*\(\s*function\s*\(/;
  const def = html.search(iife);
  if (def === -1) {
    addIssue(file, 'tracking-variables', '_iaD.dt usado mas _iaD IIFE nao encontrada');
    return;
  }
  if (def > uso) {
    addIssue(file, 'tracking-variables', '_iaD definido DEPOIS do primeiro uso em _iaD.dt');
  }

  // ⚠️ NÃO checar aqui se `_iaD` é declarado com var/let/const. Foi tentado em
  // 18/09/2026 e acusou 336 páginas de produção que estão CORRETAS: no HTML de ticker
  // o tracking é minificado numa linha só, e a IIFE do `_iaS`, logo antes, contém `;`
  // e `}` dentro dela. Qualquer heurística de "corta no último delimitador" cai no
  // meio dessa função aninhada e conclui que falta `var` onde existe
  // `var _iaB=…,_iaS=…,_iaD=…`. Descobrir o escopo de uma atribuição exige parser de
  // JavaScript, não casamento de string — e um gate que grita em 336 arquivos bons é
  // pior que gate nenhum, porque ensina a ignorar a saída.
}

/**
 * RULE: onclick-without-href
 * Links com onclick="_iaClick(event)" DEVEM ter href valido.
 * _iaClick faz preventDefault + redirect via href, sem href o redirect falha.
 */
function checkOnclickHref(file: string, html: string) {
  const onclickLinks = /href="([^"]*)"[^>]*onclick="_iaClick\(event\)"/g;
  let match: RegExpExecArray | null;
  while ((match = onclickLinks.exec(html)) !== null) {
    const href = match[1];
    if (!href || href === '#' || href === '') {
      addIssue(file, 'onclick-without-href', `Link com _iaClick mas href vazio ou "#": "${href}"`);
    }
  }
}

/**
 * RULE: onclick-without-function
 * Paginas que usam onclick="_iaClick(event)" DEVEM definir _iaClick.
 * Senao o clique gera ReferenceError e o link morre.
 */
function checkOnclickWithoutFunction(file: string, html: string) {
  if (html.includes('_iaClick(event)') && !html.includes('function _iaClick(')) {
    addIssue(file, 'onclick-without-function', 'Usa onclick="_iaClick(event)" mas nao define _iaClick — link morto');
  }
}

/**
 * RULE: utm-injection
 * _iaClick deve injetar utm_source/utm_medium/utm_campaign/utm_content na URL
 * de destino. Sem isso, GA4 e usage_events classificam o trafego do iacoes
 * como "direct"/"referral" e perdemos atribuicao da campanha.
 * Sector pages nao tem _iaClick — so ticker pages, /acoes/index.html e landing.
 */
function checkUTMInjection(file: string, html: string) {
  const isSectorPage = /^acoes\/[^/]+\/index\.html$/.test(file) && file !== 'acoes/index.html';
  if (isSectorPage) return;
  if (!html.includes('function _iaClick(')) return; // outra regra ja reclama

  if (!html.includes("set('utm_source'") || !html.includes("set('utm_campaign'")) {
    addIssue(file, 'utm-injection', '_iaClick nao injeta utm_source/utm_campaign — CTAs sem atribuicao');
  }
}

/**
 * RULE: js-syntax-basic
 * Detecta padroes de JavaScript invalido comuns em output de template literals.
 */
function checkJSSyntax(file: string, html: string) {
  // Detecta var assignments seguidos de undefined references comuns
  // Pattern: divisao acidental por variavel (resultado de regex quebrada)
  const accidentalDivision = /\)br='[^']*';/g;
  // Nao e um check direto, mas os outros rules pegam

  // Detecta string nao terminada em JSON.stringify output
  const brokenStringify = /JSON\.stringify\(\{[^}]*\n/;
  if (brokenStringify.test(html)) {
    addIssue(file, 'js-syntax', 'Possivel JSON.stringify quebrado (multiline inesperado)');
  }
}

/**
 * RULE: marca-aposentada
 *
 * Os planos IAnalista e IAlocador fundiram-se em IAções, e o teste grátis passou de 14
 * para 7 dias. O site é a porta de entrada: uma página que ainda venda o plano antigo
 * manda a pessoa para um checkout com outro nome, e uma que prometa 14 dias entrega 7.
 *
 * ⚠️ Vale para o TEXTO VISÍVEL e para o `application/ld+json`. O FAQPage e o Product do
 * schema.org são o que o Google exibe como rich result — a página do AIrton dizia
 * "14 dias" 18 vezes, METADE delas dentro do JSON-LD. Corrigir só o que se lê deixaria
 * o buscador anunciando um trial que não existe.
 *
 * ⚠️ NÃO procure preço aqui. Nas páginas de ticker, "19,90" e "39,90" são cotação e
 * receita ("R$ 19,90 B"), não plano — uma regra por número acusaria demonstrativo.
 *
 * ⚠️ Só TEXTO AUTORAL (SPEC-v2 §E1): no HTML, os blocos com dado externo (resumo e título da
 * CVM, nome de empresa) saem marcados com data-fonte="cvm" | "b3" e ficam fora do gate. Em 365
 * dias, 4 resumos reais da CVM tinham "14 dias": sem a marcação, o dia em que um deles entrasse
 * na página de fatos derrubaria o build do site inteiro. Fontes (.ts/.tsx/.js) são sempre autorais.
 */
const MARCA_APOSENTADA: Array<[RegExp, string]> = [
  [/IAnalista/g, 'o plano IAnalista virou IAções'],
  [/IAlocador/g, 'o plano IAlocador virou IAções'],
  [/14 dias/g, 'o teste grátis é de 7 dias, não 14'],
];

/** Ocorrências da marca aposentada num texto (puro: os testes usam). */
export function marcaHits(texto: string): string[] {
  const out: string[] = [];
  for (const [re, porque] of MARCA_APOSENTADA) {
    const n = (texto.match(re) || []).length;
    if (n > 0) out.push(`${n}× — ${porque}`);
  }
  return out;
}

function checkMarcaAposentada(file: string, texto: string) {
  for (const msg of marcaHits(texto)) addIssue(file, 'marca-aposentada', msg);
}

/**
 * RULE: ferramentas-links (SPEC-v2 §E2)
 *
 * Todo href/src/data-src="/ferramentas/..." de QUALQUER página (a landing escrita à mão inclusive,
 * e também os literais no JS inline dela) tem de existir no disco. A landing linka as páginas das
 * ferramentas; uma ferramenta ainda em rascunho não é escrita na raiz, então o link daria 404.
 * Link condicional (só quando a página está no ar) sai do /ferramentas/publicadas.json, nunca de
 * literal. ⚠️ Num checkout sem o hub gerado na raiz, os links da landing para /ferramentas/
 * reprovam até a geração (npm run generate): é o aviso certo antes de publicar.
 */
export function ferramentasLinkProblems(html: string, exists: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of ferramentasRefs(html)) {
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    const cands = refCandidates(r.path);
    if (cands.some(exists)) continue;
    const why = r.path === '/ferramentas/'
      ? 'o hub é escrito por generateFerramentas: gere antes de publicar (npm run generate)'
      : 'ferramenta em rascunho ou não gerada: linke só o que está no ar (site.ts toolPageExists / publicadas.json)';
    out.push(`${r.attr}="${r.url}" aponta para ${cands[0]}, que não existe no disco — ${why}`);
  }
  return out;
}

/** RULE: widget-em-link (SPEC-v2 §E6) — nenhum <a> envolve quadro de widget (botões e abas dentro de link). */
export function widgetInLinkProblems(html: string): string[] {
  return widgetsInsideLinks(html).map((id) => `widget "${id}" dentro de <a>: o link da ferramenta fica fora do quadro`);
}

/**
 * RULE: ferramentas-bundle — todo /assets/{js,css}/ferramentas*.{js,css}?v= carregado existe no disco
 * (src/href e o data-bundle da landing, que injeta o script quando a seção chega perto da tela).
 */
export function bundleRefProblems(html: string, exists: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const re = /\b(?:src|href|data-bundle)="(\/(?:[^"?#\s]*\/)?assets\/(?:js|css)\/ferramentas(?:-[a-z0-9]+)?\.(?:js|css))\?v=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const rel = m[1].replace(/^\/+/, '');
    if (!exists(rel)) out.push(`carrega ${m[1]} (bundle dos widgets), que não existe`);
  }
  return out;
}

/**
 * RULE: macro-page (só AVISO, nunca derruba o build)
 *
 * A página /macro/indicador-de-buffett/ depende de dado do dashbrasilhorizonte. Se esse
 * pipeline parar, falhar aqui impediria o commit de TODAS as páginas do site — por isso
 * o problema vira ::warning:: no log do CI e a página anterior segue no ar. As checagens
 * de dado (frescor, faixa) moram em scripts/macro/index.ts, antes de escrever o HTML.
 */
function checkMacroPage() {
  const dir = join(ROOT, 'macro', 'indicador-de-buffett');
  const page = join(dir, 'index.html');
  if (!existsSync(page)) return; // trava desligada: nada a checar
  const warn = (m: string) => console.warn(`::warning title=Página macro::${m}`);
  const html = readFileSync(page, 'utf-8');
  if (!existsSync(join(dir, 'indicador-buffett-brasil.csv'))) warn('CSV do Dataset ausente (indicador-buffett-brasil.csv)');
  if (!existsSync(join(ROOT, 'macro', 'index.html'))) warn('hub /macro/ ausente: o breadcrumb apontaria para 404');
  if (!html.includes('data-cta="macro-buffett"')) warn('CTA macro-buffett ausente');
  if (!html.includes('"@type":"Dataset"')) warn('JSON-LD Dataset ausente');
  const ref = /data-ref-date="(\d{4}-\d{2}-\d{2})"/.exec(html)?.[1];
  if (!ref) warn('data-ref-date ausente no <main>');
  else {
    const days = (Date.now() - Date.parse(`${ref}T00:00:00Z`)) / 86400000;
    if (days > 7) warn(`fechamento oficial da página é de ${ref} (${Math.floor(days)} dias): pipeline da B3 parado?`);
  }
}

/** Única página de ferramenta que pode declarar preço 0 / grátis no JSON-LD (SPEC-v2 §D). */
const CALC_SLUG = 'calculadora-preco-justo';

/** Todos os objetos (com @type) de um JSON-LD, inclusive aninhados. */
function ldNodes(v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(v)) v.forEach((x) => ldNodes(x, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('@type' in o) out.push(o);
    for (const x of Object.values(o)) ldNodes(x, out);
  }
  return out;
}

/**
 * Problemas de UMA página /ferramentas/ (slug '' = hub). Puro: os testes rodam o mesmo código
 * sobre a saída do gerador.
 */
export function toolPageProblems(slug: string, html: string): string[] {
  const p: string[] = [];
  const expected = `https://iacoes.com.br/ferramentas/${slug ? `${slug}/` : ''}`;
  const canon = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  if (canon !== expected) p.push(`canonical ${canon ?? 'ausente'} (esperado ${expected})`);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) p.push(`${h1} <h1> na página (esperado 1)`);
  if (/<meta name="robots" content="noindex/.test(html)) p.push('página em rascunho (noindex) na raiz do site: rascunho só existe na prévia');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) p.push('sem JSON-LD');
  let faqQuestions = -1;
  const nodes: Record<string, unknown>[] = [];
  for (const b of blocks) {
    try {
      const o = JSON.parse(b);
      if (o['@type'] === 'FAQPage') faqQuestions = Array.isArray(o.mainEntity) ? o.mainEntity.length : 0;
      ldNodes(o, nodes);
    } catch (e) {
      p.push(`JSON-LD que não faz parse: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // SPEC-v2 §D: offers/isAccessibleForFree e WebApplication só na calculadora (grátis no site).
  const free = nodes.filter((n) => n['@type'] === 'WebApplication' || 'offers' in n || 'isAccessibleForFree' in n);
  if (slug !== CALC_SLUG && free.length) p.push(`JSON-LD declara aplicação/oferta grátis (${free.map((n) => n['@type']).join(', ')}): só a calculadora pode (SPEC-v2 §D)`);
  if (slug === CALC_SLUG && !nodes.some((n) => n['@type'] === 'WebApplication' && (n.offers as { price?: unknown } | undefined)?.price === '0')) p.push('calculadora sem WebApplication com offers price 0');
  for (const list of nodes.filter((n) => n['@type'] === 'ItemList')) {
    const items = Array.isArray(list.itemListElement) ? (list.itemListElement as { url?: unknown }[]) : [];
    for (const it of items) if (typeof it.url !== 'string' || !it.url.startsWith('https://iacoes.com.br/')) p.push(`ItemList com URL fora do site: ${String(it.url)}`);
  }
  if (!/href="https:\/\/app\.brasilhorizonte\.com\.br\/authnew[^"]*"[^>]*data-cta="/.test(html)) p.push('nenhum CTA para /authnew com data-cta');
  if (slug) {
    const faqHtml = (html.split('id="faq"')[1] || '').split('</section>')[0];
    const details = (faqHtml.match(/<details/g) || []).length;
    if (details === 0 || details !== faqQuestions) p.push(`FAQ visível com ${details} pergunta(s) e FAQPage com ${faqQuestions}`);
  }
  // Texto autoral (sem os blocos data-fonte): o HTML sai de código, então termo proibido é bug de conteúdo.
  const general = forbiddenHits(htmlAuthorText(html), 'page');
  for (const hit of general) p.push(`termo proibido no texto autoral: ${hit}`);
  // Regras próprias da ferramenta (ex.: o ranking nunca diz "baratas" nem "oportunidades") valem no
  // conteúdo dela, seções SSR inclusive — o conteúdo de content/<id>.ts já é conferido nos testes,
  // o HTML das seções não. "Outras ferramentas" fica de fora: lá "Radar de oportunidades" é nome
  // de outra ferramenta.
  const tool = /<main\b[^>]*\sdata-tool="([a-z]+)"/.exec(html)?.[1] as ToolId | undefined;
  if (tool) {
    const main = (html.split(/<main\b/)[1] || '').split('id="outras-ferramentas"')[0];
    for (const hit of forbiddenHits(htmlAuthorText(`<main${main}`), tool)) if (!general.includes(hit)) p.push(`termo proibido no texto autoral (regra de ${tool}): ${hit}`);
  }
  if (/href="\/#precos"/.test(html)) p.push('link para /#precos (SPEC-v2 §B2: página de ferramenta não linka a tabela de planos)');
  return p;
}

/**
 * RULE: ferramentas (páginas /ferramentas/, scripts/ferramentas)
 *
 * Checagem leve e DETERMINÍSTICA (reprova): o HTML sai de código, e o dado externo vem marcado
 * (data-fonte), então defeito aqui é bug de template ou de conteúdo. Hub presente, canonical
 * igual ao caminho, um <h1>, JSON-LD que faz parse e com o tipo certo (§D), FAQ visível com o
 * mesmo número de perguntas do FAQPage, CTA para /authnew com data-cta, nenhum rascunho
 * (noindex) na raiz, nenhum termo proibido no texto autoral e o publicadas.json batendo com o
 * disco. Frescor dos dados.json (ranking e fatos relevantes) só AVISA, no molde do checkMacroPage.
 */
function checkToolPages() {
  const base = join(ROOT, 'ferramentas');
  if (!existsSync(base)) return;
  const hub = join(base, 'index.html');
  const pages = readdirSync(base).filter((d) => !d.startsWith('.') && existsSync(join(base, d, 'index.html')));
  if (pages.length && !existsSync(hub)) addIssue('ferramentas/index.html', 'ferramentas', 'hub ausente: o breadcrumb das ferramentas apontaria para 404');

  const files: [string, string, string][] = [
    ...(existsSync(hub) ? [['ferramentas/index.html', hub, ''] as [string, string, string]] : []),
    ...pages.map((d) => [`ferramentas/${d}/index.html`, join(base, d, 'index.html'), d] as [string, string, string]),
  ];
  for (const [rel, file, slug] of files) {
    for (const msg of toolPageProblems(slug, readFileSync(file, 'utf-8'))) addIssue(rel, 'ferramentas', msg);
  }

  // publicadas.json: o que a landing lê para ligar um quadro tem de bater com o disco.
  const pubFile = join(ROOT, PUBLICADAS_PATH);
  const pubRel = PUBLICADAS_PATH.replace(/^\//, '');
  if (pages.length && !existsSync(pubFile)) addIssue(pubRel, 'ferramentas', 'publicadas.json ausente (o gerador escreve a cada build)');
  if (existsSync(pubFile)) {
    try {
      const pub = JSON.parse(readFileSync(pubFile, 'utf-8')) as { ids?: unknown; tools?: { id?: unknown; path?: unknown }[] };
      const tools = Array.isArray(pub.tools) ? pub.tools : [];
      const ids = Array.isArray(pub.ids) ? pub.ids : [];
      if (JSON.stringify(ids) !== JSON.stringify(tools.map((t) => t.id))) addIssue(pubRel, 'ferramentas', 'ids diferentes da lista de ferramentas');
      for (const t of tools) {
        const path = typeof t.path === 'string' ? t.path : '';
        if (!path.startsWith('/ferramentas/') || !refCandidates(path).some((c) => existsSync(join(ROOT, c)))) addIssue(pubRel, 'ferramentas', `ferramenta ${String(t.id)} publicada em ${path || '?'}, que não existe no disco`);
      }
    } catch {
      addIssue(pubRel, 'ferramentas', 'JSON inválido');
    }
  }

  const warn = (m: string) => console.warn(`::warning title=Ferramentas::${m}`);
  // Backtest: `updated` é o fim do último mês COMPLETO (até ~31 dias de idade é o normal).
  for (const [path, key, label, maxDays] of [
    ['ferramentas/ranking-de-acoes/dados.json', 'date', 'ranking', 7],
    ['ferramentas/fatos-relevantes/dados.json', 'updated', 'fatos relevantes', 7],
    ['ferramentas/backtest-de-carteira/dados.json', 'updated', 'backtest (Ibovespa × CDI)', 70],
  ] as const) {
    const file = join(ROOT, path);
    if (!existsSync(file)) continue;
    try {
      const ref = String(JSON.parse(readFileSync(file, 'utf-8'))[key] || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ref)) { warn(`${path}: sem data (${key})`); continue; }
      const days = (Date.now() - Date.parse(`${ref}T12:00:00Z`)) / 86400000;
      if (days > maxDays) warn(`${label}: dado de ${ref} (${Math.floor(days)} dias) — fonte parada?`);
    } catch {
      warn(`${path}: JSON inválido`);
    }
  }
}

// ── Runner ───────────────────────────────────────────────────────

function main() {
  console.log('\n🧪 Validando paginas HTML geradas...\n');

  const files = collectHTMLFiles();

  if (files.length === 0) {
    console.error('❌ Nenhum arquivo HTML encontrado. Rode npm run generate primeiro.');
    process.exit(1);
  }

  console.log(`📋 ${files.length} arquivos encontrados\n`);

  let checked = 0;
  const onDisk = (rel: string) => existsSync(join(ROOT, rel));
  for (const file of files) {
    const html = readFileSync(file, 'utf-8');
    // relative + '/' fixo: no Windows o caminho vem com '\' e as regras que casam 'acoes/...' erravam.
    const relPath = relative(ROOT, file).split(sep).join('/');

    checkRegexEscaping(relPath, html);
    checkCTALinks(relPath, html);
    checkTrackingFunctions(relPath, html);
    checkTrackingVariables(relPath, html);
    checkOnclickHref(relPath, html);
    checkOnclickWithoutFunction(relPath, html);
    checkUTMInjection(relPath, html);
    checkJSSyntax(relPath, html);
    // Só texto autoral: blocos data-fonte (resumo/título da CVM, nome de empresa) ficam fora (§E1).
    checkMarcaAposentada(relPath, stripExternal(html));
    // A prévia local (preview/, gitignored) nem é coletada: ela simula páginas da raiz e linka
    // caminhos de produção, então nenhuma regra vale para ela (collectHTMLFiles).
    for (const msg of ferramentasLinkProblems(html, onDisk)) addIssue(relPath, 'ferramentas-links', msg);
    for (const msg of widgetInLinkProblems(html)) addIssue(relPath, 'widget-em-link', msg);
    for (const msg of bundleRefProblems(html, onDisk)) addIssue(relPath, 'ferramentas-bundle', msg);

    checked++;
  }

  // ⚠️ O template é a CAUSA: 352 das 359 páginas saem dele, e o cron
  // `generate-pages.yml` as reescreve todo dia útil às 20:00 BRT. Acusar só o HTML
  // gerado daria o alarme um dia DEPOIS de alguém reintroduzir a marca velha — e a
  // correção no HTML seria desfeita pelo robô na madrugada seguinte.
  const template = join(ROOT, 'scripts', 'template.ts');
  try {
    checkMarcaAposentada('scripts/template.ts', readFileSync(template, 'utf-8'));
    checked++;
  } catch {
    addIssue('scripts/template.ts', 'marca-aposentada', 'template não encontrado — o gate da causa não rodou');
  }

  // Desde out/2026 as páginas de ticker saem de scripts/ticker/ (React + shadcn): a
  // CAUSA agora mora lá, então o gate da marca também varre esses fontes.
  const tickerSrc = join(ROOT, 'scripts', 'ticker');
  const ignored = gitignoreOf(ROOT);   // .build/ e afins: o que o git ignora não é fonte publicada
  const walkSrc = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e.startsWith('.')) continue;
      const full = join(dir, e);
      const rel = relative(ROOT, full).split(sep).join('/');
      const isDir = statSync(full).isDirectory();
      if (ignored(rel, isDir)) continue;
      if (isDir) walkSrc(full);
      else if (/\.(tsx?|js|html|css)$/.test(e)) {
        checkMarcaAposentada(rel, readFileSync(full, 'utf-8'));
        checked++;
      }
    }
  };
  try { walkSrc(tickerSrc); } catch {
    addIssue('scripts/ticker', 'marca-aposentada', 'fontes das páginas de ticker não encontrados — o gate da causa não rodou');
  }
  // As páginas macro (scripts/macro/) também são causa: mesmo gate.
  try { walkSrc(join(ROOT, 'scripts', 'macro')); } catch {
    addIssue('scripts/macro', 'marca-aposentada', 'fontes das páginas macro não encontrados — o gate da causa não rodou');
  }
  // Ferramentas (scripts/ferramentas/: conteúdo, páginas e widgets do bundle) e o template das
  // páginas /airton/{TICKER}/ também são causa: mesmo gate.
  try { walkSrc(join(ROOT, 'scripts', 'ferramentas')); } catch {
    addIssue('scripts/ferramentas', 'marca-aposentada', 'fontes das ferramentas não encontrados — o gate da causa não rodou');
  }
  try {
    checkMarcaAposentada('scripts/airton-template.ts', readFileSync(join(ROOT, 'scripts', 'airton-template.ts'), 'utf-8'));
    checked++;
  } catch {
    addIssue('scripts/airton-template.ts', 'marca-aposentada', 'template do /airton/{TICKER}/ não encontrado — o gate da causa não rodou');
  }

  checkMacroPage();
  checkToolPages();

  // ── Resultado ──

  // `checked` conta as páginas MAIS o template — dizer só "N arquivos" fazia o número
  // final sair maior que o de "arquivos encontrados", o que parece defeito de contagem.
  const resumo = `${files.length} páginas + fontes dos templates`;

  if (suprimidos.length > 0) {
    console.log(`⚠️  ${suprimidos.length} problema(s) conhecido(s) suprimido(s) (KNOWN_BROKEN):`);
    for (const k of KNOWN_BROKEN) {
      const n = suprimidos.filter((s) => k.file.test(s.file) && s.rule === k.rule).length;
      if (n > 0) console.log(`    ${n}× ${k.rule} em ${k.file.source} — ${k.motivo}`);
    }
    console.log();
  }

  if (issues.length === 0) {
    console.log(`✅ ${resumo} validados — zero problemas novos\n`);
    process.exit(0);
  }

  console.log(`❌ ${issues.length} problema(s) encontrado(s) em ${checked} arquivos:\n`);

  // Agrupa por regra
  const byRule = new Map<string, Issue[]>();
  for (const issue of issues) {
    const arr = byRule.get(issue.rule) || [];
    arr.push(issue);
    byRule.set(issue.rule, arr);
  }

  for (const [rule, ruleIssues] of byRule) {
    console.log(`  ── ${rule} (${ruleIssues.length}) ──`);
    // Mostra ate 5 exemplos por regra, depois resume
    const show = ruleIssues.slice(0, 5);
    for (const issue of show) {
      console.log(`    ✗ ${issue.file}: ${issue.detail}`);
    }
    if (ruleIssues.length > 5) {
      console.log(`    ... e mais ${ruleIssues.length - 5} ocorrencias`);
    }
    console.log();
  }

  process.exit(1);
}

// Importado pelos testes (regras puras exportadas acima): só roda como script (npm test).
if (require.main === module) main();
