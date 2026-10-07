/**
 * Valuation por DCF (fluxo de caixa descontado) — página /ferramentas/fluxo-de-caixa-descontado/.
 *
 * Fonte de verdade: honestidade-rotas.md (Valuation por DCF) e o código da tela Valuation do app
 * (DCFModelPanel, RefinedAssumptionsPanel, SensitivityTables, dcfProjectionService,
 * financialService.calculateWacc, constants), lidos em 07/10/2026. O que esta página NÃO pode dizer:
 * que a IA questiona ou revisa as premissas do usuário (o botão saiu da tela), que o relatório sai
 * em PDF, que há cenários editáveis, que a análise fica pronta "em segundos" (a montagem leva
 * dezenas de segundos), que serve para BDR, ETF ou FII, nem chamar a tela pelo nome interno.
 * Margem EBITDA é RESULTADO (receita − CPV − SG&A), nunca premissa.
 *
 * Exemplo numérico (SPEC §1, regra do CNPI): a Empresa A é FICTÍCIA. As premissas ficam em EXEMPLO
 * e as contas em projecao()/valor(); a seção SSR (sections/dcf.tsx) e o texto abaixo usam essas
 * funções, e o widget (widgets/dcf.js) repete as MESMAS premissas e a mesma conta para a tabela de
 * sensibilidade do topo: mudou aqui, mude lá (caso base = R$ 25,09 por ação).
 * Acesso (SPEC-v2 §B2): a tela de Valuation é aberta a qualquer conta; o número de análises com IA
 * por dia depende do plano. Sem link para a tabela de planos e sem números de limite.
 */
import { num, pct } from '../../ticker/lib/format';
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

// ─── Empresa A (fictícia): premissas e contas do exemplo ──────────────────

/** Premissas da Empresa A. Valores em R$ milhões; ações em milhões; taxas em fração. */
export const EXEMPLO = {
  nome: 'Empresa A',
  /** Receita do último ano (ano 0). */
  receita0: 1000,
  /** Crescimento da receita nos anos explícitos (1 a 5). */
  crescimento: [0.1, 0.09, 0.08, 0.07, 0.06],
  /** Crescimento nos anos de convergência (6 a 10), perto da inflação de longo prazo. */
  convergencia: 0.04,
  cpv: 0.6,
  sga: 0.18,
  da: 0.04,
  ir: 0.34,
  capex: 0.06,
  /** Capital de giro como fração da receita: o investimento do ano é essa fração do aumento da receita. */
  giro: 0.1,
  dividaBruta: 250,
  caixa: 50,
  acoes: 30,
  /** WACC do caso base (a decomposição em WACC_PARTES dá 15,975%, arredondado para 16%). */
  wacc: 0.16,
  /** Crescimento na perpetuidade (g) do caso base. */
  g: 0.04,
} as const;

/** Decomposição do WACC da Empresa A (premissas do exemplo, não dado de mercado). */
export const WACC_PARTES = { rf: 0.12, beta: 1, erp: 0.05, premio: 0.01, selic: 0.13, spread: 0.02, e: 0.75, d: 0.25 } as const;

/** Eixos da tabela de sensibilidade (os mesmos do widget): WACC de 13% a 19% e g de 2,5% a 5,5%. */
export const SENS_WACC = [0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19] as const;
export const SENS_G = [0.025, 0.03, 0.035, 0.04, 0.045, 0.05, 0.055] as const;
/** Índice do caso base nos dois eixos (WACC 16%, g 4%). */
export const SENS_BASE = 3;

export interface AnoProjetado {
  ano: number;
  crescimento: number;
  receita: number;
  ebitda: number;
  da: number;
  ebit: number;
  /** IR/CSLL sobre o EBIT. */
  imposto: number;
  nopat: number;
  capex: number;
  /** Investimento em capital de giro (Δ capital de giro). */
  giro: number;
  fcff: number;
}

