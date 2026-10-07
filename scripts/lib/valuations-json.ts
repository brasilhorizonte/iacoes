/**
 * Campos de preço justo e proventos do `valuations.json` (landing e calculadora).
 *
 * Saem do MESMO modelo da página de ticker (`buildModel`, scripts/ticker/model.ts), com as
 * premissas padrão do site: Graham √(22,5 × LPA × VPA) sem margem; Bazin = média de
 * proventos de 5 anos ÷ 6%; Gordon = média de 5 anos × (1 + 4%) ÷ (14% − 4%). Antes o
 * arquivo publicava outra conta (Graham com VPA = PL ÷ ações, Gordon pelo LPA com ke de
 * CAPM e Bazin sem a deduplicação da página) e chegava a Gordon negativo (CSAN3: −15,69).
 *
 * Proventos já vêm na base acionária de hoje (ajuste por desdobramento em supabase.ts).
 */
import type { TickerModel } from '../ticker/model';

// Mesmo arredondamento do `brl()` da página (Intl/ICU). `toFixed(2)` diverge no meio centavo:
// 1.005.toFixed(2) = "1.00", e a página mostra R$ 1,01.
const CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** Preço em R$ com 2 casas, arredondado como a página exibe; inválido, zero ou negativo → 0. */
export const cents = (v: number): number => (Number.isFinite(v) && v > 0 ? Number(CENTS.format(v)) : 0);

/** Provento por ação com 6 casas: a precisão do `data-avg` que a calculadora da página usa. */
export const perShare = (v: number): number => (Number.isFinite(v) && v > 0 ? Number(v.toFixed(6)) : 0);

/**
 * LPA/VPA com 6 casas e COM sinal: negativo continua negativo (a calculadora mostra "não se
 * aplica"); só inválido vira 0. Com 2 casas, quem recalcula o Graham a partir do arquivo (a
 * landing recalcula; a página usa o valor cheio) errava em 190 de 236 papéis, até 6% (HBOR3:
 * R$ 2,70 contra R$ 2,88 na página).
 */
export const perShareSigned = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) || 0 : 0);

export type AvgWindow = '1' | '3' | '5' | '10';

export interface WidgetValuationFields {
  graham: number;
  bazin: number;
  gordon: number;
  lpa: number;
  vpa: number;
  divTTM: number;
  avgDiv: Record<AvgWindow, number>;
}

export function widgetValuationFields(m: Pick<TickerModel, 'calc' | 'div'>): WidgetValuationFields {
  return {
    graham: cents(m.calc.graham.fv),
    bazin: cents(m.calc.bazin.fv),
    gordon: cents(m.calc.gordon.fv),
    // As mesmas entradas do Graham da página (√(22,5 × LPA × VPA) recalculado dá o `graham`).
    lpa: perShareSigned(m.calc.graham.lpa),
    vpa: perShareSigned(m.calc.graham.vpa),
    divTTM: perShare(m.div.ttm),
    avgDiv: {
      '1': perShare(m.div.avg['1']),
      '3': perShare(m.div.avg['3']),
      '5': perShare(m.div.avg['5']),
      '10': perShare(m.div.avg['10']),
    },
  };
}
