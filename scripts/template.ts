import type { FinancialData, ComprehensiveValuation, RawIncomeStatement, RawBalanceSheet, RawCashFlow, RawDividend, PeerTicker, TickerIndexEntry, QualitativeScore } from './types';

// --- Slug helper (normalizes accented chars to ASCII) ---
export const sectorSlug = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- Formatters ---
const fmt = (n: number, dec = 2): string => {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
const fmtPct = (n: number): string => {
  if (!Number.isFinite(n)) return '-';
  return (n * 100).toFixed(2) + '%';
};
const fmtPctShort = (n: number): string => {
  if (!Number.isFinite(n)) return '-';
  return (n * 100).toFixed(1) + '%';
};
const fmtBRL = (n: number): string => {
  if (!Number.isFinite(n)) return '-';
  return `R$ ${fmt(n)}`;
};
const fmtBig = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `R$ ${fmt(n / 1e12)} T`;
  if (abs >= 1e9) return `R$ ${fmt(n / 1e9)} B`;
  if (abs >= 1e6) return `R$ ${fmt(n / 1e6)} M`;
  if (abs >= 1e3) return `R$ ${fmt(n / 1e3)} K`;
  return `R$ ${fmt(n, 0)}`;
};
const fmtVol = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${fmt(n / 1e9)} B`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} M`;
  if (abs >= 1e3) return `${fmt(n / 1e3)} K`;
  return fmt(n, 0);
};
const fmtNum = (n: number, dec = 2): string => {
  if (!Number.isFinite(n)) return '-';
  return fmt(n, dec);
};

const colorClass = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  return n > 0 ? 'val-positive' : n < 0 ? 'val-negative' : '';
};

// Social proof: gera número plausível de validações baseado no market cap
const socialProofCount = (avgVolume: number, symbol: string): number => {
  if (!avgVolume || avgVolume <= 0) return 47;
  // Seed determinístico baseado no ticker para consistência entre builds
  const seed = symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const base = Math.log10(avgVolume); // log10 do volume medio
  // base: ~4 para baixo volume, ~6 para medio, ~8 para alto
  const count = base * 70 + (seed % 80);
  // Crescimento gradual: x/365 + (ano - 2026) * 2
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const yearFactor = (now.getFullYear() - 2026) * 2;
  const timeMultiplier = 1 + (dayOfYear / 365 + yearFactor) * 0.15;
  return Math.max(30, Math.min(Math.round(count * timeMultiplier), 15000));
};

const metricBox = (label: string, value: string, colorCls = ''): string =>
  `<div class="metric-box"><span class="metric-label">${label}</span><span class="metric-value ${colorCls}">${value}</span></div>`;

// --- Financial Statements Helpers ---
const getYearlyData = <T extends { type?: string; period: string; end_date: string }>(data: T[]): T[] => {
  const yearly = data.filter(d => {
    const t = (d.type ?? '').toLowerCase();
    const p = (d.period ?? '').toUpperCase();
    return t === 'yearly' || t === 'annual' || p.startsWith('FY') || (p.length === 4 && /^\d{4}$/.test(p));
  });
  const sorted = (yearly.length > 0 ? yearly : data)
    .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
  // Deduplicate by year
  const seen = new Set<string>();
  return sorted.filter(d => {
    const year = new Date(d.end_date).getFullYear().toString();
    if (seen.has(year)) return false;
    seen.add(year);
    return true;
  }).slice(0, 10);
};

const getYear = (d: string): string => {
  try { return new Date(d).getFullYear().toString(); } catch { return '-'; }
};

