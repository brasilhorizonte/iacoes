/**
 * Testes das páginas macro. Uso: npm run test:macro (node:test via tsx).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comparisons, csvRows, faixaOf, headline, percentileOf, pibFor, quantile, seriesStats, sourceOf, toCsv, validate,
  type BuffettData, type Point,
} from './data';
import { buildBuffettModel } from './model';
import { generateMacro, llmsTxt, resumoJson } from './index';
import { renderBuffettPage } from './render';

// Valores reais de produção nas pontas (R$ MM): PIB 12m e valor de mercado oficial da B3.
const pib: Point[] = [
  { date: '2026-07-01', value: 13258459.8 },
  { date: '2026-08-01', value: 13342452.6 },
];

/** Série mensal sintética de 322 meses (2000-01 .. 2026-10) com nível conhecido. */
function synthetic(): BuffettData {
  const monthly: Point[] = [];
  const mcapMonthly: Point[] = [];
  const pibHist: Point[] = [];
  for (let i = 0; i < 321; i++) {
    const y = 2000 + Math.floor(i / 12);
    const mo = String((i % 12) + 1).padStart(2, '0');
    const date = `${y}-${mo}-28`;
    const value = 30 + (i % 40); // 30..69
    monthly.push({ date, value });
    mcapMonthly.push({ date, value: value * 1000 });
    pibHist.push({ date: `${y}-${mo}-01`, value: 100000 });
  }
  monthly.push({ date: '2026-10-02', value: 40.43 });
  return { monthly, mcapMonthly, mcapDaily: [{ date: '2026-10-02', value: 5393880.66 }], pib: [...pibHist.filter((p) => p.date < '2026-07'), ...pib] };
}

test('pibFor: mesmo mês ou o último anterior', () => {
  assert.equal(pibFor(pib, '2026-07-31')?.date, '2026-07-01');
  assert.equal(pibFor(pib, '2026-10-02')?.date, '2026-08-01');
  assert.equal(pibFor(pib, '2026-06-30'), null);
});

test('quantile e estatísticas', () => {
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  const s = seriesStats([{ date: '2000-01-31', value: 10 }, { date: '2000-02-29', value: 30 }, { date: '2000-03-31', value: 20 }]);
  assert.equal(s.mean, 20);
  assert.equal(s.median, 20);
  assert.equal(s.max.date, '2000-02-29');
  assert.equal(s.min.value, 10);
});

test('percentil e faixa', () => {
  const pts = [10, 20, 30, 40].map((value, i) => ({ date: `2000-0${i + 1}-28`, value }));
  assert.equal(percentileOf(25, pts), 50);
  const s = seriesStats(pts);
  assert.equal(faixaOf(5, s), 'historicamente barata');
  assert.equal(faixaOf(25, s), 'dentro da faixa histórica');
  assert.equal(faixaOf(45, s), 'historicamente cara');
});

test('manchete = último diário oficial ÷ PIB aplicável (2 casas)', () => {
  const h = headline({ monthly: [], mcapMonthly: [], mcapDaily: [{ date: '2026-10-02', value: 5393880.66 }], pib });
  assert.equal(h.value, 40.43);
  assert.equal(h.pibMonth, '2026-08');
});

test('comparações: fim do mês anterior e mesmo mês um ano antes', () => {
  const pts = [{ date: '2025-10-31', value: 38 }, { date: '2026-08-31', value: 37.51 }, { date: '2026-09-30', value: 39.29 }, { date: '2026-10-02', value: 40.43 }];
  const c = comparisons(pts, '2026-10-02');
  assert.equal(c.prevMonth?.date, '2026-09-30');
  assert.equal(c.yearAgo?.date, '2025-10-31');
});

test('procedência por período', () => {
  assert.equal(sourceOf('2010-03-31').label, 'BCB SGS 7849');
  assert.equal(sourceOf('2018-12-28').kind, 'estimado');
  assert.equal(sourceOf('2020-06-30').kind, 'estimado');
  assert.equal(sourceOf('2020-12-30').kind, 'oficial');
  assert.equal(sourceOf('2026-03-31').kind, 'estimado');
  assert.equal(sourceOf('2026-08-31').label, 'B3 (TOTAL GERAL)');
});

