/**
 * Render das páginas /ferramentas/: React SSR + Tailwind v4 compilado inline (como o macro),
 * head tracking compartilhado (o mesmo bloco literal das páginas de ticker), JSON-LD gerado com
 * JSON.stringify e o bundle de widgets carregado com ?v=hash.
 *
 * Ordem obrigatória (SPEC §2 e validate-html): o withClicks roda no HTML do React ANTES de
 * anexar qualquer <script>; todo data-cta fica num <a> com href absoluto para /authnew.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { pageHeadTracking } from '../ticker/render';
import { APP, SITE } from '../ticker/model';
import { HubPage, ToolPage } from './page';
import { HUB_URL, TOOLS, toolUrl } from './registry';
import type { HubModel, ToolPageModel } from './model';

const OG_IMAGE = `${SITE}/assets/img/og-iacoes-v3.png`;
export const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'IAções by Brasil Horizonte',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/assets/img/institucional_branco_amarelo_3x.png` },
  sameAs: ['https://br.linkedin.com/company/brasil-horizonte', 'https://x.com/brasilhorizont', 'https://www.instagram.com/brasil.horizonte/', 'https://t.me/brasilhorizonte'],
};

/** Link genérico do app (hub, sem tela específica). */
export const APP_HOME = `${APP}?ref=iacoes&utm_medium=ferramentas`;

// ─── CSS (compilado 1x por execução) ──────────────────────────────────────

const CSS_OUT = join(__dirname, '.build', 'ferramentas.css');
let cssCache: string | null = null;

export function buildToolsCss(): void {
  const cli = join(__dirname, '..', '..', 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  execFileSync(process.execPath, [cli, '-i', join(__dirname, 'styles.css'), '-o', CSS_OUT, '--minify'], { stdio: 'pipe' });
  cssCache = null;
}

const pageCss = (): string => {
  if (cssCache) return cssCache;
  if (!existsSync(CSS_OUT)) buildToolsCss();
  return (cssCache = readFileSync(CSS_OUT, 'utf-8'));
};

// ─── Helpers de saída ─────────────────────────────────────────────────────

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
/** O React não renderiza onclick em string: o atributo entra aqui, logo antes do data-cta (depois do href). */
export const withClicks = (html: string) => html.replace(/ data-cta="/g, ' onclick="_iaClick(event)" data-cta="');
/** Link interno medido sem redirect e sem UTM (SPEC §2): data-track="id" ganha _iaTrack. */
export const withTracks = (html: string) => html.replace(/ data-track="([a-z0-9-]+)"/g, ` onclick="_iaTrack('cta_click','$1')" data-track="$1"`);

let clientCache: string | null = null;
const pageClient = (): string => `<script>${(clientCache ??= readFileSync(join(__dirname, 'page.client.js'), 'utf-8'))}</script>`;

/**
 * Head tracking. Na PRÉVIA local (basePath ≠ ''), GA4, Meta Pixel e o insert em iacoes_page_views
 * ficam desligados — abrir a prévia não pode sujar a analytics de produção. As funções
 * _iaTrack/_iaClick continuam definidas (o validate-html também varre preview/).
 */
export function headTracking(preview: boolean): string {
  const t = pageHeadTracking();
  if (!preview) return t;
  const steps: [RegExp, string][] = [
    [/<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js[^"]*"><\/script>/, ''],
    [/<script>window\.dataLayer=[\s\S]*?<\/script>/, ''],
    [/<script>\s*var _fbPixelId=[\s\S]*?<\/script>/, ''],
    [/_iaB='https:\/\/[a-z0-9]+\.supabase\.co'/, "_iaB='http://127.0.0.1:9'"],
  ];
  let out = t;
  for (const [re, rep] of steps) {
    if (!re.test(out)) throw new Error(`prévia: trecho de tracking não encontrado (${re.source.slice(0, 40)}…) — head-tracking.html mudou?`);
    out = out.replace(re, rep);
  }
  return `  <!-- prévia local: GA4, Meta Pixel e iacoes_page_views desligados -->\n${out}`;
}

interface ShellProps {
  title: string;
  description: string;
  url: string;
  ogAlt: string;
  ld: unknown[];
  body: string;
  assets: { js: string | null; css: string | null };
  noindex?: boolean;
  /** Prévia local: tracking desligado (ver headTracking). */
  preview?: boolean;
}

function shell(p: ShellProps): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${attr(p.title)}</title>
  <meta name="description" content="${attr(p.description)}">
  <meta name="robots" content="${p.noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large'}">
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
  <meta name="twitter:image:alt" content="${attr(p.ogAlt)}">
  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=JetBrains+Mono:wght@400..700&display=swap" rel="stylesheet">
  ${p.ld.map(jsonLd).join('\n  ')}
  <style>${pageCss()}</style>${p.assets.css ? `\n  <link rel="stylesheet" href="${p.assets.css}">` : ''}${p.assets.js ? `\n  <script src="${p.assets.js}" defer></script>` : ''}
${headTracking(!!p.preview)}
</head>
<body>
${p.body}
${pageClient()}
</body>
</html>
`;
}

const breadcrumb = (items: { name: string; item: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
});

// ─── Página da ferramenta ─────────────────────────────────────────────────

export function toolStructuredData(m: ToolPageModel): unknown[] {
  const t = m.tool;
  const ld: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': m.url,
      url: m.url,
      name: m.title,
      description: m.description,
      inLanguage: 'pt-BR',
      dateModified: m.dateModified,
      isPartOf: { '@type': 'WebSite', name: 'IAções', url: SITE },
      publisher: ORG,
      mainEntity: { '@id': `${m.url}#ferramenta` },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#tool-title', '#tool-resumo'] },
    },
    breadcrumb([
      { name: 'IAções', item: `${SITE}/` },
      { name: 'Ferramentas', item: HUB_URL },
      { name: t.name, item: m.url },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      // A PÁGINA é grátis (o que ela calcula ou demonstra); o plano do app não entra aqui. Com
      // widget ilustrativo, o que é grátis é o guia com a demonstração — e o nome diz isso, para
      // não sugerir que a ferramenta completa do app é gratuita.
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${m.url}#ferramenta`,
      name: t.widget.illustrative ? `${t.name} (guia e demonstração)` : t.name,
      url: m.url,
      description: t.widget.illustrative
        ? `${m.description} A página explica o método com uma demonstração ilustrativa; a ferramenta completa fica na plataforma IAções.`
        : m.description,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requer JavaScript',
      inLanguage: 'pt-BR',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
      publisher: ORG,
    },
  ];
  if (m.itemList.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: m.h1,
      numberOfItems: m.itemList.length,
      itemListElement: m.itemList.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
    });
  }
  return ld;
}

