import * as React from 'react';
import type { TickerModel } from '../model';
import { brl, num, signedPct } from '../lib/format';
import { Container } from './chrome';
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { ButtonLink } from './ui/button';
import { Target } from 'lucide-react';
import { Lock, ArrowRight, Calculator } from './icons';
import { linkFerramenta } from './links-ferramentas';

const upsideVariant = (fv: number, price: number) => (fv > 0 ? (fv >= price ? 'positive' : 'negative') : 'neutral') as 'positive' | 'negative' | 'neutral';

function Slider({ id, label, min, max, step, value, suffix = '%', hint }: { id: string; label: string; min: number; max: number; step: number; value: number; suffix?: string; hint?: string }) {
  const pctPos = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <output htmlFor={id} id={`${id}-out`} className="font-mono text-sm font-semibold tnum">{num(value, step < 1 ? 1 : 0)}{suffix}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} defaultValue={value} data-suffix={suffix} className="slider" style={{ ['--pct' as string]: `${pctPos.toFixed(1)}%` }} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function WindowToggle({ name, label, avg }: { name: string; label: string; avg: TickerModel['div']['avg'] }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="inline-flex w-full rounded-md border bg-muted p-[3px]" role="radiogroup">
        {(['1', '3', '5', '10'] as const).map(y => (
          <label key={y} className="flex-1 cursor-pointer">
            <input type="radio" name={name} value={y} defaultChecked={y === '5'} className="peer sr-only" data-avg={avg[y].toFixed(6)} />
            <span className="block rounded-[5px] px-2 py-1 text-center text-xs font-semibold text-muted-foreground transition-colors peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40">{y} {y === '1' ? 'ano' : 'anos'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FairValue({ id, fv, price, na }: { id: string; fv: number; price: number; na: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-4 py-3">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preço justo</div>
      <div id={`${id}-fv`} className="font-mono text-3xl font-bold tracking-tight tnum">{fv > 0 ? brl(fv) : '—'}</div>
      <div id={`${id}-note`} className="text-xs text-muted-foreground">{fv > 0 ? `vs. cotação de ${brl(price)}` : na}</div>
    </div>
  );
}

function MethodCard({ id, title, desc, fv, price, na, children, footer, formula, alerta }: {
  id: string; title: string; desc: string; fv: number; price: number; na: string; children: React.ReactNode; footer: React.ReactNode; formula: string;
  /**
   * Aba "Minha tese" do ativo na plataforma (m.links.alerta), onde a pessoa registra o próprio
   * preço-alvo; cta por método (calc-alerta-<id>) para medir qual converte. O preço justo das
   * calculadoras não dispara alerta no app, e o aviso de preço-alvo é dos planos pagos (resumo
   * diário): o botão não promete alerta.
   */
  alerta: string;
}) {
  return (
    <Card className="gap-4" data-calc={id}>
      <CardHeader>
        <CardTitle as="h3" className="text-lg">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
        <CardAction>
          <Badge id={`${id}-upside`} variant={upsideVariant(fv, price)} className="font-mono tnum">{fv > 0 ? signedPct(fv / price - 1) : 'n/a'}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <FairValue id={id} fv={fv} price={price} na={na} />
        {children}
      </CardContent>
      <CardFooter className="mt-auto flex-col items-stretch gap-1.5 border-t pt-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1">{footer}</div>
        <code className="font-mono text-[11px] text-muted-foreground/90">{formula}</code>
        <ButtonLink href={alerta} cta={`calc-alerta-${id}`} className="mt-2 w-full"><Target /> Registrar meu preço-alvo</ButtonLink>
      </CardFooter>
    </Card>
  );
}

function SummaryChart({ m }: { m: TickerModel }) {
  const rows = [
    { id: 'graham', label: 'Graham', fv: m.calc.graham.fv },
    { id: 'bazin', label: 'Bazin', fv: m.calc.bazin.fv },
    { id: 'gordon', label: 'Gordon', fv: m.calc.gordon.fv },
  ];
  const scale = Math.max(m.price * 1.5, ...rows.map(r => r.fv)) * 1.08;
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100)).toFixed(1)}%`;
  const open = rows.filter(r => r.fv > 0);
  const avg = open.length ? open.reduce((s, r) => s + r.fv, 0) / open.length : 0;
  return (
    <Card className="h-full lg:col-span-5" id="resumo-metodos">
      <CardHeader>
        <CardTitle as="h3" className="text-lg">Preço justo por método</CardTitle>
        <CardDescription>Atualiza conforme você mexe nas premissas. Linha tracejada = cotação.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="relative space-y-3" data-scale={scale.toFixed(4)}>
          <div id="sum-price-line" className="pointer-events-none absolute -top-1 -bottom-1 z-10 border-l-2 border-dashed border-foreground/70" style={{ left: `calc(5.5rem + (100% - 5.5rem - 5.5rem) * ${(m.price / scale).toFixed(4)})` }} aria-hidden="true" />
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center gap-0">
              <span className="text-sm font-semibold">{r.label}</span>
              <div className="h-7 rounded-md bg-muted">
                <div id={`sum-${r.id}-bar`} className={`h-full rounded-md transition-[width] duration-300 ${r.fv >= m.price ? 'bg-positive' : 'bg-negative/85'}`} style={{ width: w(r.fv) }} />
              </div>
              <span id={`sum-${r.id}-val`} className="pl-2 text-right font-mono text-sm font-semibold tnum">{r.fv > 0 ? brl(r.fv) : '—'}</span>
            </div>
          ))}
          <a href={m.links.dcf} data-cta="dcf-locked" className="group grid grid-cols-[5.5rem_1fr_5.5rem] items-center" aria-label={`Ver o preço justo de ${m.symbol} pelo DCF na plataforma`}>
            <span className="flex items-center gap-1 text-sm font-semibold">DCF <Lock className="size-3.5 text-gold" /></span>
            <div className="relative h-7 overflow-hidden rounded-md bg-muted">
              <div className="h-full w-3/5 rounded-md bg-gold/60 locked-blur" />
              <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-gold-strong group-hover:underline">Desbloquear grátis</span>
            </div>
            <span className="pl-2 text-right font-mono text-sm font-semibold text-muted-foreground"><span className="locked-blur">R$ 00</span></span>
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 px-4 py-3">
          <div>
            <div className="text-xs text-muted-foreground">Média dos métodos abertos</div>
            <div id="sum-avg" className="font-mono text-xl font-bold tnum">{avg > 0 ? brl(avg) : '—'}</div>
          </div>
          <Badge id="sum-avg-upside" variant={upsideVariant(avg, m.price)} className="font-mono text-sm tnum">{avg > 0 ? signedPct(avg / m.price - 1) : 'n/a'}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function SensitivityLocked({ m }: { m: TickerModel }) {
  const dcf = linkFerramenta('dcf');
  const cols = m.dcf.gAxis.length ? m.dcf.gAxis : [0.04, 0.045, 0.05, 0.055, 0.06];
  const rows = m.dcf.waccAxis.length ? m.dcf.waccAxis : [0.13, 0.135, 0.14, 0.145, 0.15];
  return (
    <Card className="relative h-full overflow-hidden lg:col-span-7">
      <CardHeader>
        <CardTitle as="h3" className="text-lg">DCF de {m.symbol}: matriz de sensibilidade</CardTitle>
        <CardDescription>Preço justo para cada combinação de WACC e crescimento na perpetuidade.</CardDescription>
        <CardAction className="hidden sm:block"><Badge variant="pro">PRO · grátis no cadastro</Badge></CardAction>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <table className="w-full border-separate border-spacing-1 font-mono text-xs tnum" aria-describedby="dcf-lock-msg">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-semibold text-muted-foreground">WACC \ g</th>
                {cols.map((g, i) => <th key={i} className="px-2 py-1 font-semibold text-muted-foreground">{num(g * 100, 1)}%</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, r) => (
                <tr key={r}>
                  <th className="px-2 py-1 text-left font-semibold text-muted-foreground">{num(w * 100, 1)}%</th>
                  {cols.map((_, c) => {
                    const t = (c - r + 4) / 8;
                    return (
                      <td key={c} className={`h-9 rounded-md text-center ${r === 2 && c === 2 ? 'ring-2 ring-gold' : ''}`} style={{ background: `color-mix(in srgb, var(--positive) ${Math.round(t * 45)}%, color-mix(in srgb, var(--negative) ${Math.round((1 - t) * 45)}%, white))` }}>
                        <span className="locked-blur">R$ 00,00</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="absolute inset-0 grid place-items-center">
            <div className="mx-4 max-w-sm rounded-xl border bg-card/95 p-5 text-center shadow-lg backdrop-blur">
              <div className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-gold/15 text-gold-strong"><Lock className="size-4" /></div>
              <p id="dcf-lock-msg" className="text-sm font-semibold">O DCF é o único método que olha o caixa que {m.symbol} vai gerar, não só o passado.</p>
              <p className="mt-1 text-xs text-muted-foreground">Projeção de receita, custos e capex, com WACC decomposto. A IA propõe as premissas e você decide.</p>
              <ButtonLink href={m.links.dcf} cta="dcf-locked" variant="default" className="mt-4 w-full">Fazer o DCF de {m.symbol} <ArrowRight /></ButtonLink>
              {dcf && <a href={dcf} data-track="tk-dcf" className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline">Como funciona o fluxo de caixa descontado →</a>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Calculators({ m }: { m: TickerModel }) {
  const { graham, bazin, gordon } = m.calc;
  const hasDiv = m.div.avg['5'] > 0 || m.div.avg['10'] > 0;
  const calc = linkFerramenta('calc');
  return (
    <section id="calculadoras" className="scroll-mt-20 py-10" aria-labelledby="calc-title">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gold-strong uppercase"><Calculator className="size-3.5" /> Calculadoras de preço justo</p>
            <h2 id="calc-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Calcule o preço justo de {m.symbol}</h2>
            <p className="mt-1 text-muted-foreground">Três métodos clássicos com premissas ajustáveis. O resultado muda na hora, calculado no seu navegador.</p>
            {calc && (
              <p className="mt-1 text-sm text-muted-foreground">
                Para outra ação ou para digitar os números à mão, use a <a href={calc} data-track="tk-calculadora" className="font-medium text-primary underline-offset-2 hover:underline">calculadora de preço justo e preço teto</a>.
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-card px-4 py-2 text-right">
            <div className="text-xs text-muted-foreground">Cotação de referência</div>
            <div className="font-mono text-lg font-bold tnum">{brl(m.price)}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MethodCard
            id="graham" title="Graham" desc="Valor intrínseco por lucro e patrimônio" fv={graham.fv} price={m.price} alerta={`${m.links.alerta}&metodo=graham`}
            na="Não se aplica: LPA ou VPA negativo."
            formula="√(P/L máx. × P/VP máx. × LPA × VPA) × (1 − margem)"
            footer={<><span>LPA <strong className="font-mono text-foreground">{brl(graham.lpa)}</strong></span><span>VPA <strong className="font-mono text-foreground">{brl(graham.vpa)}</strong></span></>}
          >
            <Slider id="graham-pl" label="P/L máximo" min={8} max={25} step={0.5} value={15} suffix="x" />
            <Slider id="graham-pvp" label="P/VP máximo" min={0.5} max={3} step={0.1} value={1.5} suffix="x" />
            <Slider id="graham-margin" label="Margem de segurança" min={0} max={50} step={1} value={0} />
          </MethodCard>

          <MethodCard
            id="bazin" title="Bazin" desc="Preço teto pelos dividendos" fv={bazin.fv} price={m.price} alerta={`${m.links.alerta}&metodo=bazin`}
            na={hasDiv ? 'Sem dividendos na janela escolhida.' : 'Não se aplica: sem dividendos nos últimos 10 anos.'}
            formula="dividendo médio anual ÷ DY mínimo"
            footer={<><span>Proventos 12m <strong className="font-mono text-foreground">{brl(m.div.ttm)}</strong></span><span>DY atual <strong className="font-mono text-foreground">{m.div.dyTTM > 0 ? `${num(m.div.dyTTM * 100, 1)}%` : '—'}</strong></span></>}
          >
            <Slider id="bazin-dy" label="Dividend yield mínimo" min={3} max={12} step={0.5} value={6} />
            <WindowToggle name="bazin-win" label="Média de dividendos dos últimos" avg={m.div.avg} />
          </MethodCard>

          <MethodCard
            id="gordon" title="Gordon (DDM)" desc="Desconto de dividendos com crescimento" fv={gordon.fv} price={m.price} alerta={`${m.links.alerta}&metodo=gordon`}
            na={hasDiv ? 'Ajuste: a taxa de desconto precisa ser maior que o crescimento.' : 'Não se aplica: sem dividendos nos últimos 10 anos.'}
            formula="D₀ × (1 + g) ÷ (r − g)"
            footer={<><span>Média 5 anos <strong className="font-mono text-foreground">{brl(m.div.avg['5'])}</strong>/ação</span></>}
          >
            <Slider id="gordon-r" label="Taxa de desconto (r)" min={8} max={25} step={0.5} value={14} />
            <Slider id="gordon-g" label="Crescimento perpétuo (g)" min={0} max={10} step={0.5} value={4} />
            <WindowToggle name="gordon-win" label="Dividendo base: média dos últimos" avg={m.div.avg} />
          </MethodCard>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <SummaryChart m={m} />
          <SensitivityLocked m={m} />
        </div>
      </Container>
    </section>
  );
}