/** DRE e FCFF da Empresa A, anos 1 a 10 (5 explícitos + 5 de convergência). Mesma conta do widget. */
export function projecao(): AnoProjetado[] {
  const e = EXEMPLO;
  const out: AnoProjetado[] = [];
  let anterior: number = e.receita0;
  for (let ano = 1; ano <= 10; ano++) {
    const crescimento: number = ano <= e.crescimento.length ? e.crescimento[ano - 1] : e.convergencia;
    const receita = anterior * (1 + crescimento);
    const ebitda = receita - receita * e.cpv - receita * e.sga;
    const da = receita * e.da;
    const ebit = ebitda - da;
    const imposto = ebit * e.ir;
    const nopat = ebit - imposto;
    const capex = receita * e.capex;
    const giro = (receita - anterior) * e.giro;
    const fcff = nopat + da - capex - giro;
    out.push({ ano, crescimento, receita, ebitda, da, ebit, imposto, nopat, capex, giro, fcff });
    anterior = receita;
  }
  return out;
}

export interface ValorDcf {
  /** Soma dos valores presentes dos FCFF dos anos 1 a 10. */
  somaVp: number;
  /** Valor terminal no ano 10 (perpetuidade de Gordon). */
  vt: number;
  vpVt: number;
  ev: number;
  dividaLiquida: number;
  equity: number;
  preco: number;
  /** Valor presente da perpetuidade ÷ EV. */
  pesoPerpetuidade: number;
}

/** Da série de FCFF ao preço justo por ação, com WACC e g dados. Mesma conta do widget. */
export function valor(fcff: readonly number[], wacc: number, g: number): ValorDcf {
  const e = EXEMPLO;
  let somaVp = 0;
  for (let t = 1; t <= fcff.length; t++) somaVp += fcff[t - 1] / Math.pow(1 + wacc, t);
  const n = fcff.length;
  const vt = (fcff[n - 1] * (1 + g)) / (wacc - g);
  const vpVt = vt / Math.pow(1 + wacc, n);
  const ev = somaVp + vpVt;
  const dividaLiquida = e.dividaBruta - e.caixa;
  const equity = ev - dividaLiquida;
  return { somaVp, vt, vpVt, ev, dividaLiquida, equity, preco: equity / e.acoes, pesoPerpetuidade: vpVt / ev };
}

/** Preço justo por ação para cada WACC (linhas) × g (colunas) da tabela de sensibilidade. */
export function sensibilidade(): number[][] {
  const fcff = projecao().map((a) => a.fcff);
  return SENS_WACC.map((w) => SENS_G.map((g) => valor(fcff, w, g).preco));
}

/** Tudo o que a página mostra da Empresa A, calculado uma vez. */
export function exemploDcf() {
  const anos = projecao();
  const fcff = anos.map((a) => a.fcff);
  const base = valor(fcff, EXEMPLO.wacc, EXEMPLO.g);
  const p = WACC_PARTES;
  const ke = p.rf + p.beta * p.erp + p.premio;
  const kdBruto = p.selic + p.spread;
  const kdLiquido = kdBruto * (1 - EXEMPLO.ir);
  const waccCalculado = ke * p.e + kdLiquido * p.d;
  const grade = sensibilidade();
  const b = SENS_BASE;
  return { anos, fcff, base, ke, kdBruto, kdLiquido, waccCalculado, grade, waccMais: grade[b + 1][b], waccMenos: grade[b - 1][b], gMais: grade[b][b + 1], gMenos: grade[b][b - 1] };
}

// ─── Formatação (pt-BR, a mesma do widget) ────────────────────────────────

