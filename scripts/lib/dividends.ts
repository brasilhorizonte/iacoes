/**
 * Proventos sem as duplicatas da fonte, e as janelas de DY e de média (página de ticker inteira,
 * /acoes/, setores, pares, valuations.json, calculadora e ranking).
 *
 * `brapi_dividends` regrava o histórico em lotes (out/2026: lotes de 23/08, 27/09 e 29/09
 * convivendo, com fontes `brapi` e `b3`). A mesma distribuição aparece duas ou três vezes,
 * às vezes com outra precisão, outro dia de pagamento ou com a atualização monetária
 * embutida. Ao mesmo tempo, há linhas IGUAIS que são eventos reais diferentes: parcelas
 * (CMIG4 paga cada provento em duas metades, em junho e em dezembro) e dividendo e JCP de
 * mesmo valor na mesma data-com (SBSP3, 28/04/2022). A chave antiga `data-com|valor` errava
 * dos dois lados: juntava parcelas e naturezas diferentes (CMIG4: R$ 0,64 de proventos em
 * 12 meses contra R$ 1,14 reais) e contava data-com futura e restituição de capital.
 *
 * Régua — a do app (aba Dividendos, `collapseSourceDuplicates` em
 * src/components/portfolio/dividends/dividendData.ts:113):
 * - duplicata = mesma NATUREZA (dividendo, JCP, rendimento, restituição de capital) e mesmo
 *   VALOR DECLARADO (antes do ajuste por desdobramento) com data-com a até 3 dias;
 * - PARCELA não é duplicata: mesma data-com, os dois com pagamento real (presente e diferente
 *   da própria data-com, que a fonte usa como marcador) e pagamentos diferentes;
 * - fica a linha mais antiga, com o pagamento real mais tardio do grupo;
 * - natureza diferente nunca junta.
 *
 * Quatro guardas a mais que o app (medidas na tabela inteira em 07/10/2026, 30.942 linhas de
 * 374 papéis; o app tem os mesmos buracos):
 * 1. "Mesmo valor" = diferença relativa até 0,01%, não igualdade bit a bit: os lotes gravam o
 *    mesmo provento com 4 a 11 casas (CMIG4 0,30584806 × 0,30584806747; BBDC3 0,01725 ×
 *    0,017249826). Com a igualdade exata do app, a média de 5 anos sai inflada em 242 papéis
 *    (VALE3 R$ 10,34 contra 6,47; CMIG4 contava três vezes o dividendo de 30/04/2021).
 * 2. Pagamentos a até 3 dias um do outro são o MESMO pagamento, não parcelas: o lote de 29/09
 *    deslocou o pagamento em 1 dia em 998 pares de 204 papéis (PETR4: dividendo de 27/04/2023
 *    pago em 26/12 num lote e em 27/12 no outro). Pela regra do app, viravam "parcelas".
 * 3. LINHA-TOTAL ao lado das parcelas (`dropTotalLines`): um lote grava o provento em parcelas
 *    e o outro grava também o total numa linha só, com a mesma natureza e data-com a até 3 dias
 *    (TAEE11 09/05/2022: 2,323063 = 1,8963242 + 0,42673913; MOVI3 04/05/2022: 0,8488842 =
 *    0,246834494 + 0,602049747; ALLD3 06/12/2024: JCP 1,2970586 = duas metades de 0,6485293).
 *    O caso particular é a atualização monetária embutida: provento + RENDIMENTO (a correção
 *    pela Selic) em duas linhas e a soma numa terceira (BBSE3 10/02/2022: 0,9171545 +
 *    0,012893915 = 0,93004838; BAZA3 28/04/2025: JCP 7,1086183 + 0,3091823 = 7,4178).
 *    A linha-total sai e as parcelas ficam quando:
 *    - o valor declarado dela é a soma de 2 ou mais outras linhas da mesma natureza (o
 *      RENDIMENTO entra como parcela de dividendo/JCP) com diferença até 0,0001%; e
 *    - o pagamento dela é o de uma das parcelas (±3 dias) ou não é real.
 *    Sem a condição do pagamento, parcela verdadeira sairia: a 1ª parcela da GRND3 de
 *    26/12/2025 (0,443380332, paga em 14/01) é exatamente a soma das duas seguintes
 *    (0,221690166 em 18/03 e em 10/06); a 1ª da PETR4 de 27/04/2023 (1,3728669 em 19/05) bate
 *    com 0,8747986 (16/06) + 0,49806827 (27/12); a EALT3 de 19/01/2022 paga 0,01402 em
 *    2023 e 0,00701 em 2022. Vale também a régua antiga desta guarda (provento + RENDIMENTO
 *    da mesma data-com até 0,01%, pagamentos a até 3 dias), que pega os totais gravados com 4
 *    casas (BBSE3 2013–2015). Na tabela inteira saem 110 linhas de 49 papéis (a régua antiga
 *    tirava 23 de 5); a média de 5 anos cai em 24 papéis (BAZA3 −27,6%, MOVI3 −24,4%, ALLD3
 *    −17,0%, TAEE11 −11,4%) e nenhum DY de 12 meses muda (as linhas-total têm mais de 1 ano).
 * 4. CRONOGRAMA REVISTO (`dropRevisedSchedules`): o mesmo provento gravado com o cronograma
 *    original por um lote e com o novo por outro, com datas-com diferentes (até 3 dias). Grupos
 *    A e B da mesma natureza, cada um numa data-com: se as linhas de B com pagamento real a
 *    partir do 1º pagamento de A (folga de 3 dias) somam o mesmo que A (diferença até 0,01%),
 *    B foi reagendado por A e essas linhas de B saem (A fica, com as datas atuais). GRND3: o
 *    extraordinário de 26/12/2025 (R$ 1,086264641) saiu em 4 parcelas no lote da B3; a empresa
 *    antecipou as 3 últimas (0,221690166 + 0,221690166 + 0,199503977 = 0,642884309) para
 *    25/02 e 20/05/2026, e o lote da brapi gravou isso com data-com 24/12 (0,332535249 +
 *    0,31034906). Contava duas vezes: DY de 12 meses 48,88% → 34,13%. Único caso na tabela.
 * Uma linha é duplicata se casar com QUALQUER linha já mantida (o app compara só com a última
 * da mesma chave, e a parcela do lote novo escondia a duplicata do lote velho).
 *
 * Fica de fora DE PROPÓSITO (apagaria provento real em outros papéis):
 * - o mesmo provento com valores 0,1% a 5% diferentes entre lotes (VALE3 08/03/2022:
 *   3,7192566 × 3,701840165) e com a data de aprovação no lugar da data-com (PETR4 13/05 ×
 *   11/06/2024, mesmo pagamento). Na mesma situação há eventos reais distintos (BGIP4
 *   19/11/2025, dois JCP da fonte B3 com 1,2% de diferença; HYPE3 2024, JCP iguais a 3
 *   semanas, pagos juntos);
 * - linha-total com pagamento que não é o de nenhuma parcela, só mais tarde (CPFE3 29/04/2022,
 *   1,6211402 pago em 15/12; VITT3 28/11/2023, 0,2746809 em 31/12/2024; a 2ª cópia do total da
 *   DEXP3/DEXP4 de 28/04/2023, paga em 31/12): o mesmo desenho aparece em parcela verdadeira
 *   (EALT3 19/01/2022, PNVL3 26/06/2026: parcela maior, mais tarde, igual à soma de outras);
 * - cronograma revisto com a MESMA data-com nos dois lotes (não dá para separar os dois
 *   cronogramas sem saber de que lote é cada linha).
 * Resíduos conhecidos (07/10/2026; DADOS-API §5): com o teto de 0,01% da guarda 3, as linhas-total
 * de cópia arredondada (LAVV3, AURE3, VBBR3, CPFE3 2025) já saem; a CPFE3 ainda tem a média de
 * 5 anos acima da soma dos totais anuais pelos casos de pagamento posterior acima.
 * O ranking marca o DY que passa de 2× a média de 5 anos como provento atípico.
 *
 * DY e médias (`incomeWindows`): só RENDA (restituição de capital e amortização devolvem
 * capital, ficam fora como no app) com data-com em (hoje − N anos, hoje]. Data-com futura
 * (provento anunciado) ainda não aconteceu: aparece na lista, mas não entra no DY.
 * `dividendYieldTTM` é o DY da página INTEIRA (hero, métricas, SEO, FAQ, pares, /acoes/,
 * setores): a mesma régua da seção de proventos, em vez do `dividend_yield` do banco (que soma
 * as duplicatas: BPAC11 3,69% no topo contra 1,84% na seção).
 *
 * Funções puras: datas ISO comparadas como texto, "hoje" por parâmetro (data em BRT).
 */
