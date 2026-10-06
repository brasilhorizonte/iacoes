import * as React from 'react';
import { Container } from '../ticker/components/chrome';
import { ButtonLink } from '../ticker/components/ui/button';
import { Badge } from '../ticker/components/ui/badge';
import { Card, CardContent } from '../ticker/components/ui/card';
import { AccordionItem } from '../ticker/components/ui/misc';
import { ArrowRight, ChartColumn, FileText, TrendingDown, TrendingUp } from '../ticker/components/icons';
import { BuffettChart } from './chart';
import { MacroBreadcrumb, MacroFooter, MacroHeader } from './chrome';
import { CSV_NAME, HUB_PATH, PAGE_PATH, type BuffettModel } from './model';

export const SOURCES_NOTE =
  'Valor de mercado: B3 (TOTAL GERAL, desde jul/2026), Banco Central SGS 7849 (2000 a 2019) e Banco Mundial/WFE convertido pela PTAX de 31/dez (dezembros de 2019 a 2025); meses entre âncoras anuais interpolados pelo Ibovespa e marcados como estimados. PIB de 12 meses: Banco Central SGS 4382.';

/** Variação neutra (sem verde/vermelho): indicador subir não é "bom" nem "ruim". */
function Delta({ d }: { d: { label: string; delta: string; tone: 'up' | 'down' | 'flat' } }) {
  const Icon = d.tone === 'down' ? TrendingDown : TrendingUp;
  return (
    <Badge variant="neutral" className="font-mono tnum">
      {d.tone !== 'flat' && <Icon className="size-3.5" aria-hidden="true" />}
      {d.delta} vs {d.label}
    </Badge>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Gauge({ m }: { m: BuffettModel }) {
  return (
    <div aria-label={`Percentil histórico ${m.percentile}`}>
      <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--positive) 0 25%, #e9d9ae 25% 75%, var(--negative) 75% 100%)' }}>
        <span className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded bg-foreground" style={{ left: `${m.percentile}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>historicamente barata</span>
        <span>faixa histórica</span>
        <span>historicamente cara</span>
      </div>
    </div>
  );
}

export function BuffettPage({ m }: { m: BuffettModel }) {
  return (
    <>
      <MacroHeader app={m.links.app} />
      <main className="pb-24 lg:pb-0" data-ref-date={m.h.date}>
        <Container className="space-y-10 py-6">
          <MacroBreadcrumb items={[{ href: '/', label: 'IAções' }, { href: HUB_PATH, label: 'Macro' }, { label: 'Indicador de Buffett' }]} />

          <Card id="hoje" className="overflow-hidden">
            <CardContent className="grid gap-8 p-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <h1 id="buffett-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Indicador de Buffett do Brasil hoje: {m.vShort}% do PIB</h1>
                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-6xl font-bold tracking-tight tnum leading-none">{m.v}<span className="text-3xl text-muted-foreground">%</span></span>
                </div>
                <p className="text-sm text-muted-foreground">Fechamento oficial de <strong className="text-foreground">{m.dateBR}</strong> (B3) · PIB de 12 meses até {m.pibMonth}</p>
                <div className="flex flex-wrap gap-2">
                  {m.prevMonth && <Delta d={m.prevMonth} />}
                  {m.yearAgo && <Delta d={m.yearAgo} />}
                </div>
                <p id="buffett-resumo" className="text-[15px] leading-relaxed">
                  <strong>Hoje ({m.dateLong}), o Indicador de Buffett do Brasil está em {m.v}%</strong>: o valor de mercado das empresas listadas na B3 (R$ {m.mcapTri} trilhões) equivale a {m.v}% do PIB dos últimos 12 meses (R$ {m.pibTri} trilhões). A leitura está {m.rel} média histórica brasileira de {m.s.mean}% desde {m.s.since}, e {m.percentile}% dos meses desde então tiveram valor igual ou menor — faixa <strong>&ldquo;{m.faixa}&rdquo;</strong>.
                </p>
              </div>
              <div className="space-y-5 lg:col-span-5">
                <Gauge m={m} />
                <Badge variant="gold">Percentil {m.percentile} · {m.faixa}</Badge>
                <dl className="grid grid-cols-3 gap-3">
                  {[['Média desde ' + m.s.since, `${m.s.mean}%`], ['Mediana', `${m.s.median}%`], ['Faixa p25–p75', `${m.s.p25}–${m.s.p75}%`]].map(([k, v]) => (
                    <div key={k} className="rounded-lg border bg-muted/40 p-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="mt-1 font-mono text-lg font-bold tnum">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </CardContent>
          </Card>

          <Section id="grafico" title={`Gráfico do Indicador de Buffett no Brasil desde ${m.s.since}`}>
            <Card>
              <CardContent className="space-y-3 p-4 sm:p-6">
                <BuffettChart m={m} />
                <p className="text-xs text-muted-foreground">Linha: valor de mercado da B3 ÷ PIB de 12 meses (1 ponto por mês). Faixa verde: entre os percentis 25 e 75 da série. Tracejado: média. Áreas cinzas: períodos em que os meses são estimados entre âncoras oficiais (detalhes em Metodologia e no CSV).</p>
                <a href={`${PAGE_PATH}${CSV_NAME}`} className="inline-flex items-center gap-2 text-sm font-semibold text-gold-strong hover:underline" download>
                  <FileText className="size-4" aria-hidden="true" /> Baixar a série completa (CSV, licença CC BY 4.0)
                </a>
              </CardContent>
            </Card>
          </Section>

          <Section id="cara-ou-barata" title="A bolsa brasileira está cara ou barata hoje?">
            <p className="leading-relaxed">Pelo Indicador de Buffett, a bolsa está <strong>{m.faixa}</strong>: {m.v}% do PIB, contra uma faixa histórica de {m.s.p25}% a {m.s.p75}% (percentis 25 e 75 desde {m.s.since}). O indicador descreve o mercado como um todo: não diz nada sobre uma ação específica e não é recomendação de investimento.</p>
            <h3 className="pt-2 text-base font-semibold">Como ler</h3>
            <ul className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-lg border p-4"><strong className="text-positive">Abaixo de {m.s.p25}%</strong><p className="mt-1 text-sm text-muted-foreground">Historicamente barata: só 1 em cada 4 meses desde {m.s.since} teve leitura menor.</p></li>
              <li className="rounded-lg border p-4"><strong>De {m.s.p25}% a {m.s.p75}%</strong><p className="mt-1 text-sm text-muted-foreground">Dentro da faixa histórica: metade dos meses ficou neste intervalo.</p></li>
              <li className="rounded-lg border p-4"><strong className="text-negative">Acima de {m.s.p75}%</strong><p className="mt-1 text-sm text-muted-foreground">Historicamente cara: só 1 em cada 4 meses teve leitura maior.</p></li>
            </ul>
          </Section>

          <Section id="o-que-e" title="O que é o Indicador de Buffett">
            <p className="leading-relaxed">O Indicador de Buffett é a razão entre o valor de mercado de todas as empresas listadas na bolsa de um país e o seu PIB. Warren Buffett o chamou de provavelmente a melhor medida isolada de onde estão as avaliações do mercado em um dado momento.</p>
            <h3 id="como-calcular" className="scroll-mt-20 pt-2 text-base font-semibold">Como calcular</h3>
            <p className="leading-relaxed">Valor de mercado total da B3 ÷ PIB acumulado em 12 meses × 100. No fechamento de {m.dateBR}: R$ {m.mcapTri} tri ÷ R$ {m.pibTri} tri = <strong>{m.v}%</strong>.</p>
          </Section>

          <Section id="brasil-vs-eua" title="Por que o Brasil não usa a régua dos EUA">
            <p className="leading-relaxed">Nos EUA o indicador passa de 150% e as faixas clássicas (75%, 90%, 115%) foram pensadas para lá. No Brasil a bolsa é pequena diante da economia — poucas empresas listadas, muitas estatais e familiares fora da bolsa, juro alto — e o recorde da série desde {m.s.since} foi {m.s.max}% em {m.s.maxMonth}. Por isso comparamos o Brasil com a própria história, por percentis, e não com a régua americana.</p>
          </Section>

          <Section id="valor-de-mercado-b3" title={`Valor de mercado da B3 hoje: R$ ${m.mcapTri} tri`}>
            <p className="leading-relaxed">No fechamento de {m.dateBR}, as empresas listadas na B3 somavam R$ {m.mcapTri} trilhões de valor de mercado, pelo total publicado pela própria bolsa.{m.prevMcap ? ` No fim de ${m.prevMcap.label}, eram R$ ${m.prevMcap.tri} trilhões.` : ''}</p>
          </Section>

          <Section id="historico" title="Máximas, mínimas e média histórica">
            <div className="grid gap-3 sm:grid-cols-3">
              {[['Máxima', `${m.s.max}%`, m.s.maxMonth], ['Mínima', `${m.s.min}%`, m.s.minMonth], ['Média', `${m.s.mean}%`, `${m.s.since}–${m.h.date.slice(0, 4)}`]].map(([k, v, w]) => (
                <Card key={k}><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div><div className="font-mono text-2xl font-bold tnum">{v}</div><div className="text-xs text-muted-foreground">{w}</div></CardContent></Card>
              ))}
            </div>
          </Section>

          <Section id="acoes" title="E as ações que você acompanha?">
            <p className="leading-relaxed">A bolsa como um todo está {m.faixa}. Para uma empresa específica, o que importa é o preço frente ao valor dela — veja o preço justo por Graham, Bazin e Gordon de cada ação.</p>
            <a href="/acoes/" className="inline-flex items-center gap-2 text-sm font-semibold text-gold-strong hover:underline">Preço justo de todas as ações da B3 <ArrowRight className="size-4" aria-hidden="true" /></a>
            <div className="flex flex-col gap-4 rounded-xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-semibold"><ChartColumn className="size-4 text-gold" aria-hidden="true" />Painel macro completo na plataforma</p>
                <p className="mt-1 text-sm text-white/70">Indicador de Buffett, curva de juros, câmbio, inflação e a sensibilidade macro da sua carteira.</p>
              </div>
              <ButtonLink href={m.links.app} cta="macro-buffett" variant="gold">Ver no app <ArrowRight /></ButtonLink>
            </div>
          </Section>

          <Section id="metodologia" title="Metodologia e fontes">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">Valor de mercado:</strong> total das empresas listadas publicado pela B3 (desde jul/2026, todo dia útil, com o fechamento do pregão anterior); Banco Central SGS 7849 de 2000 a ago/2019 (nov/2018 a jan/2019 interpolados por uma anomalia na fonte); dezembros de 2019 a 2025 do Banco Mundial/WFE, convertidos pela PTAX de 31/dez (SGS 3696). Meses entre essas âncoras são interpolados pelo Ibovespa e marcados como estimados no CSV.</li>
              <li><strong className="text-foreground">PIB:</strong> PIB acumulado em 12 meses, valores correntes (Banco Central SGS 4382), do mesmo mês; no mês corrente, o último publicado ({m.pibMonth}).</li>
              <li><strong className="text-foreground">Por que não usamos o percentual do Banco Mundial direto:</strong> ele converte o valor de mercado pelo câmbio de 31/dez e o PIB pelo câmbio médio do ano; em anos de real em queda o indicador sai artificialmente baixo (2015: 27,2% contra 31,9% em reais).</li>
              <li><strong className="text-foreground">Faixas:</strong> percentis 25 e 75 da série mensal desde {m.s.since}, recalculados a cada atualização.</li>
            </ul>
          </Section>

          <Section id="faq" title="Perguntas frequentes">
            <Card><CardContent className="px-6 py-2">{m.faq.map((f, i) => <AccordionItem key={i} question={f.q} open={i === 1}>{f.a}</AccordionItem>)}</CardContent></Card>
          </Section>
        </Container>
      </main>
      <MacroFooter app={m.links.app} sources={SOURCES_NOTE} />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur lg:hidden" role="complementary" aria-label="Painel macro na plataforma">
        <div className="flex items-center gap-3">
          <div className="min-w-0 leading-tight">
            <div className="font-mono text-sm font-bold">Buffett {m.vShort}%</div>
            <div className="text-xs text-muted-foreground">Painel macro completo</div>
          </div>
          <ButtonLink href={m.links.app} cta="macro-sticky" variant="gold" className="ml-auto">Ver no app <ArrowRight /></ButtonLink>
        </div>
      </div>
    </>
  );
}

export function MacroHubPage({ m }: { m: BuffettModel }) {
  return (
    <>
      <MacroHeader app={m.links.app} />
      <main className="py-6">
        <Container className="space-y-6">
          <MacroBreadcrumb items={[{ href: '/', label: 'IAções' }, { label: 'Macro' }]} />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Indicadores macro da bolsa brasileira</h1>
          <p className="max-w-2xl text-muted-foreground">Termômetros do mercado como um todo, com dado oficial e histórico desde {m.s.since}.</p>
          <a href={PAGE_PATH} className="block max-w-xl rounded-xl border bg-card p-6 transition-colors hover:border-gold/50">
            <div className="text-sm text-muted-foreground">Valor de mercado da B3 ÷ PIB</div>
            <div className="mt-1 text-xl font-bold">Indicador de Buffett Brasil</div>
            <div className="mt-3 font-mono text-4xl font-bold tnum">{m.v}%</div>
            <div className="mt-2 text-sm text-muted-foreground">Fechamento oficial de {m.dateBR} · {m.faixa}</div>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-strong">Ver gráfico e histórico <ArrowRight className="size-4" aria-hidden="true" /></div>
          </a>
        </Container>
      </main>
      <MacroFooter app={m.links.app} sources={SOURCES_NOTE} />
    </>
  );
}