test('CSV: cabeçalho, mês corrente pelo diário e aspas em vírgula', () => {
  const d = synthetic();
  const csv = toCsv(csvRows(d));
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'data,indicador_buffett_pct,valor_mercado_b3_rs_milhoes,pib_12m_rs_milhoes,procedencia,fonte');
  assert.equal(lines.length, 323);
  assert.equal(lines[lines.length - 1], '2026-10-02,40.43,5393880.66,13342452.6,oficial,B3 (TOTAL GERAL)');
  assert.match(toCsv([{ date: 'x', buffett: 1, mcapMM: null, pibMM: null, source: { kind: 'oficial', label: 'a, b' } }]), /"a, b"/);
});

test('validação: bloqueia série curta, valor absurdo e dado velho; avisa descompasso', () => {
  const d = synthetic();
  const h = headline(d);
  assert.deepEqual(validate(d, h, new Date('2026-10-06T12:00:00Z')).problems, []);
  assert.match(validate(d, h, new Date('2026-10-20T12:00:00Z')).problems.join(), /dias/);
  assert.match(validate({ ...d, monthly: d.monthly.slice(0, 10) }, h, new Date('2026-10-06')).problems.join(), /backfill/);
  assert.match(validate(d, { ...h, value: 300 }, new Date('2026-10-06')).problems.join(), /faixa/);
  const behind = { ...d, monthly: [...d.monthly.slice(0, -1), { date: '2026-10-01', value: 39 }] };
  assert.match(validate(behind, h, new Date('2026-10-06')).warnings.join(), /atrasada/);
});

test('modelo: SEO no limite, 12 perguntas, sem marca aposentada', () => {
  const m = buildBuffettModel(synthetic(), { today: new Date('2026-10-06T12:00:00Z') });
  assert.ok(m.seo.title.length <= 60, m.seo.title);
  assert.ok(m.seo.description.length <= 160, String(m.seo.description.length));
  assert.equal(m.faq.length, 12);
  assert.equal(m.v, '40,43');
  assert.equal(m.dateLong, '2 de outubro de 2026');
  const all = JSON.stringify(m) + llmsTxt(m);
  // Montada em pedaços: o literal aqui seria acusado pelo gate de marca do validate-html.
  const marcaAposentada = new RegExp(['IAn' + 'alista', 'IAl' + 'ocador', '14 ' + 'dias'].join('|'));
  assert.doesNotMatch(all, marcaAposentada);
  assert.doesNotMatch(all, /\b(compre|venda já|vender agora)\b/i);
});

test('página renderizada: CTAs rastreados, Dataset e nenhuma tabela de preços de ações', () => {
  const html = renderBuffettPage(buildBuffettModel(synthetic(), { today: new Date('2026-10-06T12:00:00Z') }));
  assert.match(html, /onclick="_iaClick\(event\)" data-cta="macro-buffett"/);
  assert.match(html, /"@type":"Dataset"/);
  assert.match(html, /data-ref-date="2026-10-02"/);
  // Decisão do Gabriel (06/10): a página não lista ações com preço/valor justo.
  assert.doesNotMatch(html, />Graham<\/th>|>Diferença<\/th>|>Preço<\/th>/);
  // Decisão do Gabriel (06/10): sem a tabela de dezembros (a série completa fica no CSV).
  assert.doesNotMatch(html, />Dezembro<\/th>|>Procedência<\/th>/);
});

test('resumo JSON da landing: manchete no último ponto, URL relativa e leve', () => {
  const json = resumoJson(buildBuffettModel(synthetic(), { today: new Date('2026-10-06T12:00:00Z') }));
  const r = JSON.parse(json);
  assert.equal(r.value, 40.43);
  assert.equal(r.date, '2026-10-02');
  assert.equal(r.url, '/macro/indicador-de-buffett/');
  assert.equal(r.series.length, 322);
  assert.deepEqual(r.series[r.series.length - 1], ['2026-10', 40.4]);
  assert.equal(typeof r.percentile, 'number');
  assert.ok(json.length < 10_000, String(json.length));
});