/** R$ milhões com 1 casa: "R$ 1.470,5 mi". */
export const mi = (v: number): string => `R$ ${num(v, 1)} mi`;
/** Premissa redonda em R$ milhões, sem casas: "R$ 250 mi". */
export const mi0 = (v: number): string => `R$ ${num(v, 0)} mi`;
/** Variação com sinal e o sinal de menos tipográfico: "+11,9%" / "−10,1%". */
export const variacao = (x: number): string => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x), 1)}`;

const EX = exemploDcf();
const BASE = EX.base.preco;
/** Quanto o preço justo do caso base muda com +1 p.p. de WACC e +0,5 p.p. de g (frações). */
const D_WACC = EX.waccMais / BASE - 1;
const D_G = EX.gMais / BASE - 1;

// ─── Conteúdo da página ───────────────────────────────────────────────────

export const dcf: ToolContent = {
  id: 'dcf',
  slug: 'fluxo-de-caixa-descontado',
  status: 'pronto',
  name: 'Valuation por DCF',
  keyword: 'fluxo de caixa descontado',
  title: 'Fluxo de Caixa Descontado (DCF): Valuation de Ações | IAções',
  description: 'Fluxo de caixa descontado (DCF) passo a passo: FCFF, WACC, valor terminal e sensibilidade, com exemplo numérico. A IA propõe as premissas e você decide.',
  h1: 'Fluxo de caixa descontado (DCF): como chegar ao valor de uma ação',
  answer: 'O fluxo de caixa descontado (DCF) estima o valor de uma empresa pelo caixa livre que ela deve gerar no futuro, trazido a valor presente pelo custo de capital (WACC). Tirando a dívida líquida e dividindo pelo número de ações, chega-se ao preço justo por ação. Na plataforma IAções, a IA propõe as premissas a partir do histórico e você decide.',
  blurb: 'DCF de 10 anos com WACC decomposto e sensibilidade WACC × g; a IA propõe as premissas e você decide.',
  cta: {
    label: 'Abrir o Valuation na plataforma',
    target: SCREENS.valuation,
    screen: 'Valuation',
    note: 'A tela de Valuation é aberta a qualquer conta da plataforma: comece com uma conta grátis. O número de análises com IA por dia depende do plano.',
  },
  finalCta: {
    title: 'Monte o DCF de uma ação da B3',
    text: 'Escolha a ação, confira as premissas que a IA propõe a partir do histórico e mude o que quiser. A DRE projetada, a ponte até o preço justo e a tabela de sensibilidade recalculam com as suas premissas.',
    label: 'Abrir o Valuation',
  },
  widget: {
    id: 'dcf',
    illustrative: true,
    label: 'Tabela ilustrativa de sensibilidade: preço justo por ação de uma empresa fictícia para cada combinação de WACC e crescimento na perpetuidade',
    caption: 'Exemplo ilustrativo: preço justo por ação da Empresa A, uma empresa fictícia (a conta completa está em "Como funciona"). Passe o mouse, toque numa célula ou use as setas do teclado para ver a leitura.',
    fallback: { kind: 'text', text: 'Tabela de sensibilidade do preço justo da Empresa A, uma empresa fictícia: WACC nas linhas e crescimento na perpetuidade nas colunas. O exemplo completo, com as contas, está na seção "Como funciona".' },
  },
  dataSource: 'evergreen',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é fluxo de caixa descontado (DCF)',
      blocks: [
        { type: 'p', text: '**Fluxo de caixa descontado** (DCF, sigla de discounted cash flow) é o método de valuation que estima o valor de uma empresa pelo caixa que ela deve gerar no futuro. Um real recebido daqui a cinco anos vale menos do que um real hoje. Por isso o caixa de cada ano é trazido a valor presente por uma taxa de desconto: o custo de capital da empresa, o **WACC**.' },
        { type: 'p', text: 'A soma desses valores presentes, mais o valor da empresa depois do último ano projetado (o **valor terminal**), dá o valor da empresa inteira, o enterprise value. Tirando a dívida líquida, sobra o valor dos acionistas. Dividido pelo número de ações, ele vira o **preço justo por ação**.' },
        { type: 'p', text: 'O DCF é o método mais completo e também o mais exigente: depende de projetar receita, margens e investimentos por vários anos. Fórmulas mais curtas, como as de Graham, Bazin e Gordon, partem de poucos números de hoje (lucro, patrimônio ou dividendo) e servem de checagem rápida. Elas estão na [calculadora de preço justo](/ferramentas/calculadora-preco-justo/) e na [página de cada ação](/acoes/).' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona o DCF, passo a passo',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            '**Projete a DRE.** Receita, custo dos produtos vendidos (CPV), despesas de vendas, gerais e administrativas (SG&A) e depreciação, ano a ano. Daí saem o EBITDA e o EBIT.',
            '**Calcule o fluxo de caixa livre para a firma (FCFF).** É o caixa que a operação gera depois dos impostos e dos investimentos, antes de pagar credores e acionistas.',
            '**Defina a taxa de desconto.** O WACC é o retorno mínimo que acionistas e credores exigem, ponderado pelo peso de cada um no capital da empresa.',
            '**Traga cada fluxo a valor presente.** O FCFF do ano t é dividido por (1 + WACC) elevado a t.',
            '**Calcule o valor terminal.** Depois do último ano projetado, a empresa continua gerando caixa. A perpetuidade de Gordon resume esse futuro num número.',
            '**Passe do valor da empresa ao valor por ação.** O enterprise value menos a dívida líquida dá o valor do capital próprio (equity). Dividido pelo número de ações, é o preço justo por ação.',
          ],
        },
        { type: 'h3', text: 'As fórmulas' },
        { type: 'formula', text: 'FCFF = EBIT × (1 − alíquota de IR) + D&A − Capex − Δ capital de giro' },
        { type: 'formula', text: 'Valor presente do ano t = FCFF(t) ÷ (1 + WACC)^t' },
        { type: 'formula', text: 'Valor terminal (no ano 10) = FCFF(10) × (1 + g) ÷ (WACC − g)' },
        { type: 'formula', text: 'Enterprise value (EV) = soma dos valores presentes dos FCFF + valor presente do valor terminal' },
        { type: 'formula', text: 'Equity = EV − dívida líquida (dívida bruta − caixa)  ·  Preço justo por ação = equity ÷ número de ações' },
        { type: 'p', text: 'EBIT × (1 − alíquota) é o **NOPAT**, o lucro operacional depois dos impostos, como se a empresa não tivesse dívida. Os juros não entram no FCFF: o custo da dívida já está dentro do WACC. D&A (depreciação e amortização) volta para o caixa porque é despesa contábil, sem saída de dinheiro; o Capex e o capital de giro saem, porque são investimento.' },
        { type: 'h3', text: 'Exemplo numérico: a Empresa A, fictícia' },
        { type: 'p', text: `Para ver a conta inteira, acompanhe a **Empresa A**, uma empresa fictícia com receita de ${mi0(EXEMPLO.receita0)} no último ano. As premissas foram escolhidas para o exemplo e não descrevem nenhuma ação real. A tabela de sensibilidade do topo da página usa a mesma empresa.` },
        { type: 'ssr', id: 'dcf-exemplo' },
      ],
    },
    {
      id: 'wacc',
      title: 'WACC: a taxa de desconto, decomposta',
      blocks: [
        { type: 'p', text: 'O **WACC** (custo médio ponderado de capital) junta o custo de quem financia a empresa: os acionistas, pelo custo do capital próprio (Ke), e os credores, pelo custo da dívida (Kd). Cada um pesa de acordo com a sua fatia no capital.' },
        { type: 'formula', text: 'Ke = taxa livre de risco + β × prêmio de risco de mercado (ERP) + prêmio qualitativo' },
        { type: 'formula', text: 'Kd líquido = (Selic + spread de crédito) × (1 − alíquota de IR)' },
        { type: 'formula', text: 'WACC = Ke × E/V + Kd líquido × D/V' },
        {
          type: 'list',
          items: [
            '**Taxa livre de risco:** o retorno de um título sem risco de crédito. No Brasil, a referência costuma ser a taxa de juros futuros (DI) ou o Tesouro de prazo longo.',
            '**Beta (β):** quanto a ação oscila em relação ao mercado. Beta 1 acompanha o mercado; acima de 1, amplifica os movimentos.',
            '**Prêmio de risco de mercado (ERP):** o retorno extra que o investidor exige para ficar em ações em vez do título sem risco.',
            '**Prêmio qualitativo:** um acréscimo ligado à qualidade do negócio, somado ao Ke fora do beta. Na plataforma, ele vem da [nota qualitativa](/ferramentas/nota-qualitativa/) da empresa.',
            '**Custo da dívida (Kd):** a Selic mais o spread que a empresa paga. Como os juros reduzem o imposto, o custo entra líquido de IR.',
            '**E/V e D/V:** o peso do capital próprio e o da dívida no capital total.',
          ],
        },
        { type: 'p', text: 'Na Empresa A, as premissas abaixo levam a um WACC de 15,975%. O exemplo usa 16%, arredondado.' },
        { type: 'ssr', id: 'dcf-wacc' },
        { type: 'p', text: 'O capital próprio custa mais que a dívida e costuma ser a maior fatia, então o Ke manda no WACC. Por isso pequenas mudanças na taxa livre de risco, no beta ou no prêmio de risco mexem tanto no preço justo.' },
      ],
    },
    {
      id: 'perpetuidade',
      title: 'Valor terminal e crescimento na perpetuidade (g)',
      blocks: [
        { type: 'p', text: 'Nenhuma projeção vai até o infinito. O valor terminal resume o que a empresa vale depois do último ano projetado, supondo que o fluxo de caixa cresça a uma taxa constante g para sempre. É a fórmula de Gordon aplicada ao FCFF.' },
        { type: 'p', text: 'Duas regras práticas. O g precisa ser menor que o WACC, senão a conta não fecha. E um g perpétuo acima do crescimento nominal de longo prazo da economia supõe que a empresa vai ficar maior que o país. Por isso, na plataforma, a proposta da IA para o g perpétuo é limitada a 4% ao ano, perto da inflação de longo prazo.' },
        { type: 'p', text: `Na Empresa A, o valor terminal é de ${mi(EX.base.vt)} no ano 10 e vale ${mi(EX.base.vpVt)} em valor presente: ${pct(EX.base.pesoPerpetuidade, 0)} do enterprise value. Com WACC alto, como costuma ser no Brasil, o desconto encolhe o peso da perpetuidade; com WACC baixo, ela pode passar da metade do valor. A plataforma acende um alerta quando a perpetuidade passa de 75% do EV.` },
      ],
    },
    {
      id: 'sensibilidade',
      title: 'Análise de sensibilidade: WACC × g',
      blocks: [
        { type: 'p', text: 'Como o resultado depende tanto das premissas, um DCF bem feito mostra uma faixa, não um número só. A tabela de sensibilidade recalcula o preço justo para várias combinações de WACC (nas linhas) e de g (nas colunas), com o caso base no centro. É a tabela do topo desta página.' },
        { type: 'ssr', id: 'dcf-sensibilidade' },
        { type: 'p', text: `Na Empresa A, subir o WACC em 1 ponto percentual tira ${pct(-D_WACC, 1)} do preço justo, e subir o g em 0,5 ponto acrescenta ${pct(D_G, 1)}. Com taxas de desconto altas, o WACC pesa bem mais que o g.` },
        { type: 'p', text: 'Uma forma de ler a tabela: se o preço justo só fica acima da cotação nas células de WACC baixo e g alto, a conclusão depende de premissas otimistas. Se fica acima na maior parte da tabela, ela resiste a premissas mais duras.' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'O Valuation (DCF) na plataforma IAções',
      blocks: [
        { type: 'p', text: 'Na plataforma, o DCF fica na tela **Valuation**. Você digita o ticker de uma ação da B3, confirma a empresa e recebe um relatório com o **Modelo DCF Bottom-Up**: uma DRE projetada de 10 anos, editável célula a célula.' },
        { type: 'h3', text: 'A IA propõe, você decide' },
        { type: 'p', text: 'No card **Premissas refinadas pela IA**, a IA propõe as premissas a partir do histórico da empresa, com uma justificativa: o crescimento da receita do ano 1 ao ano 5, CPV/Receita, SG&A/Receita, D&A/Receita, Capex/Receita, a alíquota efetiva e o g perpétuo, limitado a 4%. As propostas de margem, Capex e alíquota aparecem ao lado da faixa histórica da empresa; quando saem dela, a plataforma traz o número de volta para perto do histórico e marca o ajuste.' },
        { type: 'p', text: 'O texto da própria tela resume: a IA propõe, você decide. Cada premissa proposta pode ser editada no Modelo DCF Bottom-Up, e o botão **Resetar** volta aos valores do histórico. A IA não revisa as mudanças que você faz: o modelo final é o que você escolheu. Se a IA não responder, o modelo parte só do histórico.' },
        { type: 'h3', text: 'O que o modelo mostra' },
        {
          type: 'list',
          items: [
            '**Anos 1 a 5 (explícitos):** crescimento da receita, CPV, SG&A, D&A, IR/CSLL, prazos de capital de giro (PMR, PME e PMP) e Capex, ano a ano.',
            '**Anos 6 a 10 (convergência):** a receita cresce pela inflação de convergência, uma premissa editável perto do IPCA, e as margens ficam iguais às do ano 5.',
            '**Margem EBITDA:** é resultado, não premissa. Sai da receita menos CPV e SG&A.',
            '**WACC decomposto:** taxa livre de risco, beta, ERP global, prêmio qualitativo, Selic, spread de crédito, IR e a estrutura E/V e D/V, cada parte à vista. Taxa livre de risco, beta, ERP, Selic, spread e IR podem ser editados.',
            '**Ponte para o preço justo:** soma dos valores presentes, valor presente da perpetuidade, enterprise value, caixa, dívida bruta, equity e preço justo por ação. Caixa e dívida também são editáveis.',
            '**Checagens de sanidade:** perpetuidade como % do EV (alerta acima de 75%), EV/EBITDA implícito (alerta acima de 15x) e a TIR implícita no preço atual.',
            '**Sensibilidade:** a tabela WACC × crescimento perpétuo, de 7 por 7 e com amplitude ajustável, uma matriz personalizada entre 10 premissas e um gráfico 3D de WACC × g.',
          ],
        },
        { type: 'h3', text: 'O prêmio qualitativo no WACC' },
        { type: 'p', text: 'O prêmio qualitativo sai da Nota Qualitativa da empresa, numa escala de 1 a 4: quanto mais baixa a nota, maior o prêmio somado ao Ke.' },
        {
          type: 'table',
          caption: 'Prêmio qualitativo somado ao Ke, por faixa da Nota Qualitativa',
          head: ['Nota Qualitativa (1 a 4)', 'Prêmio somado ao Ke'],
          rows: [
            ['3,5 ou mais', '0 ponto percentual'],
            ['De 3,0 a menos de 3,5', '1 ponto percentual'],
            ['De 2,5 a menos de 3,0', '2 pontos percentuais'],
            ['De 2,0 a menos de 2,5', '3 pontos percentuais'],
            ['Abaixo de 2,0', '4 pontos percentuais'],
            ['Sem nota disponível', '1 ponto percentual'],
          ],
        },
        { type: 'p', text: 'O relatório também cruza o DCF com Graham, Bazin, Gordon e múltiplos de pares do setor e traz um resumo gerado pela IA, com pilares e pontos de atenção. Você pode salvar a análise e compartilhar por link. O [AIrton](/airton/), assistente de IA da plataforma, lê a análise salva quando você pede.' },
        { type: 'note', tone: 'info', text: 'A montagem do relatório leva dezenas de segundos: a plataforma junta os demonstrativos, calcula o WACC e espera a proposta da IA. Conteúdo gerado por IA pode ter erros, e o próprio relatório avisa que é ferramenta de apoio, não recomendação.' },
      ],
    },
    {
      id: 'metodos',
      title: 'DCF, múltiplos ou Graham, Bazin e Gordon?',
      blocks: [
        { type: 'p', text: 'Nenhum método é o certo para tudo. Usar mais de um ajuda a checar um pelo outro: se o DCF dá um valor muito diferente dos outros, vale descobrir qual premissa explica a diferença.' },
        {
          type: 'table',
          caption: 'Métodos de valuation comparados',
          head: ['Método', 'Parte de', 'Ajuda quando', 'Cuidado'],
          rows: [
            ['**DCF**', 'Fluxo de caixa projetado e WACC', 'A operação é previsível e os investimentos pesam', 'Muito sensível ao WACC e ao g'],
            ['**Múltiplos (P/L, EV/EBITDA)**', 'Preço de empresas parecidas', 'Há pares comparáveis no setor', 'Herda o otimismo ou o pessimismo do mercado com os pares'],
            ['**Graham**', 'Lucro por ação e valor patrimonial', 'Para uma checagem rápida de empresa lucrativa', 'Não olha crescimento nem dívida'],
            ['**Bazin**', 'Média de dividendos', 'A empresa paga dividendos estáveis', 'Ignora quem reinveste o lucro'],
            ['**Gordon**', 'Dividendo e crescimento', 'Empresas maduras e bancos', 'Exige taxa de desconto maior que o crescimento'],
          ],
        },
        { type: 'p', text: 'Graham, Bazin e Gordon estão na [calculadora de preço justo](/ferramentas/calculadora-preco-justo/), com os dados de cada ação. Para comparar múltiplos entre empresas, o [ranking de ações](/ferramentas/ranking-de-acoes/) ordena os papéis por P/L, P/VP, ROE e dividendos. E, antes de gastar tempo num DCF, uma triagem ajuda a escolher onde olhar: o [Radar de oportunidades](/ferramentas/radar-de-oportunidades/) separa as ações em listas por regras fixas.' },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**Só ações de empresas da B3.** BDRs são bloqueados, e ETFs e fundos imobiliários (FIIs) não são suportados.',
            '**Bancos e seguradoras:** a tela avisa que o DCF padrão não se aplica, porque depósitos e provisões técnicas não são dívida comum e o FCFF perde o sentido. Para essas empresas, desconto de dividendos e múltiplos como P/VP e ROE costumam funcionar melhor.',
            '**Dados incompletos:** quando faltam números no histórico, como Capex e depreciação, as premissas são estimadas e a tela avisa.',
            '**Premissa errada, valor errado.** O DCF amplifica erros de projeção, principalmente no WACC e no g. Olhe a sensibilidade antes de tirar conclusões.',
            '**Não é recomendação.** O preço justo do DCF é uma estimativa feita com as premissas escolhidas, não uma previsão da cotação.',
          ],
        },
        { type: 'p', text: 'Com o preço justo em mãos, registre a [tese de investimento](/ferramentas/tese-de-investimento/): o que precisa acontecer para a premissa se confirmar e o que faria você mudar de ideia.' },
      ],
    },
  ],
  definedTerms: [
    { name: 'Fluxo de caixa descontado (DCF)', description: 'Método de valuation que soma o caixa livre que a empresa deve gerar no futuro, trazido a valor presente pelo custo de capital (WACC).' },
    { name: 'FCFF (fluxo de caixa livre para a firma)', description: 'Caixa gerado pela operação depois de impostos e investimentos, antes de pagar credores e acionistas: EBIT × (1 − IR) + D&A − Capex − Δ capital de giro.' },
    { name: 'WACC', description: 'Custo médio ponderado de capital: Ke × E/V + Kd líquido × D/V. É a taxa que traz os fluxos de caixa a valor presente.' },
    { name: 'Valor terminal', description: 'Valor da empresa depois do último ano projetado, pela perpetuidade de Gordon: FCFF do último ano × (1 + g) ÷ (WACC − g).' },
    { name: 'Crescimento na perpetuidade (g)', description: 'Taxa constante de crescimento do fluxo de caixa depois do último ano projetado. Precisa ser menor que o WACC.' },
    { name: 'Enterprise value (EV)', description: 'Valor da empresa inteira, para acionistas e credores. Menos a dívida líquida, vira o valor do capital próprio (equity).' },
  ],
  faq: [
    {
      q: 'O que é fluxo de caixa descontado (DCF)?',
      a: 'É um método de valuation que estima o valor de uma empresa pelo caixa livre que ela deve gerar no futuro, trazido a valor presente por uma taxa de desconto, o WACC. Do valor da empresa (enterprise value) sai a dívida líquida; o resultado, dividido pelo número de ações, é o preço justo por ação.',
    },
    {
      q: 'Como calcular o fluxo de caixa descontado de uma ação?',
      a: 'Projete receita, custos, despesas e investimentos por alguns anos; na plataforma IAções são 10, sendo 5 explícitos e 5 de convergência. Calcule o FCFF de cada ano, desconte cada um pelo WACC, some o valor presente do valor terminal e subtraia a dívida líquida. Divida o resultado pelo número de ações.',
    },
    {
      q: 'O que é FCFF?',
      a: 'É o fluxo de caixa livre para a firma: o caixa que a operação gera depois de impostos e investimentos, antes de pagar credores e acionistas. A conta é EBIT × (1 − alíquota de IR) + depreciação e amortização − Capex − variação do capital de giro.',
    },
    {
      q: 'O que é WACC e como ele é calculado?',
      a: 'É o custo médio ponderado de capital: Ke × E/V + Kd líquido × D/V. O Ke soma a taxa livre de risco ao beta vezes o prêmio de risco de mercado e, na plataforma, a um prêmio ligado à nota qualitativa da empresa. O Kd é a Selic mais o spread de crédito, descontado o benefício fiscal do IR.',
    },
    {
      q: 'Qual crescimento na perpetuidade (g) usar?',
      a: 'Um g próximo da inflação de longo prazo, ou pouco acima dela, e sempre menor que o WACC. Um g alto demais supõe que a empresa vai crescer mais que a economia para sempre. Na plataforma, a proposta da IA para o g é limitada a 4% ao ano, e você pode mudar o número.',
    },
    {
      q: 'Por que o DCF muda tanto com pequenas mudanças nas premissas?',
      a: `Porque o valor terminal e o desconto acumulado de 10 anos reagem muito ao WACC e ao g. No exemplo desta página, com uma empresa fictícia, 1 ponto percentual a mais no WACC reduz o preço justo em ${pct(-D_WACC, 1)}, e 0,5 ponto a mais no g o aumenta em ${pct(D_G, 1)}. Por isso a tabela de sensibilidade WACC × g faz parte de qualquer DCF.`,
    },
    {
      q: 'A IA faz o valuation por mim?',
      a: 'Não. A IA propõe premissas ancoradas no histórico da empresa, com justificativa, e você decide quais manter: todas podem ser editadas no Modelo DCF Bottom-Up. A IA não revisa as premissas que você muda.',
    },
    {
      q: 'O Valuation funciona para bancos, FIIs e BDRs?',
      a: 'A tela de Valuation avalia ações de empresas listadas na B3: BDRs são bloqueados, e ETFs e fundos imobiliários não são suportados. Para bancos e seguradoras, a tela avisa que o DCF padrão não se aplica, porque depósitos e provisões técnicas não são dívida comum; nesses casos, desconto de dividendos e múltiplos como P/VP e ROE costumam funcionar melhor.',
    },
    {
      q: 'Qual a diferença entre o DCF e os métodos de Graham, Bazin e Gordon?',
      a: 'Graham, Bazin e Gordon partem de poucos números de hoje (lucro e patrimônio, dividendos médios, ou dividendo e crescimento) e dão uma referência rápida. O DCF projeta a operação ano a ano e desconta o caixa da empresa inteira, por isso pede mais premissas e mostra melhor de onde vem o valor. Usar os dois ajuda a checar um pelo outro.',
    },
    {
      q: 'Preciso de conta para usar o Valuation da plataforma?',
      a: 'Sim. A tela de Valuation é aberta a qualquer conta da plataforma, inclusive a gratuita, e o número de análises com IA por dia depende do plano. Esta página e o exemplo da tabela de sensibilidade são abertos a todos, e o conteúdo é educativo, sem recomendação de investimento.',
    },
  ],
  sources: 'Metodologia e rótulos: tela Valuation da plataforma IAções (Modelo DCF Bottom-Up, Premissas refinadas pela IA e Análise de Sensibilidade). Na plataforma, os dados vêm das demonstrações financeiras e cotações da base de mercado (via brapi) e da curva de juros futuros. O exemplo numérico usa uma empresa fictícia, com premissas escolhidas para fins didáticos.',
  contentRevised: '2026-10-07',
};
