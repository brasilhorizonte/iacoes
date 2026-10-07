import * as React from 'react';
import {
  ArrowRight, Bot, Building2, Calculator, ChartLine, ChartNoAxesCombined, ChartScatter, ClipboardCheck, FileText, Gauge,
  Info, Lightbulb, ListOrdered, Radar, TriangleAlert,
} from 'lucide-react';
import { Container } from '../ticker/components/chrome';
import { ButtonLink } from '../ticker/components/ui/button';
import { Badge } from '../ticker/components/ui/badge';
import { AccordionItem } from '../ticker/components/ui/misc';
import { brl, isoToBR, mult, pct } from '../ticker/lib/format';
import { Autoria, ToolsBreadcrumb, ToolsFooter, ToolsHeader } from './chrome';
import { HUB_PATH, ctaId } from './registry';
import { RANKING_LABELS, rankingRows, resolveHref, termId, type HubModel, type LinkCard, type RenderEnv, type ToolPageModel } from './model';
import { SECTIONS } from './sections';
import type { Block, FatosData, RankingData, RankingKey, Tone, ToolId } from './types';

type LinkEnv = Pick<RenderEnv, 'published' | 'macroPage' | 'basePath' | 'pages'>;

const TOOL_ICONS: Record<ToolId, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  markowitz: ChartScatter,
  backtest: ChartLine,
  fatos: FileText,
  ranking: ListOrdered,
  radar: Radar,
  nota: ClipboardCheck,
  tese: Lightbulb,
  calc: Calculator,
  dcf: ChartNoAxesCombined,
};
const SITE_ICONS: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  '/macro/indicador-de-buffett/': Gauge,
  '/airton/': Bot,
  '/acoes/': Building2,
};

const TONE_BAR: Record<Tone, string> = {
  gold: 'bg-gold',
  emerald: 'bg-positive',
  blue: 'bg-primary',
  teal: 'bg-primary/70',
  purple: 'bg-ink/60',
  red: 'bg-negative',
  neutral: 'bg-muted-foreground/40',
};