import { isoMinusYears } from './dates';

export type DividendKind = 'dividendo' | 'jcp' | 'rendimento' | 'capital' | 'outro';

/** Provento como o gerador lê (o `RawDividend` encaixa aqui). */
export interface DividendRowLike {
  /** R$/ação na base acionária de hoje (já ajustado por desdobramento). */
  amount: number;
  /** Data-com (yyyy-mm-dd). */
  exDate: string;
  paymentDate?: string | null;
  dividendType?: string | null;
  /** Valor como declarado na época; só existe quando o ajuste mudou o valor. */
  amountDeclared?: number;
}

/** Datas-com a até N dias com a mesma natureza e valor são a mesma linha repetida. */
export const SOURCE_DUPLICATE_MAX_DAYS = 3;
/** "Mesmo valor": diferença relativa até 0,01% (o mesmo provento gravado com 4 a 11 casas). */
export const AMOUNT_REL_TOLERANCE = 1e-4;
/** Linha-total: o valor dela e a soma das parcelas diferem até 0,01% (guarda 3). Era 0,0001%, mas o
 * colapso de duplicatas guarda às vezes a cópia arredondada a 4–6 casas (LAVV3 14/11/2024, AURE3
 * 03/05/2022, VBBR3 14/12/2021, CPFE3 29/04/2025): a soma ficava fora por 0,0002%. Medido em
 * 07/10/2026: com 0,01% saem mais 14 linhas, todas linha-total; a condição do pagamento continua. */
