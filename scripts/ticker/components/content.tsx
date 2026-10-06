import * as React from 'react';
import type { TickerModel, StatementTable } from '../model';
import { brl, num, pct, mult, big, qty, isoToBR, truncate, ok } from '../lib/format';
import { Container } from './chrome';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from './ui/card';
import { Badge } from './ui/badge';
import { ButtonLink } from './ui/button';
import { Separator, Tabs, TabsList, TabsTrigger, TabsContent, AccordionItem } from './ui/misc';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { Lock, ArrowRight, Bell, MessageSquareText, Star, ChartColumn, FileText, ExternalLink, Sparkles, Layers } from './icons';

const toneCls = (n: number) => (!ok(n) || n === 0 ? '' : n > 0 ? 'text-positive' : 'text-negative');

function SectionTitle({ id, children, sub, action }: { id: string; children: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <CardHeader>
      <CardTitle as="h2" id={id} className="text-xl">{children}</CardTitle>
      {sub && <CardDescription>{sub}</CardDescription>}
      {action && <CardAction>{action}</CardAction>}
    </CardHeader>
  );
}

// --- Indicadores -----------------------------------------------------------------

export function Indicators({ m }: { m: TickerModel }) {
  const f = m.m;
  const groups: { title: string; rows: [string, string, string?][] }[] = [
    { title: 'Valuation', rows: [['P/L', mult(f.pl)], ['P/VP', mult(f.pvp)], ['EV/EBITDA', mult(f.evEbitda)], ['EV/EBIT', mult(f.evEbit)], ['P/EBIT', mult(f.pebit)], ['PSR (preço/receita)', mult(f.psr)], ['Dividend yield', pct(f.divYield)], ['LPA', brl(f.lpa)], ['VPA', brl(f.vpa)]] },
    { title: 'Rentabilidade', rows: [['ROE', pct(f.roe), toneCls(f.roe)], ['ROIC', pct(f.roic), toneCls(f.roic)], ['Margem bruta', pct(f.grossMargin)], ['Margem EBIT', pct(f.ebitMargin)], ['Margem EBITDA', pct(f.ebitdaMargin)], ['Margem líquida', pct(f.netMargin), toneCls(f.netMargin)]] },
    { title: 'Endividamento', rows: [['Dív. líquida/EBITDA', mult(f.debtEbitda)], ['Dív. bruta/patrimônio', mult(f.debtEquity)], ['Liquidez corrente', mult(f.currentLiquidity)]] },
    { title: 'Mercado', rows: [['Valor de mercado', big(f.marketCap)], ['Valor da firma (EV)', big(f.firmValue)], ['Nº de ações', qty(f.sharesOutstanding)], ['Volume médio diário', qty(f.volMed2m)], ['Mín. 52 semanas', brl(f.min52Week)], ['Máx. 52 semanas', brl(f.max52Week)]] },
  ];
  return (
    <Card id="indicadores" className="scroll-mt-20" aria-labelledby="ind-title">
      <SectionTitle id="ind-title" sub={`Atualizados em ${m.todayBR}, após o fechamento da B3. Último balanço anual: ${m.lastBalance}.`}>Indicadores fundamentalistas de {m.symbol}</SectionTitle>
      <CardContent className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {groups.map(g => (
          <div key={g.title}>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
            <dl className="divide-y divide-dashed">
              {g.rows.map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-sm">{k}</dt>
                  <dd className={`font-mono text-sm font-semibold tnum ${c || ''}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Sobre -------------------------------------------------------------------------

export function About({ m }: { m: TickerModel }) {
  const facts: [string, React.ReactNode][] = [];
  if (m.sector) facts.push(['Setor', m.sectorSlug ? <a href={`/acoes/${m.sectorSlug}/`} className="underline-offset-2 hover:underline">{m.sector}</a> : m.sector]);
  if (m.subSector) facts.push(['Segmento', m.subSector]);
  if (m.hq) facts.push(['Sede', m.hq]);
  if (m.employees) facts.push(['Funcionários', m.employees.toLocaleString('pt-BR')]);
  if (m.website) facts.push(['Site', <a href={m.website} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">{m.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} <ExternalLink className="size-3" /></a>]);
  facts.push(['Tipo', `${m.type} (${m.typeLabel})`]);
  return (
    <Card id="sobre" className="scroll-mt-20" aria-labelledby="about-title">
      <SectionTitle id="about-title">Sobre {m.shortName} ({m.symbol})</SectionTitle>
      <CardContent className="space-y-5">
        <div className="space-y-3 leading-relaxed">{m.seo.intro.map((p, i) => <p key={i}>{p}</p>)}</div>
        {m.summary && (
          <>
            <Separator />
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">O negócio</h3>
              <p className="leading-relaxed text-muted-foreground">{m.summary}</p>
            </div>
          </>
        )}
        <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k} className="bg-card px-4 py-2.5">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate text-sm font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// --- Dividendos ----------------------------------------------------------------------

export function Dividends({ m }: { m: TickerModel }) {
  const d = m.div;
  const maxY = Math.max(0, ...d.byYear.map(y => y.total));
  const stats: [string, string][] = [
    ['Dividend yield 12m', d.dyTTM > 0 ? pct(d.dyTTM) : '—'],
    ['Proventos 12m (por ação)', d.ttm > 0 ? brl(d.ttm) : '—'],
    ['Média anual (5 anos)', d.avg['5'] > 0 ? brl(d.avg['5']) : '—'],
    ['Pagamentos no histórico', d.totalPayments ? String(d.totalPayments) : '—'],
  ];
  return (
    <Card id="dividendos" className="scroll-mt-20" aria-labelledby="div-title">
      <SectionTitle id="div-title" sub={d.totalPayments ? `Dividendos e JCP por ação${d.firstYear ? ` desde ${d.firstYear}` : ''}.` : 'Sem pagamentos de proventos registrados.'}>Dividendos de {m.symbol}</SectionTitle>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-background/60 px-4 py-3">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="font-mono text-lg font-bold tnum">{v}</div>
            </div>
          ))}
        </div>

        {d.byYear.length > 1 && maxY > 0 && (
          <figure>
            <figcaption className="mb-3 text-sm font-semibold">Proventos por ação, por ano</figcaption>
            <div className="flex h-44 items-end gap-1.5 sm:gap-2.5" role="img" aria-label={`Proventos por ação de ${m.symbol} por ano: ${d.byYear.map(y => `${y.year}: ${brl(y.total)}`).join('; ')}`}>
              {d.byYear.map(y => (
                <div key={y.year} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${y.year}: ${brl(y.total)} em ${y.count} pagamento(s)`}>
                  <span className="hidden font-mono text-[10px] font-semibold text-muted-foreground tnum sm:block">{num(y.total, 2)}</span>
                  <div className={`w-full rounded-t-md ${y.partial ? 'bg-primary/35' : 'bg-primary'} transition-colors group-hover:bg-gold`} style={{ height: `${Math.max(2, (y.total / maxY) * 100).toFixed(1)}%` }} />
                  <span className="font-mono text-[10px] text-muted-foreground tnum">{String(y.year).slice(2)}</span>
                </div>
              ))}
            </div>
            {d.byYear.some(y => y.partial) && <p className="mt-2 text-[11px] text-muted-foreground">Barra clara: ano corrente, ainda parcial.</p>}
          </figure>
        )}

        {d.recent.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Últimos pagamentos</h3>
            <Table>
              <TableHeader><TableRow><TableHead>Data com (ex)</TableHead><TableHead>Pagamento</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor por ação</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.recent.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono tnum">{isoToBR(r.ex)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground tnum">{r.pay ? isoToBR(r.pay) : '—'}</TableCell>
                    <TableCell>{r.type ? <Badge variant="neutral">{r.type}</Badge> : '—'}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tnum">{brl(r.amount, r.amount < 0.1 ? 4 : 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Demonstrações ----------------------------------------------------------------------

function StatementView({ t, chart }: { t: StatementTable; chart?: { a: number; b: number; la: string; lb: string } }) {
  if (!t.years.length) return <p className="text-sm text-muted-foreground">Sem dados anuais disponíveis.</p>;
  let bars: React.ReactNode = null;
  if (chart) {
    const ra = t.rows[chart.a], rb = t.rows[chart.b];
    const max = Math.max(1, ...ra.values.map(Math.abs), ...rb.values.map(Math.abs));
    bars = (
      <figure className="mb-5">
        <div className="mb-2 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />{chart.la}</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gold" />{chart.lb}</span>
        </div>
        <div className="flex h-36 items-end gap-2 sm:gap-3" role="img" aria-label={`${chart.la} e ${chart.lb} por ano`}>
          {t.years.map((y, i) => (
            <div key={y} className="flex h-full flex-1 flex-col justify-end gap-1">
              <div className="flex h-full items-end gap-0.5">
                <div className="flex-1 rounded-t-sm bg-primary" style={{ height: `${Math.max(1, (Math.max(0, ra.values[i]) / max) * 100).toFixed(1)}%` }} title={`${y} · ${chart.la}: ${big(ra.values[i])}`} />
                <div className={`flex-1 rounded-t-sm ${rb.values[i] < 0 ? 'bg-negative' : 'bg-gold'}`} style={{ height: `${Math.max(1, (Math.abs(rb.values[i]) / max) * 100).toFixed(1)}%` }} title={`${y} · ${chart.lb}: ${big(rb.values[i])}`} />
              </div>
              <span className="text-center font-mono text-[10px] text-muted-foreground tnum">{y.slice(2)}</span>
            </div>
          ))}
        </div>
      </figure>
    );
  }
  return (
    <div>
      {bars}
      <Table className="text-[13px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card">R$</TableHead>
            {t.years.map(y => <TableHead key={y} className="text-right font-mono">{y}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {t.rows.map(r => (
            <TableRow key={r.label}>
              <TableCell className={`sticky left-0 z-10 bg-card ${r.strong ? 'font-semibold' : 'text-muted-foreground'}`}>{r.label}</TableCell>
              {r.values.map((v, i) => (
                <TableCell key={i} className={`text-right font-mono tnum ${r.strong ? 'font-semibold' : ''} ${v < 0 ? 'text-negative' : ''}`}>
                  {r.kind === 'pct' ? pct(v) : big(v).replace('R$ ', '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function Statements({ m }: { m: TickerModel }) {
  const id = 'fin';
  return (
    <Card id="demonstracoes" className="scroll-mt-20" aria-labelledby="fin-title">
      <SectionTitle id="fin-title" sub="Até 10 anos de resultados anuais. Valores em reais.">Demonstrações financeiras de {m.symbol}</SectionTitle>
      <CardContent>
        <Tabs id={id}>
          <TabsList label="Demonstrações financeiras">
            <TabsTrigger tabsId={id} value="dre" active>DRE</TabsTrigger>
            <TabsTrigger tabsId={id} value="bal">Balanço</TabsTrigger>
            <TabsTrigger tabsId={id} value="cf">Fluxo de caixa</TabsTrigger>
          </TabsList>
          <TabsContent tabsId={id} value="dre" active><h3 className="sr-only">DRE de {m.symbol}</h3><StatementView t={m.dre} chart={{ a: 0, b: 4, la: 'Receita líquida', lb: 'Lucro líquido' }} /></TabsContent>
          <TabsContent tabsId={id} value="bal"><h3 className="sr-only">Balanço patrimonial de {m.symbol}</h3><StatementView t={m.bal} /></TabsContent>
          <TabsContent tabsId={id} value="cf"><h3 className="sr-only">Fluxo de caixa de {m.symbol}</h3><StatementView t={m.cf} chart={{ a: 0, b: 2, la: 'Caixa operacional', lb: 'Fluxo de caixa livre' }} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// --- CVM -------------------------------------------------------------------------------

export function CvmDocs({ m }: { m: TickerModel }) {
  if (!m.cvmDocs.length) return null;
  return (
    <Card id="cvm" className="scroll-mt-20" aria-labelledby="cvm-title">
      <SectionTitle id="cvm-title" sub="Os documentos mais recentes que a companhia enviou à CVM." action={<Badge variant="gold">Direto da CVM</Badge>}>O que {m.symbol} publicou na CVM</SectionTitle>
      <CardContent className="space-y-4">
        <ol className="divide-y rounded-lg border">
          {m.cvmDocs.map((d, i) => (
            <li key={i}>
              <a href={d.link} target="_blank" rel="noopener nofollow" className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 space-y-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="secondary">{d.docTypeLabel}</Badge><time dateTime={d.date} className="font-mono text-muted-foreground">{isoToBR(d.date)}</time></span>
                  {d.title && <span className="block text-sm font-semibold">{truncate(d.title, 120)}</span>}
                  {d.excerpt && <span className="block text-sm text-muted-foreground">{truncate(d.excerpt, 220)}</span>}
                </span>
                <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href={m.links.alerta} cta="alerta-cvm" variant="default"><Bell /> Receber os próximos no WhatsApp</ButtonLink>
          <a href={`/airton/${m.symbol}/`} className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline">Veja como o alerta chega →</a>
        </div>
      </CardContent>
    </Card>
  );
}

// --- FAQ -------------------------------------------------------------------------------

export function Faq({ m }: { m: TickerModel }) {
  return (
    <Card id="faq" className="scroll-mt-20" aria-labelledby="faq-title">
      <SectionTitle id="faq-title">Perguntas frequentes sobre {m.symbol}</SectionTitle>
      <CardContent>
        {m.faq.map((f, i) => <AccordionItem key={i} question={f.q} open={i === 0}><p>{f.a}</p></AccordionItem>)}
      </CardContent>
    </Card>
  );
}

// --- Aside: AIrton + plataforma ------------------------------------------------------------

export function Aside({ m }: { m: TickerModel }) {
  const q = encodeURIComponent;
  const features: { href: string; cta: string; icon: React.ReactNode; title: React.ReactNode; desc: string }[] = [
    { href: m.links.dcf, cta: 'dcf-locked', icon: <ChartColumn className="size-4" />, title: <>DCF completo de {m.symbol}</>, desc: 'WACC, cenários e sensibilidade com premissas suas.' },
    { href: m.links.generic, cta: 'nota-qualitativa', icon: <Star className="size-4" />, title: <>Nota qualitativa <span className="locked-blur inline-block">?,??</span>/4</>, desc: 'Governança, gestão, vantagens competitivas e riscos.' },
    { href: m.links.alerta, cta: 'alerta-cvm', icon: <Bell className="size-4" />, title: <>Alertas de {m.symbol} no WhatsApp</>, desc: 'Fato Relevante, ITR, DFP e proventos assim que saem.' },
    { href: m.links.asset, cta: 'asset-page', icon: <Layers className="size-4" />, title: <>{m.symbol} completa na plataforma</>, desc: 'Gráficos, comparativos e histórico em um só lugar.' },
  ];
  return (
    <div className="aside-sticky space-y-4">
      <Card className="gap-4 border-gold/40 bg-gradient-to-b from-gold/10 to-card">
        <CardHeader>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gold-strong uppercase"><Sparkles className="size-3.5" /> AIrton · IA da Brasil Horizonte</p>
          <CardTitle as="h2" className="text-lg">Leu um relatório sobre {m.symbol}? Pergunte ao AIrton.</CardTitle>
          <CardDescription>Ele cruza a tese com os números reais e os documentos da CVM e aponta onde ela não se sustenta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {m.airtonQuestions.map(question => (
              <li key={question}>
                <a href={`${m.links.airton}&prompt=${q(question)}`} data-cta="airton-audit" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-gold/60 hover:bg-gold/5">
                  <MessageSquareText className="size-4 shrink-0 text-gold-strong" /><span className="flex-1">{question}</span><ArrowRight className="size-3.5 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
          <ButtonLink href={m.links.airton} cta="airton-audit" variant="gold" className="w-full">Auditar {m.symbol} grátis <ArrowRight /></ButtonLink>
          <p className="text-center text-xs text-muted-foreground">{m.socialProof.toLocaleString('pt-BR')} investidores já validaram teses em {m.symbol}</p>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle as="h2" className="text-base">Na plataforma para {m.symbol}</CardTitle>
          <CardDescription>Grátis para começar. Sem cartão.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="-mx-2">
            {features.map(ft => (
              <li key={ft.cta}>
                <a href={ft.href} data-cta={ft.cta} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/8 text-primary">{ft.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{ft.title}</span>
                    <span className="block text-xs text-muted-foreground">{ft.desc}</span>
                  </span>
                  <Lock className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Setor --------------------------------------------------------------------------------

export function Peers({ m }: { m: TickerModel }) {
  if (!m.peers.length) return null;
  const f = m.m;
  const rows = [{ ticker: m.symbol, name: m.shortName, price: m.price, pl: f.pl, dy: f.divYield, marketCap: f.marketCap, self: true }, ...m.peers.map(p => ({ ...p, self: false }))];
  return (
    <Card id="setor" className="scroll-mt-20" aria-labelledby="peers-title">
      <SectionTitle id="peers-title" sub={`Compare ${m.symbol} com as maiores empresas do setor na B3.`} action={m.sectorSlug ? <a href={`/acoes/${m.sectorSlug}/`} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">Ver setor completo →</a> : undefined}>
        Ações do setor de {m.sector}
      </SectionTitle>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Ação</TableHead><TableHead>Empresa</TableHead><TableHead className="text-right">Cotação</TableHead><TableHead className="text-right">P/L</TableHead><TableHead className="text-right">DY</TableHead><TableHead className="text-right">Valor de mercado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.ticker} className={r.self ? 'bg-gold/8 hover:bg-gold/10' : ''}>
                <TableCell className="font-mono font-bold">{r.self ? r.ticker : <a href={`/${r.ticker}/`} className="text-primary underline-offset-2 hover:underline">{r.ticker}</a>}</TableCell>
                <TableCell className="max-w-[16rem] truncate">{r.name}</TableCell>
                <TableCell className="text-right font-mono tnum">{brl(r.price)}</TableCell>
                <TableCell className="text-right font-mono tnum">{r.pl > 0 ? num(r.pl, 1) : '—'}</TableCell>
                <TableCell className="text-right font-mono tnum">{r.dy > 0 ? pct(r.dy) : '—'}</TableCell>
                <TableCell className="text-right font-mono tnum">{big(r.marketCap)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// --- Faixa final + linking interno ------------------------------------------------------------

export function FinalCta({ m }: { m: TickerModel }) {
  return (
    <section className="py-10" aria-labelledby="final-cta-title">
      <Container>
        <div className="relative overflow-hidden rounded-2xl bg-ink px-6 py-10 text-white sm:px-10 bg-grid-ink">
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
          <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <h2 id="final-cta-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Faça o valuation completo de {m.symbol}</h2>
              <p className="mt-2 text-white/75">DCF com as suas premissas, nota qualitativa, AIrton para auditar a sua tese e alertas da CVM no WhatsApp. Comece grátis, sem cartão.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <ButtonLink href={m.links.dcf} cta="footer" variant="gold" size="lg">Começar o DCF de {m.symbol} <ArrowRight /></ButtonLink>
              <ButtonLink href={m.links.asset} cta="asset-page" variant="outline-dark" size="lg">Ver {m.symbol} na plataforma</ButtonLink>
            </div>
          </div>
        </div>

        <nav className="mt-8" aria-label="Ações populares">
          <h2 className="mb-3 text-sm font-semibold">Ações populares</h2>
          <div className="flex flex-wrap gap-2">
            {m.popular.map(t => <a key={t} href={`/${t}/`} className="rounded-md border bg-card px-2.5 py-1 font-mono text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-accent">{t}</a>)}
            <a href="/acoes/" className="rounded-md px-2.5 py-1 text-xs font-semibold text-primary hover:underline">Todas as ações →</a>
          </div>
        </nav>
      </Container>
    </section>
  );
}
