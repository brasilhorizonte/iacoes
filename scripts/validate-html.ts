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

function collectHTMLFiles(): string[] {
  const files: string[] = [];

  // Ticker pages (UPPERCASE dirs like PETR4/, VALE3/)
  for (const entry of readdirSync(ROOT)) {
    if (/^[A-Z]{4}\d{1,2}$/.test(entry)) {
      const html = join(ROOT, entry, 'index.html');
      try { statSync(html); files.push(html); } catch {}
    }
  }

  // Index page
  const indexHtml = join(ROOT, 'acoes', 'index.html');
  try { statSync(indexHtml); files.push(indexHtml); } catch {}

  // Sector pages
  const acoesDir = join(ROOT, 'acoes');
  try {
    for (const entry of readdirSync(acoesDir)) {
      if (entry === 'index.html') continue;
      const html = join(acoesDir, entry, 'index.html');
      try { statSync(html); files.push(html); } catch {}
    }
  } catch {}

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
    checkJSSyntax(relPath, html);

    checked++;
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
