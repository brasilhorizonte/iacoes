import type { FinancialData, ComprehensiveValuation, RawIncomeStatement, RawBalanceSheet, RawCashFlow, RawDividend } from './types';

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
export const generateTickerHTML = (data: FinancialData, val: ComprehensiveValuation): string => {
  const f = data.fundamentals;
  const today = new Date().toLocaleDateString('pt-BR');
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

  // DRE rows
  const dreRows = incomeYearly.map(d => `
    <tr>
      <td>${getYear(d.end_date)}</td>
      <td>${fmtBig(d.total_revenue)}</td>
      <td>${fmtBig(d.gross_profit || 0)}</td>
      <td>${fmtBig(d.ebit)}</td>
      <td>${fmtBig(d.income_before_tax)}</td>
      <td class="${colorClass(d.net_income)}">${fmtBig(d.net_income)}</td>
    </tr>`).join('');

  // Balance rows
  const balRows = balanceYearly.map(d => `
    <tr>
      <td>${getYear(d.end_date)}</td>
      <td>${fmtBig(d.total_assets)}</td>
      <td>${fmtBig(d.cash + (d.short_term_investments || 0))}</td>
      <td>${fmtBig(d.total_liab)}</td>
      <td>${fmtBig(d.long_term_debt)}</td>
      <td>${fmtBig(d.total_stockholder_equity)}</td>
    </tr>`).join('');

  // CashFlow rows
  const cfRows = cashFlowYearly.map(d => `
    <tr>
      <td>${getYear(d.end_date)}</td>
      <td>${fmtBig(d.total_cash_from_operating_activities)}</td>
      <td>${fmtBig(d.total_cashflows_from_investing_activities)}</td>
      <td>${fmtBig(d.total_cash_from_financing_activities)}</td>
      <td>${fmtBig(d.capital_expenditures)}</td>
      <td class="${colorClass(d.dividends_paid)}">${fmtBig(d.dividends_paid)}</td>
    </tr>`).join('');

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

  // SEO: meta description, title, FAQ
  const desc = `${f.symbol} vale a pena? Preco justo de R$ ${fmt(grahamFV)} (Graham), R$ ${fmt(bazinFV)} (Bazin) e R$ ${fmt(gordonFV)} (Gordon). P/L ${fmtNum(f.pl)}, DY ${fmtPctShort(f.divYield)}, ROE ${fmtPctShort(f.roe)}. Analise fundamentalista completa.`;
  const titleTag = `${f.symbol} Preco Justo e Valuation ${new Date().getFullYear()} | Analise Fundamentalista | iAcoes`;
  const ogTitle = `${f.symbol} vale a pena? Preco Justo R$ ${fmt(grahamFV)} (Graham) | iAcoes`;
  const faqItems = [
    {
      q: `Quais os principais indicadores fundamentalistas de ${f.symbol}?`,
      a: `${f.symbol} apresenta P/L de ${fmtNum(f.pl)}, P/VP de ${fmtNum(f.pvp)}, ROE de ${fmtPctShort(f.roe)}, ROIC de ${fmtPctShort(f.roic)}, Margem Liquida de ${fmtPctShort(f.netMargin)}, EV/EBITDA de ${fmtNum(f.evEbitda)} e Div. Liq./EBITDA de ${fmtNum(f.debtEbitda)}. Esses indicadores ajudam a avaliar a saude financeira, rentabilidade e eficiencia operacional da empresa.`
    },
    {
      q: `Em qual setor ${f.symbol} atua e quem sao seus concorrentes?`,
      a: `${f.symbol} (${f.companyName}) atua no setor de ${f.sector}${f.industry ? ', segmento de ' + f.industry : ''}. A empresa compete com outras companhias listadas na B3 dentro do mesmo setor. Para uma analise comparativa, e importante avaliar os multiplos setoriais como P/L, EV/EBITDA e margens operacionais em relacao aos pares de mercado.`
    },
    {
      q: `Como esta a rentabilidade e as margens de ${f.symbol}?`,
      a: `${f.symbol} possui ROE de ${fmtPctShort(f.roe)} e ROIC de ${fmtPctShort(f.roic)}, que medem o retorno sobre o patrimonio e sobre o capital investido, respectivamente. A Margem Bruta e de ${fmtPctShort(f.grossMargin)}, a Margem EBITDA de ${fmtPctShort(f.ebitdaMargin)} e a Margem Liquida de ${fmtPctShort(f.netMargin)}. Esses numeros refletem a capacidade da empresa de gerar lucro a partir de suas operacoes.`
    },
    {
      q: `Qual o historico de dividendos de ${f.symbol}?`,
      a: `${f.symbol} possui Dividend Yield atual de ${fmtPctShort(f.divYield)}${divTTM > 0 ? ' e distribuiu R$ ' + fmt(divTTM) + ' por acao nos ultimos 12 meses' : ''}. O historico de dividendos e um dos fatores analisados para entender a politica de remuneracao ao acionista e a consistencia dos pagamentos ao longo dos anos.`
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleTag}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${f.symbol}, ${f.symbol} preco justo, ${f.symbol} vale a pena, ${f.symbol} dividendos, ${f.symbol} valuation, ${f.name}, analise fundamentalista ${f.symbol}, acoes ${f.sector}, B3, Graham, Bazin, Gordon">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="Brasil Horizonte">
  <link rel="canonical" href="https://iacoes.com.br/${f.symbol}">

  <!-- Open Graph -->
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://iacoes.com.br/${f.symbol}">
  <meta property="og:site_name" content="iAcoes — Analise de Acoes | Brasil Horizonte">
  <meta property="og:locale" content="pt_BR">
  <meta property="article:published_time" content="${new Date().toISOString()}">
  <meta property="article:modified_time" content="${new Date().toISOString()}">
  <meta property="article:section" content="Analise Fundamentalista">
  <meta property="article:tag" content="${f.symbol}">
  <meta property="article:tag" content="Valuation">
  <meta property="article:tag" content="${f.sector}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${desc}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <!-- Schema.org: Article -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${f.symbol} — Preco Justo e Analise Fundamentalista ${new Date().getFullYear()}",
    "description": "${desc}",
    "datePublished": "${new Date().toISOString()}",
    "dateModified": "${new Date().toISOString()}",
    "author": { "@type": "Organization", "name": "Brasil Horizonte", "url": "https://brasilhorizonte.com.br" },
    "publisher": {
      "@type": "Organization",
      "name": "iAcoes by Brasil Horizonte",
      "url": "https://iacoes.com.br"
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://iacoes.com.br/${f.symbol}" },
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
      { "@type": "ListItem", "position": 1, "name": "iAcoes", "item": "https://iacoes.com.br/" },
      { "@type": "ListItem", "position": 2, "name": "Acoes", "item": "https://iacoes.com.br/" },
      { "@type": "ListItem", "position": 3, "name": "${f.symbol}", "item": "https://iacoes.com.br/${f.symbol}" }
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
      font-family: 'Playfair Display', serif; font-size: 1.1rem;
      letter-spacing: -0.02em;
    }
    .nav-iacoes-i {
      color: #B68F40; font-weight: 800; font-style: italic;
      font-size: 1.25rem;
    }
    .nav-iacoes-acoes {
      color: #fff; font-weight: 700;
    }
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
    .methods-grid-3 { grid-template-columns: repeat(3, 1fr); }
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
      .methods-grid-3 { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) {
      .page { padding: 1rem; }
      .company-header { padding: 1.5rem; flex-direction: column; }
      .company-symbol { font-size: 2rem; }
      .company-right { text-align: left; }
      .price-value { font-size: 2.2rem; }
      .price-changes { justify-content: flex-start; }
      .metrics-grid { grid-template-columns: repeat(3, 1fr); }
      .methods-grid, .methods-grid-3 { grid-template-columns: 1fr; }
      .nav { padding: 0 1rem; }
    }
    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
      .price-value { font-size: 1.8rem; }
      .consensus-price { font-size: 2rem; }
    }

    /* ============ ANIMATIONS ============ */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-in {
      animation: fadeInUp 0.4s ease-out both;
    }
  </style>
</head>
<body>

<!-- NAV -->
<nav class="nav" aria-label="Navegacao principal">
  <div class="nav-left">
    <a href="/" class="nav-brand" aria-label="iAcoes - Pagina inicial">
      <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" class="nav-logo-bh">
    </a>
    <span class="nav-divider"></span>
    <a href="/" class="nav-iacoes" aria-label="iAcoes">
      <span class="nav-iacoes-i">i</span><span class="nav-iacoes-acoes">Acoes</span>
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
    <a href="https://app.brasilhorizonte.com.br" class="nav-btn nav-btn-outline">Acessar App</a>
    <a href="https://app.brasilhorizonte.com.br" class="nav-btn nav-btn-gold">Assinar Plano</a>
  </div>
</nav>

<!-- Breadcrumb -->
<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">iAcoes</a></li>
    <li><a href="/">Acoes</a></li>
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
      <div class="price-label">Cotacao Atual</div>
      <div class="price-value"><sup>R$</sup>${fmt(f.price)}</div>
      <div class="price-changes">
        <span class="${f.changeDay >= 0 ? 'val-positive' : 'val-negative'}">${f.changeDay >= 0 ? '+' : ''}${fmtPctShort(f.changeDay)} dia</span>
        <span class="${f.change12m >= 0 ? 'val-positive' : 'val-negative'}">${f.change12m >= 0 ? '+' : ''}${fmtPctShort(f.change12m)} 12m</span>
      </div>
      <div class="price-date">Dados de ${today}</div>
    </div>
  </header>

  <!-- MERCADO & ESTRUTURA -->
  <section class="metrics-section animate-in" aria-label="Mercado e Estrutura">
    <h2 class="section-legend">Mercado & Estrutura</h2>
    <div class="metrics-grid">
      ${metricBox('Valor de Mercado', fmtBig(f.marketCap))}
      ${metricBox('Valor da Firma (EV)', fmtBig(f.firmValue))}
      ${metricBox('Nro. Acoes', fmtVol(f.sharesOutstanding))}
      ${metricBox('Volume Medio (3M)', fmtVol(f.volMed2m))}
      ${metricBox('Min. 52 Semanas', fmtBRL(f.min52Week))}
      ${metricBox('Max. 52 Semanas', fmtBRL(f.max52Week))}
    </div>
  </section>

  <!-- VALUATION -->
  <section class="metrics-section animate-in" aria-label="Indicadores de Valuation">
    <h2 class="section-legend">Valuation</h2>
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
  </section>

  <!-- RENTABILIDADE & MARGENS -->
  <section class="metrics-section animate-in" aria-label="Rentabilidade e Margens">
    <h2 class="section-legend">Rentabilidade & Margens</h2>
    <div class="metrics-grid">
      ${metricBox('ROE', fmtPctShort(f.roe), colorClass(f.roe))}
      ${metricBox('ROIC', fmtPctShort(f.roic), colorClass(f.roic))}
      ${metricBox('Margem Bruta', fmtPctShort(f.grossMargin))}
      ${metricBox('Margem EBIT', fmtPctShort(f.ebitMargin))}
      ${metricBox('Margem EBITDA', fmtPctShort(f.ebitdaMargin))}
      ${metricBox('Margem Liquida', fmtPctShort(f.netMargin), colorClass(f.netMargin))}
    </div>
  </section>

  <!-- ENDIVIDAMENTO & LIQUIDEZ -->
  <section class="metrics-section animate-in" aria-label="Endividamento e Liquidez">
    <h2 class="section-legend">Endividamento & Liquidez</h2>
    <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
      ${metricBox('Div. Liq./EBITDA', fmtNum(f.debtEbitda, 2), colorClass(f.debtEbitda))}
      ${metricBox('Div. Bruta/Patrim.', fmtNum(f.debtEquity, 2))}
      ${metricBox('Liquidez Corrente', fmtNum(f.currentLiquidity, 2), colorClass(f.currentLiquidity))}
    </div>
  </section>

  <!-- PRECO JUSTO (METODOS CLASSICOS) -->
  <section class="methods-section animate-in" aria-label="Preco Justo - Metodos Classicos">
    <div class="section-header-row">
      <div>
        <h3 class="section-title font-playfair">Preco Justo (Metodos Classicos)</h3>
        <span class="section-sub">Graham, Bazin e Gordon com premissas auditaveis</span>
      </div>
      <div class="section-price-ref">Cotacao Atual<br><strong>R$ ${fmt(f.price)}</strong></div>
    </div>
    <div class="methods-grid methods-grid-3">

      <!-- GRAHAM -->
      <div class="method-card">
        <div class="method-header">
          <div>
            <span class="method-name">Graham</span>
            <span class="method-sub">Valor Intrinseco (LPA x VPA)</span>
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
            <div class="premissa-row">
              <label>P/L Maximo</label>
              <div class="premissa-input-group">
                <input type="number" id="graham-pl" value="15" min="1" max="50" step="1" class="premissa-input">
              </div>
            </div>
            <div class="premissa-row">
              <label>P/VP Maximo</label>
              <div class="premissa-input-group">
                <input type="number" id="graham-pvp" value="1.5" min="0.1" max="10" step="0.1" class="premissa-input">
              </div>
            </div>
            <div class="premissa-row">
              <label>Margem de Seguranca</label>
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
            <span class="method-sub">Preco justo por dividendos</span>
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
            <div class="premissa-row">
              <label>Anos para Media</label>
              <select id="bazin-years" class="premissa-select">
                <option value="1">1 ano</option>
                <option value="3">3 anos</option>
                <option value="5" selected>5 anos</option>
                <option value="10">10 anos</option>
              </select>
            </div>
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
            <div class="premissa-row">
              <label>Anos para Media</label>
              <select id="gordon-years" class="premissa-select">
                <option value="1">1 ano</option>
                <option value="3">3 anos</option>
                <option value="5" selected>5 anos</option>
                <option value="10">10 anos</option>
              </select>
            </div>
          </div>

          <div class="premissa-info-row">
            <span>CAGR Dividendos:</span> <strong class="${divCAGR >= 0 ? 'val-positive' : 'val-negative'}">${divCAGR !== 0 ? fmtPctShort(divCAGR) : '-'}</strong>
          </div>
        </div>
      </div>

    </div>

    <div class="methods-note">
      <strong>Nota:</strong> Graham foca em empresas com lucro e patrimonio solidos. Bazin e para empresas com dividendos estaveis. Gordon (DDM) assume crescimento perpetuo dos dividendos. Todos tem limitacoes e devem ser combinados com outras analises.
    </div>
  </section>

  ${data.businessSummary ? `
  <!-- RESUMO DE NEGOCIO -->
  <section class="section-card animate-in" aria-label="Resumo de Negocio de ${f.symbol}">
    <div class="resumo-header">
      <div>
        <h2 class="resumo-title">${f.symbol} — Visao de Negocio</h2>
        <div class="resumo-date">Atualizacao: ${today}</div>
      </div>
      <div class="resumo-badges">
        <span class="resumo-badge">Setor: ${f.sector}</span>
        <span class="resumo-badge">Subsetor: ${f.subSector}</span>
        <span class="resumo-badge">Tipo: ${f.type}</span>
      </div>
    </div>
    <p class="resumo-text">${data.businessSummary}</p>
  </section>` : ''}

  <!-- NOTA QUALITATIVA (PAYWALL) -->
  <section class="section-card animate-in nota-section" aria-label="Nota Qualitativa de ${f.symbol}">
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

    <div class="nota-blurred">
      <p class="nota-blurred-text">
        Com base na analise da Brasil Horizonte Research, segue o resumo do resultado da ${f.name} (${f.symbol}). A nota qualitativa avalia criterios como Governanca Corporativa, Management, Riscos da Industria, Vantagens Competitivas, Barreiras a Entrada e Poder de Barganha para determinar a qualidade estrutural da empresa alem dos numeros financeiros.
      </p>

      <div class="nota-radar-placeholder">
        <svg class="nota-radar-svg" viewBox="0 0 300 260" fill="none">
          <!-- Radar grid -->
          <polygon points="150,30 250,100 220,210 80,210 50,100" stroke="#e2e8f0" stroke-width="1" fill="none"/>
          <polygon points="150,60 220,110 200,190 100,190 80,110" stroke="#e2e8f0" stroke-width="1" fill="none"/>
          <polygon points="150,90 190,120 180,170 120,170 110,120" stroke="#e2e8f0" stroke-width="1" fill="none"/>
          <!-- Radar fill -->
          <polygon points="150,55 230,105 195,195 105,185 70,115" fill="rgba(182,143,64,0.15)" stroke="#B68F40" stroke-width="2"/>
          <!-- Labels -->
          <text x="150" y="22" text-anchor="middle" font-size="10" fill="#64748b" font-family="Montserrat">Governanca</text>
          <text x="265" y="100" text-anchor="start" font-size="10" fill="#64748b" font-family="Montserrat">Management</text>
          <text x="235" y="225" text-anchor="start" font-size="10" fill="#64748b" font-family="Montserrat">Industria</text>
          <text x="65" y="225" text-anchor="end" font-size="10" fill="#64748b" font-family="Montserrat">Poder Barganha</text>
          <text x="35" y="100" text-anchor="end" font-size="10" fill="#64748b" font-family="Montserrat">Riscos</text>
          <text x="150" y="255" text-anchor="middle" font-size="10" fill="#64748b" font-family="Montserrat">Vantagens Competitivas</text>
        </svg>
      </div>
    </div>

    <div class="nota-overlay">
      <div class="nota-overlay-lock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      </div>
      <div class="nota-overlay-title">Analise Qualitativa com IA</div>
      <div class="nota-overlay-sub">Acesse a nota qualitativa completa de ${f.symbol}, radar de categorias e insights gerados por IA na plataforma Brasil Horizonte.</div>
      <a href="https://app.brasilhorizonte.com.br" class="nota-overlay-btn">Desbloquear Analise &rarr;</a>
    </div>
  </section>

  <!-- DEMONSTRACOES FINANCEIRAS -->
  <section class="section-card animate-in" aria-label="Demonstracoes Financeiras">
    <div class="section-header-row">
      <h2 class="section-title font-playfair">Demonstracoes Financeiras</h2>
      <span class="section-sub">Dados historicos</span>
    </div>

    <!-- DRE -->
    <div class="fin-tabs">
      <span class="fin-tab active">DRE</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table">
        <thead>
          <tr>
            <th>Periodo</th><th>Receita Total</th><th>Lucro Bruto</th>
            <th>EBIT</th><th>Lucro Antes IR</th><th>Lucro Liquido</th>
          </tr>
        </thead>
        <tbody>${dreRows}</tbody>
      </table>
    </div>

    ${balanceYearly.length > 0 ? `
    <!-- BALANCO -->
    <div class="fin-tabs" style="margin-top:1.5rem;">
      <span class="fin-tab active">Balanco</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table">
        <thead>
          <tr>
            <th>Periodo</th><th>Ativo Total</th><th>Caixa</th>
            <th>Passivo Total</th><th>Divida LP</th><th>Patrimonio Liq.</th>
          </tr>
        </thead>
        <tbody>${balRows}</tbody>
      </table>
    </div>` : ''}

    ${cashFlowYearly.length > 0 ? `
    <!-- FLUXO DE CAIXA -->
    <div class="fin-tabs" style="margin-top:1.5rem;">
      <span class="fin-tab active">Fluxo de Caixa</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table">
        <thead>
          <tr>
            <th>Periodo</th><th>FCO</th><th>FCI</th>
            <th>FCF</th><th>CAPEX</th><th>Dividendos Pagos</th>
          </tr>
        </thead>
        <tbody>${cfRows}</tbody>
      </table>
    </div>` : ''}

    ${divYears.length > 0 ? `
    <!-- DIVIDENDOS -->
    <div class="fin-tabs" style="margin-top:1.5rem;">
      <span class="fin-tab active">Dividendos</span>
    </div>
    <div class="table-scroll">
      <table class="fin-table">
        <thead>
          <tr><th>Ano</th><th>Total Pago</th><th>Qtd. Pagamentos</th></tr>
        </thead>
        <tbody>${divRows}</tbody>
      </table>
    </div>` : ''}
  </section>

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
    <h2>Analise completa na plataforma</h2>
    <p>Acesse premissas editaveis, cenarios Bear/Base/Bull, analise qualitativa com IA, radar de noticias e muito mais.</p>
    <a href="https://app.brasilhorizonte.com.br" class="cta-btn">Acessar Gr&aacute;tis &rarr;</a>
  </section>

  </article>

  <!-- DISCLAIMER -->
  <footer class="disclaimer" role="contentinfo">
    <h2 class="disclaimer-title">Isencao de Responsabilidade (Disclaimer)</h2>
    <p class="disclaimer-text">
      As analises, precos alvo e relatorios apresentados nesta pagina sao gerados automaticamente por Inteligencia Artificial e algoritmos financeiros (ValuAI By Brasil Horizonte). Estas informacoes tem carater estritamente educativo e informativo, nao configurando recomendacao de compra ou venda de ativos, nem garantia de rentabilidade futura. Investimentos em renda variavel envolvem riscos. A Inteligencia Artificial pode cometer erros de interpretacao ou calculo (alucinacoes). Sempre consulte um profissional certificado e realize sua propria diligencia antes de tomar qualquer decisao financeira.
    </p>
    <div class="footer-logos">
      <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" class="footer-logo-bh">
      <span class="footer-x">&times;</span>
      <span class="footer-iacoes"><span class="footer-iacoes-i">i</span>Acoes</span>
    </div>
    <div class="footer-copy">
      &copy; ${new Date().getFullYear()} ValuAI by <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener">Brasil Horizonte</a>. Todos os direitos reservados. Dados atualizados em ${today}. Balanco: ${f.lastBalanceDate}.
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

</body>
</html>`;
};

export const generateSitemap = (tickers: string[]): string => {
  const today = new Date().toISOString().split('T')[0];
  const urls = [
    `  <url><loc>https://iacoes.com.br/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...tickers.map(t =>
      `  <url><loc>https://iacoes.com.br/${t}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
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