export const TOTAL_LINE_REL_TOLERANCE = 1e-4;
/** Cronograma revisto: a soma do novo e a das parcelas substituídas diferem até 0,01% (guarda 4). */
export const REVISED_SCHEDULE_REL_TOLERANCE = 1e-4;
/** Teto da busca de parcelas de UMA linha (passos). Estourou: a linha fica (na dúvida, não apaga). */
const TOTAL_LINE_SEARCH_BUDGET = 200_000;

const plain = (raw: unknown): string =>
  String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * Natureza do `dividend_type` (mesma régua do `classifyDividendType` do app). Valores na
 * tabela em 07/10/2026: JCP, DIVIDENDO, RENDIMENTO, REST CAP DIN e AMORTIZAÇÃO.
 */
export function classifyDividendType(raw: unknown): DividendKind {
  const t = plain(raw);
  if (t === 'DIVIDENDO' || t === 'DIVIDENDOS') return 'dividendo';
  if (t === 'JCP' || t.startsWith('JUROS SOBRE CAPITAL')) return 'jcp';
  if (t === 'RENDIMENTO' || t === 'RENDIMENTOS') return 'rendimento';
  if (t.startsWith('REST CAP') || t.startsWith('AMORTIZACAO')) return 'capital';
  return 'outro';
}

/** Restituição de capital e amortização devolvem investimento: não são renda (fora do DY). */
export const isIncomeKind = (k: DividendKind): boolean => k !== 'capital';