export function renderToolPage(m: ToolPageModel): string {
  const body = withTracks(withClicks(renderToStaticMarkup(<ToolPage m={m} />)));
  return shell({
    title: m.title,
    description: m.description,
    url: m.url,
    ogAlt: `${m.tool.name} | IAções`,
    ld: toolStructuredData(m),
    body,
    assets: m.env.assets,
    noindex: m.draft,
    preview: m.env.basePath !== '',
  });
}

// ─── Hub ──────────────────────────────────────────────────────────────────

export function hubStructuredData(m: HubModel): unknown[] {
  const published = TOOLS.filter((t) => m.env.published.has(t.id) && t.status === 'pronto');
  const abs = (href: string) => `${SITE}${href.replace(m.env.basePath, '')}`;
  return [
    breadcrumb([
      { name: 'IAções', item: `${SITE}/` },
      { name: 'Ferramentas', item: HUB_URL },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': HUB_URL,
      url: HUB_URL,
      name: m.title,
      description: m.description,
      inLanguage: 'pt-BR',
      dateModified: m.dateModified,
      isPartOf: { '@type': 'WebSite', name: 'IAções', url: SITE },
      publisher: ORG,
      hasPart: published.map((t) => ({ '@type': 'WebPage', url: toolUrl(t), name: t.name })),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: m.cards.filter((c) => !c.draft).length,
        itemListElement: m.cards.filter((c) => !c.draft).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, url: abs(c.href) })),
      },
    },
  ];
}

export function renderHub(m: HubModel): string {
  const body = withTracks(withClicks(renderToStaticMarkup(<HubPage m={m} app={APP_HOME} />)));
  return shell({
    title: m.title,
    description: m.description,
    url: m.url,
    ogAlt: 'Ferramentas para analisar ações da B3 | IAções',
    ld: hubStructuredData(m),
    body,
    assets: { js: null, css: null },
    preview: m.env.basePath !== '',
  });
}
