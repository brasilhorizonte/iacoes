// Índice /acoes/, páginas de setor, sitemap e robots.
// As páginas de ticker saem de scripts/ticker/ (React + shadcn/ui renderizados no build).
import type { TickerIndexEntry } from './types';

// --- Slug helper (normalizes accented chars to ASCII) ---
export const sectorSlug = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- Formatters ---
const fmt = (n: number, dec = 2): string => {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
const fmtPctShort = (n: number): string => {
  if (!Number.isFinite(n)) return '-';
  return (n * 100).toFixed(1) + '%';
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
const fmtNum = (n: number, dec = 2): string => {
  if (!Number.isFinite(n)) return '-';
  return fmt(n, dec);
};

// --- Index Page (/acoes/index.html) ---
export const generateIndexHTML = (
  tickers: TickerIndexEntry[],
  airtonSet: Set<string> = new Set(),
  // Link para o Indicador de Buffett (só existe com MACRO_BUFFETT_ENABLED=true).
  macroLink?: { href: string; label: string },
): string => {
  const today = new Date().toLocaleDateString('pt-BR');
  const year = new Date().getFullYear();
  const sectors = [...new Set(tickers.map(t => t.sector).filter(Boolean))].sort();

  const tickerRows = tickers.map(t => `
    <tr data-sector="${t.sector}">
      <td><a href="/${t.ticker}/" class="idx-ticker-link">${t.ticker}</a>${airtonSet.has(t.ticker) ? ` <a href="/airton/${t.ticker}/" class="idx-alert-link" title="Alertas de ${t.ticker} na CVM pelo WhatsApp" aria-label="Alertas de ${t.ticker} na CVM pelo WhatsApp">&#x1F514;</a>` : ''}</td>
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
  <!-- Verificação de domínio Meta (Business Settings → Brand Safety → Domínios) -->
  <meta name="facebook-domain-verification" content="0941qt8c38dvdna2jnm6fgek6931de">
  <!-- Meta Pixel — Pixel ID 927250313694701 (mesmo do app brasilhorizonte.com). Guard "_" mantido por segurança. -->
  <script>
  var _fbPixelId='927250313694701';
  if(_fbPixelId&&_fbPixelId.indexOf('_')<0){
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init',_fbPixelId);fbq('track','PageView');
  }
  </script>
  <script>var _iaB='https://dawvgbopyemcayavcatd.supabase.co',_iaK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd3ZnYm9weWVtY2F5YXZjYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MzAwOTEsImV4cCI6MjA3MTMwNjA5MX0.TuQV1G_JsJQRjLr76f8xX2HUjCig5FQa8R-YpsPyJiw',_iaS=(function(){var s=sessionStorage.getItem('_ia_sid');if(!s){s=crypto.randomUUID();sessionStorage.setItem('_ia_sid',s)}return s})(),_iaD=(function(){var ua=navigator.userAgent;var m=/Mobi|Android/i.test(ua);var t=/Tablet|iPad/i.test(ua);var dt=t?'tablet':m?'mobile':'desktop';var br='Outro';if(/Edg\\//i.test(ua))br='Edge';else if(/Chrome/i.test(ua))br='Chrome';else if(/Firefox/i.test(ua))br='Firefox';else if(/Safari/i.test(ua))br='Safari';var os='Outro';if(/Windows/i.test(ua))os='Windows';else if(/Mac/i.test(ua))os='macOS';else if(/Android/i.test(ua))os='Android';else if(/iPhone|iPad|iPod/i.test(ua))os='iOS';else if(/Linux/i.test(ua))os='Linux';return{dt:dt,br:br,os:os}})();var _iaSH=(function(){var ua=navigator.userAgent;if(/FBAN|FBAV/i.test(ua))return'facebook';if(/Instagram/i.test(ua))return'instagram';if(/LinkedIn/i.test(ua))return'linkedin';if(/WhatsApp/i.test(ua))return'whatsapp';if(/Telegram/i.test(ua))return'telegram';if(/Twitter|TwitterAndroid/i.test(ua))return'twitter';return null})(),_iaCID=(function(){var u=new URLSearchParams(location.search);if(u.get('fbclid'))return'facebook';if(u.get('gclid'))return'google_ads';if(u.get('ttclid'))return'tiktok';if(u.get('li_fat_id'))return'linkedin';if(u.get('twclkd'))return'twitter';if(u.get('msclkid'))return'microsoft_ads';return null})();var _iaBOT=(function(){try{if(navigator.webdriver===true)return true;if(/bot|crawl|spider|headless|preview|lighthouse|gptbot|claudebot|perplexity|bingpreview/i.test(navigator.userAgent||''))return true;var l=navigator.languages;if(!l||!l.length)return true;return false}catch(_be){return false}})(),_iaINT=false;(function(){try{var _if=function(){_iaINT=true};['pointerdown','keydown','touchstart','wheel'].forEach(function(t){window.addEventListener(t,_if,{passive:true,once:true})})}catch(_ie){}})();function _iaTrack(ev,cid){var u=new URLSearchParams(location.search);var d={session_id:_iaS,page_path:(location.pathname.replace(/\\/index\\.html$/,'').replace(/\\/$/,'')||'/').toUpperCase(),referrer:document.referrer||null,utm_source:u.get('utm_source')||null,utm_medium:u.get('utm_medium')||null,utm_campaign:u.get('utm_campaign')||null,device_type:_iaD.dt,screen_width:screen.width,browser:_iaD.br,os:_iaD.os,event_type:ev||'pageview',source_hint:_iaSH,click_id_source:_iaCID,is_bot:_iaBOT,interacted:_iaINT};if(cid)d.cta_id=cid;fetch(_iaB+'/rest/v1/iacoes_page_views',{method:'POST',headers:{'Content-Type':'application/json','apikey':_iaK,'Authorization':'Bearer '+_iaK,'Prefer':'return=minimal'},keepalive:true,body:JSON.stringify(d)}).catch(function(){})}_iaTrack();function _iaClick(e){var el=e.currentTarget;try{var _lh=new URL(el.href).host;if(typeof fbq==='function'&&_lh.indexOf('brasilhorizonte.com')>-1)fbq('trackCustom','CTAIAcoes')}catch(_le){try{console.warn('[iAcoes] fbq CTA tracking falhou:',_le)}catch(_we){}}if(e.metaKey||e.ctrlKey||e.shiftKey||e.button===1)return;e.preventDefault();var cid=el.getAttribute('data-cta')||'unknown';var u;try{u=new URL(el.href)}catch(_){u=null}if(u){var inUtm=new URLSearchParams(location.search);var src=inUtm.get('utm_source')||'iacoes';var med=inUtm.get('utm_medium')||'acoes-index';var camp=inUtm.get('utm_campaign')||'seo-organico';if(!u.searchParams.has('utm_source'))u.searchParams.set('utm_source',src);if(!u.searchParams.has('utm_medium'))u.searchParams.set('utm_medium',med);if(!u.searchParams.has('utm_campaign'))u.searchParams.set('utm_campaign',camp);if(!u.searchParams.has('utm_content'))u.searchParams.set('utm_content',cid)}_iaTrack('cta_click',cid);var dest=u?u.toString():el.href;setTimeout(function(){window.location.href=dest},150)}document.addEventListener('DOMContentLoaded',function(){var _fb=new URLSearchParams(location.search).get('fbclid');if(!_fb)return;document.querySelectorAll('a[href*="brasilhorizonte.com"]').forEach(function(l){try{var _u=new URL(l.href);_u.searchParams.set('fbclid',_fb);l.href=_u.toString()}catch(e){}})});</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todas as Ações da B3 — Análise Fundamentalista e Preço Justo ${year} | IAções</title>
  <meta name="description" content="Lista completa de ${tickers.length} ações da B3 com indicadores fundamentalistas: P/L, Dividend Yield, preço justo por Graham, Bazin e Gordon. Análise fundamentalista atualizada em ${today}.">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="Brasil Horizonte">
  <link rel="canonical" href="https://iacoes.com.br/acoes/">
  <meta property="og:title" content="Todas as Ações da B3 — Análise Fundamentalista ${year} | IAções">
  <meta property="og:description" content="Lista completa de ${tickers.length} ações da B3 com indicadores fundamentalistas atualizados.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://iacoes.com.br/acoes/">
  <meta property="og:site_name" content="IAções — Análise de Ações | Brasil Horizonte">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:image" content="https://iacoes.com.br/assets/img/og-iacoes-v3.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Todas as Ações da B3 — IAções">
  <meta name="keywords" content="ações B3, análise fundamentalista, preço justo, valuation, Graham, Bazin, Gordon, bolsa brasileira, investimentos, P/L, dividend yield, ROE, IAções, Brasil Horizonte">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Todas as Ações da B3 — Análise Fundamentalista ${year} | IAções">
  <meta name="twitter:description" content="Lista completa de ${tickers.length} ações da B3 com indicadores fundamentalistas atualizados.">
  <meta name="twitter:image" content="https://iacoes.com.br/assets/img/og-iacoes-v3.png">
  <meta name="twitter:image:alt" content="Todas as Ações da B3 — IAções">

  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">

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
      { "@type": "ListItem", "position": 1, "name": "IAções", "item": "https://iacoes.com.br/" },
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
    .idx-alert-link { font-size: 0.7rem; text-decoration: none; opacity: 0.55; margin-left: 0.2rem; }
    .idx-alert-link:hover { opacity: 1; }
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
    <a href="/" class="nav-iacoes"><span class="nav-iacoes-i">IA</span><span class="nav-iacoes-acoes">ções</span><span class="nav-cursor"></span></a>
  </div>
  <div class="nav-links">
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nav-btn nav-btn-outline" data-cta="nav-app" onclick="_iaClick(event)">Acessar App</a>
    <a href="https://app.brasilhorizonte.com.br/authnew?ref=iacoes" class="nav-btn nav-btn-gold" data-cta="nav-assinar" onclick="_iaClick(event)">Assinar Plano</a>
  </div>
</nav>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">IAções</a></li>
    <li aria-current="page">Ações</li>
  </ol>
</nav>

<main class="page">
  <header class="page-header">
    <h1 class="font-playfair">Todas as Ações da B3</h1>
    <p><span class="count">${tickers.length}</span> ações com análise fundamentalista e preço justo por Graham, Bazin e Gordon. Dados atualizados em ${today}.</p>${macroLink ? `
    <p><a href="${macroLink.href}" style="color:#8a6a24;font-weight:600">${macroLink.label} →</a></p>` : ''}
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
            <td><a href="/${t.ticker}/" class="idx-ticker-link">${t.ticker}</a>${airtonSet.has(t.ticker) ? ` <a href="/airton/${t.ticker}/" class="idx-alert-link" title="Alertas de ${t.ticker} na CVM pelo WhatsApp" aria-label="Alertas de ${t.ticker} na CVM pelo WhatsApp">&#x1F514;</a>` : ''}</td>
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
export const generateSectorPage = (sector: string, tickers: TickerIndexEntry[], airtonSet: Set<string> = new Set()): string => {
  const today = new Date().toLocaleDateString('pt-BR');
  const year = new Date().getFullYear();
  const slug = sectorSlug(sector);
  const count = tickers.length;

  const avgPL = tickers.filter(t => t.pl > 0).reduce((s, t) => s + t.pl, 0) / (tickers.filter(t => t.pl > 0).length || 1);
  const avgDY = tickers.filter(t => t.divYield > 0).reduce((s, t) => s + t.divYield, 0) / (tickers.filter(t => t.divYield > 0).length || 1);
  const totalMC = tickers.reduce((s, t) => s + t.marketCap, 0);

  const rows = tickers.map(t => `
    <tr>
      <td><a href="/${t.ticker}/" class="idx-ticker-link">${t.ticker}</a>${airtonSet.has(t.ticker) ? ` <a href="/airton/${t.ticker}/" class="idx-alert-link" title="Alertas de ${t.ticker} na CVM pelo WhatsApp" aria-label="Alertas de ${t.ticker} na CVM pelo WhatsApp">&#x1F514;</a>` : ''}</td>
      <td class="idx-name">${t.name}</td>
      <td class="idx-num">${t.price > 0 ? 'R$ ' + fmt(t.price) : '-'}</td>
      <td class="idx-num">${t.pl > 0 ? fmtNum(t.pl) : '-'}</td>
      <td class="idx-num">${t.divYield > 0 ? fmtPctShort(t.divYield) : '-'}</td>
      <td class="idx-num">${fmtBig(t.marketCap)}</td>
    </tr>`).join('');

  const desc = `${count} ações do setor de ${sector} na B3 com análise fundamentalista, preço justo e dividendos. P/L médio: ${fmtNum(avgPL)}, DY médio: ${fmtPctShort(avgDY)}. Dados ${year}.`;

  const faqItems = [
    { q: `Quantas ações do setor de ${sector} existem na B3?`, a: `Atualmente existem ${count} ações do setor de ${sector} listadas na B3 com análise fundamentalista disponível no IAções. O valor de mercado combinado do setor é de ${fmtBig(totalMC)}.` },
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
  <title>Ações do Setor de ${sector} ${year} | Análise Fundamentalista | IAções</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="ações ${sector}, setor ${sector} B3, dividendos ${sector}, análise fundamentalista ${sector}, preço justo ${sector}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://iacoes.com.br/acoes/${slug}/">
  <meta property="og:title" content="Ações do Setor de ${sector} — Análise e Dividendos | IAções">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="https://iacoes.com.br/acoes/${slug}/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="IAções">
  <meta property="og:image" content="https://iacoes.com.br/assets/img/og-iacoes-v3.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Ações do setor de ${sector} — IAções">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Ações do Setor de ${sector} — Análise e Dividendos | IAções">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="https://iacoes.com.br/assets/img/og-iacoes-v3.png">
  <meta name="twitter:image:alt" content="Ações do setor de ${sector} — IAções">
  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
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
    .idx-alert-link{font-size:.7rem;text-decoration:none;opacity:.55;margin-left:.2rem}.idx-alert-link:hover{opacity:1}
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
    <span class="nav-brand"><span>IA</span>ções</span>
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

export const generateSitemap = (
  tickers: string[],
  sectors: string[] = [],
  lastmodMap: Record<string, string> = {},
  airtonTickers: string[] = [],
  // Páginas fora do padrão ticker/setor (ex.: /macro/, só com MACRO_BUFFETT_ENABLED=true).
  extra: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [],
): string => {
  const today = new Date().toISOString().split('T')[0];
  const urls = [
    `  <url><loc>https://iacoes.com.br/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>https://iacoes.com.br/acoes/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    ...sectors.map(s =>
      `  <url><loc>https://iacoes.com.br/acoes/${sectorSlug(s)}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>`
    ),
    ...tickers.map(t =>
      `  <url><loc>https://iacoes.com.br/${t}/</loc><lastmod>${lastmodMap[t] || today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
    ),
    `  <url><loc>https://iacoes.com.br/airton/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...airtonTickers.map(t =>
      `  <url><loc>https://iacoes.com.br/airton/${t}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`
    ),
    ...extra.map(e =>
      `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
    )
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
};

// /rest/ não existe no site: o Google tirou o caminho do tracking inline (fetch para
// <supabase>/rest/v1/iacoes_page_views) e passou a rastrear /rest/... como URL daqui (404 no GSC).
export const generateRobots = (): string => `User-agent: *
Allow: /
Disallow: /rest/
Sitemap: https://iacoes.com.br/sitemap.xml
`;