const isoDay = (v: unknown): string | null => {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const dayNumber = (iso: string): number =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

const daysApart = (a: string, b: string): number => Math.abs(dayNumber(a) - dayNumber(b));

export const sameAmount = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= AMOUNT_REL_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));

const declared = (d: DividendRowLike): number => d.amountDeclared ?? d.amount;

/** Pagamento de verdade: presente e diferente da data-com (a fonte usa a data-com como marcador). */
const realPayment = (d: DividendRowLike): string | null => {
  const p = isoDay(d.paymentDate);
  return p && p !== isoDay(d.exDate) ? p : null;
};

/** Parcela: mesma data-com e dois pagamentos reais a mais de 3 dias um do outro. */
export function isInstallment(a: DividendRowLike, b: DividendRowLike): boolean {
  if (isoDay(a.exDate) !== isoDay(b.exDate)) return false;
  const pa = realPayment(a);
  const pb = realPayment(b);
  return !!pa && !!pb && daysApart(pa, pb) > SOURCE_DUPLICATE_MAX_DAYS;
}

/** A mesma linha gravada de novo pela fonte (regra do app + guardas 1 e 2 do cabeçalho). */
export function isSourceDuplicate(a: DividendRowLike, b: DividendRowLike): boolean {
  const ea = isoDay(a.exDate);
  const eb = isoDay(b.exDate);
  if (!ea || !eb || daysApart(ea, eb) > SOURCE_DUPLICATE_MAX_DAYS) return false;
  if (classifyDividendType(a.dividendType) !== classifyDividendType(b.dividendType)) return false;
  if (!sameAmount(declared(a), declared(b))) return false;
  return !isInstallment(a, b);
}

const validRow = (d: DividendRowLike | null | undefined): d is DividendRowLike =>
  !!d && Number.isFinite(d.amount) && d.amount > 0 && isoDay(d.exDate) !== null;

/** Linhas válidas em ordem crescente de data-com (estável: empate fica na ordem de entrada). */
function ascending<T extends DividendRowLike>(rows: readonly T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .filter((x) => validRow(x.r))
    .sort((a, b) => (isoDay(a.r.exDate) as string).localeCompare(isoDay(b.r.exDate) as string) || a.i - b.i)
    .map((x) => x.r);
}

/**
 * Colapsa as linhas repetidas da fonte. Recebe as linhas de UM papel (qualquer ordem) e devolve
 * as válidas (valor > 0, data-com válida) em ordem crescente de data-com, sem as repetições.
 */
export function collapseSourceDuplicates<T extends DividendRowLike>(rows: readonly T[]): T[] {
  const out: T[] = [];
  for (const r of ascending(rows)) {
    const ex = dayNumber(isoDay(r.exDate) as string);
    let dup = -1;
    for (let j = out.length - 1; j >= 0; j--) {
      if (ex - dayNumber(isoDay(out[j].exDate) as string) > SOURCE_DUPLICATE_MAX_DAYS) break;
      if (isSourceDuplicate(out[j], r)) { dup = j; break; }
    }
    if (dup < 0) { out.push(r); continue; }
    // Fica a linha mais antiga, com o pagamento real mais tardio (o mais antigo pode ser marcador).
    const kept = out[dup];
    const p = realPayment(r);
    const kp = realPayment(kept);
    if (p && (!kp || p > kp)) out[dup] = { ...kept, paymentDate: r.paymentDate };
  }
  return out;
}

/** Linhas lidas uma vez: natureza, valor declarado, data-com e pagamento real em dias. */
interface RowFacts { kind: DividendKind[]; amt: number[]; ex: number[]; pay: (number | null)[] }

function factsOf(rows: readonly DividendRowLike[]): RowFacts {
  return {
    kind: rows.map((r) => classifyDividendType(r.dividendType)),
    amt: rows.map(declared),
    ex: rows.map((r) => { const e = isoDay(r.exDate); return e ? dayNumber(e) : NaN; }),
    pay: rows.map((r) => { const p = realPayment(r); return p ? dayNumber(p) : null; }),
  };
}

