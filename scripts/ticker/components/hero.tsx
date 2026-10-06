import * as React from 'react';
import type { TickerModel } from '../model';
import { brl, num, pct, signedPct, mult, big, tone, ok } from '../lib/format';
import { Container, Breadcrumb } from './chrome';
import { Badge } from './ui/badge';
import { ButtonLink } from './ui/button';
import { Lock, ArrowRight, Bell, ShieldCheck } from './icons';

const toneText = { positive: 'text-positive', negative: 'text-negative', neutral: 'text-muted-foreground' } as const;

function CompanyLogo({ m }: { m: TickerModel }) {
  const initials = m.symbol.slice(0, 2);
  return (
    <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white shadow-xs sm:size-20">
      {/* Monograma por baixo: se o logo da brapi falhar (alt vazio), sobra o monograma. */}
      <span className="absolute inset-0 grid place-items-center bg-primary font-mono text-xl font-bold text-white" aria-hidden="true">{initials}</span>
      {m.logoUrl && (
        <img src={m.logoUrl} alt="" width="80" height="80" className="relative size-full bg-white object-contain p-2" decoding="async" fetchPriority="high" />
      )}
    </div>
  );
}

function RangeBar({ m }: { m: TickerModel }) {
  if (!(m.min52 > 0 && m.max52 > m.min52)) return null;
  const pos = Math.max(0, Math.min(100, ((m.price - m.min52) / (m.max52 - m.min52)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground"><span>Mín. 52 semanas</span><span>Máx. 52 semanas</span></div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-negative/25 via-muted to-positive/25">
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow" style={{ left: `${pos.toFixed(1)}%` }} aria-hidden="true" />
      </div>
      <div className="flex justify-between font-mono text-xs font-semibold tnum"><span>{brl(m.min52)}</span><span>{brl(m.max52)}</span></div>
    </div>
  );
}

/** Card-gancho do DCF: o número fica de fora do HTML (só placeholder borrado). */
function DcfHook({ m }: { m: TickerModel }) {
  const cols = m.dcf.gAxis.length ? m.dcf.gAxis : [0.04, 0.045, 0.05, 0.055, 0.06];
  const rows = m.dcf.waccAxis.length ? m.dcf.waccAxis : [0.13, 0.135, 0.14, 0.145, 0.15];
  // Intensidade fixa (diagonal): não vaza a forma real da matriz.
  const shade = (r: number, c: number) => {
    const t = (c - r + 4) / 8;
    return `color-mix(in srgb, var(--positive) ${Math.round(t * 70)}%, var(--negative) ${Math.round((1 - t) * 70)}%)`;
  };
  return (
    <div className="relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-lg ring-1 ring-white/10 sm:p-6 bg-grid-ink">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-3">
        <Badge variant="pro" className="border-gold/50 text-gold">DCF · Fluxo de caixa descontado</Badge>
        <span className="text-xs text-white/60">o método dos analistas</span>
      </div>

      <div className="relative">
        <p className="text-sm text-white/70">Preço justo de {m.symbol} pelo DCF</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-4xl font-bold tnum sm:text-5xl" aria-label="valor disponível na plataforma">
            R$ <span className="locked-blur inline-block" aria-hidden="true">00,00</span>
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-gold/15 text-gold"><Lock className="size-4" /></span>
        </div>
        <p className="mt-1 text-sm text-white/60">Upside vs. {brl(m.price)}: <span className="locked-blur inline-block" aria-hidden="true">+00,0%</span></p>
      </div>

      <div className="relative">
        <div className="mb-1.5 flex justify-between text-[11px] text-white/50"><span>WACC ↓ · g perpétuo →</span><span>sensibilidade</span></div>
        <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1 font-mono text-[11px]" aria-hidden="true">
          <span />
          {cols.slice(0, 5).map((g, i) => <span key={i} className="text-center text-white/55 tnum">{num(g * 100, 1)}%</span>)}
          {rows.slice(0, 5).map((w, r) => (
            <React.Fragment key={r}>
              <span className="pr-1 text-white/55 tnum">{num(w * 100, 1)}%</span>
              {cols.slice(0, 5).map((_, c) => (
                <span key={c} className={`h-6 rounded ${r === 2 && c === 2 ? 'ring-2 ring-gold' : ''}`} style={{ background: shade(r, c), opacity: 0.55 }} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <ul className="relative grid gap-1.5 text-sm text-white/80">
        {m.dcf.wacc > 0 && <li className="flex justify-between"><span>WACC estimado (cenário base)</span><span className="font-mono font-semibold text-white tnum">{pct(m.dcf.wacc)}</span></li>}
        <li className="flex justify-between"><span>Projeção</span><span className="font-semibold text-white">5 anos + perpetuidade</span></li>
        <li className="flex justify-between"><span>Cenários</span><span className="font-semibold text-white">base · otimista · pessimista</span></li>
      </ul>

      <div className="relative mt-auto space-y-3">
        <ButtonLink href={m.links.dcf} cta="hero-dcf" variant="gold" size="xl" className="w-full">Ver o DCF de {m.symbol} grátis <ArrowRight /></ButtonLink>
        <p className="flex items-center justify-center gap-1.5 text-xs text-white/60"><ShieldCheck className="size-3.5" /> Cadastro grátis, sem cartão. Premissas suas, não as nossas.</p>
        <a href={m.links.alerta} data-cta="alerta-cvm-topo" className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-300 hover:underline"><Bell className="size-3.5" /> Me avise quando {m.symbol} publicar na CVM</a>
      </div>
    </div>
  );
}

interface Tile { label: string; value: string; hint?: string; tone?: 'positive' | 'negative' | 'neutral' }

function MultiplesStrip({ m }: { m: TickerModel }) {
  const f = m.m;
  const sm = m.sectorMedian;
  const tiles: Tile[] = [
    { label: 'P/L', value: mult(f.pl, 1), hint: sm.pl ? `setor ${mult(sm.pl, 1)}` : undefined },
    { label: 'P/VP', value: mult(f.pvp, 2) },
    { label: 'EV/EBITDA', value: mult(f.evEbitda, 1) },
    { label: 'Dividend yield', value: pct(f.divYield), hint: sm.dy != null ? `setor ${pct(sm.dy)}` : undefined },
    { label: 'ROE', value: pct(f.roe), tone: tone(f.roe) },
    { label: 'Margem líquida', value: pct(f.netMargin), tone: tone(f.netMargin) },
    { label: 'Dív. líq./EBITDA', value: mult(f.debtEbitda, 2) },
    { label: 'Valor de mercado', value: big(f.marketCap) },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4" aria-label={`Múltiplos de ${m.symbol}`}>
      {tiles.map(t => (
        <div key={t.label} className="bg-card px-4 py-3">
          <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
          <div className={`mt-0.5 font-mono text-xl font-bold tnum ${t.tone ? toneText[t.tone] : ''}`}>{t.value}</div>
          {t.hint && <div className="text-[11px] text-muted-foreground">{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function Hero({ m }: { m: TickerModel }) {
  const dayTone = tone(m.changeDay);
  return (
    <section className="border-b bg-card" aria-labelledby="ticker-title">
      <Container className="py-5 lg:py-8">
        <Breadcrumb m={m} />
        <div className="mt-5 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-6 lg:col-span-7 xl:col-span-8">
            <div className="flex items-start gap-4">
              <CompanyLogo m={m} />
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">Ação {m.typeLabel} · {m.type}</Badge>
                  {m.sector && (m.sectorSlug ? <a href={`/acoes/${m.sectorSlug}/`}><Badge variant="outline" className="hover:bg-accent">{m.sector}</Badge></a> : <Badge variant="outline">{m.sector}</Badge>)}
                  {m.subSector && <Badge variant="neutral" className="hidden sm:inline-flex">{m.subSector}</Badge>}
                </div>
                <h1 id="ticker-title" className="leading-tight">
                  <span className="block font-mono text-3xl font-bold tracking-tight sm:text-4xl">{m.symbol}</span>
                  <span className="block text-base font-medium text-muted-foreground sm:text-lg">{m.seo.h1Sub}</span>
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cotação</div>
                <div id="live-price" className="font-mono text-4xl font-bold tracking-tight tnum sm:text-5xl">{brl(m.price)}</div>
              </div>
              <div className="flex flex-col gap-1 pb-1.5">
                <span id="live-change-day" className={`font-mono text-sm font-semibold tnum ${toneText[dayTone]}`}>{signedPct(m.changeDay, 2)} hoje</span>
                <span id="live-date" className="text-xs text-muted-foreground">Dados de {m.todayBR} · pós-fechamento B3</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {m.perf.map(p => (
                <div key={p.label} className="rounded-lg border bg-background/60 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="text-[11px] font-medium text-muted-foreground">{p.label}</div>
                  <div className={`font-mono text-xs font-bold tnum sm:text-sm ${ok(p.value) ? toneText[tone(p.value)] : 'text-muted-foreground'}`}>{signedPct(p.value)}</div>
                </div>
              ))}
            </div>

            <RangeBar m={m} />

            <MultiplesStrip m={m} />
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <DcfHook m={m} />
          </div>
        </div>

      </Container>
    </section>
  );
}