/** Texto com `**negrito**` e `[rótulo](/caminho/)`; link para página que não existe vira texto. */
export function Rich({ text, env }: { text: string; env: LinkEnv }) {
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-semibold text-foreground">{m[1]}</strong>);
    else {
      const href = resolveHref(m[3], env);
      out.push(href ? <a key={k++} href={href} className="font-medium text-gold-strong underline-offset-2 hover:underline">{m[2]}</a> : m[2]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Section({ id, title, scroll, children }: { id: string; title: string; scroll?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-4" data-scroll={scroll}>
      <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

// ─── Blocos com dado real ─────────────────────────────────────────────────
// Texto que vem de fora (título e resumo da CVM, nome de empresa, setor da base de mercado) sai
// num elemento com data-fonte="cvm" | "b3" (SPEC-v2 §E1): fica fora das checagens de texto
// autoral (gate de marca do validate-html e termos proibidos). Ticker, rótulos e datas são nossos.

const rankingValue = (k: RankingKey, v: number | null): string =>
  v === null ? '—' : k === 'dy' || k === 'roe' ? pct(v, 1) : mult(v, 2);

export function RankingTable({ d, k, limit, compact }: { d: RankingData; k: RankingKey; limit?: number; compact?: boolean }) {
  const rows = rankingRows(d, k, limit);
  const L = RANKING_LABELS[k];
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-base font-semibold">{L.title}</h3>
        <span className="text-xs text-muted-foreground">Dados de <time dateTime={d.date}>{d.dateBR}</time></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-semibold">#</th>
              <th scope="col" className="px-2 py-2 font-semibold">Ação</th>
              {!compact && <th scope="col" className="hidden px-2 py-2 font-semibold sm:table-cell">Setor</th>}
              <th scope="col" className="px-2 py-2 text-right font-semibold">Cotação</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">{L.tab}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.t} className="border-t">
                <td className="px-4 py-2 font-mono text-muted-foreground tnum">{i + 1}</td>
                <td className="px-2 py-2">
                  <a href={`/${r.t}/`} className="font-mono font-semibold text-foreground hover:text-gold-strong hover:underline">{r.t}</a>
                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline" data-fonte="b3">{r.name}</span>
                </td>
                {!compact && <td className="hidden px-2 py-2 text-xs text-muted-foreground sm:table-cell" data-fonte="b3">{r.sector}</td>}
                <td className="px-2 py-2 text-right font-mono tnum">{brl(r.price)}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold tnum">{rankingValue(k, r[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && <p className="border-t px-4 py-2 text-xs text-muted-foreground">{L.note} Valor de mercado acima de {brl(d.minMarketCap / 1e9, 0)} {d.minMarketCap / 1e9 === 1 ? 'bilhão' : 'bilhões'}; uma classe de ação por empresa (a mais negociada).</p>}
    </div>
  );
}

export function FatosList({ d, limit, compact }: { d: FatosData; limit?: number; compact?: boolean }) {
  const items = d.items.slice(0, limit ?? 12);
  return (
    <div className="space-y-2">
      <ol className="divide-y overflow-hidden rounded-xl border bg-card">
        {items.map((it) => (
          <li key={`${it.t}-${it.date}-${it.title}`} className="space-y-1 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="neutral">{it.typeLabel}</Badge>
              <a href={it.url} className="font-mono font-semibold text-foreground hover:text-gold-strong hover:underline">{it.t}</a>
              <span className="text-muted-foreground" data-fonte="cvm">{it.name}</span>
              {/* Data de publicação; a hora, quando há, é a de entrada no feed e vem rotulada (SPEC-v2 §C). */}
              <span className="ml-auto text-muted-foreground tnum">
                <time dateTime={it.publishedDate ?? it.date}>{isoToBR(it.publishedDate ?? it.date)}</time>
                {it.feedLabel ? ` · ${it.feedLabel}` : it.time ? ` · entrou no feed às ${it.time}` : ''}
              </span>
            </div>
            <h3 className="text-sm font-semibold leading-snug" data-fonte="cvm">{it.title}</h3>
            {!compact && <p className="text-sm leading-relaxed text-muted-foreground" data-fonte="cvm">{it.summary}</p>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">Resumos gerados por IA a partir de documentos publicados na CVM: podem conter erros e não substituem o documento oficial. Documento mais recente: <time dateTime={d.updated}>{d.updatedBR}</time>.</p>
    </div>
  );
}

// ─── Blocos de conteúdo ───────────────────────────────────────────────────

function BlockView({ b, m }: { b: Block; m: ToolPageModel }) {
  const env = m.env;
  switch (b.type) {
    case 'p':
      return <p className="leading-relaxed"><Rich text={b.text} env={env} /></p>;
    case 'h3':
      return <h3 className="pt-2 text-base font-semibold">{b.text}</h3>;
    case 'list': {
      const items = b.items.map((it, i) => <li key={i}><Rich text={it} env={env} /></li>);
      return b.ordered
        ? <ol className="list-decimal space-y-2 pl-5 leading-relaxed marker:font-semibold marker:text-gold-strong">{items}</ol>
        : <ul className="list-disc space-y-2 pl-5 leading-relaxed marker:text-gold-strong">{items}</ul>;
    }
    case 'table':
      // No celular cada linha vira um cartão (sem rolagem lateral); a partir de sm, tabela normal.
      return (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            {b.caption && <caption className="sr-only">{b.caption}</caption>}
            <thead className="hidden sm:table-header-group">
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                {b.head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className={`block space-y-1 px-4 py-3 align-top sm:table-row sm:space-y-0 sm:p-0 ${i ? 'border-t' : ''}`}>
                  {r.map((c, j) => (
                    <td
                      key={j}
                      data-label={j > 1 ? `${b.head[j]}: ` : undefined}
                      className={`block leading-relaxed sm:table-cell sm:px-4 sm:py-3 ${i ? 'sm:border-t' : ''} ${j === 0 ? 'sm:whitespace-nowrap' : ''} ${j === r.length - 1 ? 'text-muted-foreground' : ''} ${j > 1 ? 'before:font-semibold before:text-foreground before:content-[attr(data-label)] sm:before:content-none' : ''}`}
                    >
                      <Rich text={c} env={env} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'cards':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {b.items.map((c) => (
            <div key={c.title} className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5">
              <span className={`absolute inset-y-0 left-0 w-1 ${TONE_BAR[c.tone ?? 'neutral']}`} aria-hidden="true" />
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground"><Rich text={c.text} env={env} /></p>
            </div>
          ))}
        </div>
      );
    case 'formula':
      return <p className="rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm leading-relaxed">{b.text}</p>;
    case 'note': {
      const Icon = b.tone === 'warn' ? TriangleAlert : Info;
      return (
        <p className="flex gap-3 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed">
          <Icon className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden="true" />
          <span><Rich text={b.text} env={env} /></span>
        </p>
      );
    }
    case 'ranking-table':
      return env.ranking ? <RankingTable d={env.ranking} k={b.indicator} limit={b.limit} /> : null;
    case 'fatos-list':
      return env.fatos ? <FatosList d={env.fatos} limit={b.limit} /> : null;
    case 'ssr': {
      // Ponto de extensão: componente de scripts/ferramentas/sections/ registrado em SECTIONS.
      // Chave desconhecida quebra ESTA página (o gerador mantém a anterior e avisa no log).
      const S = Object.prototype.hasOwnProperty.call(SECTIONS, b.id) ? SECTIONS[b.id] : undefined;
      if (!S) throw new Error(`seção SSR "${b.id}" não registrada em scripts/ferramentas/sections/index.ts`);
      return <S m={m} block={b} />;
    }
    case 'todo':
      return <p className="rounded-lg border border-dashed border-negative/50 bg-negative/5 px-4 py-3 text-sm text-negative">{b.text}</p>;
  }
}

// ─── Widget ───────────────────────────────────────────────────────────────

function WidgetFallback({ m }: { m: ToolPageModel }) {
  const w = m.tool.widget;
  if (m.tool.dataSource === 'ranking' && m.env.ranking) return <RankingTable d={m.env.ranking} k="dy" limit={5} compact />;
  if (m.tool.dataSource === 'fatos' && m.env.fatos) return <FatosList d={m.env.fatos} limit={4} compact />;
  if (w.fallback?.kind === 'chips') {
    return (
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {w.fallback.items.map((x) => <li key={x} className="rounded-lg border bg-muted/40 px-3 py-3 text-sm font-semibold leading-snug">{x}</li>)}
      </ul>
    );
  }
  return <p className="text-sm text-muted-foreground">{w.fallback?.kind === 'text' ? w.fallback.text : w.label}</p>;
}

function WidgetFrame({ m }: { m: ToolPageModel }) {
  const w = m.tool.widget;
  return (
    <figure className="m-0 space-y-2">
      <div
        className="iaw-host relative min-h-[300px] rounded-2xl border bg-card p-4 shadow-xs sm:min-h-[360px]"
        data-ia-widget={w.id}
        data-size="page"
        data-src={m.dataSrc ?? undefined}
        role="region"
        aria-label={w.label}
      >
        {w.illustrative && (
          <span className="mb-3 inline-flex rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-strong">Exemplo ilustrativo</span>
        )}
        <WidgetFallback m={m} />
      </div>
      {m.caption && <figcaption className="text-xs leading-relaxed text-muted-foreground">{m.caption}</figcaption>}
    </figure>
  );
}

// ─── Cartões de links internos ────────────────────────────────────────────

function LinkCards({ cards, trackPrefix }: { cards: LinkCard[]; trackPrefix: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.tool ? TOOL_ICONS[c.tool] : SITE_ICONS[c.href] ?? ArrowRight;
        const id = `${trackPrefix}-${c.tool ?? c.href.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
        return (
          <li key={c.href}>
            <a href={c.href} data-track={id} className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-gold/60">
              <span className="flex items-center gap-2">
                <Icon className="size-5 text-gold-strong" aria-hidden="true" />
                <span className="font-semibold">{c.title}</span>
                {c.draft && <Badge variant="negative" className="ml-auto">Rascunho</Badge>}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{c.text}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-gold-strong">Ver <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function DraftBanner() {
  return (
    <p role="note" className="rounded-xl border border-dashed border-negative/60 bg-negative/5 px-4 py-3 text-sm font-semibold text-negative">
      Rascunho: esta página só existe na prévia local (status &quot;rascunho&quot; em scripts/ferramentas/content) e não vai para o ar.
    </p>
  );
}

// ─── Página da ferramenta ─────────────────────────────────────────────────

/** CTA grande que quebra linha no celular (o botão base é nowrap: rótulo longo dava rolagem lateral em 320 px). */
const CTA_WRAP = 'h-auto min-h-11 max-w-full whitespace-normal py-2.5 text-center';

export function ToolPage({ m }: { m: ToolPageModel }) {
  const t = m.tool;
  const hubHref = `${m.env.basePath}${HUB_PATH}`;
  const mid = Math.min(t.sections.length - 1, Math.max(1, Math.floor(t.sections.length / 2)));
  return (
    <>
      <ToolsHeader app={m.href} hubHref={hubHref} />
      <main id="conteudo" className="pb-24 lg:pb-0" data-tool={t.id} data-ref-date={m.refDate ?? undefined}>
        <Container className="space-y-12 py-6">
          <div className="space-y-4">
            <ToolsBreadcrumb items={[{ href: '/', label: 'IAções' }, { href: hubHref, label: 'Ferramentas' }, { label: t.name }]} />
            {m.draft && <DraftBanner />}
          </div>

          {/* min-w-0 nas duas colunas: sem ele, o min-content do widget (ou da tabela do fallback)
              alarga a coluna única do celular e a página ganha rolagem lateral em 320 px. */}
          <section id="inicio" aria-labelledby="tool-title" className="grid items-start gap-8 lg:grid-cols-12">
            <div className="min-w-0 space-y-5 lg:col-span-5 lg:pt-2">
              <Badge variant="gold">Ferramenta · {t.cta.screen}</Badge>
              <h1 id="tool-title" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{m.h1}</h1>
              <p id="tool-resumo" className="text-[17px] leading-relaxed text-foreground/90">{m.answer}</p>
              <div className="flex flex-wrap items-center gap-3">
                <ButtonLink href={m.href} cta={ctaId(t)} variant="gold" size="lg" className={CTA_WRAP}>{t.cta.label} <ArrowRight /></ButtonLink>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground"><Rich text={t.cta.note} env={m.env} /></p>
            </div>
            <div className="min-w-0 lg:col-span-7">
              <WidgetFrame m={m} />
            </div>
          </section>

          {t.sections.map((s, i) => (
            <Section key={s.id} id={s.id} title={s.title} scroll={i === 0 ? 'scroll_25' : i === mid ? 'scroll_50' : undefined}>
              {s.blocks.map((b, j) => <BlockView key={j} b={b} m={m} />)}
            </Section>
          ))}

          {/* Termos definidos: o MESMO texto do DefinedTermSet do JSON-LD (dado estruturado reflete o visível). */}
          {t.definedTerms && t.definedTerms.length > 0 && (
            <Section id="glossario" title="Glossário">
              <dl className="grid gap-3 sm:grid-cols-2">
                {t.definedTerms.map((d) => (
                  <div key={d.name} id={termId(d.name)} className="scroll-mt-20 rounded-xl border bg-card p-4">
                    <dt className="font-semibold">{d.name}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.description}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          <Section id="faq" title="Perguntas frequentes" scroll="scroll_75">
            <div className="rounded-xl border bg-card px-6 py-2">
              {t.faq.map((f, i) => <AccordionItem key={i} question={f.q} open={i === 0}>{f.a}</AccordionItem>)}
            </div>
          </Section>

          {m.related.length > 0 && (
            <Section id="outras-ferramentas" title="Outras ferramentas">
              <LinkCards cards={m.related} trackPrefix={`tool-${t.id}-rel`} />
            </Section>
          )}

          <section id="cta-final" aria-labelledby="cta-final-title" className="flex flex-col gap-5 rounded-2xl bg-ink p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between" data-scroll="scroll_100">
            <div className="max-w-2xl space-y-2">
              <h2 id="cta-final-title" className="text-xl font-bold tracking-tight">{t.finalCta.title}</h2>
              <p className="text-sm leading-relaxed text-white/75">{t.finalCta.text}</p>
            </div>
            <ButtonLink href={m.href} cta={ctaId(t, 'final')} variant="gold" size="lg" className={`shrink-0 ${CTA_WRAP}`}>{t.finalCta.label} <ArrowRight /></ButtonLink>
          </section>

          {/* Data do dado (páginas com dado real) ou da última atualização do conteúdo. */}
          <Autoria updated={m.dateModified} />
        </Container>
      </main>
      <ToolsFooter app={m.href} hubHref={hubHref} sources={t.sources} macroPage={m.env.macroPage} padForSticky />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur lg:hidden" role="complementary" aria-label={`${t.name} na plataforma`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold">{t.name}</div>
            <div className="text-xs text-muted-foreground">Na plataforma IAções</div>
          </div>
          <ButtonLink href={m.href} cta={ctaId(t, 'sticky')} variant="gold" className="ml-auto">Abrir <ArrowRight /></ButtonLink>
        </div>
      </div>
    </>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────

export function HubPage({ m, app }: { m: HubModel; app: string }) {
  const hubHref = `${m.env.basePath}${HUB_PATH}`;
  return (
    <>
      <ToolsHeader app={app} hubHref={hubHref} />
      <main id="conteudo" className="py-6">
        <Container className="space-y-10">
          <div className="space-y-4">
            <ToolsBreadcrumb items={[{ href: '/', label: 'IAções' }, { label: 'Ferramentas' }]} />
            <h1 id="hub-title" className="text-3xl font-bold tracking-tight sm:text-4xl">{m.h1}</h1>
            <div className="max-w-3xl space-y-3 text-[17px] leading-relaxed text-foreground/90">
              {m.intro.map((p, i) => <p key={i} id={i === 0 ? 'hub-resumo' : undefined}>{p}</p>)}
            </div>
          </div>
          <section id="lista" aria-label="Ferramentas e páginas" data-scroll="scroll_50">
            <LinkCards cards={m.cards} trackPrefix="hub" />
          </section>
          <Autoria updated={m.dateModified} />
        </Container>
      </main>
      <ToolsFooter
        app={app}
        hubHref={hubHref}
        macroPage={m.env.macroPage}
        sources="Cada página de ferramenta traz as próprias fontes e a data do dado, quando mostra dado real."
      />
    </>
  );
}