/** Parcela possível de um total da natureza `total`: a mesma natureza, ou RENDIMENTO (correção) de dividendo/JCP. */
const partKindFits = (total: DividendKind, part: DividendKind): boolean =>
  part === total || (part === 'rendimento' && (total === 'dividendo' || total === 'jcp'));

/**
 * Régua antiga da guarda 3 (mantida): Z = x + y com x da natureza de Z e y RENDIMENTO, todos na
 * MESMA data-com, soma até 0,01% e os pagamentos de x e de y a até 3 dias do de Z (ou ausentes).
 * `near` = linhas vivas com data-com a até 3 dias da de Z (sem Z).
 */
function isFoldedCorrection(rows: readonly DividendRowLike[], f: RowFacts, z: number, near: readonly number[]): boolean {
  if (f.kind[z] === 'rendimento' || f.kind[z] === 'capital') return false;
  const Z = rows[z];
  const closePay = (b: DividendRowLike) => {
    const pa = isoDay(Z.paymentDate);
    const pb = isoDay(b.paymentDate);
    return !pa || !pb || daysApart(pa, pb) <= SOURCE_DUPLICATE_MAX_DAYS;
  };
  const same = near.filter((i) => f.ex[i] === f.ex[z] && closePay(rows[i]));
  for (const x of same) {
    if (f.kind[x] !== f.kind[z]) continue;
    for (const y of same) {
      if (y !== x && f.kind[y] === 'rendimento' && sameAmount(f.amt[z], f.amt[x] + f.amt[y])) return true;
    }
  }
  return false;
}

/**
 * Régua nova da guarda 3: Z é a soma (até 0,01%) de 2 ou mais linhas vivas da mesma natureza
 * (RENDIMENTO conta como parcela de dividendo/JCP; pelo menos uma parcela da natureza de Z),
 * com data-com a até 3 dias da de Z, e o pagamento de Z é o de uma das parcelas (±3 dias) ou
 * não é real. Busca em profundidade do maior para o menor, com poda pela soma (valores > 0).
 * `near` = linhas vivas com data-com a até 3 dias da de Z (sem Z).
 */
function isTotalOfParts(f: RowFacts, z: number, near: readonly number[]): boolean {
  const kz = f.kind[z];
  const target = f.amt[z];
  const parts = near.filter((j) => partKindFits(kz, f.kind[j]) && f.amt[j] < target);
  if (parts.length < 2) return false;
  parts.sort((a, b) => f.amt[b] - f.amt[a] || a - b);
  const rest: number[] = new Array(parts.length + 1).fill(0);
  for (let i = parts.length - 1; i >= 0; i--) rest[i] = rest[i + 1] + f.amt[parts[i]];
  const tol = TOTAL_LINE_REL_TOLERANCE * target;
  const pz = f.pay[z];
  let budget = TOTAL_LINE_SEARCH_BUDGET;
  const search = (i: number, sum: number, count: number, sameKind: boolean, payMatch: boolean): boolean => {
    if (--budget < 0) return false;
    if (count >= 2 && sameKind && (pz === null || payMatch) && Math.abs(sum - target) <= tol) return true;
    if (i >= parts.length || sum - target > tol || sum + rest[i] < target - tol) return false;
    const j = parts[i];
    const pj = f.pay[j];
    const matches = payMatch || (pz !== null && pj !== null && Math.abs(pj - pz) <= SOURCE_DUPLICATE_MAX_DAYS);
    return search(i + 1, sum + f.amt[j], count + 1, sameKind || f.kind[j] === kz, matches)
      || search(i + 1, sum, count, sameKind, payMatch);
  };
  return search(0, 0, 0, false, false);
}