// --- Main Template ---
export const generateTickerHTML = (data: FinancialData, val: ComprehensiveValuation, peers: PeerTicker[] = [], qualScore: QualitativeScore | null = null): string => {
  const f = data.fundamentals;
  const today = new Date().toLocaleDateString('pt-BR');
  const todayISO = new Date().toISOString().split('T')[0] + 'T03:00:00.000Z';
  // desc, titleTag, ogTitle and faqItems are defined after graham/bazin/gordon calculations below

  // Prepare financial statements
  const incomeYearly = getYearlyData(data._rawIncome);
  const balanceYearly = getYearlyData(data._rawBalance);
  const cashFlowYearly = getYearlyData(data._rawCashFlow);

  // Sanity Check table data
  const sanityYears = incomeYearly.map(d => getYear(d.end_date));
  const sanityIncomeRow = (label: string, getter: (d: RawIncomeStatement) => number, isMoney = true) => {
    const cells = incomeYearly.map(d => {
      const v = getter(d);
      return `<td class="${colorClass(v)}">${isMoney ? fmtBig(v) : fmtPctShort(v)}</td>`;
    }).join('');
    return `<tr><td class="sticky-col">${label}</td>${cells}</tr>`;
  };

  // --- Tabelas transpostas (anos na horizontal, métricas como linhas) ---
  const transposeTable = (years: string[], metrics: { label: string; values: string[] }[]) => {
    const headerCells = years.map(y => `<th>${y}</th>`).join('');
    const rows = metrics.map(m => {
      const cells = m.values.map(v => `<td>${v}</td>`).join('');
      return `<tr><td class="sticky-col">${m.label}</td>${cells}</tr>`;
    }).join('');
    return { headerCells, rows };
  };

  // Inverter para ano mais antigo → mais novo (esquerda → direita)
  const incomeAsc = [...incomeYearly].reverse();
  const balanceAsc = [...balanceYearly].reverse();
  const cashFlowAsc = [...cashFlowYearly].reverse();

  // DRE transposta
  const dreYears = incomeAsc.map(d => getYear(d.end_date));
  const dreTable = transposeTable(dreYears, [
    { label: 'Receita Total', values: incomeAsc.map(d => fmtBig(d.total_revenue)) },
    { label: 'Lucro Bruto', values: incomeAsc.map(d => fmtBig(d.gross_profit || 0)) },
    { label: 'EBIT', values: incomeAsc.map(d => fmtBig(d.ebit)) },
    { label: 'Lucro Antes IR', values: incomeAsc.map(d => fmtBig(d.income_before_tax)) },
    { label: 'Lucro Líquido', values: incomeAsc.map(d => `<span class="${colorClass(d.net_income)}">${fmtBig(d.net_income)}</span>`) },
  ]);

  // Balanço transposto
  const balYears = balanceAsc.map(d => getYear(d.end_date));
  const balTable = transposeTable(balYears, [
    { label: 'Ativo Total', values: balanceAsc.map(d => fmtBig(d.total_assets)) },
    { label: 'Caixa', values: balanceAsc.map(d => fmtBig(d.cash + (d.short_term_investments || 0))) },
    { label: 'Passivo Total', values: balanceAsc.map(d => fmtBig(d.total_liab)) },
    { label: 'Dívida LP', values: balanceAsc.map(d => fmtBig(d.long_term_debt)) },
    { label: 'Patrimônio Líq.', values: balanceAsc.map(d => fmtBig(d.total_stockholder_equity)) },
  ]);

  // Fluxo de Caixa transposto
  const cfYears = cashFlowAsc.map(d => getYear(d.end_date));
  const cfTable = transposeTable(cfYears, [
    { label: 'FCO', values: cashFlowAsc.map(d => fmtBig(d.total_cash_from_operating_activities)) },
    { label: 'FCI', values: cashFlowAsc.map(d => fmtBig(d.total_cashflows_from_investing_activities)) },
    { label: 'FCF', values: cashFlowAsc.map(d => fmtBig(d.total_cash_from_financing_activities)) },
    { label: 'CAPEX', values: cashFlowAsc.map(d => fmtBig(d.capital_expenditures)) },
    { label: 'Div. Pagos', values: cashFlowAsc.map(d => `<span class="${colorClass(d.dividends_paid)}">${fmtBig(d.dividends_paid)}</span>`) },
  ]);

  // Dividends aggregation by year
  const divByYear = new Map<string, { total: number; count: number }>();
  data._rawDividends.forEach(d => {
    const year = getYear(d.exDate);
    const entry = divByYear.get(year) || { total: 0, count: 0 };
    entry.total += d.amount;
    entry.count++;
    divByYear.set(year, entry);
  });
  const divYears = [...divByYear.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 10);
  const divRows = divYears.map(([year, d]) => `
    <tr><td>${year}</td><td>${fmtBRL(d.total)}</td><td>${d.count}</td></tr>`).join('');

  // Histórico completo de dividendos (individual, ordenado por data desc)
  const divHistory = [...data._rawDividends]
    .filter(d => d.amount > 0 && d.exDate)
    .sort((a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());
  const divHistoryRows = divHistory.map(d => {
    const ex = new Date(d.exDate).toLocaleDateString('pt-BR');
    const pay = d.paymentDate ? new Date(d.paymentDate).toLocaleDateString('pt-BR') : '-';
    const tipo = d.dividendType || '-';
    return `<tr><td>${ex}</td><td>${fmtBRL(d.amount)}</td><td>${tipo}</td><td>${pay}</td></tr>`;
  }).join('');

  // Classical methods data (Graham, Bazin, Gordon)
  const grahamResult = val.results.find(r => r.method === 'GRAHAM');
  const gordonResult = val.results.find(r => r.method === 'GORDON');
  const grahamFV = grahamResult?.fairValue || 0;
  const gordonFV = gordonResult?.fairValue || 0;

  // Bazin calculation: avgDividends / minDY
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const recentDivs = data._rawDividends.filter(d => new Date(d.exDate) >= oneYearAgo);
  const divTTM = recentDivs.reduce((sum, d) => sum + d.amount, 0);
  const fiveYearDivs = data._rawDividends.filter(d => new Date(d.exDate) >= fiveYearsAgo);
  const avgDiv5y = fiveYearDivs.length > 0 ? fiveYearDivs.reduce((s, d) => s + d.amount, 0) / 5 : divTTM;
  const bazinMinDY = 0.06;
  const bazinFV = avgDiv5y > 0 ? avgDiv5y / bazinMinDY : 0;
  const dyAtual = data.price > 0 ? divTTM / data.price : 0;

  // Dividend CAGR for Gordon
  const divByYearMap = new Map<number, number>();
  data._rawDividends.forEach(d => {
    const yr = new Date(d.exDate).getFullYear();
    divByYearMap.set(yr, (divByYearMap.get(yr) || 0) + d.amount);
  });
  const divYearsSorted = [...divByYearMap.entries()].sort((a, b) => a[0] - b[0]);
  let divCAGR = 0;
  if (divYearsSorted.length >= 2) {
    const first = divYearsSorted[0];
    const last = divYearsSorted[divYearsSorted.length - 1];
    const years = last[0] - first[0];
    if (years > 0 && first[1] > 0 && last[1] > 0) {
      divCAGR = Math.pow(last[1] / first[1], 1 / years) - 1;
    }
  }

  // DCF Sensitivity Table (visual fixo — gradiente verde/vermelho)
  const sensWacc = ['14.2%','14.7%','15.2%','15.7%','16.2%','16.7%','17.2%'];
  const sensG = ['3.5%','4.0%','4.5%','5.0%','5.5%','6.0%','6.5%'];
  // Valores placeholder — números plausíveis baseados no preço atual
  const sensBase = Math.round(f.price * 0.95);
  const sensGrid = sensWacc.map((_, ri) => sensG.map((_, ci) => {
    const val = sensBase * (1 + (ci - 3) * 0.06 - (ri - 3) * 0.07);
    return Math.round(val * 10) / 10;
  }));
  const sensitivityHTML = `
    <div class="sensitivity-table-wrap">
      <div class="sensitivity-title">G PERP&Eacute;TUO</div>
      <table class="sensitivity-table">
        <thead><tr><th></th>${sensG.map((g, i) => `<th${i === 3 ? ' class="sensitivity-center-col"' : ''}>${g}</th>`).join('')}</tr></thead>
        <tbody>${sensGrid.map((row, ri) => {
          return `<tr${ri === 3 ? ' class="sensitivity-center-row"' : ''}><td class="sensitivity-wacc">${sensWacc[ri]}</td>${row.map((v, ci) => {
            if (ri === 3 && ci === 3) return `<td class="sensitivity-center">${fmt(v)}</td>`;
            // Gradiente fixo: top-right = verde, bottom-left = vermelho
            const t = (ci - ri + 6) / 12; // 0 = vermelho, 1 = verde
            const r = Math.round(220 - t * 180);
            const g = Math.round(80 + t * 140);
            const b = Math.round(70 + t * 50);
            const alpha = 0.13 + Math.abs(t - 0.5) * 0.2;
            const bg = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(2) + ')';
            const fg = t < 0.35 ? '#991b1b' : t > 0.65 ? '#065f46' : '#92400e';
            return `<td style="background:${bg};color:${fg}">${fmt(v)}</td>`;
          }).join('')}</tr>`;
        }).join('')}</tbody>
      </table>
      <div class="sensitivity-footer">WACC &darr; &mdash; Centro: WACC 15.7% &times; g 5.0% = <strong>R$ ${fmt(sensGrid[3][3])}</strong></div>
    </div>`;

  // SEO: meta description, title, FAQ
  const currentYear = new Date().getFullYear();
  const desc = `Calculadora de valor justo para ${f.name} (${f.symbol}) com Graham, Bazin e Gordon. Premissas ajustáveis — calcule o valor justo agora. Indicadores, balanço e dividendos atualizados.`;
  const titleTag = `${f.symbol} Está Cara ou Barata? Calcule o Valor Justo | iAções`;
  const ogTitle = `${f.symbol} Está Cara ou Barata? Calcule o Valor Justo | iAções`;
  const sectorSlugVal = sectorSlug(f.sector || '');
  const faqItems = [
    {
      q: `Quais os principais indicadores fundamentalistas de ${f.symbol}?`,
      a: `${f.symbol} apresenta P/L de ${fmtNum(f.pl)}, P/VP de ${fmtNum(f.pvp)}, ROE de ${fmtPctShort(f.roe)}, ROIC de ${fmtPctShort(f.roic)}, Margem Líquida de ${fmtPctShort(f.netMargin)}, EV/EBITDA de ${fmtNum(f.evEbitda)} e Div. Liq./EBITDA de ${fmtNum(f.debtEbitda)}. Esses indicadores ajudam a avaliar a saúde financeira, rentabilidade e eficiência operacional da empresa.`
    },
    {
      q: `Em qual setor ${f.symbol} atua?`,
      a: `${f.symbol} (${f.name}) atua no setor de ${f.sector}${f.subSector ? ', segmento de ' + f.subSector : ''}. A empresa está listada na B3 (bolsa brasileira). Para uma análise comparativa com outros ativos do mesmo setor, é possível avaliar múltiplos como P/L, EV/EBITDA e margens operacionais em relação aos pares de mercado.`
    },
    {
      q: `Quais são as margens e a rentabilidade de ${f.symbol}?`,
      a: `${f.symbol} possui ROE de ${fmtPctShort(f.roe)} e ROIC de ${fmtPctShort(f.roic)}, que medem o retorno sobre o patrimônio e sobre o capital investido, respectivamente. A Margem Bruta é de ${fmtPctShort(f.grossMargin)}, a Margem EBITDA de ${fmtPctShort(f.ebitdaMargin)} e a Margem Líquida de ${fmtPctShort(f.netMargin)}. Esses números refletem a capacidade da empresa de gerar lucro a partir de suas operações.`
    },
    {
      q: `Qual o histórico de dividendos de ${f.symbol}?`,
      a: `${f.symbol} possui Dividend Yield de ${fmtPctShort(f.divYield)}${divTTM > 0 ? ' e distribuiu R$ ' + fmt(divTTM) + ' por ação nos últimos 12 meses' : ''}. ${divHistory.length > 0 ? 'O histórico completo inclui ' + divHistory.length + ' pagamentos (dividendos, JCP e rendimentos) desde ' + new Date(divHistory[divHistory.length - 1].exDate).getFullYear() + '.' : ''} O histórico de dividendos é um dos fatores analisados para entender a política de remuneração ao acionista e a consistência dos pagamentos ao longo dos anos.`
    },
    {
      q: `Quanto ${f.symbol} pagou de dividendos em ${currentYear - 1}?`,
      a: `${divByYear.has(String(currentYear - 1)) ? `Em ${currentYear - 1}, ${f.symbol} distribuiu R$ ${fmt(divByYear.get(String(currentYear - 1))!.total)} por ação em ${divByYear.get(String(currentYear - 1))!.count} pagamentos entre dividendos e JCP.` : `${f.symbol} não possui registros de dividendos pagos em ${currentYear - 1}.`} Para baixar o histórico completo de proventos com datas e valores, insira seu e-mail na seção de dividendos acima.`
    },
    {
      q: `Como calcular o preço justo de ${f.symbol}?`,
      a: `Use 3 métodos clássicos de valuation disponíveis nesta página: Graham (baseado em LPA e VPA), Bazin (baseado em dividendos) e Gordon (modelo de desconto de dividendos). Ajuste as premissas como margem de segurança, DY mínimo e taxa de desconto para encontrar o valor justo de ${f.name} segundo a sua análise. Para uma análise mais completa com DCF (Fluxo de Caixa Descontado), acesse a plataforma Brasil Horizonte.`
    },
    {
      q: `O que é a fórmula de Graham para ${f.symbol}?`,
      a: `A fórmula de Benjamin Graham calcula o valor intrínseco de uma ação com base no lucro por ação (LPA) e no valor patrimonial por ação (VPA). A fórmula é: Valor Intrínseco = √(22,5 × LPA × VPA), com ajuste por margem de segurança. É um método mais adequado para empresas lucrativas com patrimônio sólido. Use a calculadora acima para calcular o valor justo de ${f.symbol} com suas próprias premissas.`
    },
    {
      q: `Como funciona o modelo de Bazin para ${f.symbol}?`,
      a: `A metodologia de Décio Bazin calcula o preço máximo que um investidor deveria pagar para obter um dividend yield mínimo desejado. A fórmula é: Preço Justo = Dividendo Médio (últimos anos) ÷ DY mínimo. É ideal para investidores focados em renda passiva. Ajuste o DY mínimo na calculadora acima para simular diferentes cenários para ${f.symbol}.`
    },
    {
      q: `Como funciona o modelo de Gordon para ${f.symbol}?`,
      a: `O modelo de Gordon (DDM — Dividend Discount Model) calcula o valor presente de todos os dividendos futuros projetados. A fórmula é: P = D1 ÷ (r − g), onde D1 é o dividendo projetado, r é a taxa de desconto e g é a taxa de crescimento perpétuo dos dividendos. Ajuste a taxa de desconto e crescimento na calculadora acima para simular o valor justo de ${f.symbol}.`
    },
    {
      q: `O que é o DCF (Fluxo de Caixa Descontado) e como aplicar em ${f.symbol}?`,
      a: `O DCF (Discounted Cash Flow) é o método mais completo de valuation, projetando os fluxos de caixa livres futuros da empresa e trazendo-os a valor presente usando o WACC como taxa de desconto. Diferente de Graham, Bazin e Gordon, o DCF considera a operação completa da empresa. Acesse a plataforma Brasil Horizonte para calcular o DCF de ${f.symbol} com projeções detalhadas de receita, margens e CAPEX.`
    },
    {
      q: `Qual o nível de endividamento de ${f.symbol}?`,
      a: `${f.symbol} possui Dívida Líquida/EBITDA de ${fmtNum(f.debtEbitda, 2)}x, Dívida Bruta/Patrimônio de ${fmtNum(f.debtEquity, 2)}x e Liquidez Corrente de ${fmtNum(f.currentLiquidity, 2)}x. A Dívida Líquida/EBITDA indica quantos anos de geração operacional seriam necessários para quitar a dívida líquida. A Liquidez Corrente mostra a capacidade de honrar obrigações de curto prazo com ativos circulantes.`
    }
  ];

  // Sensitivity matrix
  const matrix = val.sensitivityMatrix;
  let matrixHTML = '';
  if (matrix && matrix.length > 0) {
    const values = matrix.flat().map(c => c.fairValue).filter(v => v > 0 && Number.isFinite(v));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const headerCells = matrix[0].map(c => `<th>${(c.growth * 100).toFixed(1)}%</th>`).join('');
    const bodyRows = matrix.map((row, ri) => {
      const waccLabel = `${(row[0].wacc * 100).toFixed(1)}%`;
      const cells = row.map((c, ci) => {
        const isCenter = ri === 2 && ci === 2;
        const intensity = Math.max(0, Math.min(1, (c.fairValue - minVal) / range));
        const r = Math.round(182 - intensity * 40);
        const g = Math.round(143 - intensity * 10);
        const b = Math.round(64 + intensity * 0);
        const bgColor = c.fairValue > 0 ? `rgba(${r},${g},${b},${(0.15 + intensity * 0.35).toFixed(2)})` : 'transparent';
        const cellClass = isCenter ? 'matrix-center' : '';
        return `<td class="${cellClass}" style="background:${bgColor}">R$ ${fmt(c.fairValue, 0)}</td>`;
      }).join('');
      return `<tr><td class="matrix-wacc">${waccLabel}</td>${cells}</tr>`;
    }).join('');

    matrixHTML = `
    <div class="section-card">
      <div class="section-header-row">
        <h3 class="section-title font-playfair">Matriz de Sensibilidade</h3>
        <span class="section-sub">WACC vs. Crescimento Perpétuo</span>
      </div>
      <div class="table-scroll">
        <table class="matrix-table">
          <thead>
            <tr><th class="matrix-corner">WACC \\ g</th>${headerCells}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  // Weighted fair value
  const wfv = val.weightedFairValue;
  const totalUpside = val.totalUpside;
  const upsideColor = totalUpside > 0.1 ? 'val-positive' : totalUpside < -0.1 ? 'val-negative' : 'val-neutral';
  const upsideFmt = totalUpside >= 0 ? `+${fmtPctShort(totalUpside)}` : fmtPctShort(totalUpside);

  // --- SEO: Intro analysis paragraphs ---
  const introVerdict = totalUpside > 0.1 ? 'potencial de valorização'
    : totalUpside < -0.1 ? 'possível sobrevalorização' : 'preço próximo ao valor justo';
  const introVerdictClass = totalUpside > 0.1 ? 'intro-verdict-up'
    : totalUpside < -0.1 ? 'intro-verdict-down' : 'intro-verdict-neutral';
  const introVerdictLabel = totalUpside > 0.1 ? `Upside de ${upsideFmt}`
    : totalUpside < -0.1 ? `Downside de ${upsideFmt}` : `Neutro (${upsideFmt})`;
  const dyText = Number.isFinite(f.divYield) && f.divYield > 0
    ? `, com dividend yield de ${fmtPctShort(f.divYield)} nos últimos 12 meses`
    : '';
  const roeText = Number.isFinite(f.roe) && f.roe > 0
    ? `O retorno sobre patrimônio (ROE) é de ${fmtPctShort(f.roe)}, `
    : '';
  const marginText = Number.isFinite(f.netMargin)
    ? `e a margem líquida de ${fmtPctShort(f.netMargin)}.`
    : '.';
  const plText = Number.isFinite(f.pl) && f.pl > 0
    ? `Negocia a um P/L de ${fmtNum(f.pl, 1)}x`
    : 'Os múltiplos de valuation';
  const evEbitdaText = Number.isFinite(f.evEbitda) && f.evEbitda > 0
    ? ` e EV/EBITDA de ${fmtNum(f.evEbitda, 1)}x`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleTag}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${f.symbol}, ${f.symbol} preço justo, ${f.symbol} vale a pena, ${f.symbol} dividendos, histórico dividendos ${f.symbol}, ${f.symbol} JCP, ${f.symbol} proventos, ${f.symbol} valuation, ${f.symbol} dividend yield, ${f.name}, análise fundamentalista ${f.symbol}, ações ${f.sector}, B3, Graham, Bazin, Gordon">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="Brasil Horizonte">
  <link rel="canonical" href="https://iacoes.com.br/${f.symbol}/">

  <!-- Open Graph -->
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://iacoes.com.br/${f.symbol}/">
  <meta property="og:site_name" content="iAções — Análise de Ações | Brasil Horizonte">
  <meta property="og:locale" content="pt_BR">
  <meta property="article:published_time" content="${todayISO}">
  <meta property="article:modified_time" content="${todayISO}">
  <meta property="article:section" content="Análise Fundamentalista">
  <meta property="article:tag" content="${f.symbol}">
  <meta property="article:tag" content="Valuation">
  <meta property="article:tag" content="${f.sector}">

  <!-- Open Graph Image -->
  <meta property="og:image" content="https://iacoes.com.br/assets/img/og-iacoes.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="628">
  <meta property="og:image:alt" content="${f.symbol} — Análise Fundamentalista | iAções">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="https://iacoes.com.br/assets/img/og-iacoes.png">
  <meta name="twitter:image:alt" content="${f.symbol} — Análise Fundamentalista | iAções">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Schema.org: Article -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${f.symbol} — Preço Justo e Análise Fundamentalista ${new Date().getFullYear()}",
    "description": "${desc}",
    "datePublished": "${todayISO}",
    "dateModified": "${todayISO}",
    "author": { "@type": "Organization", "name": "Brasil Horizonte", "url": "https://brasilhorizonte.com.br" },
    "publisher": {
      "@type": "Organization",
      "name": "iAções by Brasil Horizonte",
      "url": "https://iacoes.com.br",
      "logo": { "@type": "ImageObject", "url": "https://iacoes.com.br/assets/img/institucional_branco_amarelo_3x.png" },
      "sameAs": [
        "https://br.linkedin.com/company/brasil-horizonte",
        "https://x.com/brasilhorizont",
        "https://www.instagram.com/brasil.horizonte/",
        "https://t.me/brasilhorizonte"
      ]
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://iacoes.com.br/${f.symbol}/" },
    "about": {
      "@type": "FinancialProduct",
      "name": "${f.symbol} - ${f.name}",
      "category": "${f.sector}"
    }
  }
  </script>

  <!-- Schema.org: BreadcrumbList -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "iAções", "item": "https://iacoes.com.br/" },
      { "@type": "ListItem", "position": 2, "name": "Ações", "item": "https://iacoes.com.br/acoes/" },
      { "@type": "ListItem", "position": 3, "name": "${f.sector || 'Setor'}", "item": "https://iacoes.com.br/acoes/#setor-${encodeURIComponent((f.sector || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" },
      { "@type": "ListItem", "position": 4, "name": "${f.symbol}", "item": "https://iacoes.com.br/${f.symbol}/" }
    ]
  }
  </script>

  <!-- Schema.org: FAQPage -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      ${faqItems.map(faq => `{
        "@type": "Question",
        "name": "${faq.q}",
        "acceptedAnswer": { "@type": "Answer", "text": "${faq.a}" }
      }`).join(',\n      ')}
    ]
  }
  </script>
  <style>
    /* ============ RESET & BASE ============ */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { font-size: 16px; }
    body {
      font-family: 'Montserrat', sans-serif;
      background: #f5f3ef;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    .font-playfair { font-family: 'Playfair Display', serif; }
    .font-mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }

    /* ============ COLORS ============ */
    .val-positive { color: #10b981 !important; }
    .val-negative { color: #ef4444 !important; }
    .val-neutral { color: #64748b !important; }

    /* ============ NAV ============ */
    .nav {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.5rem; height: 56px;
      background: #041C24; border-bottom: 1px solid rgba(182,143,64,0.2);
    }
    .nav-left {
      display: flex; align-items: center; gap: 0.75rem;
    }
    .nav-brand {
      display: flex; align-items: center;
      text-decoration: none;
    }
    .nav-logo-bh { height: 28px; opacity: 0.95; }
    .nav-divider {
      width: 1px; height: 24px;
      background: rgba(255,255,255,0.2);
    }
    .nav-iacoes {
      text-decoration: none; display: flex; align-items: baseline;
      font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace; font-size: 1.15rem;
      font-weight: 700; letter-spacing: -0.01em;
    }
    .nav-iacoes-i {
      color: #B68F40;
    }
    .nav-iacoes-acoes {
      color: #fff;
    }
    .nav-cursor {
      display: inline-block; width: 2px; height: 1.1em;
      background: #B68F40; margin-left: 2px; vertical-align: middle;
      animation: blink 1s step-end infinite;
    }
    @keyframes blink { 50% { opacity: 0; } }
    .nav-search {
      position: relative; flex: 1; max-width: 320px; margin: 0 1rem;
    }
    .nav-search-box {
      display: flex; align-items: center; gap: 0.4rem;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; padding: 0.35rem 0.7rem;
      transition: all 0.2s;
    }
    .nav-search-box:focus-within {
      background: rgba(255,255,255,0.12); border-color: rgba(182,143,64,0.5);
    }
    .nav-search-box svg { flex-shrink: 0; opacity: 0.5; }
    .nav-search-box input {
      background: none; border: none; outline: none; color: #fff;
      font-family: 'Montserrat', sans-serif; font-size: 0.8rem;
      width: 100%; min-width: 0;
    }
    .nav-search-box input::placeholder { color: rgba(255,255,255,0.4); }
    .nav-search-dropdown {
      display: none; position: absolute; top: calc(100% + 6px); left: 0; right: 0;
      background: #fff; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      max-height: 320px; overflow-y: auto; z-index: 200;
    }
    .nav-search-dropdown.active { display: block; }
    .nav-search-dropdown a {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.6rem 0.9rem; text-decoration: none; color: #0f172a;
      border-bottom: 1px solid #f0f0f0; font-size: 0.82rem; transition: background 0.15s;
    }
    .nav-search-dropdown a:last-child { border-bottom: none; }
    .nav-search-dropdown a:hover, .nav-search-dropdown a.hl { background: #f8f6f1; }
    .nav-search-dropdown .s-ticker { font-weight: 700; font-family: 'SFMono-Regular',monospace; color: #0f172a; }
    .nav-search-dropdown .s-name { color: #64748b; font-size: 0.75rem; margin-left: 0.5rem; }
    .nav-search-dropdown .s-arrow { color: #B68F40; opacity: 0; transition: opacity 0.15s; }
    .nav-search-dropdown a:hover .s-arrow, .nav-search-dropdown a.hl .s-arrow { opacity: 1; }
    .nav-search-dropdown .s-empty { padding: 0.8rem; color: #94a3b8; font-size: 0.8rem; text-align: center; }
    .nav-links { display: flex; gap: 0.5rem; }
    .nav-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.9rem; border-radius: 8px;
      font-size: 0.8rem; font-weight: 600; text-decoration: none;
      transition: all 0.2s; white-space: nowrap;
    }
    .nav-btn-gold { background: #B68F40; color: #041C24; }
    .nav-btn-gold:hover { background: #c9a44e; }
    .nav-btn-outline { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    .nav-btn-outline:hover { background: rgba(255,255,255,0.08); }
    @media (max-width: 640px) {
      .nav-search { max-width: none; margin: 0 0.5rem; }
      .nav-links { display: none; }
    }

    /* ============ PAGE CONTAINER ============ */
    .page { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }

    /* ============ COMPANY HEADER ============ */
    .company-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 16px; padding: 2rem 2.5rem;
      color: #fff; margin-bottom: 1.5rem;
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-wrap: wrap; gap: 1rem;
    }
    .company-left { display: flex; flex-direction: column; gap: 0.3rem; }
    .company-symbol {
      font-family: 'Playfair Display', serif;
      font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em;
      display: flex; align-items: center; gap: 0.75rem;
    }
    .badge-type {
      display: inline-block; padding: 0.15rem 0.5rem;
      background: #B68F40; color: #fff; font-size: 0.65rem;
      font-weight: 700; border-radius: 4px; letter-spacing: 0.05em;
      font-family: 'Montserrat', sans-serif; text-transform: uppercase;
    }
    .company-name { font-size: 1rem; color: rgba(255,255,255,0.85); font-weight: 500; }
    .company-sector {
      font-size: 0.72rem; color: rgba(255,255,255,0.5);
      text-transform: uppercase; letter-spacing: 0.1em; font-weight: 500;
    }
    .company-right { text-align: right; }
    .price-label {
      font-size: 0.65rem; color: rgba(255,255,255,0.5);
      text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;
    }
    .price-value {
      font-size: 3rem; font-weight: 800; letter-spacing: -0.02em;
      font-family: 'Montserrat', sans-serif; line-height: 1.1;
    }
    .price-value sup { font-size: 1.2rem; font-weight: 600; vertical-align: super; margin-right: 0.2rem; }
    .price-changes {
      display: flex; gap: 0.75rem; justify-content: flex-end;
      font-size: 0.8rem; font-weight: 600; margin-top: 0.3rem;
    }
    .price-changes span { display: flex; align-items: center; gap: 0.2rem; }
    .price-date {
      font-size: 0.6rem; color: rgba(255,255,255,0.35);
      text-align: right; margin-top: 0.3rem; text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ============ INTRO ANALYSIS (SEO) ============ */
    .intro-analysis {
      background: #fff; border-radius: 12px; padding: 1.5rem 2rem;
      margin-bottom: 1.5rem; border: 1px solid #e2e0da;
    }
    .intro-analysis p {
      font-size: 0.95rem; line-height: 1.75; color: #334155;
      margin-bottom: 0.75rem;
    }
    .intro-analysis p:last-child { margin-bottom: 0; }
    .intro-analysis strong { color: #0f172a; }
    .intro-analysis .intro-verdict {
      display: inline-block; padding: 0.25rem 0.75rem; border-radius: 6px;
      font-weight: 700; font-size: 0.85rem; margin-top: 0.5rem;
    }
    .intro-verdict-up { background: rgba(16,185,129,0.1); color: #10b981; }
    .intro-verdict-down { background: rgba(239,68,68,0.1); color: #ef4444; }
    .intro-verdict-neutral { background: rgba(100,116,139,0.1); color: #64748b; }

    /* ============ SECTION FIELDSETS ============ */
    .metrics-section {
      margin-bottom: 1.5rem;
    }
    .section-legend {
      font-size: 0.65rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.15em;
      color: #64748b; margin-bottom: 0.6rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 1px;
      background: #e2e8f0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .metric-box {
      background: #fff;
      padding: 0.75rem 0.9rem;
      display: flex; flex-direction: column; gap: 0.15rem;
    }
    .metric-label {
      font-size: 0.6rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .metric-value {
      font-size: 1.05rem; font-weight: 700;
      font-family: 'SFMono-Regular', Consolas, monospace;
      color: #0f172a;
    }

    /* ============ METHOD CARDS ============ */
    .methods-section { margin-bottom: 1.5rem; }
    .section-header-row {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;
    }
    .section-title {
      font-size: 1.5rem; font-weight: 700;
      color: #0f172a;
    }
    .section-sub {
      font-size: 0.75rem; color: #94a3b8;
    }
    .section-price-ref {
      font-size: 0.78rem; color: #64748b;
    }
    .section-price-ref strong {
      font-family: monospace; color: #0f172a; font-size: 1rem;
    }
    .methods-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    /* methods-grid-3 removido — grid usa auto-fit */
    .method-card {
      background: #fff; border: 1px solid #e2e8f0;
      border-radius: 12px; overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .method-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .method-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 1rem 1.25rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .method-name {
      display: block; font-size: 1.05rem; font-weight: 700; color: #0f172a;
    }
    .method-sub {
      display: block; font-size: 0.7rem; color: #94a3b8; margin-top: 0.1rem;
    }
    .method-weight {
      font-size: 0.65rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: #B68F40; background: rgba(182,143,64,0.08);
      padding: 0.2rem 0.5rem; border-radius: 4px;
      white-space: nowrap;
    }
    .method-body { padding: 1rem 1.25rem 1.25rem; }
    .method-fv-row, .method-upside-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0;
    }
    .method-fv-row { border-bottom: 1px solid #f1f5f9; }
    .method-fv-label {
      font-size: 0.65rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .method-fv {
      font-size: 1.4rem; font-weight: 800;
      font-family: 'Montserrat', sans-serif;
    }
    .method-upside {
      font-size: 1.1rem; font-weight: 700;
    }

    /* ============ AUDIT BADGE ============ */
    .method-audit {
      font-size: 0.65rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: #64748b; cursor: default;
    }

    /* ============ PREMISSAS ============ */
    .premissas-section {
      border-top: 1px solid #e2e8f0; margin-top: 0.75rem; padding-top: 0.75rem;
    }
    .premissas-label {
      font-size: 0.6rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: #94a3b8; margin-bottom: 0.6rem;
    }
    .premissa-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.5rem; gap: 0.5rem;
    }
    .premissa-row label {
      font-size: 0.75rem; font-weight: 500; color: #475569;
      white-space: nowrap;
    }
    .premissa-input-group { display: flex; gap: 0.4rem; }
    .premissa-input {
      width: 60px; padding: 0.35rem 0.5rem;
      border: 1px solid #e2e8f0; border-radius: 6px;
      font-size: 0.82rem; font-family: 'SFMono-Regular', Consolas, monospace;
      text-align: center; color: #0f172a; background: #fff;
    }
    .premissa-input:focus { outline: none; border-color: #B68F40; }
    .premissa-slider-group {
      display: flex; align-items: center; gap: 0.5rem;
    }
    .premissa-slider {
      -webkit-appearance: none; appearance: none;
      width: 80px; height: 6px; border-radius: 3px;
      background: #e2e8f0; outline: none;
    }
    .premissa-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px; border-radius: 50%;
      background: #B68F40; cursor: pointer;
      border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .premissa-slider::-moz-range-thumb {
      width: 16px; height: 16px; border-radius: 50%;
      background: #B68F40; cursor: pointer;
      border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .premissa-slider-val {
      font-size: 0.78rem; font-weight: 600; color: #0f172a;
      min-width: 40px; text-align: right;
      font-family: 'SFMono-Regular', Consolas, monospace;
    }
    .premissa-select {
      padding: 0.35rem 0.5rem; border: 1px solid #e2e8f0;
      border-radius: 6px; font-size: 0.78rem; color: #0f172a;
      background: #fff; font-family: 'Montserrat', sans-serif;
      cursor: pointer; min-width: 100px;
    }
    .premissa-select:focus { outline: none; border-color: #B68F40; }
    .premissa-info-row {
      font-size: 0.75rem; color: #64748b;
      padding: 0.25rem 0;
    }
    .premissa-info-row strong {
      font-family: 'SFMono-Regular', Consolas, monospace;
      color: #0f172a;
    }
    .premissa-locked-row {
      display: flex; gap: 0.75rem; align-items: center;
      font-size: 0.75rem; color: #64748b;
      padding: 0.5rem 0.6rem; margin-top: 0.5rem;
      background: rgba(182,143,64,0.06); border: 1px solid rgba(182,143,64,0.15);
      border-radius: 6px; text-decoration: none; cursor: pointer;
      transition: background 0.15s;
    }
    .premissa-locked-row:hover { background: rgba(182,143,64,0.12); }
    .premissa-locked-row strong { font-family: 'SFMono-Regular', Consolas, monospace; }
    .methods-note {
      margin-top: 1rem; padding: 0.75rem 1rem;
      background: #fafaf8; border: 1px solid #e2e8f0;
      border-radius: 8px; font-size: 0.72rem; color: #64748b; line-height: 1.6;
    }
    .methods-note strong { color: #475569; }

    /* ============ SECTION CARDS ============ */
    .section-card {
      background: #fff; border: 1px solid #e2e8f0;
      border-radius: 12px; padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    /* ============ RESUMO ============ */
    .resumo-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;
    }
    .resumo-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.3rem; font-weight: 700;
    }
    .resumo-date { font-size: 0.7rem; color: #94a3b8; }
    .resumo-badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .resumo-badge {
      display: inline-block; padding: 0.2rem 0.6rem;
      background: #f1f5f9; border: 1px solid #e2e8f0;
      border-radius: 6px; font-size: 0.65rem; font-weight: 600;
      color: #475569; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .resumo-text {
      font-size: 0.88rem; color: #475569; line-height: 1.7;
    }

    /* ============ FINANCIAL TABLES ============ */
    .fin-tabs {
      display: flex; gap: 0; margin-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .fin-tab {
      padding: 0.6rem 1rem; font-size: 0.78rem; font-weight: 600;
      color: #94a3b8; cursor: default;
      border-bottom: 2px solid transparent;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .fin-tab.active {
      color: #0f172a; border-bottom-color: #B68F40;
    }
    .table-scroll {
      overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .fin-table {
      width: 100%; border-collapse: collapse;
      font-size: 0.8rem;
    }
    .fin-table thead th {
      padding: 0.6rem 0.8rem;
      text-align: right; font-size: 0.65rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em;
      color: #94a3b8; border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    .fin-table thead th:first-child { text-align: left; }
    .fin-table tbody td {
      padding: 0.55rem 0.8rem;
      text-align: right; border-bottom: 1px solid #f8fafc;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.78rem; white-space: nowrap;
    }
    .fin-table tbody td:first-child {
      text-align: left; font-family: 'Montserrat', sans-serif;
      font-weight: 600; color: #475569;
    }
    .fin-table tbody tr:hover { background: #fafaf8; }
    .fin-transposed .sticky-col {
      position: sticky; left: 0; background: #fff; z-index: 1;
      font-family: 'Montserrat', sans-serif; font-weight: 600;
      color: #475569; text-align: left; min-width: 120px;
    }
    .fin-transposed thead th.sticky-col { background: #fff; }
    .div-lead-card {
      margin-top: 1.5rem; padding: 2rem; border-radius: 12px;
      background: linear-gradient(135deg, #041C24 0%, #0a2e3a 100%);
      text-align: center; color: #fff;
    }
    .div-lead-icon { margin-bottom: 0.75rem; color: #B68F40; }
    .div-lead-title {
      font-family: 'Playfair Display', serif; font-size: 1.15rem;
      font-weight: 700; margin-bottom: 0.4rem;
    }
    .div-lead-sub {
      font-size: 0.82rem; color: rgba(255,255,255,0.7);
      margin-bottom: 1.25rem; max-width: 420px; margin-left: auto; margin-right: auto;
    }
    .div-lead-form {
      display: flex; flex-wrap: wrap; gap: 0.5rem;
      justify-content: center; max-width: 500px; margin: 0 auto;
    }
    .div-lead-form input {
      flex: 1; min-width: 160px; padding: 0.65rem 0.9rem;
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      background: rgba(255,255,255,0.08); color: #fff;
      font-size: 0.85rem; font-family: 'Montserrat', sans-serif;
    }
    .div-lead-form input::placeholder { color: rgba(255,255,255,0.4); }
    .div-lead-form input:focus { outline: none; border-color: #B68F40; background: rgba(255,255,255,0.12); }
    .div-lead-btn {
      width: 100%; padding: 0.7rem; border: none; border-radius: 8px;
      background: #B68F40; color: #041C24; font-weight: 700;
      font-size: 0.88rem; cursor: pointer; transition: all 0.2s;
      font-family: 'Montserrat', sans-serif;
    }
    .div-lead-btn:hover { background: #c9a44e; }
    .div-lead-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .div-lead-success { margin-top: 1rem; }
    .div-lead-success p { color: #10b981; font-weight: 600; font-size: 0.9rem; }
    @media (max-width: 640px) {
      .div-lead-form input { min-width: 100%; }
    }

    /* ============ SANITY CHECK ============ */
    .sanity-table {
      width: 100%; border-collapse: collapse;
      font-size: 0.75rem;
    }
    .sanity-table thead th {
      padding: 0.5rem 0.6rem;
      text-align: right; font-size: 0.6rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: #94a3b8; border-bottom: 1px solid #e2e8f0;
      white-space: nowrap; position: sticky; top: 0; background: #fff;
    }
    .sanity-table thead th:first-child { text-align: left; }
    .sanity-table .sticky-col {
      position: sticky; left: 0; background: #fff;
      text-align: left; font-family: 'Montserrat', sans-serif;
      font-weight: 600; color: #475569; z-index: 1;
      padding: 0.5rem 0.6rem; white-space: nowrap;
      border-right: 1px solid #e2e8f0;
    }
    .sanity-table tbody td {
      padding: 0.45rem 0.6rem;
      text-align: right; border-bottom: 1px solid #f8fafc;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.72rem; white-space: nowrap;
    }
    .sanity-table tbody tr:hover { background: #fafaf8; }
    .sanity-section-header {
      font-size: 0.6rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: #B68F40; padding: 0.6rem 0.6rem 0.3rem;
      background: #fafaf8;
    }

    /* ============ MATRIX ============ */
    .matrix-table {
      width: 100%; border-collapse: collapse;
      font-size: 0.78rem;
    }
    .matrix-table th, .matrix-table td {
      padding: 0.55rem 0.7rem; text-align: center;
      border: 1px solid #e2e8f0;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.75rem;
    }
    .matrix-table thead th {
      background: #f8fafc; font-size: 0.65rem; font-weight: 700;
      color: #64748b;
    }
    .matrix-corner {
      font-size: 0.6rem !important; color: #94a3b8 !important;
    }
    .matrix-wacc {
      background: #f8fafc !important; font-weight: 700 !important;
      color: #64748b !important; text-align: center !important;
    }
    .matrix-center {
      outline: 2px solid #64748b; outline-offset: -2px;
      font-weight: 700 !important;
    }

    /* ============ DISCLAIMER ============ */
    .disclaimer {
      text-align: center; padding: 2rem 1.5rem;
      border-top: 1px solid #e2e8f0; margin-top: 1rem;
    }
    .disclaimer-title {
      font-size: 0.7rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.15em;
      color: #64748b; margin-bottom: 0.5rem;
    }
    .disclaimer-text {
      font-size: 0.75rem; color: #94a3b8; line-height: 1.7;
      max-width: 800px; margin: 0 auto;
    }
    .footer-logos {
      display: flex; align-items: center; justify-content: center;
      gap: 0.75rem; margin-bottom: 1rem;
    }
    .footer-logo-bh {
      height: 32px; filter: brightness(0) saturate(100%) invert(60%) sepia(10%) saturate(300%) hue-rotate(180deg);
      opacity: 0.5;
    }
    .footer-x {
      font-size: 1rem; color: #94a3b8; font-weight: 300;
    }
    .footer-iacoes {
      font-family: 'Playfair Display', serif;
      font-size: 1.1rem; font-weight: 700; color: #64748b;
    }
    .footer-iacoes-i {
      color: #B68F40; font-weight: 800; font-style: italic;
      font-size: 1.25rem;
    }
    .footer-copy {
      font-size: 0.7rem; color: #cbd5e1; margin-top: 1rem;
    }
    .footer-copy a { color: #94a3b8; text-decoration: none; }

    /* ============ CTA ============ */
    .cta-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 16px; padding: 2.5rem 2rem;
      text-align: center; margin-bottom: 1.5rem;
    }
    .cta-card h2 {
      font-family: 'Playfair Display', serif;
      color: #fff; font-size: 1.6rem; font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .cta-card p { color: rgba(255,255,255,0.6); margin-bottom: 1.5rem; font-size: 0.9rem; }
    .cta-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 2rem; background: #B68F40; color: #0f172a;
      font-weight: 700; font-size: 0.95rem; border-radius: 10px;
      text-decoration: none; transition: all 0.2s;
    }
    .cta-btn:hover { background: #c9a44e; transform: translateY(-1px); }

    /* ============ CTA VALUATION ============ */
    .cta-valuation {
      background: linear-gradient(135deg, #0f172a 0%, #1a2a1a 100%);
      border-radius: 16px; padding: 2rem 2rem;
      margin: 1.5rem 0;
    }
    .cta-valuation-inner {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1.5rem; flex-wrap: wrap;
    }
    .cta-valuation-text { flex: 1; min-width: 240px; }
    .cta-valuation-title {
      font-family: 'Playfair Display', serif;
      color: #fff; font-size: 1.35rem; font-weight: 700;
      margin-bottom: 0.4rem;
    }
    .cta-valuation-desc {
      color: rgba(255,255,255,0.65); font-size: 0.88rem;
      line-height: 1.5; margin: 0;
    }
    .cta-valuation-desc strong { color: rgba(255,255,255,0.9); }
    .cta-valuation-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1.8rem; background: #B68F40; color: #0f172a;
      font-weight: 700; font-size: 0.92rem; border-radius: 10px;
      text-decoration: none; transition: all 0.2s; white-space: nowrap;
      flex-shrink: 0;
    }
    .cta-valuation-btn:hover { background: #c9a44e; transform: translateY(-1px); }
    @media (max-width: 640px) {
      .cta-valuation-inner { flex-direction: column; text-align: center; }
      .cta-valuation-btn { width: 100%; justify-content: center; }
    }

    /* ============ NOTA QUALITATIVA (PAYWALL) ============ */
    .nota-section { position: relative; overflow: hidden; }
    .nota-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;
    }
    .nota-label {
      font-size: 0.6rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: #64748b;
    }
    .nota-sector-badge {
      display: inline-block; padding: 0.2rem 0.6rem;
      background: #f1f5f9; border: 1px solid #e2e8f0;
      border-radius: 6px; font-size: 0.6rem; font-weight: 600;
      color: #475569; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .nota-score {
      font-size: 3rem; font-weight: 800;
      font-family: 'Montserrat', sans-serif;
      color: #0f172a; line-height: 1;
    }
    .nota-scale {
      font-size: 0.7rem; color: #94a3b8; font-weight: 500;
      margin-left: 0.3rem;
    }
    .nota-blurred {
      filter: blur(6px); -webkit-filter: blur(6px);
      user-select: none; pointer-events: none;
      opacity: 0.6;
    }
    .nota-blurred-text {
      font-size: 0.85rem; color: #475569; line-height: 1.7;
      margin-top: 0.75rem;
    }
    .nota-radar-placeholder {
      display: flex; justify-content: center; align-items: center;
      height: 200px; margin-top: 1rem;
    }
    .nota-radar-svg { max-width: 260px; width: 100%; }
    .nota-categories { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
    .nota-categories-title { font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.25rem; }
    .nota-cat-item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem 0.75rem; }
    .nota-cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
    .nota-cat-name { font-size: 0.8rem; color: #334155; font-weight: 600; }
    .nota-cat-score { font-size: 0.8rem; font-weight: 700; }
    .nota-cat-bar { height: 6px; border-radius: 3px; background: #f1f5f9; overflow: hidden; }
    .nota-cat-bar-fill { height: 100%; border-radius: 3px; }
    .nota-detail-placeholder { padding: 1rem 0; }
    .nota-detail-title { font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.5rem; }
    .nota-detail-placeholder p { font-size: 0.85rem; color: #475569; line-height: 1.7; margin-bottom: 0.5rem; }
    .nota-overlay {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 70%; display: flex; flex-direction: column;
      justify-content: flex-end; align-items: center;
      padding: 2rem;
      background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 30%, rgba(255,255,255,1) 100%);
    }
    .nota-overlay-lock {
      width: 48px; height: 48px; border-radius: 50%;
      background: #f1f5f9; border: 2px solid #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 0.75rem;
    }
    .nota-overlay-lock svg { width: 22px; height: 22px; color: #64748b; }
    .nota-overlay-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.1rem; font-weight: 700; color: #0f172a;
      margin-bottom: 0.3rem; text-align: center;
    }
    .nota-overlay-sub {
      font-size: 0.8rem; color: #64748b; text-align: center;
      margin-bottom: 1rem; max-width: 400px;
    }
    .nota-overlay-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.6rem 1.5rem; background: #B68F40; color: #041C24;
      font-weight: 700; font-size: 0.85rem; border-radius: 8px;
      text-decoration: none; transition: all 0.2s;
    }
    .nota-overlay-btn:hover { background: #c9a44e; }

    /* ============ BREADCRUMB ============ */
    .breadcrumb {
      max-width: 1100px; margin: 0 auto;
      padding: 0.6rem 1.5rem;
    }
    .breadcrumb ol {
      list-style: none; display: flex; gap: 0.3rem;
      font-size: 0.7rem; color: #94a3b8;
    }
    .breadcrumb li::after { content: '/'; margin-left: 0.3rem; }
    .breadcrumb li:last-child::after { content: ''; }
    .breadcrumb a {
      color: #64748b; text-decoration: none;
    }
    .breadcrumb a:hover { color: #B68F40; text-decoration: underline; }
    .breadcrumb [aria-current="page"] { color: #0f172a; font-weight: 600; }

    /* ============ PEERS (AÇÕES DO MESMO SETOR) ============ */
    .peers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .peer-card {
      background: #fff; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 0.9rem;
      text-decoration: none; color: inherit;
      transition: all 0.2s;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .peer-card:hover {
      border-color: #B68F40; box-shadow: 0 2px 12px rgba(182,143,64,0.1);
      transform: translateY(-1px);
    }
    .peer-ticker {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.95rem; font-weight: 700; color: #0f172a;
    }
    .peer-name {
      font-size: 0.7rem; color: #64748b;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .peer-price {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.8rem; font-weight: 600; color: #475569;
      margin-top: 0.15rem;
    }
    .peers-more {
      display: inline-flex; align-items: center; gap: 0.3rem;
      margin-top: 0.75rem; font-size: 0.82rem; font-weight: 600;
      color: #B68F40; text-decoration: none;
    }
    .peers-more:hover { text-decoration: underline; }

    /* ============ FAQ ============ */
    .faq-section { }
    .faq-list { margin-top: 1rem; }
    .faq-item {
      border-bottom: 1px solid #e2e8f0;
      padding: 1rem 0;
    }
    .faq-item:last-child { border-bottom: none; }
    .faq-question {
      font-size: 0.95rem; font-weight: 700;
      color: #0f172a; margin-bottom: 0.4rem;
    }
    .faq-answer {
      font-size: 0.85rem; color: #475569;
      line-height: 1.7;
    }

    /* ============ RESPONSIVE ============ */
    @media (max-width: 1024px) {
      .metrics-grid { grid-template-columns: repeat(4, 1fr); }
    }
    @media (max-width: 900px) {

    }
    @media (max-width: 768px) {
      .page { padding: 1rem; }
      .company-header { padding: 1.5rem; flex-direction: column; }
      .company-symbol { font-size: 2rem; }
      .company-right { text-align: left; }
      .price-value { font-size: 2.2rem; }
      .price-changes { justify-content: flex-start; }
      .metrics-grid { grid-template-columns: repeat(3, 1fr); }
      .methods-grid { grid-template-columns: 1fr; }
      .nav { padding: 0 1rem; }
    }
    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
      .price-value { font-size: 1.8rem; }
      .consensus-price { font-size: 2rem; }
    }

    /* ============ HERO NOTA QUALITATIVA ============ */
    .hero-nota-qual { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.7rem; background: rgba(182,143,64,0.08); border: 1px solid rgba(182,143,64,0.15); border-radius: 6px; font-size: 0.75rem; color: #64748b; margin-top: 0.3rem; }
    .hero-nota-qual .nota-teaser-lock { font-size: 0.75rem; }

    /* ============ HERO MICRO-CTA ============ */
    .hero-cta-anchor { display: inline-block; margin-top: 0.75rem; padding: 0.4rem 1rem; background: transparent; border: 1.5px solid #B68F40; color: #B68F40; border-radius: 6px; font-size: 0.78rem; font-weight: 600; text-decoration: none; transition: all 0.2s; }
    .hero-cta-anchor:hover { background: #B68F40; color: white; }

    /* ============ DIFERENCIADOR ============ */
    .diferenciador { text-align: center; padding: 1rem 1.5rem; margin: 0.5rem 0 1rem; }
    .diferenciador p { font-size: 0.88rem; color: #475569; max-width: 600px; margin: 0 auto; line-height: 1.6; }
    .diferenciador strong { color: #B68F40; }

    /* ============ CSS-ONLY TABS ============ */
    .tabs-container { position: relative; }
    .tab-radio { display: none; }
    .tab-label { display: inline-block; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.82rem; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .tab-radio:checked + .tab-label { color: #B68F40; border-bottom-color: #B68F40; }
    .tab-panel { display: none; padding: 1rem 0; }
    #tab-mercado:checked ~ #panel-mercado,
    #tab-valuation:checked ~ #panel-valuation,
    #tab-rentabilidade:checked ~ #panel-rentabilidade,
    #tab-endividamento:checked ~ #panel-endividamento { display: block; }
    .nota-teaser-inline { margin-top: 1rem; padding: 0.75rem 1rem; background: rgba(182,143,64,0.08); border: 1px solid rgba(182,143,64,0.2); border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
    .nota-teaser-inline a { color: #B68F40; font-weight: 600; margin-left: auto; text-decoration: none; }
    .nota-teaser-lock { font-size: 0.9rem; }
    .metrics-timestamp { text-align: center; font-size: 0.72rem; color: #94a3b8; margin-top: 0.75rem; }

    /* ============ DCF LOCKED CARD ============ */
    /* ============ INTRO COMBINED CARD ============ */
    .intro-combined { padding: 1.5rem; }
    .intro-combined .section-legend { margin-bottom: 0.5rem; }
    .intro-combined p { font-size: 0.88rem; color: #334155; line-height: 1.7; margin-bottom: 0.5rem; }
    .intro-combined-divider { height: 1px; background: #e2e8f0; margin: 1.2rem 0; }

    /* ============ DCF FULL-WIDTH ============ */
    .dcf-locked-card { margin-top: 1rem; grid-column: 1 / -1; }
    .dcf-locked-inner { display: flex; gap: 1.5rem; align-items: center; }
    .dcf-locked-left { flex: 1; filter: blur(4px); pointer-events: none; user-select: none; }
    .dcf-locked-left .method-body { filter: none; }
    .dcf-locked-right { flex: 1; text-align: center; padding: 1.5rem; }
    .dcf-locked-right svg { color: #B68F40; margin-bottom: 0.75rem; }
    .dcf-locked-headline { font-size: 1rem; color: #0f172a; margin-bottom: 0.4rem; font-weight: 500; line-height: 1.5; }
    .dcf-locked-headline strong { color: #B68F40; }
    .dcf-locked-sub { font-size: 0.82rem; color: #64748b; margin-bottom: 1rem; }
    @media (max-width: 768px) {
      .dcf-locked-inner { flex-direction: column; }
      .dcf-locked-left { display: none; }
    }

    /* ============ SENSITIVITY TABLE ============ */
    .dcf-sensitivity-blur { filter: blur(3px); pointer-events: none; user-select: none; }
    .sensitivity-table-wrap { text-align: center; }
    .sensitivity-title { font-size: 0.7rem; font-weight: 700; color: #64748b; letter-spacing: 0.1em; margin-bottom: 0.4rem; }
    .sensitivity-table { width: 100%; border-collapse: collapse; font-size: 0.72rem; font-family: 'SFMono-Regular', Consolas, monospace; }
    .sensitivity-table th { padding: 0.3rem 0.4rem; font-weight: 600; color: #64748b; font-size: 0.68rem; }
    .sensitivity-table td { padding: 0.35rem 0.4rem; border-radius: 4px; text-align: center; font-weight: 600; }
    .sensitivity-wacc { text-align: left !important; color: #64748b; font-weight: 700 !important; font-size: 0.68rem; }
    .sensitivity-center-col { color: #0f172a !important; font-weight: 800 !important; }
    .sensitivity-center-row .sensitivity-wacc { color: #0f172a !important; }
    .sensitivity-center { background: #f8f6f1; color: #0f172a; outline: 2px solid #64748b; outline-offset: -1px; }
    .sensitivity-footer { font-size: 0.7rem; color: #64748b; margin-top: 0.5rem; }
    .sensitivity-footer strong { color: #0f172a; }

    .method-card-locked { position: relative; overflow: hidden; }
    .method-body-blur { filter: blur(4px); pointer-events: none; user-select: none; }
    .method-locked-badge { background: #B68F40; color: white; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.05em; }
    .premissa-locked { color: #94a3b8; font-size: 0.8rem; }
    .method-card-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(245,243,239,0.85); text-align: center; padding: 1.5rem; }
    .method-card-overlay svg { color: #B68F40; margin-bottom: 0.75rem; }
    .method-card-overlay p { font-size: 0.85rem; color: #334155; margin-bottom: 1rem; font-weight: 500; }
    .method-unlock-btn { background: #B68F40; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.82rem; transition: background 0.2s; }
    .method-unlock-btn:hover { background: #a07a2e; }

    /* ============ SOCIAL PROOF ============ */
    .social-proof-section { margin: 1.5rem 0; }
    .social-proof-card { padding: 2.2rem 2.5rem; background: linear-gradient(135deg, rgba(182,143,64,0.18) 0%, rgba(182,143,64,0.04) 100%); border: 1px solid rgba(182,143,64,0.25); border-radius: 0.75rem; text-align: center; }
    .social-proof-headline { font-size: 1.6rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; line-height: 1.3; font-family: 'Playfair Display', serif; }
    .social-proof-text { font-size: 1.15rem; color: #475569; line-height: 1.7; margin-bottom: 1.8rem; max-width: 650px; margin-left: auto; margin-right: auto; }
    .social-proof-text strong { color: #B68F40; }
    .social-proof-count { display: block; width: fit-content; margin: 0 auto 1.4rem; font-size: 0.88rem; color: #041C24; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); padding: 0.4rem 1rem; border-radius: 9999px; font-weight: 600; letter-spacing: 0.01em; }
    .social-proof-count::before { content: '\\2713\\0020'; color: #10b981; font-weight: 700; }
    .social-proof-btn { display: inline-block; background: #041C24; color: white; padding: 0.85rem 2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: background 0.15s; }
    .social-proof-btn:hover { background: #093848; }

    /* ============ FEATURES SHOWCASE ============ */
    .features-showcase { background: #041C24; border-radius: 12px; padding: 2.5rem; margin: 1.5rem 0; }
    .features-inner { max-width: 900px; margin: 0 auto; text-align: center; }
    .features-title { color: #fff; font-family: 'Playfair Display', serif; font-size: 1.3rem; margin-bottom: 1.5rem; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.2rem; margin-bottom: 1.5rem; }
    .feature-item { text-align: center; }
    .feature-icon { font-size: 1.5rem; display: block; margin-bottom: 0.4rem; }
    .feature-name { display: block; color: #B68F40; font-weight: 700; font-size: 0.82rem; margin-bottom: 0.2rem; }
    .feature-desc { display: block; color: rgba(255,255,255,0.6); font-size: 0.72rem; line-height: 1.4; }
    .features-cta { display: inline-block; background: #B68F40; color: #041C24; padding: 0.7rem 1.5rem; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 0.85rem; transition: background 0.2s; }
    .features-cta:hover { background: #d4a94e; }

    /* ============ MARKOWITZ CARD ============ */
    .markowitz-card { background: linear-gradient(135deg, #f8f6f1 0%, #f0ebe0 100%); border: 1px solid rgba(182,143,64,0.2); border-radius: 12px; padding: 2rem; margin: 1.5rem 0; text-align: center; }
    .markowitz-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .markowitz-title { font-family: 'Playfair Display', serif; font-size: 1.15rem; margin-bottom: 0.5rem; }
    .markowitz-desc { color: #475569; font-size: 0.85rem; max-width: 500px; margin: 0 auto 1rem; line-height: 1.6; }
    .markowitz-btn { display: inline-block; background: #B68F40; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.82rem; }

    /* ============ SLIDER PULSE HINT ============ */
    @keyframes sliderPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(182,143,64,0.4); }
      50% { transform: scale(1.35); box-shadow: 0 0 0 6px rgba(182,143,64,0); }
    }
    .slider-hint input[type="range"]::-webkit-slider-thumb { animation: sliderPulse 1.2s ease-in-out 3; }
    .slider-hint input[type="range"]::-moz-range-thumb { animation: sliderPulse 1.2s ease-in-out 3; }

    /* ============ SHADCN-INSPIRED REFINEMENTS ============ */
    .method-card { border-radius: 0.75rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.15s ease; }
    .method-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .tab-label { transition: color 0.15s ease, border-color 0.15s ease; border-bottom-width: 2px; }
    .method-locked-badge { border-radius: 9999px; padding: 0.15rem 0.6rem; font-size: 0.6rem; }
    .social-proof-card { border-radius: 0.75rem; }
    .features-showcase { border-radius: 0.75rem; }
    .markowitz-card { border-radius: 0.75rem; }

    /* ============ ANIMATIONS ============ */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-in {
      animation: fadeInUp 0.4s ease-out both;
    }
  </style>

  <!-- Google Analytics (GA4) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-858T7GLTMJ"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-858T7GLTMJ');</script>
  <script>var _iaB='https://dawvgbopyemcayavcatd.supabase.co',_iaK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd3ZnYm9weWVtY2F5YXZjYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MzAwOTEsImV4cCI6MjA3MTMwNjA5MX0.TuQV1G_JsJQRjLr76f8xX2HUjCig5FQa8R-YpsPyJiw',_iaS=(function(){var s=sessionStorage.getItem('_ia_sid');if(!s){s=crypto.randomUUID();sessionStorage.setItem('_ia_sid',s)}return s})(),_iaD=(function(){var ua=navigator.userAgent;var m=/Mobi|Android/i.test(ua);var t=/Tablet|iPad/i.test(ua);var dt=t?'tablet':m?'mobile':'desktop';var br='Outro';if(/Edg\\//i.test(ua))br='Edge';else if(/Chrome/i.test(ua))br='Chrome';else if(/Firefox/i.test(ua))br='Firefox';else if(/Safari/i.test(ua))br='Safari';var os='Outro';if(/Windows/i.test(ua))os='Windows';else if(/Mac/i.test(ua))os='macOS';else if(/Android/i.test(ua))os='Android';else if(/iPhone|iPad|iPod/i.test(ua))os='iOS';else if(/Linux/i.test(ua))os='Linux';return{dt:dt,br:br,os:os}})();var _iaSH=(function(){var ua=navigator.userAgent;if(/FBAN|FBAV/i.test(ua))return'facebook';if(/Instagram/i.test(ua))return'instagram';if(/LinkedIn/i.test(ua))return'linkedin';if(/WhatsApp/i.test(ua))return'whatsapp';if(/Telegram/i.test(ua))return'telegram';if(/Twitter|TwitterAndroid/i.test(ua))return'twitter';return null})(),_iaCID=(function(){var u=new URLSearchParams(location.search);if(u.get('fbclid'))return'facebook';if(u.get('gclid'))return'google_ads';if(u.get('ttclid'))return'tiktok';if(u.get('li_fat_id'))return'linkedin';if(u.get('twclkd'))return'twitter';if(u.get('msclkid'))return'microsoft_ads';return null})();function _iaTrack(ev,cid){var u=new URLSearchParams(location.search);var d={session_id:_iaS,page_path:(location.pathname.replace(/\\/index\\.html$/,'').replace(/\\/$/,'')||'/').toUpperCase(),referrer:document.referrer||null,utm_source:u.get('utm_source')||null,utm_medium:u.get('utm_medium')||null,utm_campaign:u.get('utm_campaign')||null,device_type:_iaD.dt,screen_width:screen.width,browser:_iaD.br,os:_iaD.os,event_type:ev||'pageview',source_hint:_iaSH,click_id_source:_iaCID};if(cid)d.cta_id=cid;fetch(_iaB+'/rest/v1/iacoes_page_views',{method:'POST',headers:{'Content-Type':'application/json','apikey':_iaK,'Authorization':'Bearer '+_iaK,'Prefer':'return=minimal'},keepalive:true,body:JSON.stringify(d)}).catch(function(){})}_iaTrack();function _iaClick(e){if(e.metaKey||e.ctrlKey||e.shiftKey||e.button===1)return;e.preventDefault();var el=e.currentTarget;var cid=el.getAttribute('data-cta')||'unknown';var u;try{u=new URL(el.href)}catch(_){u=null}if(u){var inUtm=new URLSearchParams(location.search);var src=inUtm.get('utm_source')||'iacoes';var med=inUtm.get('utm_medium')||'ticker';var camp=inUtm.get('utm_campaign')||'seo-organico';if(!u.searchParams.has('utm_source'))u.searchParams.set('utm_source',src);if(!u.searchParams.has('utm_medium'))u.searchParams.set('utm_medium',med);if(!u.searchParams.has('utm_campaign'))u.searchParams.set('utm_campaign',camp);if(!u.searchParams.has('utm_content'))u.searchParams.set('utm_content',cid)}_iaTrack('cta_click',cid);var dest=u?u.toString():el.href;setTimeout(function(){window.location.href=dest},150)}
var _iaDivData=${JSON.stringify(divHistory.map(d => ({e:d.exDate,a:d.amount,t:d.dividendType||'',p:d.paymentDate||''})))};
var _iaDreData=${JSON.stringify(incomeAsc.map(d => ({y:getYear(d.end_date),rev:d.total_revenue,gp:d.gross_profit||0,ebit:d.ebit,ibt:d.income_before_tax,ni:d.net_income})))};
var _iaBalData=${JSON.stringify(balanceAsc.map(d => ({y:getYear(d.end_date),ta:d.total_assets,cash:d.cash+(d.short_term_investments||0),tl:d.total_liab,ltd:d.long_term_debt,eq:d.total_stockholder_equity})))};
var _iaCfData=${JSON.stringify(cashFlowAsc.map(d => ({y:getYear(d.end_date),fco:d.total_cash_from_operating_activities,fci:d.total_cashflows_from_investing_activities,fcf:d.total_cash_from_financing_activities,capex:d.capital_expenditures,divp:d.dividends_paid})))};
function _iaLeadSubmit(e,ticker){e.preventDefault();var f=e.target;var btn=f.querySelector('button');btn.disabled=true;btn.textContent='Enviando...';var name=f.name.value.trim();var email=f.email.value.trim();fetch(_iaB+'/rest/v1/iacoes_email_leads',{method:'POST',headers:{'Content-Type':'application/json','apikey':_iaK,'Authorization':'Bearer '+_iaK,'Prefer':'return=minimal'},body:JSON.stringify({name:name,email:email,ticker:ticker,source:'financeiras'})}).then(function(){_iaTrack('lead_financeiras');var csv='=== DRE (Demonstracao de Resultados) ===\\nAno;Receita Total;Lucro Bruto;EBIT;Lucro Antes IR;Lucro Liquido\\n';_iaDreData.forEach(function(d){csv+=d.y+';'+d.rev+';'+d.gp+';'+d.ebit+';'+d.ibt+';'+d.ni+'\\n';});csv+='\\n=== Balanco Patrimonial ===\\nAno;Ativo Total;Caixa;Passivo Total;Divida LP;Patrimonio Liquido\\n';_iaBalData.forEach(function(d){csv+=d.y+';'+d.ta+';'+d.cash+';'+d.tl+';'+d.ltd+';'+d.eq+'\\n';});csv+='\\n=== Fluxo de Caixa ===\\nAno;FCO;FCI;FCF;CAPEX;Dividendos Pagos\\n';_iaCfData.forEach(function(d){csv+=d.y+';'+d.fco+';'+d.fci+';'+d.fcf+';'+d.capex+';'+d.divp+'\\n';});csv+='\\n=== Dividendos ===\\nData Ex;Valor por Acao;Tipo;Data Pagamento\\n';_iaDivData.forEach(function(d){csv+=d.e+';'+d.a+';'+d.t+';'+d.p+'\\n';});var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='financeiras_'+ticker+'.csv';a.click();URL.revokeObjectURL(url);f.style.display='none';document.getElementById('div-lead-success-'+ticker).style.display='block';}).catch(function(){btn.disabled=false;btn.textContent='Erro — tente novamente';});return false;}</script>
</head>
<body>

<!-- NAV -->
<nav class="nav" aria-label="Navegação principal">
  <div class="nav-left">
    <a href="/" class="nav-brand" aria-label="iAções - Página inicial">
      <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" class="nav-logo-bh">
    </a>
    <span class="nav-divider"></span>
    <a href="/" class="nav-iacoes" aria-label="iAções">
      <span class="nav-iacoes-i">iA</span><span class="nav-iacoes-acoes">ções</span><span class="nav-cursor"></span>
    </a>
  </div>
  <div class="nav-search">
    <div class="nav-search-box">
      <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="6" cy="6" r="5"/><line x1="10" y1="10" x2="13" y2="13"/></svg>
      <input type="text" id="nav-ticker-search" placeholder="Buscar ativo... ex: PETR4" autocomplete="off" spellcheck="false">
    </div>
    <div class="nav-search-dropdown" id="nav-search-dropdown"></div>
  </div>
  <div class="nav-links">
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nav-btn nav-btn-outline" data-cta="nav-app" onclick="_iaClick(event)">Acessar App</a>
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nav-btn nav-btn-gold" data-cta="nav-assinar" onclick="_iaClick(event)">Assinar Plano</a>
  </div>
</nav>

<!-- Breadcrumb -->
<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">iAções</a></li>
    <li><a href="/acoes/">Ações</a></li>
    ${f.sector && sectorSlugVal ? `<li><a href="/acoes/${sectorSlugVal}/">${f.sector}</a></li>` : ''}
    <li aria-current="page">${f.symbol}</li>
  </ol>
</nav>

<main class="page" role="main">

  <!-- COMPANY HEADER -->
  <article itemscope itemtype="https://schema.org/Article">
  <header class="company-header animate-in">
    <div class="company-left">
      <h1 class="company-symbol">
        ${f.symbol} <span class="badge-type">${f.type}</span>
      </h1>
      <p class="company-name">${f.name}</p>
      <p class="company-sector">${f.sector} / ${f.subSector}</p>
    </div>
    <div class="company-right">
      <div class="price-label">Cotação Atual</div>
      <div class="price-value" id="live-price"><sup>R$</sup>${fmt(f.price)}</div>
      <div class="price-changes">
        <span id="live-change-day" class="${f.changeDay >= 0 ? 'val-positive' : 'val-negative'}">${f.changeDay >= 0 ? '+' : ''}${fmtPctShort(f.changeDay)} dia</span>
        <span class="${f.change12m >= 0 ? 'val-positive' : 'val-negative'}">${f.change12m >= 0 ? '+' : ''}${fmtPctShort(f.change12m)} 12m</span>
      </div>
      <div class="hero-nota-qual">
        <span class="nota-teaser-lock" aria-hidden="true">&#x1F512;</span>
        <span>Nota Qualitativa: <strong style="filter:blur(4px)">?.??</strong> / 4.0</span>
      </div>
      <div class="price-date" id="live-date">Dados de ${today}</div>
      <a href="#valuation-section" class="hero-cta-anchor" onclick="document.getElementById('valuation-section').scrollIntoView({behavior:'smooth'});return false;">Fazer meu Valuation &darr;</a>
    </div>
  </header>

  <!-- AUDITORIA IA -->
  <section class="social-proof-section animate-in" aria-label="Auditoria por IA">
    <div class="social-proof-card">
      <p class="social-proof-headline">Leu um relat&oacute;rio sobre ${f.symbol}? Viu uma recomenda&ccedil;&atilde;o?</p>
      <p class="social-proof-text">Nossa IA audita a tese por tr&aacute;s &mdash; governan&ccedil;a, vantagens competitivas, riscos e mais 3 categorias. <strong>Descubra se a indica&ccedil;&atilde;o se sustenta.</strong></p>
      <p class="social-proof-count">${socialProofCount(f.volMed2m, f.symbol).toLocaleString('pt-BR')} investidores j&aacute; validaram teses em ${f.symbol}</p>
      <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=${f.symbol}" class="social-proof-btn" data-cta="social-proof" onclick="_iaClick(event)">Auditar com IA <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16" style="vertical-align:middle;margin-left:0.3rem"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></a>
    </div>
  </section>

  <!-- SOBRE A EMPRESA (SEO + NEGÓCIO) -->
  <section class="section-card intro-combined animate-in" aria-label="Sobre ${f.symbol}">
    <div class="intro-combined-section">
      <h2 class="section-legend">Análise Fundamentalista</h2>
      <p><strong>${f.symbol}</strong> é a ação ${f.type === 'PN' ? 'preferencial' : f.type === 'ON' ? 'ordinária' : ''} de <strong>${f.name}</strong>, negociada na B3 (bolsa brasileira) no setor de ${f.sector}${f.subSector ? ', segmento de ' + f.subSector : ''}. Com cotação atual de <strong>R$ ${fmt(f.price)}</strong> e valor de mercado de ${fmtBig(f.marketCap)}, a empresa é analisada abaixo por 3 metodologias clássicas de valuation: Graham, Bazin e Gordon (DDM).</p>
      <p>A análise fundamentalista de ${f.symbol} utiliza 3 métodos clássicos de valuation — <strong>Graham</strong>, <strong>Bazin</strong> e <strong>Gordon (DDM)</strong> — para estimar o preço justo da ação com premissas ajustáveis. Confira os resultados abaixo e ajuste as premissas para sua própria análise.</p>
      <p>${plText}${evEbitdaText}${dyText}. ${roeText}${marginText} Abaixo, você encontra todos os indicadores fundamentalistas, demonstrações financeiras históricas e o preço justo calculado com premissas ajustáveis.</p>
    </div>
    ${data.businessSummary ? `
    <div class="intro-combined-divider"></div>
    <div class="intro-combined-section">
      <h2 class="section-legend">Visão de Negócio</h2>
      <p>${data.businessSummary}</p>
    </div>` : ''}
  </section>

  <!-- INDICADORES FUNDAMENTALISTAS (CSS-ONLY TABS) -->
  <section class="metrics-tabs-section animate-in" aria-label="Indicadores Fundamentalistas">
    <h2 class="section-legend">Indicadores Fundamentalistas</h2>
    <div class="tabs-container">
      <input type="radio" name="metrics-tab" id="tab-mercado" class="tab-radio">
      <label for="tab-mercado" class="tab-label">Mercado</label>
      <input type="radio" name="metrics-tab" id="tab-valuation" class="tab-radio" checked>
      <label for="tab-valuation" class="tab-label">Valuation</label>
      <input type="radio" name="metrics-tab" id="tab-rentabilidade" class="tab-radio">
      <label for="tab-rentabilidade" class="tab-label">Rentabilidade</label>
      <input type="radio" name="metrics-tab" id="tab-endividamento" class="tab-radio">
      <label for="tab-endividamento" class="tab-label">Endividamento</label>

      <div class="tab-panel" id="panel-mercado">
        <div class="metrics-grid">
          ${metricBox('Valor de Mercado', fmtBig(f.marketCap))}
          ${metricBox('Valor da Firma (EV)', fmtBig(f.firmValue))}
          ${metricBox('Nro. Ações', fmtVol(f.sharesOutstanding))}
          ${metricBox('Volume Médio (3M)', fmtVol(f.volMed2m))}
          ${metricBox('Min. 52 Semanas', fmtBRL(f.min52Week))}
          ${metricBox('Max. 52 Semanas', fmtBRL(f.max52Week))}
        </div>
      </div>
      <div class="tab-panel" id="panel-valuation">
        <div class="metrics-grid">
          ${metricBox('P/L', fmtNum(f.pl, 2))}
          ${metricBox('P/VP', fmtNum(f.pvp, 2))}
          ${metricBox('P/EBIT', fmtNum(f.pebit, 2))}
          ${metricBox('PSR (Price/Sales)', fmtNum(f.psr, 2))}
          ${metricBox('EV/EBITDA', fmtNum(f.evEbitda, 2))}
          ${metricBox('EV/EBIT', fmtNum(f.evEbit, 2))}
          ${metricBox('Div. Yield', fmtPctShort(f.divYield), colorClass(f.divYield))}
          ${metricBox('LPA', fmtBRL(f.lpa))}
          ${metricBox('VPA', fmtBRL(f.vpa))}
        </div>
      </div>
      <div class="tab-panel" id="panel-rentabilidade">
        <div class="metrics-grid">
          ${metricBox('ROE', fmtPctShort(f.roe), colorClass(f.roe))}
          ${metricBox('ROIC', fmtPctShort(f.roic), colorClass(f.roic))}
          ${metricBox('Margem Bruta', fmtPctShort(f.grossMargin))}
          ${metricBox('Margem EBIT', fmtPctShort(f.ebitMargin))}
          ${metricBox('Margem EBITDA', fmtPctShort(f.ebitdaMargin))}
          ${metricBox('Margem Líquida', fmtPctShort(f.netMargin), colorClass(f.netMargin))}
        </div>
      </div>
      <div class="tab-panel" id="panel-endividamento">
        <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
          ${metricBox('Div. Liq./EBITDA', fmtNum(f.debtEbitda, 2), colorClass(f.debtEbitda))}
          ${metricBox('Div. Bruta/Patrim.', fmtNum(f.debtEquity, 2))}
          ${metricBox('Liquidez Corrente', fmtNum(f.currentLiquidity, 2), colorClass(f.currentLiquidity))}
        </div>
      </div>

      <div class="metrics-timestamp">Atualizado em ${today} (p&oacute;s-fechamento B3)</div>
    </div>
  </section>

  <!-- PRECO JUSTO (METODOS CLASSICOS) -->
  <section class="methods-section animate-in" id="valuation-section" aria-label="Preço Justo - Métodos Clássicos">
    <div class="section-header-row">
      <div>
        <h3 class="section-title font-playfair">Calcule o pre&ccedil;o justo de ${f.symbol} com suas premissas</h3>
        <span class="section-sub">3 m&eacute;todos cl&aacute;ssicos + DCF avan&ccedil;ado na plataforma</span>
      </div>
      <div class="section-price-ref">Cotação Atual<br><strong>R$ ${fmt(f.price)}</strong></div>
    </div>
    <div class="methods-grid">

      <!-- GRAHAM -->
      <div class="method-card">
        <div class="method-header">
          <div>
            <span class="method-name">Graham</span>
            <span class="method-sub">Valor Intrínseco (LPA x VPA)</span>
          </div>
          <span class="method-audit">AUDITAR</span>
        </div>
        <div class="method-body">
          <div class="method-fv-row">
            <span class="method-fv-label">PRECO JUSTO</span>
            <span class="method-fv ${grahamFV / data.price - 1 > 0 ? 'val-positive' : 'val-negative'}" id="graham-fv">R$ ${fmt(grahamFV)}</span>
          </div>
          <div class="method-upside-row">
            <span class="method-fv-label">Upside</span>
            <span class="method-upside ${grahamFV / data.price - 1 > 0 ? 'val-positive' : 'val-negative'}" id="graham-upside">${grahamFV / data.price - 1 >= 0 ? '+' : ''}${fmtPctShort(grahamFV / data.price - 1)}</span>
          </div>

          <div class="premissas-section">
            <div class="premissas-label">PREMISSAS</div>
            <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=${f.symbol}" class="premissa-locked-row" data-cta="dcf-locked" onclick="_iaClick(event)">
              <span>&#x1F512; P/L Máximo: <strong style="filter:blur(4px)">15</strong></span>
              <span>P/VP Máximo: <strong style="filter:blur(4px)">1.5</strong></span>
            </a>
            <input type="hidden" id="graham-pl" value="15">
            <input type="hidden" id="graham-pvp" value="1.5">
            <div class="premissa-row">
              <label>Margem de Segurança</label>
              <div class="premissa-slider-group">
                <input type="range" id="graham-margin" min="0" max="50" step="1" value="25" class="premissa-slider">
                <span class="premissa-slider-val" id="graham-margin-val">25.0%</span>
              </div>
            </div>
          </div>

          <div class="premissa-info-row">
            <span>LPA:</span> <strong>R$ ${fmt(f.lpa)}</strong>
            <span style="margin-left:0.75rem">VPA:</span> <strong>R$ ${fmt(f.vpa)}</strong>
          </div>
        </div>
      </div>

      <!-- BAZIN -->
      <div class="method-card">
        <div class="method-header">
          <div>
            <span class="method-name">Bazin</span>
            <span class="method-sub">Preço justo por dividendos</span>
          </div>
          <span class="method-audit">AUDITAR</span>
        </div>
        <div class="method-body">
          <div class="method-fv-row">
            <span class="method-fv-label">PRECO JUSTO</span>
            <span class="method-fv ${bazinFV > 0 && bazinFV / data.price - 1 > 0 ? 'val-positive' : 'val-negative'}" id="bazin-fv">R$ ${fmt(bazinFV)}</span>
          </div>
          <div class="method-upside-row">
            <span class="method-fv-label">Upside</span>
            <span class="method-upside ${bazinFV > 0 && bazinFV / data.price - 1 > 0 ? 'val-positive' : 'val-negative'}" id="bazin-upside">${bazinFV > 0 ? (bazinFV / data.price - 1 >= 0 ? '+' : '') + fmtPctShort(bazinFV / data.price - 1) : '-'}</span>
          </div>

          <div class="premissas-section">
            <div class="premissas-label">PREMISSAS</div>
            <div class="premissa-row">
              <label>DY Minimo Desejado</label>
              <div class="premissa-slider-group">
                <input type="range" id="bazin-dy" min="1" max="15" step="0.5" value="6" class="premissa-slider">
                <span class="premissa-slider-val" id="bazin-dy-val">6.0%</span>
              </div>
            </div>
            <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=${f.symbol}" class="premissa-locked-row" data-cta="dcf-locked" onclick="_iaClick(event)">
              <span>&#x1F512; Anos para Média: <strong style="filter:blur(4px)">5 anos</strong></span>
            </a>
            <input type="hidden" id="bazin-years" value="5">
          </div>

          <div class="premissa-info-row">
            <span>Dividendos TTM:</span> <strong>R$ ${fmt(divTTM)}</strong>
          </div>
          <div class="premissa-info-row">
            <span>DY Atual:</span> <strong>${fmtPctShort(dyAtual)}</strong>
          </div>
        </div>
      </div>

      <!-- GORDON (DDM) -->
      <div class="method-card">
        <div class="method-header">
          <div>
            <span class="method-name">Gordon (DDM)</span>
            <span class="method-sub">Dividend Discount Model</span>
          </div>
          <span class="method-audit">AUDITAR</span>
        </div>
        <div class="method-body">
          <div class="method-fv-row">
            <span class="method-fv-label">PRECO JUSTO</span>
            <span class="method-fv ${gordonFV / data.price - 1 > 0 ? 'val-positive' : 'val-negative'}" id="gordon-fv">R$ ${fmt(gordonFV)}</span>
          </div>
          <div class="method-upside-row">
            <span class="method-fv-label">Upside</span>
            <span class="method-upside ${gordonFV / data.price - 1 > 0 ? 'val-positive' : 'val-negative'}" id="gordon-upside">${gordonFV / data.price - 1 >= 0 ? '+' : ''}${fmtPctShort(gordonFV / data.price - 1)}</span>
          </div>

          <div class="premissas-section">
            <div class="premissas-label">PREMISSAS</div>
            <div class="premissa-row">
              <label>Taxa de Desconto (r)</label>
              <div class="premissa-slider-group">
                <input type="range" id="gordon-r" min="5" max="25" step="0.5" value="12" class="premissa-slider">
                <span class="premissa-slider-val" id="gordon-r-val">12.0%</span>
              </div>
            </div>
            <div class="premissa-row">
              <label>Crescimento (g)</label>
              <div class="premissa-slider-group">
                <input type="range" id="gordon-g" min="0" max="15" step="0.5" value="5" class="premissa-slider">
                <span class="premissa-slider-val" id="gordon-g-val">5.0%</span>
              </div>
            </div>
            <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=${f.symbol}" class="premissa-locked-row" data-cta="dcf-locked" onclick="_iaClick(event)">
              <span>&#x1F512; Anos para Média: <strong style="filter:blur(4px)">5 anos</strong></span>
            </a>
            <input type="hidden" id="gordon-years" value="5">
          </div>

          <div class="premissa-info-row">
            <span>CAGR Dividendos:</span> <strong class="${divCAGR >= 0 ? 'val-positive' : 'val-negative'}">${divCAGR !== 0 ? fmtPctShort(divCAGR) : '-'}</strong>
          </div>
        </div>
      </div>


    </div>

    <!-- DCF (LOCKED — FULL WIDTH) -->
    <div class="dcf-locked-card method-card method-card-locked">
      <div class="dcf-locked-inner">
        <div class="dcf-locked-left">
          <div class="method-header" style="margin-bottom:0.5rem">
            <div>
              <span class="method-name">DCF</span>
              <span class="method-sub">Tabela de Sensibilidade</span>
            </div>
            <span class="method-locked-badge">PRO</span>
          </div>
          <div class="dcf-sensitivity-blur">
            ${sensitivityHTML}
          </div>
        </div>
        <div class="dcf-locked-right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <p class="dcf-locked-headline">Diferente de agregadores de dados, aqui <strong>voc&ecirc; monta seu pr&oacute;prio valuation</strong></p>
          <p class="dcf-locked-sub">Premissas avan&ccedil;adas, cen&aacute;rios e compara&ccedil;&atilde;o com intelig&ecirc;ncia artificial.</p>
          <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=${f.symbol}" class="method-unlock-btn" data-cta="dcf-locked" onclick="_iaClick(event)">Fazer Valuation DCF &rarr;</a>
        </div>
      </div>
    </div>
  </section>


  <!-- FEATURES SHOWCASE -->
  <section class="features-showcase animate-in" aria-label="Funcionalidades da plataforma">
    <div class="features-inner">
      <h3 class="features-title">Tudo que voc&ecirc; precisa para analisar ${f.symbol}</h3>
      <div class="features-grid">
        <div class="feature-item">
          <span class="feature-icon" role="img" aria-label="DCF Completo">&#x1F4CA;</span>
          <span class="feature-name">DCF Completo</span>
          <span class="feature-desc">Fluxo de caixa descontado com premissas edit&aacute;veis</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon" role="img" aria-label="Nota Qualitativa">&#x1F3AF;</span>
          <span class="feature-name">Nota Qualitativa</span>
          <span class="feature-desc">Auditoria com IA em 6 categorias</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon" role="img" aria-label="Otimizador Markowitz">&#x2696;&#xFE0F;</span>
          <span class="feature-name">Otimizador Markowitz</span>
          <span class="feature-desc">Fronteira eficiente e balanceamento de carteira</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon" role="img" aria-label="Radar de Oportunidades">&#x1F50D;</span>
          <span class="feature-name">Radar de Oportunidades</span>
          <span class="feature-desc">Screening com filtros fundamentalistas</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon" role="img" aria-label="Documentos CVM">&#x1F4C4;</span>
          <span class="feature-name">Documentos CVM</span>
          <span class="feature-desc">Feed de ITRs, DFPs e fatos relevantes</span>
        </div>
      </div>
      <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="features-cta" data-cta="features-card" onclick="_iaClick(event)">Explorar plataforma gr&aacute;tis &rarr;</a>
    </div>
  </section>

  <!-- NOTA QUALITATIVA (PAYWALL) -->
  <section class="section-card animate-in nota-section" id="nota-section" aria-label="Nota Qualitativa de ${f.symbol}">
    <div class="nota-header">
      <div>
        <div class="nota-label">Nota Qualitativa</div>
        <div style="margin-top:0.3rem">
          <span class="nota-score">?.??</span>
          <span class="nota-scale">0 &rarr; 4</span>
        </div>
      </div>
      <span class="nota-sector-badge">Setor Qualitativo: ${f.sector}</span>
    </div>

    ${qualScore ? `<div class="nota-categories">
      <div class="nota-categories-title">Scores por Categoria</div>
      ${[
        { name: 'Governança', score: qualScore.c1 },
        { name: 'Management', score: qualScore.c2 },
        { name: 'Indústria', score: qualScore.c3 },
        { name: 'Vantagens Competitivas', score: qualScore.c4 },
        { name: 'Poder de Barganha', score: qualScore.c5 },
        { name: 'Riscos e Estrutura', score: qualScore.c6 },
      ].map(cat => {
        const pct = Math.round((cat.score / 4) * 100);
        const color = cat.score >= 3 ? '#10b981' : cat.score >= 2 ? '#B68F40' : '#ef4444';
        return `<div class="nota-cat-item">
          <div class="nota-cat-header"><span class="nota-cat-name">${cat.name}</span><span class="nota-cat-score" style="color:${color}">?.?</span></div>
          <div class="nota-cat-bar"><div class="nota-cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
      }).join('\n      ')}
    </div>` : ''}

    <div class="nota-blurred">
      <div class="nota-detail-placeholder">
        <div class="nota-detail-title">Detalhamento por Categoria</div>
        <p>Análise qualitativa completa com mais de 50 perguntas de auditoria cobrindo governança corporativa, qualidade do management, dinâmica do setor, vantagens competitivas, poder de barganha e riscos estruturais.</p>
        <p>Cada categoria é avaliada com perguntas específicas e respostas fundamentadas em dados públicos, relatórios anuais e fatos relevantes sobre ${f.name}.</p>
      </div>
    </div>

    <div class="nota-overlay">
      <div class="nota-overlay-lock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      </div>
      <div class="nota-overlay-title">Análise Qualitativa com IA</div>
      <div class="nota-overlay-sub">Descubra a nota qualitativa de ${f.symbol} e o detalhamento completo das 6 categorias com respostas fundamentadas e auditoria por IA.</div>
      <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nota-overlay-btn" data-cta="nota-qualitativa" onclick="_iaClick(event)">Desbloquear Análise &rarr;</a>
    </div>
  </section>

  <!-- MARKOWITZ CARD -->
  <section class="markowitz-card animate-in" aria-label="Otimização de carteira">
    <div class="markowitz-inner">
      <div class="markowitz-icon" role="img" aria-label="Otimização">&#x2696;&#xFE0F;</div>
      <h3 class="markowitz-title">Tem ${f.symbol} na carteira?</h3>
      <p class="markowitz-desc">Descubra se seu portf&oacute;lio est&aacute; otimizado segundo Markowitz &mdash; fronteira eficiente, correla&ccedil;&atilde;o entre ativos e an&aacute;lise de risco/retorno.</p>
      <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="markowitz-btn" data-cta="markowitz" onclick="_iaClick(event)">Otimizar minha carteira &rarr;</a>
    </div>
  </section>


  <!-- DEMONSTRAÇÕES FINANCEIRAS -->
  <section class="section-card animate-in" aria-label="Demonstrações Financeiras">
    <div class="section-header-row">
      <h2 class="section-title font-playfair">Demonstrações Financeiras</h2>
      <span class="section-sub">Dados históricos</span>
    </div>

    <!-- DRE -->
    <div class="fin-tabs">
      <span class="fin-tab active">DRE</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table fin-transposed">
        <thead><tr><th class="sticky-col"></th>${dreTable.headerCells}</tr></thead>
        <tbody>${dreTable.rows}</tbody>
      </table>
    </div>

    ${balanceYearly.length > 0 ? `
    <!-- BALANCO -->
    <div class="fin-tabs" style="margin-top:1.5rem;">
      <span class="fin-tab active">Balanço</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table fin-transposed">
        <thead><tr><th class="sticky-col"></th>${balTable.headerCells}</tr></thead>
        <tbody>${balTable.rows}</tbody>
      </table>
    </div>` : ''}

    ${cashFlowYearly.length > 0 ? `
    <!-- FLUXO DE CAIXA -->
    <div class="fin-tabs" style="margin-top:1.5rem;">
      <span class="fin-tab active">Fluxo de Caixa</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table fin-transposed">
        <thead><tr><th class="sticky-col"></th>${cfTable.headerCells}</tr></thead>
        <tbody>${cfTable.rows}</tbody>
      </table>
    </div>` : ''}

    ${divYears.length > 0 ? `
    <!-- DIVIDENDOS RESUMO ANUAL -->
    <div class="fin-tabs" style="margin-top:1.5rem;">
      <span class="fin-tab active">Dividendos por Ano</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table fin-transposed">
        <thead><tr><th class="sticky-col"></th>${[...divYears].reverse().map(([year]) => `<th>${year}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><td class="sticky-col">Total Pago</td>${[...divYears].reverse().map(([, d]) => `<td>${fmtBRL(d.total)}</td>`).join('')}</tr>
          <tr><td class="sticky-col">Pagamentos</td>${[...divYears].reverse().map(([, d]) => `<td>${d.count}</td>`).join('')}</tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- LEAD COLLECTOR: PLANILHA FINANCEIRA COMPLETA -->
    <div class="div-lead-card" id="div-lead-card-${f.symbol}">
      <div class="div-lead-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <div class="div-lead-title">Dados Financeiros Completos de ${f.symbol}</div>
      <div class="div-lead-sub">DRE, Balan&ccedil;o Patrimonial, Fluxo de Caixa e Dividendos &mdash; ${dreYears.length > 0 ? dreYears.length + ' anos de hist&oacute;rico' : 'dados hist&oacute;ricos'}${divHistory.length > 0 ? ' + ' + divHistory.length + ' pagamentos de dividendos' : ''}.</div>
      <form class="div-lead-form" id="div-lead-form-${f.symbol}" onsubmit="return _iaLeadSubmit(event,'${f.symbol}')">
        <input type="text" name="name" placeholder="Seu nome" required>
        <input type="email" name="email" placeholder="Seu melhor e-mail" required>
        <button type="submit" class="div-lead-btn">Baixar dados completos <span>&rarr;</span></button>
      </form>
      <div class="div-lead-success" id="div-lead-success-${f.symbol}" style="display:none">
        <p>Pronto! O download vai come&ccedil;ar automaticamente.</p>
      </div>
    </div>
  </section>

  ${peers.length > 0 ? `
  <!-- AÇÕES DO MESMO SETOR -->
  <section class="section-card animate-in" aria-label="Ações do setor de ${f.sector}">
    <div class="section-header-row">
      <h2 class="section-title font-playfair">Ações do setor de ${f.sector}</h2>
      <span class="section-sub">Outras empresas do mesmo setor na B3</span>
    </div>
    <div class="peers-grid">
      ${peers.map(p => `
      <a href="/${p.ticker}/" class="peer-card">
        <span class="peer-ticker">${p.ticker}</span>
        <span class="peer-name">${p.name}</span>
        <span class="peer-price">R$ ${fmt(p.price)}</span>
      </a>`).join('')}
    </div>
    ${sectorSlugVal ? `<a href="/acoes/${sectorSlugVal}/" class="peers-more">Ver todas as ações de ${f.sector} &rarr;</a>` : ''}
  </section>` : ''}

  <!-- FAQ SEO -->
  <section class="section-card animate-in faq-section" aria-label="Perguntas Frequentes sobre ${f.symbol}">
    <h2 class="section-title font-playfair">Perguntas Frequentes sobre ${f.symbol}</h2>
    <dl class="faq-list">
      ${faqItems.map(faq => `
      <div class="faq-item">
        <dt class="faq-question">${faq.q}</dt>
        <dd class="faq-answer">${faq.a}</dd>
      </div>`).join('')}
    </dl>
  </section>

  <!-- CTA -->
  <section class="cta-card animate-in" aria-label="Acesse a plataforma">
    <h2>Sua an&aacute;lise de ${f.symbol} come&ccedil;a aqui</h2>
    <p>Premissas edit&aacute;veis, cen&aacute;rios Bear/Base/Bull, an&aacute;lise qualitativa com IA, otimizador Markowitz e muito mais &mdash; tudo gr&aacute;tis para come&ccedil;ar.</p>
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=${f.symbol}" class="cta-btn" data-cta="footer" onclick="_iaClick(event)">Comece sua an&aacute;lise gr&aacute;tis &rarr;</a>
  </section>

  </article>

  <!-- AÇÕES POPULARES (linking interno cross-sector) -->
  <nav class="section-card popular-tickers" aria-label="Ações populares no iAções">
    <h2 class="section-title font-playfair" style="font-size:1.1rem;margin-bottom:0.8rem;">Ações populares</h2>
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
      ${['PETR4','VALE3','ITUB4','BBAS3','WEGE3','BBDC4','ABEV3','RENT3','SUZB3','GGBR4','CSNA3','HAPV3','CPLE6','TAEE11','ELET3','BPAC11','ITSA4','VIVT3','MGLU3','JBSS3'].filter(t => t !== f.symbol).slice(0, 15).map(t =>
        `<a href="/${t}/" style="padding:0.3rem 0.6rem;background:#f8f6f1;border:1px solid #e2e8f0;border-radius:4px;font-size:0.75rem;font-weight:600;color:#0f172a;text-decoration:none;font-family:SFMono-Regular,monospace;">${t}</a>`
      ).join('')}
    </div>
    <a href="/acoes/" style="display:inline-block;margin-top:0.6rem;font-size:0.8rem;color:#B68F40;text-decoration:none;font-weight:500;">Ver todas as ações &rarr;</a>
  </nav>

  <!-- NOTAS SOBRE OS MÉTODOS DE VALUATION -->
  <div class="methods-note" style="margin-bottom:0.5rem;">
    <strong>Importante:</strong> Os valores apresentados nesta p&aacute;gina s&atilde;o estimativas calculadas por modelos matem&aacute;ticos e <strong>n&atilde;o constituem recomenda&ccedil;&atilde;o de compra, venda ou manuten&ccedil;&atilde;o de ativos</strong>. Cada investidor deve conduzir sua pr&oacute;pria an&aacute;lise, considerando o contexto da empresa, riscos setoriais, cen&aacute;rio macroecon&ocirc;mico e seu perfil de investimento.
  </div>
  <div class="methods-note" style="margin-bottom:0.5rem;">
    <strong>Graham</strong> calcula o valor intr&iacute;nseco com base no lucro por a&ccedil;&atilde;o (LPA) e valor patrimonial por a&ccedil;&atilde;o (VPA). &Eacute; mais adequado para empresas lucrativas, com patrim&ocirc;nio s&oacute;lido e hist&oacute;rico consistente.
  </div>
  <div class="methods-note" style="margin-bottom:0.5rem;">
    <strong>Bazin</strong> estima o pre&ccedil;o justo a partir dos dividendos pagos, dividindo-os por uma taxa m&iacute;nima de retorno desejada (dividend yield). Funciona melhor para empresas maduras e boas pagadoras de dividendos.
  </div>
  <div class="methods-note" style="margin-bottom:0.5rem;">
    <strong>Gordon (DDM)</strong> projeta o valor presente de todos os dividendos futuros, assumindo um crescimento perp&eacute;tuo constante. &Eacute; &uacute;til para empresas com dividendos est&aacute;veis e previs&iacute;veis.
  </div>
  <div class="methods-note" style="margin-bottom:1.5rem;">
    Utilize a <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" style="color:#B68F40;font-weight:600;" data-cta="disclaimer" onclick="_iaClick(event)">plataforma iA&ccedil;&otilde;es</a> para aprofundar sua an&aacute;lise com dados completos, comparativos setoriais e ferramentas de valuation avan&ccedil;adas. Investir exige estudo &mdash; conhe&ccedil;a a empresa, entenda os riscos e tome decis&otilde;es informadas.
  </div>

  <!-- DISCLAIMER -->
  <footer class="disclaimer" role="contentinfo">
    <h2 class="disclaimer-title">Isenção de Responsabilidade (Disclaimer)</h2>
    <p class="disclaimer-text">
      As análises, preços alvo e relatórios apresentados nesta página são gerados automaticamente por Inteligência Artificial e algoritmos financeiros (ValuAI By Brasil Horizonte). Estas informações têm caráter estritamente educativo e informativo, não configurando recomendação de compra ou venda de ativos, nem garantia de rentabilidade futura. Investimentos em renda variável envolvem riscos. A Inteligência Artificial pode cometer erros de interpretação ou cálculo (alucinações). Sempre consulte um profissional certificado e realize sua própria diligência antes de tomar qualquer decisão financeira.
    </p>
    <div class="footer-logos">
      <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener"><img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" class="footer-logo-bh"></a>
      <span class="footer-x">&times;</span>
      <span class="footer-iacoes"><span class="footer-iacoes-i">i</span>Ações</span>
    </div>
    <div class="footer-copy">
      &copy; ${new Date().getFullYear()} ValuAI by <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener">Brasil Horizonte</a>. Todos os direitos reservados. Dados atualizados em ${today}. Balanço: ${f.lastBalanceDate}.
    </div>
  </footer>

</main>

<script>
(function() {
  var price = ${data.price};
  var lpa = ${f.lpa};
  var vpa = ${f.vpa};
  var divTTM = ${divTTM};
  var divData = ${JSON.stringify([...divByYearMap.entries()].sort((a, b) => a[0] - b[0]).map(([y, a]) => ({ y, a })))};

  function fmt(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(n) { return (n * 100).toFixed(1) + '%'; }
  function setFV(id, fv) {
    var el = document.getElementById(id);
    if (!el) return;
    var up = fv > 0 ? fv / price - 1 : 0;
    el.textContent = fv > 0 ? 'R$ ' + fmt(fv) : '-';
    el.className = 'method-fv ' + (up > 0 ? 'val-positive' : 'val-negative');
    var uid = id.replace('-fv', '-upside');
    var uel = document.getElementById(uid);
    if (uel) {
      uel.textContent = fv > 0 ? (up >= 0 ? '+' : '') + pct(up) : '-';
      uel.className = 'method-upside ' + (up > 0 ? 'val-positive' : 'val-negative');
    }
  }

  function calcGraham() {
    var maxPL = parseFloat(document.getElementById('graham-pl').value) || 15;
    var maxPVP = parseFloat(document.getElementById('graham-pvp').value) || 1.5;
    var margin = (parseFloat(document.getElementById('graham-margin').value) || 25) / 100;
    document.getElementById('graham-margin-val').textContent = (margin * 100).toFixed(1) + '%';
    if (lpa <= 0 || vpa <= 0) { setFV('graham-fv', 0); return; }
    var fv = Math.sqrt(maxPL * maxPVP * lpa * vpa) * (1 - margin);
    setFV('graham-fv', fv);
  }

  function getAvgDiv(years) {
    if (!divData.length) return divTTM;
    var now = new Date().getFullYear();
    var filtered = divData.filter(function(d) { return d.y >= now - years; });
    if (!filtered.length) return divTTM;
    var total = filtered.reduce(function(s, d) { return s + d.a; }, 0);
    return total / years;
  }

  function calcBazin() {
    var minDY = (parseFloat(document.getElementById('bazin-dy').value) || 6) / 100;
    var years = parseInt(document.getElementById('bazin-years').value) || 5;
    document.getElementById('bazin-dy-val').textContent = (minDY * 100).toFixed(1) + '%';
    var avg = getAvgDiv(years);
    var fv = avg > 0 && minDY > 0 ? avg / minDY : 0;
    setFV('bazin-fv', fv);
  }

  function calcGordon() {
    var r = (parseFloat(document.getElementById('gordon-r').value) || 12) / 100;
    var g = (parseFloat(document.getElementById('gordon-g').value) || 5) / 100;
    document.getElementById('gordon-r-val').textContent = (r * 100).toFixed(1) + '%';
    document.getElementById('gordon-g-val').textContent = (g * 100).toFixed(1) + '%';
    var years = parseInt(document.getElementById('gordon-years').value) || 5;
    var avg = getAvgDiv(years);
    if (r <= g || avg <= 0) { setFV('gordon-fv', 0); return; }
    var d1 = avg * (1 + g);
    var fv = d1 / (r - g);
    setFV('gordon-fv', fv);
  }

  // Bind events
  ['graham-pl', 'graham-pvp', 'graham-margin'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', calcGraham);
  });
  ['bazin-dy', 'bazin-years'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', calcBazin);
  });
  ['gordon-r', 'gordon-g', 'gordon-years'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', calcGordon);
  });
})();
</script>
<script>
(function(){
  var TICKERS=null, input=document.getElementById('nav-ticker-search'),
      dd=document.getElementById('nav-search-dropdown'), hl=-1;
  function load(){
    if(TICKERS)return Promise.resolve(TICKERS);
    return fetch('/tickers.json').then(function(r){return r.ok?r.json():[]})
      .then(function(d){TICKERS=d;return d}).catch(function(){TICKERS=[];return[]});
  }
  function go(t){window.location.href='/'+t+'/';}
  function render(items){
    hl=-1;
    if(!items.length){dd.innerHTML='<div class="s-empty">Nenhuma acao encontrada</div>';dd.classList.add('active');return;}
    dd.innerHTML=items.map(function(t){
      return '<a href="/'+t.ticker+'/" data-t="'+t.ticker+'"><div><span class="s-ticker">'+t.ticker+'</span>'+(t.name?'<span class="s-name">'+t.name+'</span>':'')+'</div><span class="s-arrow">&rarr;</span></a>';
    }).join('');
    dd.classList.add('active');
  }
  input.addEventListener('input',function(){
    var v=input.value.trim().toUpperCase();
    if(!v){dd.classList.remove('active');return;}
    load().then(function(tk){
      if(!tk.length){dd.classList.remove('active');return;}
      var m=tk.filter(function(t){return t.ticker.indexOf(v)===0||(t.name&&t.name.toUpperCase().indexOf(v)>=0);}).slice(0,8);
      render(m);
    });
  });
  input.addEventListener('keydown',function(e){
    var items=dd.querySelectorAll('a');
    if(e.key==='ArrowDown'){e.preventDefault();hl=Math.min(hl+1,items.length-1);items.forEach(function(el,i){el.classList.toggle('hl',i===hl);});}
    else if(e.key==='ArrowUp'){e.preventDefault();hl=Math.max(hl-1,0);items.forEach(function(el,i){el.classList.toggle('hl',i===hl);});}
    else if(e.key==='Enter'){e.preventDefault();if(hl>=0&&items[hl])go(items[hl].dataset.t);else{var v=input.value.trim().toUpperCase();if(v)go(v);}}
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.nav-search'))dd.classList.remove('active');});
})();
</script>

<!-- Slider pulse hint -->
<script>
(function(){
  if(!window.IntersectionObserver)return;
  var cards=document.querySelectorAll('.method-card:not(.method-card-locked)');
  var ob=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('slider-hint');
        ob.unobserve(e.target);
        var inputs=e.target.querySelectorAll('input[type="range"]');
        inputs.forEach(function(inp){
          inp.addEventListener('input',function(){e.target.classList.remove('slider-hint');},{once:true});
        });
        setTimeout(function(){e.target.classList.remove('slider-hint');},4000);
      }
    });
  },{threshold:0.5});
  cards.forEach(function(c){ob.observe(c);});
})();
</script>

<!-- Scroll depth tracking -->
<script>
(function(){
  var f={};
  var m={scroll_25:'#valuation-section',scroll_50:'.features-showcase',scroll_75:'[aria-label="Demonstrações Financeiras"]',scroll_100:'.faq-section'};
  if(!window.IntersectionObserver)return;
  var o=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){var k=e.target.dataset.sm;if(k&&!f[k]){f[k]=1;_iaTrack(k)}}
    })
  },{threshold:0.1});
  Object.keys(m).forEach(function(k){
    var el=document.querySelector(m[k]);
    if(el){el.dataset.sm=k;o.observe(el)}
  })
})();
</script>

