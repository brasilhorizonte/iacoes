/**
 * Data da cotação (`_quoteDate` do valuations.json) e datas no fuso de São Paulo.
 * Uso: npx tsx --test scripts/lib/*.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brtDateISO, isoMinusYears, parseMarketTime, previousBusinessDayBRT, quoteDateFromTimes } from './dates';

const at = (iso: string) => new Date(iso);

test('brtDateISO usa o dia de São Paulo, não o de UTC', () => {
  assert.equal(brtDateISO(at('2026-10-06T19:45:00Z')), '2026-10-06');
  assert.equal(brtDateISO(at('2026-10-07T02:30:00Z')), '2026-10-06');   // 23h30 BRT
  assert.equal(brtDateISO(at('2026-10-07T03:00:00Z')), '2026-10-07');   // meia-noite BRT
});

test('build depois do fechamento (20h BRT): a data é a do pregão do próprio dia', () => {
  const now = at('2026-10-06T23:00:00Z');   // terça, 20h BRT
  // Horários reais de brapi_quotes em 06/10/2026 (PETR4 19:45Z; o último papel 20:50Z).
  const times = ['2026-10-06T19:45:00+00:00', '2026-10-06T20:50:42+00:00', '2026-10-03T22:01:45+00:00', null, ''];
  assert.equal(quoteDateFromTimes(times, now), '2026-10-06');
  // A regra antiga datava esta mesma cotação como 05/10.
  assert.equal(previousBusinessDayBRT(now), '2026-10-05');
});

test('build tarde da noite (já é amanhã em UTC): continua a data do pregão em BRT', () => {
  const now = at('2026-10-07T01:30:00Z');   // 22h30 BRT de terça
  assert.equal(quoteDateFromTimes(['2026-10-06T20:50:42+00:00'], now), '2026-10-06');
});

test('build no fim de semana ou antes da abertura: a data é a do último pregão', () => {
  const sextaFechamento = ['2026-10-09T20:50:00+00:00', '2026-10-09T19:45:00+00:00', '2026-10-01T19:45:00+00:00'];
  assert.equal(quoteDateFromTimes(sextaFechamento, at('2026-10-10T15:00:00Z')), '2026-10-09');   // sábado
  assert.equal(quoteDateFromTimes(sextaFechamento, at('2026-10-11T23:00:00Z')), '2026-10-09');   // domingo
  assert.equal(quoteDateFromTimes(sextaFechamento, at('2026-10-12T11:00:00Z')), '2026-10-09');   // segunda, 8h BRT
});

test('feriado com cron rodando: a data é a do último pregão, não a do build', () => {
  // 12/10/2026 (segunda) é feriado: o cron roda às 20h, mas o último horário é de sexta.
  assert.equal(quoteDateFromTimes(['2026-10-09T20:50:00Z'], at('2026-10-12T23:00:00Z')), '2026-10-09');
});

test('dado faltando: volta a regra antiga (dia útil anterior ao build, em BRT)', () => {
  assert.equal(quoteDateFromTimes([], at('2026-10-06T23:00:00Z')), '2026-10-05');            // terça → segunda
  assert.equal(quoteDateFromTimes([null, undefined, '', 'lixo'], at('2026-10-05T23:00:00Z')), '2026-10-02');   // segunda → sexta
  assert.equal(quoteDateFromTimes([], at('2026-10-10T15:00:00Z')), '2026-10-09');           // sábado → sexta
  assert.equal(quoteDateFromTimes([], at('2026-10-11T15:00:00Z')), '2026-10-09');           // domingo → sexta
  // 22h30 BRT de terça (quarta em UTC): o "hoje" é terça, então o anterior é segunda.
  assert.equal(previousBusinessDayBRT(at('2026-10-07T01:30:00Z')), '2026-10-05');
});

test('horário no futuro: pequena folga vira "agora"; muito à frente é descartado', () => {
  const now = at('2026-10-06T23:00:00Z');
  assert.equal(quoteDateFromTimes(['2026-10-06T23:30:00Z'], now), '2026-10-06');
  assert.equal(quoteDateFromTimes(['2027-01-05T19:45:00Z', '2026-10-06T19:45:00Z'], now), '2026-10-06');
  assert.equal(quoteDateFromTimes(['2027-01-05T19:45:00Z'], now), '2026-10-05');   // só lixo → regra antiga
});

test('parseMarketTime: com fuso, sem fuso (UTC) e data pura (meio-dia BRT)', () => {
  assert.equal(parseMarketTime('2026-10-06T19:45:00+00:00'), Date.parse('2026-10-06T19:45:00Z'));
  assert.equal(parseMarketTime('2026-10-06T16:45:00-03:00'), Date.parse('2026-10-06T19:45:00Z'));
  assert.equal(parseMarketTime('2026-10-06 19:45:00'), Date.parse('2026-10-06T19:45:00Z'));
  assert.equal(brtDateISO(new Date(parseMarketTime('2026-10-06')!)), '2026-10-06');
  assert.equal(parseMarketTime('lixo'), null);
  assert.equal(parseMarketTime(null), null);
});

test('isoMinusYears segue o Postgres (29/02 vira 28/02)', () => {
  assert.equal(isoMinusYears('2026-10-06', 1), '2025-10-06');
  assert.equal(isoMinusYears('2028-02-29', 1), '2027-02-28');
  assert.equal(isoMinusYears('2028-02-29', 4), '2024-02-29');
  assert.equal(isoMinusYears('2026-01-01', 5), '2021-01-01');
});