/**
 * Guarda 3 do cabeçalho: tira a LINHA-TOTAL gravada ao lado das próprias parcelas (inclui o
 * provento com a atualização monetária embutida). As parcelas ficam. Recebe e devolve as
 * linhas de UM papel na mesma ordem (passe a saída de `collapseSourceDuplicates`).
 */
export function dropTotalLines<T extends DividendRowLike>(rows: readonly T[]): T[] {
  if (rows.length < 3) return rows.slice();
  const f = factsOf(rows);
  const drop = new Set<number>();
  // Índices em ordem de data-com: os vizinhos de cada linha (data-com a até 3 dias) saem de uma
  // janela contígua, sem varrer o histórico inteiro por linha.
  const byEx = rows.map((_, i) => i).filter((i) => Number.isFinite(f.ex[i])).sort((a, b) => f.ex[a] - f.ex[b] || a - b);
  const pos = new Map(byEx.map((i, k) => [i, k] as const));
  const nearOf = (z: number): number[] => {
    const k = pos.get(z) as number;
    let lo = k;
    let hi = k;
    while (lo > 0 && f.ex[z] - f.ex[byEx[lo - 1]] <= SOURCE_DUPLICATE_MAX_DAYS) lo--;
    while (hi < byEx.length - 1 && f.ex[byEx[hi + 1]] - f.ex[z] <= SOURCE_DUPLICATE_MAX_DAYS) hi++;
    const out: number[] = [];
    for (let p = lo; p <= hi; p++) if (byEx[p] !== z && !drop.has(byEx[p])) out.push(byEx[p]);
    return out;
  };
  // Do maior para o menor: o total é maior que cada parcela, e um subtotal só é avaliado
  // depois do total que o contém.
  const order = byEx.slice().sort((a, b) => f.amt[b] - f.amt[a] || a - b);
  for (const z of order) {
    if (!(f.amt[z] > 0)) continue;
    const near = nearOf(z);
    if (near.length < 2) continue;
    if (isFoldedCorrection(rows, f, z, near) || isTotalOfParts(f, z, near)) drop.add(z);
  }
  return drop.size ? rows.filter((_, i) => !drop.has(i)) : rows.slice();
}

/** Nome antigo da guarda 3 (só provento + RENDIMENTO); hoje é a linha-total generalizada. */
export const dropFoldedCorrections = dropTotalLines;

/**
 * Guarda 4 do cabeçalho: o mesmo provento gravado com o cronograma ORIGINAL (grupo B) e com o
 * REVISTO (grupo A) em datas-com diferentes, a até 3 dias. Grupo = linhas da mesma natureza
 * numa data-com. Se todas as linhas de A têm pagamento real e as linhas de B pagas a partir do
 * 1º pagamento de A (folga de 3 dias) somam o mesmo que A (até 0,01%), essas linhas de B saem:
 * A fica, com as datas atuais; as parcelas de B pagas antes da revisão também ficam.
 */
export function dropRevisedSchedules<T extends DividendRowLike>(rows: readonly T[]): T[] {
  if (rows.length < 3) return rows.slice();
  const f = factsOf(rows);
  const byKey = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const ex = isoDay(r.exDate);
    if (!ex) return;
    const key = `${ex}|${f.kind[i]}`;
    const g = byKey.get(key);
    if (g) g.push(i); else byKey.set(key, [i]);
  });
  // Grupos em ordem de data-com (e natureza): cada um só é comparado com os vizinhos a até 3 dias.
  const groups = [...byKey.keys()].sort().map((k) => byKey.get(k)!);
  const drop = new Set<number>();
  const sum = (idx: number[]) => idx.reduce((s, i) => s + f.amt[i], 0);
  let start = 0;
  for (let a = 0; a < groups.length; a++) {
    const exA = f.ex[groups[a][0]];
    while (exA - f.ex[groups[start][0]] > SOURCE_DUPLICATE_MAX_DAYS) start++;
    for (let b = start; b < groups.length; b++) {
      if (f.ex[groups[b][0]] - exA > SOURCE_DUPLICATE_MAX_DAYS) break;   // daqui para frente, só mais longe
      if (a === b || f.kind[groups[a][0]] !== f.kind[groups[b][0]]) continue;
      const A = groups[a].filter((i) => !drop.has(i));
      const B = groups[b].filter((i) => !drop.has(i));
      if (!A.length || !B.length || A.some((i) => f.pay[i] === null)) continue;
      const firstA = Math.min(...A.map((i) => f.pay[i] as number));
      const replaced = B.filter((i) => f.pay[i] !== null && (f.pay[i] as number) >= firstA - SOURCE_DUPLICATE_MAX_DAYS);
      if (!replaced.length) continue;
      const sa = sum(A);
      const sb = sum(replaced);
      if (Math.abs(sa - sb) > REVISED_SCHEDULE_REL_TOLERANCE * Math.max(sa, sb)) continue;
      for (const i of replaced) drop.add(i);
    }
  }
  return drop.size ? rows.filter((_, i) => !drop.has(i)) : rows.slice();
}

