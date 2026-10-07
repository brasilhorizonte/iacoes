import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cvmDocTitle, dedupeCvmVersions } from './cvm-doc-title';

// Títulos reais de cvm_documents (BPAC11, 07/10/2026).
const BPAC11 = [
  { docType: 'ITR', date: '2026-08-14', title: 'BCO BTG PACTUAL S.A. | ref 2026-06-30 | v3 | id 160881' },
  { docType: 'PR', date: '2026-08-11', title: 'Earnings Release - Português' },
  { docType: 'ITR', date: '2026-08-11', title: 'BCO BTG PACTUAL S.A. | ref 2026-06-30 | v2 | id 160386' },
  { docType: 'ITR', date: '2026-08-11', title: 'BCO BTG PACTUAL S.A. | ref 2026-06-30 | v1 | id 160381' },
  { docType: 'ITR', date: '2026-05-12', title: 'BCO BTG PACTUAL S.A. | ref 2026-03-31 | v1 | id 157001' },
  { docType: 'FR', date: '2026-05-10', title: 'Pagamento de JCP' },
  { docType: 'FR', date: '2026-05-09', title: 'Pagamento de JCP' },
];

test('cvmDocTitle: metadado cru de ITR/DFP vira o período; título normal passa', () => {
  assert.equal(cvmDocTitle(BPAC11[0]), 'Trimestre encerrado em 30/06/2026');
  assert.equal(cvmDocTitle({ docType: 'DFP', title: 'X S.A. | ref 2025-12-31 | v1 | id 1' }), 'Exercício encerrado em 31/12/2025');
  assert.equal(cvmDocTitle(BPAC11[1]), 'Earnings Release - Português');
});

test('dedupeCvmVersions: v1/v2/v3 do mesmo ITR viram um (a mais recente); outros períodos e títulos normais ficam', () => {
  const out = dedupeCvmVersions(BPAC11);
  assert.deepEqual(out.map((d) => `${d.docType} ${d.date}`), ['ITR 2026-08-14', 'PR 2026-08-11', 'ITR 2026-05-12', 'FR 2026-05-10', 'FR 2026-05-09']);
  // Os cartões exibidos não repetem o mesmo título de período.
  const shown = out.filter((d) => d.docType === 'ITR').map(cvmDocTitle);
  assert.equal(new Set(shown).size, shown.length);
});