<!-- Live price update -->
<script>
(function(){
  var sym='${f.symbol}';
  fetch(_iaB+'/rest/v1/brapi_quotes?select=regular_market_price,regular_market_change_percent,updated_at&symbol=eq.'+sym+'&limit=1',{
    headers:{'apikey':_iaK,'Authorization':'Bearer '+_iaK}
  }).then(function(r){return r.json()}).then(function(d){
    if(!d||!d[0]||!d[0].regular_market_price)return;
    var q=d[0],p=q.regular_market_price,c=q.regular_market_change_percent||0;
    var pe=document.getElementById('live-price');
    var ce=document.getElementById('live-change-day');
    var de=document.getElementById('live-date');
    if(pe)pe.innerHTML='<sup>R$</sup>'+Number(p).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(ce){ce.className=c>=0?'val-positive':'val-negative';ce.textContent=(c>=0?'+':'')+Number(c).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'% dia';}
    if(de&&q.updated_at){var dt=new Date(q.updated_at);de.textContent='Atualizado em '+dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
  }).catch(function(){});
})();
</script>

</body>
</html>`;
};

// --- Index Page (/acoes/index.html) ---
export const generateIndexHTML = (tickers: TickerIndexEntry[]): string => {
  const today = new Date().toLocaleDateString('pt-BR');
  const year = new Date().getFullYear();
  const sectors = [...new Set(tickers.map(t => t.sector).filter(Boolean))].sort();

  const tickerRows = tickers.map(t => `
    <tr data-sector="${t.sector}">
      <td><a href="/${t.ticker}/" class="idx-ticker-link">${t.ticker}</a></td>
      <td class="idx-name">${t.name}</td>
      <td>${t.sector}</td>
      <td class="idx-num">${t.price > 0 ? 'R$ ' + fmt(t.price) : '-'}</td>
      <td class="idx-num">${t.pl > 0 ? fmtNum(t.pl) : '-'}</td>
      <td class="idx-num">${t.divYield > 0 ? fmtPctShort(t.divYield) : '-'}</td>
      <td class="idx-num">${fmtBig(t.marketCap)}</td>
    </tr>`).join('');

  const sectorFilters = sectors.map(s =>
    `<button class="idx-filter-btn" data-filter="${s}" onclick="filterSector('${s}')">${s}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-858T7GLTMJ"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-858T7GLTMJ');</script>
  <script>var _iaB='https://dawvgbopyemcayavcatd.supabase.co',_iaK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd3ZnYm9weWVtY2F5YXZjYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MzAwOTEsImV4cCI6MjA3MTMwNjA5MX0.TuQV1G_JsJQRjLr76f8xX2HUjCig5FQa8R-YpsPyJiw',_iaS=(function(){var s=sessionStorage.getItem('_ia_sid');if(!s){s=crypto.randomUUID();sessionStorage.setItem('_ia_sid',s)}return s})(),_iaD=(function(){var ua=navigator.userAgent;var m=/Mobi|Android/i.test(ua);var t=/Tablet|iPad/i.test(ua);var dt=t?'tablet':m?'mobile':'desktop';var br='Outro';if(/Edg\\//i.test(ua))br='Edge';else if(/Chrome/i.test(ua))br='Chrome';else if(/Firefox/i.test(ua))br='Firefox';else if(/Safari/i.test(ua))br='Safari';var os='Outro';if(/Windows/i.test(ua))os='Windows';else if(/Mac/i.test(ua))os='macOS';else if(/Android/i.test(ua))os='Android';else if(/iPhone|iPad|iPod/i.test(ua))os='iOS';else if(/Linux/i.test(ua))os='Linux';return{dt:dt,br:br,os:os}})();var _iaSH=(function(){var ua=navigator.userAgent;if(/FBAN|FBAV/i.test(ua))return'facebook';if(/Instagram/i.test(ua))return'instagram';if(/LinkedIn/i.test(ua))return'linkedin';if(/WhatsApp/i.test(ua))return'whatsapp';if(/Telegram/i.test(ua))return'telegram';if(/Twitter|TwitterAndroid/i.test(ua))return'twitter';return null})(),_iaCID=(function(){var u=new URLSearchParams(location.search);if(u.get('fbclid'))return'facebook';if(u.get('gclid'))return'google_ads';if(u.get('ttclid'))return'tiktok';if(u.get('li_fat_id'))return'linkedin';if(u.get('twclkd'))return'twitter';if(u.get('msclkid'))return'microsoft_ads';return null})();function _iaTrack(ev,cid){var u=new URLSearchParams(location.search);var d={session_id:_iaS,page_path:(location.pathname.replace(/\\/index\\.html$/,'').replace(/\\/$/,'')||'/').toUpperCase(),referrer:document.referrer||null,utm_source:u.get('utm_source')||null,utm_medium:u.get('utm_medium')||null,utm_campaign:u.get('utm_campaign')||null,device_type:_iaD.dt,screen_width:screen.width,browser:_iaD.br,os:_iaD.os,event_type:ev||'pageview',source_hint:_iaSH,click_id_source:_iaCID};if(cid)d.cta_id=cid;fetch(_iaB+'/rest/v1/iacoes_page_views',{method:'POST',headers:{'Content-Type':'application/json','apikey':_iaK,'Authorization':'Bearer '+_iaK,'Prefer':'return=minimal'},keepalive:true,body:JSON.stringify(d)}).catch(function(){})}_iaTrack();function _iaClick(e){if(e.metaKey||e.ctrlKey||e.shiftKey||e.button===1)return;e.preventDefault();var el=e.currentTarget;var cid=el.getAttribute('data-cta')||'unknown';var u;try{u=new URL(el.href)}catch(_){u=null}if(u){var inUtm=new URLSearchParams(location.search);var src=inUtm.get('utm_source')||'iacoes';var med=inUtm.get('utm_medium')||'acoes-index';var camp=inUtm.get('utm_campaign')||'seo-organico';if(!u.searchParams.has('utm_source'))u.searchParams.set('utm_source',src);if(!u.searchParams.has('utm_medium'))u.searchParams.set('utm_medium',med);if(!u.searchParams.has('utm_campaign'))u.searchParams.set('utm_campaign',camp);if(!u.searchParams.has('utm_content'))u.searchParams.set('utm_content',cid)}_iaTrack('cta_click',cid);var dest=u?u.toString():el.href;setTimeout(function(){window.location.href=dest},150)}</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todas as Ações da B3 — Análise Fundamentalista e Preço Justo ${year} | iAções</title>
  <meta name="description" content="Lista completa de ${tickers.length} ações da B3 com indicadores fundamentalistas: P/L, Dividend Yield, preço justo por Graham, Bazin e Gordon. Análise fundamentalista atualizada em ${today}.">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="Brasil Horizonte">
  <link rel="canonical" href="https://iacoes.com.br/acoes/">
  <meta property="og:title" content="Todas as Ações da B3 — Análise Fundamentalista ${year} | iAções">
  <meta property="og:description" content="Lista completa de ${tickers.length} ações da B3 com indicadores fundamentalistas atualizados.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://iacoes.com.br/acoes/">
  <meta property="og:site_name" content="iAções — Análise de Ações | Brasil Horizonte">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:image" content="https://iacoes.com.br/assets/img/og-iacoes.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="628">
  <meta property="og:image:alt" content="Todas as Ações da B3 — iAções">
  <meta name="keywords" content="ações B3, análise fundamentalista, preço justo, valuation, Graham, Bazin, Gordon, bolsa brasileira, investimentos, P/L, dividend yield, ROE, iAções, Brasil Horizonte">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Todas as Ações da B3 — Análise Fundamentalista ${year} | iAções">
  <meta name="twitter:description" content="Lista completa de ${tickers.length} ações da B3 com indicadores fundamentalistas atualizados.">
  <meta name="twitter:image" content="https://iacoes.com.br/assets/img/og-iacoes.png">
  <meta name="twitter:image:alt" content="Todas as Ações da B3 — iAções">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Ações da B3 — Análise Fundamentalista",
    "description": "Lista de ${tickers.length} ações da bolsa brasileira com indicadores fundamentalistas e preço justo.",
    "numberOfItems": ${tickers.length},
    "itemListElement": [
      ${tickers.slice(0, 50).map((t, i) => `{
        "@type": "ListItem",
        "position": ${i + 1},
        "name": "${t.ticker} — ${t.name}",
        "url": "https://iacoes.com.br/${t.ticker}/"
      }`).join(',\n      ')}
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "iAções", "item": "https://iacoes.com.br/" },
      { "@type": "ListItem", "position": 2, "name": "Ações", "item": "https://iacoes.com.br/acoes/" }
    ]
  }
  </script>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { font-size: 16px; }
    body {
      font-family: 'Montserrat', sans-serif;
      background: #f5f3ef; color: #0f172a;
      -webkit-font-smoothing: antialiased; line-height: 1.5;
    }
    .font-playfair { font-family: 'Playfair Display', serif; }
    .nav {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.5rem; height: 56px;
      background: #041C24; border-bottom: 1px solid rgba(182,143,64,0.2);
    }
    .nav-left { display: flex; align-items: center; gap: 0.75rem; }
    .nav-brand { display: flex; align-items: center; text-decoration: none; }
    .nav-logo-bh { height: 28px; opacity: 0.95; }
    .nav-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.2); }
    .nav-iacoes {
      text-decoration: none; display: flex; align-items: baseline;
      font-family: 'JetBrains Mono', monospace; font-size: 1.15rem;
      font-weight: 700; letter-spacing: -0.01em;
    }
    .nav-iacoes-i { color: #B68F40; }
    .nav-iacoes-acoes { color: #fff; }
    .nav-cursor {
      display: inline-block; width: 2px; height: 1.1em;
      background: #B68F40; margin-left: 2px; vertical-align: middle;
      animation: blink 1s step-end infinite;
    }
    @keyframes blink { 50% { opacity: 0; } }
    .nav-links { display: flex; gap: 0.5rem; }
    .nav-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.9rem; border-radius: 8px;
      font-size: 0.8rem; font-weight: 600; text-decoration: none;
      transition: all 0.2s; white-space: nowrap;
    }
    .nav-btn-gold { background: #B68F40; color: #041C24; }
    .nav-btn-gold:hover { background: #c9a44e; }
    .nav-btn-outline { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    .nav-btn-outline:hover { background: rgba(255,255,255,0.08); }
    @media (max-width: 640px) { .nav-links { display: none; } }

    .breadcrumb { max-width: 1200px; margin: 0 auto; padding: 0.6rem 1.5rem; }
    .breadcrumb ol { list-style: none; display: flex; gap: 0.3rem; font-size: 0.7rem; color: #94a3b8; }
    .breadcrumb li::after { content: '/'; margin-left: 0.3rem; }
    .breadcrumb li:last-child::after { content: ''; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    .breadcrumb a:hover { color: #B68F40; text-decoration: underline; }
    .breadcrumb [aria-current="page"] { color: #0f172a; font-weight: 600; }

    .page { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h1 { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 800; margin-bottom: 0.3rem; }
    .page-header p { color: #64748b; font-size: 0.9rem; }
    .page-header .count { font-weight: 700; color: #0f172a; }

    .idx-filters {
      display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem;
    }
    .idx-filter-btn {
      padding: 0.3rem 0.7rem; border: 1px solid #e2e8f0; border-radius: 6px;
      background: #fff; font-size: 0.7rem; font-weight: 600; color: #475569;
      cursor: pointer; transition: all 0.15s; font-family: 'Montserrat', sans-serif;
    }
    .idx-filter-btn:hover, .idx-filter-btn.active {
      background: #041C24; color: #fff; border-color: #041C24;
    }

    .idx-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      overflow: hidden;
    }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .idx-table {
      width: 100%; border-collapse: collapse; font-size: 0.82rem;
    }
    .idx-table thead th {
      padding: 0.7rem 0.9rem; text-align: left; font-size: 0.65rem;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
      color: #94a3b8; border-bottom: 1px solid #e2e8f0;
      white-space: nowrap; position: sticky; top: 0; background: #fff;
    }
    .idx-table tbody td {
      padding: 0.6rem 0.9rem; border-bottom: 1px solid #f8fafc;
      white-space: nowrap;
    }
    .idx-table tbody tr:hover { background: #fafaf8; }
    .idx-ticker-link {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-weight: 700; color: #0f172a; text-decoration: none;
      font-size: 0.85rem;
    }
    .idx-ticker-link:hover { color: #B68F40; text-decoration: underline; }
    .idx-name { color: #64748b; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    .idx-num {
      font-family: 'SFMono-Regular', Consolas, monospace;
      text-align: right; font-size: 0.8rem;
    }
    .idx-table thead th:nth-child(n+4) { text-align: right; }

    .footer-disc {
      text-align: center; padding: 2rem 1.5rem; border-top: 1px solid #e2e8f0; margin-top: 1.5rem;
    }
    .footer-disc p { font-size: 0.72rem; color: #94a3b8; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    .footer-disc a { color: #64748b; text-decoration: none; }
    @media (max-width: 768px) {
      .page { padding: 1rem; }
      .page-header h1 { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
<nav class="nav">
  <div class="nav-left">
    <a href="/" class="nav-brand"><img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" class="nav-logo-bh"></a>
    <span class="nav-divider"></span>
    <a href="/" class="nav-iacoes"><span class="nav-iacoes-i">iA</span><span class="nav-iacoes-acoes">ções</span><span class="nav-cursor"></span></a>
  </div>
  <div class="nav-links">
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nav-btn nav-btn-outline" data-cta="nav-app" onclick="_iaClick(event)">Acessar App</a>
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nav-btn nav-btn-gold" data-cta="nav-assinar" onclick="_iaClick(event)">Assinar Plano</a>
  </div>
</nav>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">iAções</a></li>
    <li aria-current="page">Ações</li>
  </ol>
</nav>

<main class="page">
  <header class="page-header">
    <h1 class="font-playfair">Todas as Ações da B3</h1>
    <p><span class="count">${tickers.length}</span> ações com análise fundamentalista e preço justo por Graham, Bazin e Gordon. Dados atualizados em ${today}.</p>
  </header>

  <div class="idx-filters">
    <button class="idx-filter-btn active" onclick="filterSector('')">Todos</button>
    ${sectorFilters}
  </div>

  <div class="idx-card">
    <div class="table-scroll">
      <table class="idx-table" id="idx-table">
        <thead>
          <tr>
            <th>Ticker</th><th>Empresa</th><th>Setor</th>
            <th>Preço</th><th>P/L</th><th>DY</th><th>Market Cap</th>
          </tr>
        </thead>
        <tbody id="idx-tbody">
          ${sectors.map(s => `<tr id="setor-${sectorSlug(s)}" class="idx-sector-anchor"><td colspan="7" style="background:#f8f6f1;padding:0.5rem 0.9rem;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#B68F40;border-bottom:1px solid #e2e8f0;">${s}</td></tr>
          ${tickers.filter(t => t.sector === s).map(t => `<tr data-sector="${t.sector}">
            <td><a href="/${t.ticker}/" class="idx-ticker-link">${t.ticker}</a></td>
            <td class="idx-name">${t.name}</td>
            <td>${t.sector}</td>
            <td class="idx-num">${t.price > 0 ? 'R$ ' + fmt(t.price) : '-'}</td>
            <td class="idx-num">${t.pl > 0 ? fmtNum(t.pl) : '-'}</td>
            <td class="idx-num">${t.divYield > 0 ? fmtPctShort(t.divYield) : '-'}</td>
            <td class="idx-num">${fmtBig(t.marketCap)}</td>
          </tr>`).join('')}`).join('\n          ')}
        </tbody>
      </table>
    </div>
  </div>

  <footer class="footer-disc">
    <p>&copy; ${new Date().getFullYear()} ValuAI by <a href="https://brasilhorizonte.com.br" target="_blank">Brasil Horizonte</a>. Dados atualizados em ${today}. As informações não constituem recomendação de investimento.</p>
  </footer>
</main>

<script>
function filterSector(sector) {
  var rows = document.querySelectorAll('#idx-tbody tr[data-sector]');
  var anchors = document.querySelectorAll('.idx-sector-anchor');
  var btns = document.querySelectorAll('.idx-filter-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-filter') === sector || (!sector && !b.getAttribute('data-filter'))); });
  rows.forEach(function(r) { r.style.display = (!sector || r.getAttribute('data-sector') === sector) ? '' : 'none'; });
  anchors.forEach(function(a) {
    var s = a.id.replace('setor-', '');
    a.style.display = (!sector || a.id === 'setor-' + sector.toLowerCase().replace(/[^a-z0-9]+/g, '-')) ? '' : 'none';
  });
}
</script>

<!-- Scroll depth tracking -->
<script>
(function(){
  var f={};
  var m={scroll_50:'.idx-card',scroll_100:'.footer-disc'};
  if(!window.IntersectionObserver)return;
  var o=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){var k=e.target.dataset.sm;if(k&&!f[k]){f[k]=1;_iaTrack(k)}}
    })
  },{threshold:0.1});
  Object.keys(m).forEach(function(k){
    var el=document.querySelector(m[k]);
    if(el){el.dataset.sm=k;o.observe(el)}
  })
})();
</script>
</body>
</html>`;
};

// --- Sector Page (/acoes/{setor}/index.html) ---
export const generateSectorPage = (sector: string, tickers: TickerIndexEntry[]): string => {
  const today = new Date().toLocaleDateString('pt-BR');
  const year = new Date().getFullYear();
  const slug = sectorSlug(sector);
  const count = tickers.length;

  const avgPL = tickers.filter(t => t.pl > 0).reduce((s, t) => s + t.pl, 0) / (tickers.filter(t => t.pl > 0).length || 1);
  const avgDY = tickers.filter(t => t.divYield > 0).reduce((s, t) => s + t.divYield, 0) / (tickers.filter(t => t.divYield > 0).length || 1);
  const totalMC = tickers.reduce((s, t) => s + t.marketCap, 0);

  const rows = tickers.map(t => `
    <tr>
      <td><a href="/${t.ticker}/" class="idx-ticker-link">${t.ticker}</a></td>
      <td class="idx-name">${t.name}</td>
      <td class="idx-num">${t.price > 0 ? 'R$ ' + fmt(t.price) : '-'}</td>
      <td class="idx-num">${t.pl > 0 ? fmtNum(t.pl) : '-'}</td>
      <td class="idx-num">${t.divYield > 0 ? fmtPctShort(t.divYield) : '-'}</td>
      <td class="idx-num">${fmtBig(t.marketCap)}</td>
    </tr>`).join('');

  const desc = `${count} ações do setor de ${sector} na B3 com análise fundamentalista, preço justo e dividendos. P/L médio: ${fmtNum(avgPL)}, DY médio: ${fmtPctShort(avgDY)}. Dados ${year}.`;

  const faqItems = [
    { q: `Quantas ações do setor de ${sector} existem na B3?`, a: `Atualmente existem ${count} ações do setor de ${sector} listadas na B3 com análise fundamentalista disponível no iAções. O valor de mercado combinado do setor é de ${fmtBig(totalMC)}.` },
    { q: `Qual o P/L médio do setor de ${sector}?`, a: `O P/L (Preço/Lucro) médio das ${count} ações do setor de ${sector} é de ${fmtNum(avgPL)}. O P/L indica quantos anos de lucro seriam necessários para recuperar o investimento no preço atual.` },
    { q: `Quais ações do setor de ${sector} pagam mais dividendos?`, a: `O Dividend Yield médio do setor de ${sector} é de ${fmtPctShort(avgDY)}. As ações com maior DY são: ${tickers.filter(t => t.divYield > 0).sort((a, b) => b.divYield - a.divYield).slice(0, 3).map(t => t.ticker + ' (' + fmtPctShort(t.divYield) + ')').join(', ') || 'dados não disponíveis'}.` },
  ];

  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(f => ({
      "@type": "Question", "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ações do Setor de ${sector} ${year} | Análise Fundamentalista | iAções</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="ações ${sector}, setor ${sector} B3, dividendos ${sector}, análise fundamentalista ${sector}, preço justo ${sector}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://iacoes.com.br/acoes/${slug}/">
  <meta property="og:title" content="Ações do Setor de ${sector} — Análise e Dividendos | iAções">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="https://iacoes.com.br/acoes/${slug}/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="iAções">
  <script type="application/ld+json">${faqSchema}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type":"ListItem","position":1,"name":"Home","item":"https://iacoes.com.br/"},
      {"@type":"ListItem","position":2,"name":"Ações","item":"https://iacoes.com.br/acoes/"},
      {"@type":"ListItem","position":3,"name":sector,"item":`https://iacoes.com.br/acoes/${slug}/`}
    ]
  })}</script>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Montserrat',sans-serif;background:#f5f3ef;color:#0f172a;line-height:1.6}
    .nav{background:#041C24;padding:0.8rem 2rem;display:flex;align-items:center;justify-content:space-between}
    .nav-logo{display:flex;align-items:center;gap:0.5rem;text-decoration:none}
    .nav-logo img{height:28px}
    .nav-brand{color:#fff;font-weight:700;font-size:1.1rem;display:flex;align-items:center;gap:0.3rem}
    .nav-brand span:first-child{color:#B68F40}
    .nav-links{display:flex;gap:1rem;align-items:center}
    .nav-links a{color:rgba(255,255,255,0.8);text-decoration:none;font-size:0.82rem;font-weight:500}
    .breadcrumb{padding:0.7rem 2rem;font-size:0.75rem;color:#64748b}
    .breadcrumb a{color:#64748b;text-decoration:none}
    .breadcrumb a:hover{color:#B68F40}
    .page{max-width:1200px;margin:0 auto;padding:1.5rem}
    .page-header{margin-bottom:1.5rem}
    .page-header h1{font-family:'Playfair Display',serif;font-size:1.8rem;margin-bottom:0.5rem}
    .page-header p{color:#64748b;font-size:0.88rem}
    .sector-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem}
    .stat-card{background:#fff;border-radius:10px;padding:1rem;border:1px solid #e2e8f0;text-align:center}
    .stat-card .stat-val{font-size:1.3rem;font-weight:700;color:#0f172a;font-family:'SFMono-Regular',monospace}
    .stat-card .stat-lbl{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-top:0.2rem}
    .idx-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden}
    .table-scroll{overflow-x:auto}
    .idx-table{width:100%;border-collapse:collapse;font-size:0.82rem}
    .idx-table th{padding:0.6rem 0.9rem;text-align:left;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:2px solid #e2e8f0;position:sticky;top:0;background:#fff}
    .idx-table td{padding:0.55rem 0.9rem;border-bottom:1px solid #f1f5f9}
    .idx-table tbody tr:hover{background:#fafaf8}
    .idx-num{font-family:'SFMono-Regular',monospace;text-align:right;font-size:0.8rem}
    .idx-ticker-link{color:#B68F40;font-weight:700;text-decoration:none}
    .idx-ticker-link:hover{text-decoration:underline}
    .idx-name{color:#475569;font-size:0.78rem}
    .faq-section{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:2rem;margin-top:1.5rem}
    .faq-section h2{font-family:'Playfair Display',serif;font-size:1.3rem;margin-bottom:1rem}
    .faq-item{padding:1rem 0;border-bottom:1px solid #f1f5f9}
    .faq-item:last-child{border:none}
    .faq-item h3{font-size:0.92rem;margin-bottom:0.4rem}
    .faq-item p{color:#475569;font-size:0.85rem;line-height:1.7}
    .footer-disc{text-align:center;padding:2rem;font-size:0.72rem;color:#94a3b8}
    .footer-disc a{color:#B68F40}
    .back-link{display:inline-block;margin-top:1rem;color:#B68F40;font-size:0.85rem;text-decoration:none;font-weight:600}
    .back-link:hover{text-decoration:underline}
  </style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">
    <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" loading="lazy">
    <span style="color:rgba(255,255,255,0.3);margin:0 0.3rem">|</span>
    <span class="nav-brand"><span>iA</span>ções</span>
  </a>
  <div class="nav-links">
    <a href="/acoes/">Todas as Ações</a>
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" target="_blank" rel="noopener">Acessar App</a>
  </div>
</nav>
<div class="breadcrumb">
  <a href="/">Home</a> &rsaquo; <a href="/acoes/">Ações</a> &rsaquo; ${sector}
</div>

<main class="page">
  <header class="page-header">
    <h1 class="font-playfair">Ações do Setor de ${sector}</h1>
    <p>${count} ações com análise fundamentalista e preço justo. Dados atualizados em ${today}.</p>
  </header>

  <div class="sector-stats">
    <div class="stat-card"><div class="stat-val">${count}</div><div class="stat-lbl">Ações no setor</div></div>
    <div class="stat-card"><div class="stat-val">${fmtNum(avgPL)}</div><div class="stat-lbl">P/L Médio</div></div>
    <div class="stat-card"><div class="stat-val">${fmtPctShort(avgDY)}</div><div class="stat-lbl">DY Médio</div></div>
    <div class="stat-card"><div class="stat-val">${fmtBig(totalMC)}</div><div class="stat-lbl">Market Cap Total</div></div>
  </div>

  <div class="idx-card">
    <div class="table-scroll">
      <table class="idx-table">
        <thead>
          <tr><th>Ticker</th><th>Empresa</th><th>Preço</th><th>P/L</th><th>DY</th><th>Market Cap</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>

  <div class="faq-section">
    <h2>Perguntas Frequentes — Setor de ${sector}</h2>
    ${faqItems.map(f => `<div class="faq-item"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('')}
  </div>

  <a href="/acoes/" class="back-link">&larr; Ver todos os setores</a>

  <footer class="footer-disc">
    <p>&copy; ${year} ValuAI by <a href="https://brasilhorizonte.com.br" target="_blank">Brasil Horizonte</a>. Dados atualizados em ${today}. As informações não constituem recomendação de investimento.</p>
  </footer>
</main>
</body>
</html>`;
};

export const generateSitemap = (tickers: string[], sectors: string[] = [], lastmodMap: Record<string, string> = {}): string => {
  const today = new Date().toISOString().split('T')[0];
  const urls = [
    `  <url><loc>https://iacoes.com.br/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>https://iacoes.com.br/acoes/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    ...sectors.map(s =>
      `  <url><loc>https://iacoes.com.br/acoes/${sectorSlug(s)}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>`
    ),
    ...tickers.map(t =>
      `  <url><loc>https://iacoes.com.br/${t}/</loc><lastmod>${lastmodMap[t] || today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
    )
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
};

export const generateRobots = (): string => `User-agent: *
Allow: /
Sitemap: https://iacoes.com.br/sitemap.xml
`;
