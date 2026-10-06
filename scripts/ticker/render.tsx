import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import type { FinancialData, ComprehensiveValuation, TickerIndexEntry, CvmDocument } from '../types';
import { buildModel, SITE, type TickerModel } from './model';
import { TickerPage } from './page';

const DIR = __dirname;
const CSS_OUT = join(DIR, '.build', 'ticker.css');

/**
 * Compila o Tailwind (tokens shadcn) uma vez por execução do gerador.
 * O CSS sai inline em cada página: elas continuam self-contained, sem request extra.
 */
export function buildTickerCss(): void {
  const cli = join(DIR, '..', '..', 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  execFileSync(process.execPath, [cli, '-i', join(DIR, 'styles.css'), '-o', CSS_OUT, '--minify'], { stdio: 'pipe' });
}

let cssCache: string | null = null;
let headCache: string | null = null;
let clientCache: string | null = null;

const css = () => {
  if (cssCache) return cssCache;
  if (!existsSync(CSS_OUT)) buildTickerCss();
  return (cssCache = readFileSync(CSS_OUT, 'utf-8'));
};
// GA4 + Meta Pixel + tracking Supabase (_iaTrack/_iaClick). Arquivo HTML literal,
// copiado byte a byte da versão anterior: sem template literal no caminho, nenhum
// backslash de regex é engolido (regra `regex-escaping` do validate-html).
const headTracking = () => (headCache ??= readFileSync(join(DIR, 'head-tracking.html'), 'utf-8'));
const clientJs = () => (clientCache ??= readFileSync(join(DIR, 'client.js'), 'utf-8'));

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function structuredData(m: TickerModel): string {
  const url = `${SITE}/${m.symbol}/`;
  const org = {
    '@type': 'Organization',
    '@id': `${SITE}/#org`,
    name: 'IAções by Brasil Horizonte',
    url: SITE,
    logo: { '@type': 'ImageObject', url: `${SITE}/assets/img/institucional_branco_amarelo_3x.png` },
    sameAs: ['https://br.linkedin.com/company/brasil-horizonte', 'https://x.com/brasilhorizont', 'https://www.instagram.com/brasil.horizonte/', 'https://t.me/brasilhorizonte'],
  };
  const company: Record<string, unknown> = {
    '@type': 'Corporation',
    name: m.name,
    tickerSymbol: `BVMF:${m.symbol}`,
    ...(m.logoUrl ? { logo: m.logoUrl } : {}),
    ...(m.website ? { url: m.website } : {}),
    ...(m.employees ? { numberOfEmployees: { '@type': 'QuantitativeValue', value: m.employees } } : {}),
    ...(m.sector ? { industry: m.sector } : {}),
  };
  const crumbs = [
    { name: 'IAções', item: `${SITE}/` },
    { name: 'Ações', item: `${SITE}/acoes/` },
    ...(m.sector && m.sectorSlug ? [{ name: m.sector, item: `${SITE}/acoes/${m.sectorSlug}/` }] : []),
    { name: m.symbol, item: url },
  ];
  return [
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url,
      url,
      name: m.seo.title,
      description: m.seo.description,
      inLanguage: 'pt-BR',
      dateModified: m.todayISO,
      isPartOf: { '@type': 'WebSite', name: 'IAções', url: SITE },
      publisher: org,
      about: company,
      primaryImageOfPage: m.logoUrl || undefined,
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#ticker-title', '#sobre p'] },
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: m.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }),
  ].join('\n  ');
}

export function renderTickerPage(m: TickerModel): string {
  const url = `${SITE}/${m.symbol}/`;
  const og = `${SITE}/assets/img/og-iacoes-v3.png`;
  // CTAs: o React não renderiza onclick em string, então o atributo entra aqui, logo
  // antes do data-cta (que vem depois do href — regra `onclick-without-href`).
  const body = renderToStaticMarkup(<TickerPage m={m} />).replace(/ data-cta="/g, ' onclick="_iaClick(event)" data-cta="');
  const pageData = { symbol: m.symbol, price: m.price, lpa: m.calc.graham.lpa, vpa: m.calc.graham.vpa };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${attr(m.seo.title)}</title>
  <meta name="description" content="${attr(m.seo.description)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="Brasil Horizonte">
  <meta name="theme-color" content="#041c24">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${attr(m.seo.title)}">
  <meta property="og:description" content="${attr(m.seo.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="IAções — Análise de Ações | Brasil Horizonte">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:image" content="${og}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${attr(`${m.symbol}: preço justo e análise fundamentalista | IAções`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(m.seo.title)}">
  <meta name="twitter:description" content="${attr(m.seo.description)}">
  <meta name="twitter:image" content="${og}">
  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${m.logoUrl ? `<link rel="preconnect" href="${new URL(m.logoUrl).origin}">` : ''}
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=JetBrains+Mono:wght@400..700&display=swap" rel="stylesheet">
  ${structuredData(m)}
  <style>${css()}</style>
${headTracking()}
</head>
<body>
${body}
<script>window.__TK=${JSON.stringify(pageData)};</script>
<script>${clientJs()}</script>
</body>
</html>
`;
}

export function generateTickerPage(data: FinancialData, val: ComprehensiveValuation, all: TickerIndexEntry[], cvmDocs: CvmDocument[]): string {
  return renderTickerPage(buildModel(data, val, all, cvmDocs));
}