/** Proventos de um papel sem as repetições da fonte, em ordem crescente de data-com. */
export function dedupeDividends<T extends DividendRowLike>(rows: readonly T[]): T[] {
  return dropRevisedSchedules(dropTotalLines(collapseSourceDuplicates(rows)));
}

export type AvgWindowKey = '1' | '3' | '5' | '10';
export const AVG_WINDOWS: readonly AvgWindowKey[] = ['1', '3', '5', '10'];

/** Renda (sem restituição de capital) e data-com já ocorrida (≤ hoje, BRT). */
export function isPastIncome(d: DividendRowLike, todayISO: string): boolean {
  const ex = isoDay(d.exDate);
  return !!ex && ex <= todayISO && isIncomeKind(classifyDividendType(d.dividendType)) && Number.isFinite(d.amount) && d.amount > 0;
}

export interface IncomeWindows {
  /** Soma por ação da renda com data-com em (hoje − 12 meses, hoje]. */
  ttm: number;
  /** Média anual por janela móvel: soma em (hoje − N anos, hoje] ÷ N (ano sem pagamento conta zero). */
  avg: Record<AvgWindowKey, number>;
}

/** DY de 12 meses e médias por janela, já sem duplicatas (passe a saída de `dedupeDividends`). */
export function incomeWindows(rows: readonly DividendRowLike[], todayISO: string): IncomeWindows {
  const past = rows.filter((d) => isPastIncome(d, todayISO));
  const sumSince = (years: number) => {
    const from = isoMinusYears(todayISO, years);
    return past.reduce((s, d) => ((isoDay(d.exDate) as string) > from ? s + d.amount : s), 0);
  };
  const ttm = sumSince(1);
  return { ttm, avg: { '1': ttm, '3': sumSince(3) / 3, '5': sumSince(5) / 5, '10': sumSince(10) / 10 } };
}

/**
 * DY de 12 meses da página INTEIRA (hero, métricas, meta description, introdução, FAQ de
 * indicadores, pares, /acoes/ e setores): renda sem duplicatas com data-com em
 * (hoje − 12 meses, hoje] ÷ cotação — a mesma régua de `dividends()` (seção de proventos, FAQ
 * "quanto paga", calculadora e ranking). Recebe TODAS as linhas do papel, já ajustadas por
 * desdobramento (o mesmo que a seção recebe).
 *
 * Papel sem nenhum provento válido na base, ou sem cotação: fica o DY publicado pelo banco
 * (`reported`), como antes — não inventa zero onde o banco tem DY.
 */
export function dividendYieldTTM(rows: readonly DividendRowLike[], price: number, reported: number, todayISO: string): number {
  const fallback = Number.isFinite(reported) && reported > 0 ? reported : 0;
  if (!rows.some(validRow) || !(Number.isFinite(price) && price > 0)) return fallback;
  return incomeWindows(dedupeDividends(rows), todayISO).ttm / price;
}
