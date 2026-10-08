import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { pageHeadTracking, withTracks } from '../ticker/render';
import { SITE } from '../ticker/model';
import { BuffettPage, MacroHubPage } from './page';
import { HUB_PATH, PAGE_PATH, type BuffettModel } from './model';

const OG_IMAGE = `${SITE}/assets/img/og-iacoes-v3.png`;
const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'IAções by Brasil Horizonte',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/assets/img/institucional_branco_amarelo_3x.png` },
  sameAs: ['https://br.linkedin.com/company/brasil-horizonte', 'https://x.com/brasilhorizont', 'https://www.instagram.com/brasil.horizonte/', 'https://t.me/brasilhorizonte'],
};

const CSS_OUT = join(__dirname, '.build', 'macro.css');
let cssCache: string | null = null;

/** CSS próprio (scripts/macro/styles.css): mesmos tokens das páginas de ticker, compilado 1x por execução. */
export function buildMacroCss(): void {
  const cli = join(__dirname, '..', '..', 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  execFileSync(process.execPath, [cli, '-i', join(__dirname, 'styles.css'), '-o', CSS_OUT, '--minify'], { stdio: 'pipe' });
  cssCache = null;
}

const pageCss = (): string => {
  if (cssCache) return cssCache;
  if (!existsSync(CSS_OUT)) buildMacroCss();
  return (cssCache = readFileSync(CSS_OUT, 'utf-8'));
};

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
// Mesmo pós-processamento das páginas de ticker: o React não renderiza onclick em string.
// data-cta ganha _iaClick (CTA do app); data-track ganha _iaTrack (link interno, ex.: ranking).
const withClicks = (html: string) => withTracks(html.replace(/ data-cta="/g, ' onclick="_iaClick(event)" data-cta="'));
// Formulário de e-mail do download do CSV (JS puro em arquivo próprio; ver csv-lead.client.js).
const csvLeadScript = (): string => `<script>${readFileSync(join(__dirname, 'csv-lead.client.js'), 'utf-8')}</script>`;

function shell(p: { title: string; description: string; url: string; ogAlt: string; ld: unknown[]; body: string }): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${attr(p.title)}</title>
  <meta name="description" content="${attr(p.description)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="Brasil Horizonte">
  <meta name="theme-color" content="#041c24">
  <link rel="canonical" href="${p.url}">
  <meta property="og:title" content="${attr(p.title.replace(/ \| IAções$/, ''))}">
  <meta property="og:description" content="${attr(p.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${p.url}">
  <meta property="og:site_name" content="IAções — Análise de Ações | Brasil Horizonte">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${attr(p.ogAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(p.title)}">
  <meta name="twitter:description" content="${attr(p.description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=JetBrains+Mono:wght@400..700&display=swap" rel="stylesheet">
  ${p.ld.map(jsonLd).join('\n  ')}
  <style>${pageCss()}</style>
${pageHeadTracking()}
</head>
<body>
${p.body}
</body>
</html>
`;
}

export function renderBuffettPage(m: BuffettModel): string {
  const crumbs = [
    { name: 'IAções', item: `${SITE}/` },
    { name: 'Macro', item: m.hubUrl },
    { name: 'Indicador de Buffett', item: m.url },
  ];
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': m.url,
      url: m.url,
      name: m.seo.title,
      description: m.seo.description,
      inLanguage: 'pt-BR',
      dateModified: m.todayISO,
      isPartOf: { '@type': 'WebSite', name: 'IAções', url: SITE },
      publisher: ORG,
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#buffett-title', '#buffett-resumo'] },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: m.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Indicador de Buffett Brasil (valor de mercado da B3 ÷ PIB)',
      alternateName: ['Buffett Indicator Brazil', 'Indicador Buffett B3'],
      description: `Série mensal do Indicador de Buffett do Brasil desde ${m.s.since}: valor de mercado das empresas listadas na B3 dividido pelo PIB acumulado em 12 meses. Valor de mercado da B3 (oficial desde jul/2026), do Banco Central (SGS 7849) e do Banco Mundial/WFE; PIB do Banco Central (SGS 4382). Atualizada todo dia útil com o último fechamento oficial publicado pela B3; meses estimados marcados no arquivo.`,
      url: m.url,
      identifier: 'iacoes-indicador-buffett-brasil',
      keywords: ['Indicador de Buffett', 'Buffett Indicator', 'valor de mercado da B3', 'PIB', 'bolsa brasileira'],
      creator: ORG,
      publisher: ORG,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      isAccessibleForFree: true,
      temporalCoverage: `${m.stats.first}/${m.h.date}`,
      spatialCoverage: { '@type': 'Place', name: 'Brasil' },
      variableMeasured: [
        { '@type': 'PropertyValue', name: 'Indicador de Buffett', unitText: '%', value: m.h.value },
        { '@type': 'PropertyValue', name: 'Valor de mercado das empresas listadas na B3', unitText: 'R$ milhões', value: m.h.mcapMM },
        { '@type': 'PropertyValue', name: 'PIB acumulado em 12 meses', unitText: 'R$ milhões', value: m.h.pibMM },
      ],
      measurementTechnique: 'Valor de mercado das empresas listadas na B3 (TOTAL GERAL) ÷ PIB acumulado em 12 meses (BCB SGS 4382) × 100',
      dateModified: m.todayISO,
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: m.csvUrl }],
    },
  ];
  return shell({
    title: m.seo.title,
    description: m.seo.description,
    url: m.url,
    ogAlt: `Indicador de Buffett do Brasil: ${m.vShort}% do PIB | IAções`,
    ld,
    body: `${withClicks(renderToStaticMarkup(<BuffettPage m={m} />))}\n${csvLeadScript()}`,
  });
}

export function renderMacroHub(m: BuffettModel): string {
  const title = 'Indicadores Macro da Bolsa Brasileira | IAções';
  const description = `Termômetros do mercado de ações brasileiro com dado oficial: Indicador de Buffett hoje em ${m.vShort}% do PIB (${m.dateBR}).`;
  return shell({
    title,
    description,
    url: m.hubUrl,
    ogAlt: 'Indicadores macro da bolsa brasileira | IAções',
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'IAções', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Macro', item: `${SITE}${HUB_PATH}` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE}${HUB_PATH}`,
        name: title,
        description,
        inLanguage: 'pt-BR',
        hasPart: [{ '@type': 'WebPage', url: `${SITE}${PAGE_PATH}`, name: 'Indicador de Buffett Brasil' }],
      },
    ],
    body: withClicks(renderToStaticMarkup(<MacroHubPage m={m} />)),
  });
}