test('resumo JSON: meses estimados (estimatedRanges) sem mudar os campos que já existiam', () => {
  const m = buildBuffettModel(synthetic(), { today: new Date('2026-10-06T12:00:00Z') });
  const r = JSON.parse(resumoJson(m));
  // Campos e ordem de antes, com estimatedRanges acrescentado no fim.
  assert.deepEqual(Object.keys(r), ['value', 'date', 'dateBR', 'band', 'percentile', 'since', 'mean', 'p25', 'p75', 'min', 'max', 'url', 'series', 'estimatedRanges']);
  // Anomalia da fonte (nov/2018–jan/2019) e o trecho do Banco Mundial interpolado pelo Ibovespa
  // (set/2019–jun/2026): os mesmos períodos que o gráfico da página sombreia, em meses.
  assert.deepEqual(r.estimatedRanges, [{ from: '2018-11', to: '2019-01' }, { from: '2019-09', to: '2026-06' }]);
  assert.deepEqual(r.estimatedRanges, m.estimatedRanges.map((x) => ({ from: x.from.slice(0, 7), to: x.to.slice(0, 7) })));
  for (const x of r.estimatedRanges) {
    assert.match(x.from, /^\d{4}-\d{2}$/);
    assert.match(x.to, /^\d{4}-\d{2}$/);
    assert.ok(x.from <= x.to);
  }
  // Todo mês marcado é "estimado" ou dezembro do Banco Mundial (âncora) para o CSV; o oficial da B3 não é marcado.
  const inRange = (mo: string) => r.estimatedRanges.some((x: { from: string; to: string }) => x.from <= mo && mo <= x.to);
  for (const [mo] of r.series as [string, number][]) {
    if (inRange(mo)) assert.notEqual(sourceOf(`${mo}-15`).label, 'BCB SGS 7849', mo);
    else assert.notEqual(sourceOf(`${mo}-15`).kind, 'estimado', mo);
  }
  assert.ok(!inRange('2026-10'));                         // manchete: fechamento oficial da B3
});

test('download do CSV pede e-mail: formulário + lead em iacoes_email_leads, sem link direto', () => {
  const html = renderBuffettPage(buildBuffettModel(synthetic(), { today: new Date('2026-10-06T12:00:00Z') }));
  assert.match(html, /<form id="csv-lead"[^>]*data-csv="\/macro\/indicador-de-buffett\/indicador-buffett-brasil\.csv"/);
  assert.match(html, /<input id="csv-email"[^>]*type="email"/);
  assert.match(html, /\/rest\/v1\/iacoes_email_leads/);
  assert.match(html, /source: 'buffett-csv'/);
  assert.doesNotMatch(html, /<a [^>]*indicador-buffett-brasil\.csv/);
  // LGPD: aviso com canal para sair e política; sem JS o botão fica desabilitado e o campo sem name.
  assert.match(html, /mailto:contato@brasilhorizonte\.com\.br/);
  assert.match(html, /LGPD\/LGPD\.pdf/);
  assert.match(html, /<button type="submit" disabled=""/);
  assert.doesNotMatch(html, /<input id="csv-email"[^>]* name="/);
  // A regex de e-mail sobreviveu inteira (sem barras invertidas engolidas).
  assert.match(html, /\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\{2,\}/);
});

test('trava de publicação: desligada não escreve nada', async () => {
  const prev = process.env.MACRO_BUFFETT_ENABLED;
  delete process.env.MACRO_BUFFETT_ENABLED;
  const entries = await generateMacro({ outRoot: 'nao-existe-e-nao-deve-ser-criado', data: synthetic() });
  assert.deepEqual(entries, []);
  if (prev !== undefined) process.env.MACRO_BUFFETT_ENABLED = prev;
});
