/**
 * Título de documento da CVM para exibir (/airton/{T}/ e o bloco "O que {T} publicou na CVM" da
 * página de ticker).
 *
 * O ITR/DFP chega de `cvm_documents.summary` com o metadado cru no lugar do título
 * ("ITR - BCO BTG PACTUAL S.A. | ref 2026-06-30 | v3 | id 160881 - Date 2026-08-14" → título
 * "BCO BTG PACTUAL S.A. | ref 2026-06-30 | v3 | id 160881"). Esse texto não aparece: fica o
 * período de referência, quando há. Título normal passa como veio.
 */
const fmtDateBR = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Metadado técnico da CVM no título: "| ref AAAA-MM-DD", "| v3 |", "| id 160881". */
const RAW_META = /\|\s*(?:ref\s+\d{4}-\d{2}-\d{2}|v\d+|id\s+\d+)\s*(?:\||$)/i;

export function cvmDocTitle(d: { docType: string; title: string }): string {
  const t = String(d.title ?? '').trim();
  if (!RAW_META.test(t)) return t;
  const ref = /\|\s*ref\s+(\d{4}-\d{2}-\d{2})\b/i.exec(t);
  if (!ref) return '';
  const quando = fmtDateBR(ref[1]);
  if (d.docType === 'ITR') return `Trimestre encerrado em ${quando}`;
  if (d.docType === 'DFP') return `Exercício encerrado em ${quando}`;
  return `Data de referência: ${quando}`;
}

/**
 * Versões do mesmo ITR/DFP (v1, v2, v3 do mesmo período, reapresentações) viram um cartão só.
 * Com o título trocado por cvmDocTitle, as três saíam iguais ("Trimestre encerrado em
 * 30/06/2026" três vezes no /airton/BPAC11/). Fica a primeira da lista (a CVM devolve da mais
 * recente para a mais antiga, então a última versão). Documento com título normal passa sempre.
 */
export function dedupeCvmVersions<T extends { docType: string; title: string }>(docs: readonly T[]): T[] {
  const seen = new Set<string>();
  return docs.filter((d) => {
    const t = String(d.title ?? '');
    if (!RAW_META.test(t)) return true;
    const ref = /\|\s*ref\s+(\d{4}-\d{2}-\d{2})\b/i.exec(t);
    if (!ref) return true;
    const key = `${d.docType}|${ref[1]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
