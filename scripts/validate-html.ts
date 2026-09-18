/**
 * validate-html.ts — Validacao pos-geracao das paginas HTML
 *
 * Verifica problemas comuns que ja causaram bugs em producao:
 * - Regexes quebradas por template literals (backslash engolido)
 * - Links de CTA apontando para destinos errados
 * - Funcoes de tracking ausentes ou corrompidas
 *
 * Rodar: npm test (apos npm run generate ou generate:test)
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const REQUIRED_CTA_PATH = '/authnew';
const APP_DOMAIN = 'app.brasilhorizonte.com.br';

interface Issue {
  file: string;
  rule: string;
  detail: string;
}

const issues: Issue[] = [];

function addIssue(file: string, rule: string, detail: string) {
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

function collectHTMLFiles(): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (entry === 'index.html') files.push(full);
    }
  };

  const landing = join(ROOT, 'index.html');
  try { statSync(landing); files.push(landing); } catch {}
  walk(ROOT);

  return files;
}

// ── Regras de validacao ──────────────────────────────────────────

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
  // _iaD deve ser uma IIFE que retorna um objeto com .dt, .br, .os
  if (html.includes('_iaD.dt') && !html.includes('_iaD=(function()')) {
    addIssue(file, 'tracking-variables', '_iaD.dt usado mas _iaD IIFE nao encontrada');
  }
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
 */
const MARCA_APOSENTADA: Array<[RegExp, string]> = [
  [/IAnalista/g, 'o plano IAnalista virou IAções'],
  [/IAlocador/g, 'o plano IAlocador virou IAções'],
  [/14 dias/g, 'o teste grátis é de 7 dias, não 14'],
];

function checkMarcaAposentada(file: string, texto: string) {
  for (const [re, porque] of MARCA_APOSENTADA) {
    const n = (texto.match(re) || []).length;
    if (n > 0) addIssue(file, 'marca-aposentada', `${n}× — ${porque}`);
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
  for (const file of files) {
    const html = readFileSync(file, 'utf-8');
    const relPath = file.replace(ROOT + '/', '');

    checkRegexEscaping(relPath, html);
    checkCTALinks(relPath, html);
    checkTrackingFunctions(relPath, html);
    checkTrackingVariables(relPath, html);
    checkOnclickHref(relPath, html);
    checkOnclickWithoutFunction(relPath, html);
    checkUTMInjection(relPath, html);
    checkJSSyntax(relPath, html);
    checkMarcaAposentada(relPath, html);

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

  // ── Resultado ──

  if (issues.length === 0) {
    console.log(`✅ ${checked} arquivos validados — zero problemas encontrados\n`);
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

main();
