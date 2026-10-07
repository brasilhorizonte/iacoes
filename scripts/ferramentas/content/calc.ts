/**
 * Calculadora de preço justo e preço teto (SPEC §3; SPEC-v2 §C Calculadora e §D).
 *
 * Única página de ferramenta que roda inteira no site, grátis: por isso é a única com
 * WebApplication + offers price 0 no JSON-LD (model.pageSchema). O widget `calc`
 * (widgets/calc.js, arquivo próprio no bundle) lê o /valuations.json do build: cotação, LPA,
 * VPA e proventos de cada ação, e os preços justos prontos, que são os mesmos da página do
 * ticker (scripts/lib/valuations-json.ts). Com as premissas padrão, ele mostra esses números;
 * ao mexer, recalcula no navegador.
 *
 * Fonte de verdade: honestidade-rotas.md ("Calculadoras de preço justo"), a ficha do app
 * (QuickValuationPanel / classicValuation.ts) e scripts/ticker/model.ts (premissas do site).
 * O que esta página NÃO pode dizer: que usa IA (são fórmulas fixas), que as premissas são as
 * do app (o app usa margem de 25%, DY mínimo ancorado na taxa livre de risco e r pelo beta,
 * com g de 5%), que serve para FII, ou limites de plano. Acesso (SPEC-v2 §B2): a aba Preço
 * justo do app exige login e é aberta à conta grátis; salvar o preço justo é dos planos pagos.
 * Sem tokens {data}/{n} no texto: a data do dado aparece no widget (o HTML não muda todo dia).
 */
import type { ToolContent } from '../types';

export const calc: ToolContent = {
  id: 'calc',
  slug: 'calculadora-preco-justo',
  status: 'pronto',
  name: 'Calculadora de preço justo',
  keyword: 'calculadora de preço justo',
  title: 'Calculadora de Preço Justo e Preço Teto de Ações | IAções',
  description: 'Calcule o preço justo (Graham e Gordon) e o preço teto (Bazin) de ações da B3, com LPA, VPA e proventos já preenchidos ou com os seus números.',
  h1: 'Calculadora de preço justo e preço teto: Graham, Bazin e Gordon',
  answer: 'A calculadora de preço justo estima o valor de uma ação por Graham e Gordon e o preço teto por Bazin, com cotação, LPA, VPA e proventos de mais de 300 ações da B3 já preenchidos ou com os números que você digitar. As premissas padrão do site são fator 22,5 no Graham, dividend yield mínimo de 6% no Bazin e taxa de 14% com crescimento de 4% no Gordon. A conta roda no seu navegador, sem IA.',
  blurb: 'Preço justo por Graham e Gordon e preço teto por Bazin, com os dados de cada ação ou com os seus números.',
  cta: {
    label: 'Calcular na plataforma',
    // O widget troca o ticker deste link pelo da ação escolhida (o href do servidor nunca fica vazio).
    target: { kind: 'asset', ticker: 'PETR4', tab: 'valuation' },
    screen: 'Preço justo',
    note: 'O botão abre a aba Preço justo da ação escolhida na plataforma, que exige login. Com a conta grátis você calcula os três métodos com as suas premissas; salvar o seu preço justo é dos planos pagos.',
  },
  finalCta: {
    title: 'Leve a conta para a plataforma',
    text: 'Na aba Preço justo da página de cada ação, as mesmas três fórmulas ganham a Memória de Cálculo, o gráfico do preço justo ao longo do tempo e campos para corrigir LPA, VPA e dividendo à mão.',
    label: 'Calcular na plataforma',
  },
  widget: {
    id: 'calc',
    illustrative: false,
    label: 'Calculadora de preço justo e preço teto por Graham, Bazin e Gordon, com os dados das ações da B3 ou com números digitados por você',
    caption: 'Cotação, LPA, VPA e proventos da base do site, atualizada todo dia útil depois do fechamento; a data aparece na calculadora. Premissas padrão do site; mude à vontade.',
    // Aparece enquanto o arquivo do widget carrega e para quem navega sem JavaScript.
    fallback: { kind: 'text', text: 'Carregando a calculadora. Ela roda no seu navegador, com JavaScript; as fórmulas e as premissas padrão estão logo abaixo, em "Como funciona".' },
  },
  dataSource: 'valuations',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é a calculadora de preço justo',
      blocks: [
        { type: 'p', text: 'A **calculadora de preço justo** do IAções estima quanto vale uma ação da B3 por três fórmulas clássicas da análise fundamentalista. Graham e Gordon dão o **preço justo**: o valor que a fórmula atribui à ação com as premissas escolhidas. Bazin dá o **preço teto**: o maior preço que ainda entrega o dividend yield mínimo que você exige.' },
        { type: 'p', text: 'Escolha uma ação e a calculadora traz a cotação, o lucro por ação (LPA), o valor patrimonial por ação (VPA) e a média de proventos: os mesmos números da [página de cada ação](/acoes/), atualizados todo dia útil. Para uma empresa que não está na lista, ou para testar as suas próprias estimativas, use o modo **Digitar números**.' },
        { type: 'p', text: 'Com as premissas padrão do site, o resultado é o mesmo da página da ação. Ao mexer numa premissa, o número muda na hora. A conta roda no seu navegador e não usa inteligência artificial: são fórmulas fixas, com as premissas que você vê na tela.' },
        { type: 'note', tone: 'info', text: 'Preço justo não é previsão de cotação nem recomendação. É uma referência para comparar com o preço de hoje e entender o que o mercado está pagando pela empresa.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona: as três fórmulas',
      blocks: [
        { type: 'p', text: 'Cada método olha para uma parte da empresa. Graham parte do lucro e do patrimônio. Bazin e Gordon partem dos proventos: dividendos e juros sobre capital próprio.' },
        {
          type: 'table',
          caption: 'Fórmulas, premissas padrão do site e faixas de ajuste da calculadora',
          head: ['Método', 'Fórmula', 'Premissa padrão do site', 'Na calculadora'],
          rows: [
            ['**Graham** (preço justo)', '√(22,5 × LPA × VPA)', 'P/L máximo de 15 e P/VP máximo de 1,5 (15 × 1,5 = 22,5), sem margem de segurança', 'P/L de 8 a 25, P/VP de 0,5 a 3 e margem de 0% a 50%'],
            ['**Bazin** (preço teto)', 'média anual de proventos ÷ DY mínimo', 'DY mínimo de 6% sobre a média dos últimos 5 anos', 'DY de 3% a 12% e média de 1, 3, 5 ou 10 anos'],
            ['**Gordon** (preço justo)', 'D₀ × (1 + g) ÷ (r − g)', 'D₀ igual à média de proventos de 5 anos, r de 14% e g de 4%', 'r de 8% a 25%, g de 0% a 10% e média de 1, 3, 5 ou 10 anos'],
          ],
        },
        { type: 'h3', text: 'Graham: lucro e patrimônio' },
        { type: 'p', text: 'Benjamin Graham, em O Investidor Inteligente, sugeriu não pagar mais de 15 vezes o lucro nem mais de 1,5 vez o patrimônio. O produto dos dois limites, 22,5, deu origem ao número de Graham. A margem de segurança, quando você aplica, desconta uma porcentagem do resultado.' },
        { type: 'formula', text: 'Preço justo (Graham) = √(P/L máximo × P/VP máximo × LPA × VPA) × (1 − margem de segurança)' },
        { type: 'p', text: 'A fórmula não se aplica quando o LPA ou o VPA é zero ou negativo: com prejuízo ou patrimônio negativo, a raiz não tem resultado, e a calculadora mostra "não se aplica".' },
        { type: 'h3', text: 'Bazin: o preço teto pelos proventos' },
        { type: 'p', text: 'Décio Bazin, em Faça Fortuna com Ações, propôs um teto de preço para quem investe por renda: o preço em que os proventos rendem pelo menos 6% ao ano. Acima dele, o dividend yield fica abaixo do mínimo.' },
        { type: 'formula', text: 'Preço teto (Bazin) = média anual de proventos por ação ÷ dividend yield mínimo' },
        { type: 'p', text: 'A média é anual e móvel: soma os proventos com data-com nos últimos 12, 36, 60 ou 120 meses e divide pelo número de anos da janela. Entram dividendos e juros sobre capital próprio; restituição de capital fica de fora. Os valores já vêm ajustados por desdobramentos e grupamentos, e os lançamentos repetidos da fonte de dados são filtrados.' },
        { type: 'p', text: 'Janela curta acompanha o momento da empresa, mas dá peso demais a um provento extraordinário. Janela longa suaviza, mas pode refletir uma empresa que já mudou. Quando a média passa de 25% da cotação, a calculadora marca o resultado como provento atípico.' },
        { type: 'h3', text: 'Gordon: desconto de dividendos com crescimento' },
        { type: 'p', text: 'O modelo de Gordon trata a ação como uma sequência de dividendos que cresce a uma taxa constante g para sempre, descontada pela taxa de retorno r que você exige. O dividendo do próximo ano, D₁, é o dividendo base, D₀, corrigido pelo crescimento.' },
        { type: 'formula', text: 'Preço justo (Gordon) = D₁ ÷ (r − g), com D₁ = D₀ × (1 + g)' },
        { type: 'p', text: 'A taxa de desconto precisa ser maior que o crescimento. Com r igual ou menor que g, a fórmula não tem resultado, e a calculadora avisa. Perto disso, o resultado dispara: com r de 14%, subir g de 4% para 6% aumenta o preço justo em cerca de 27%.' },
        { type: 'h3', text: 'As três contas para a mesma empresa' },
        { type: 'ssr', id: 'calc-exemplo' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'Preço justo na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma IAções, as mesmas três fórmulas ficam na aba **Preço justo** da página de cada ação. Lá você também corrige à mão o LPA, o VPA e o dividendo, abre a **Memória de Cálculo** de cada método e vê o gráfico do preço justo ao longo do tempo. O cálculo também é feito no navegador, sem IA.' },
        { type: 'p', text: 'As premissas padrão da plataforma são outras: margem de segurança de 25% no Graham, dividend yield mínimo igual à taxa livre de risco mais 2 pontos percentuais no Bazin e, no Gordon, taxa de desconto calculada a partir da taxa livre de risco e do beta da ação, com crescimento de 5%. A média de proventos também é feita de outro jeito: a plataforma divide a soma da janela pelo número de anos com pagamento. Por isso, os números podem ser diferentes dos desta página.' },
        { type: 'p', text: 'A aba exige login. Com a conta grátis, você calcula os três métodos com as suas premissas; salvar o seu preço justo e vê-lo na tabela de ações é dos planos pagos.' },
        { type: 'p', text: 'Para ir além das fórmulas de lucro e dividendos, a tela Valuation da plataforma monta um [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/) de 10 anos: a IA propõe as premissas a partir do histórico da empresa e você decide.' },
      ],
    },
    {
      id: 'qual-metodo',
      title: 'Graham, Bazin ou Gordon: qual usar',
      blocks: [
        { type: 'p', text: 'Depende do tipo de empresa e da pergunta que você quer responder. Usar os três juntos ajuda a ver a empresa por ângulos diferentes.' },
        {
          type: 'cards',
          items: [
            { title: 'Graham', tone: 'blue', text: 'Combina com empresas lucrativas e com patrimônio relevante, como indústrias e bancos. Funciona mal com prejuízo, patrimônio negativo ou valor concentrado em marcas e tecnologia, que o balanço não mostra.' },
            { title: 'Bazin', tone: 'gold', text: 'Responde a quem investe por renda: até que preço os proventos rendem o mínimo exigido. Serve para pagadoras regulares, como elétricas, saneamento, bancos e seguradoras. Não diz nada sobre quem reinveste o lucro.' },
            { title: 'Gordon', tone: 'emerald', text: 'Acrescenta o crescimento dos proventos e o retorno exigido. É o mais sensível às premissas: pequenas mudanças em r ou em g mudam muito o resultado.' },
          ],
        },
        { type: 'p', text: 'Quando os três divergem muito, a causa costuma ser o payout, a parte do lucro que a empresa distribui. Quem distribui pouco fica com Bazin e Gordon baixos e Graham alto. Para empresas em crescimento, com dívida relevante ou sem dividendos, o caminho é o [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/).' },
      ],
    },
    {
      id: 'preco-justo-e-preco-teto',
      title: 'Preço justo, preço teto e margem de segurança',
      blocks: [
        { type: 'p', text: '**Preço justo** é o valor estimado da ação por uma fórmula. **Preço teto** é o limite de preço de uma estratégia: no Bazin, o preço acima do qual o dividend yield fica abaixo do mínimo. O preço justo responde quanto a ação vale pela fórmula; o preço teto responde até quanto pagar para receber a renda exigida.' },
        { type: 'p', text: '**Margem de segurança** é o desconto que você exige sobre o preço justo para se proteger de erros nas premissas. Com preço justo de R$ 20 e margem de 25%, o preço de referência cai para R$ 15. Na calculadora, a margem vale para o Graham e começa em zero, o padrão do site. No Bazin, o próprio DY mínimo faz esse papel; no Gordon, a taxa de desconto.' },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**Proventos do passado.** Bazin e Gordon usam a média do que já foi pago. Um dividendo extraordinário infla a média, e um corte recente demora a aparecer. Em alguns papéis, a fonte grava o mesmo provento de mais de um jeito e a média sai maior que a real: confira o histórico de proventos na página da ação.',
            '**Lucro de 12 meses.** O Graham usa o LPA dos últimos 12 meses. Um lucro inflado por um evento que não se repete, como a venda de um ativo, infla o preço justo.',
            '**Só empresas.** A calculadora não serve para fundos imobiliários nem ETFs: a base e as fórmulas são de empresas.',
            '**Dados do último fechamento.** Cotação, LPA, VPA e proventos são atualizados todo dia útil depois do fechamento, e a data aparece na calculadora. Não é cotação em tempo real.',
            '**Referência, não recomendação.** O resultado depende das premissas e não diz o que comprar ou vender.',
          ],
        },
      ],
    },
    {
      id: 'depois-do-calculo',
      title: 'Depois do cálculo',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Compare o resultado com a cotação, os indicadores e os proventos na [página da ação](/acoes/).',
            'Veja se a empresa é boa, não só se o preço é bom: a [nota qualitativa](/ferramentas/nota-qualitativa/) avalia governança, gestão, indústria, vantagens competitivas, poder de barganha e riscos.',
            'Registre o seu preço-alvo e os critérios da sua [tese de investimento](/ferramentas/tese-de-investimento/) em Minhas Teses.',
            'Para estudar várias empresas de uma vez, use o [ranking de ações](/ferramentas/ranking-de-acoes/) ou a triagem do [Radar de oportunidades](/ferramentas/radar-de-oportunidades/).',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: 'Como calcular o preço justo de uma ação?',
      a: 'Escolha um método e aplique a fórmula aos números da empresa. Pelo número de Graham, o preço justo é a raiz quadrada de 22,5 × LPA × VPA. Pelo modelo de Gordon, é o dividendo do próximo ano dividido pela diferença entre a taxa de desconto e o crescimento. A calculadora desta página faz as três contas com os dados de cada ação ou com os números que você digitar, no seu navegador e sem inteligência artificial.',
    },
    {
      q: 'Qual é a fórmula de Graham e quando ela não funciona?',
      a: 'A fórmula é √(22,5 × LPA × VPA). O 22,5 vem do P/L máximo de 15 vezes o P/VP máximo de 1,5 sugeridos por Benjamin Graham. Ela não se aplica com LPA ou VPA zero ou negativo. Também funciona mal quando o valor da empresa está em marcas, tecnologia ou crescimento, que o patrimônio não mostra, e quando o lucro de 12 meses foi inflado por um evento que não se repete.',
    },
    {
      q: 'Como calcular o preço teto pelo método Bazin?',
      a: 'Divida a média anual de proventos por ação pelo dividend yield mínimo que você exige. Com média de R$ 1,20 e DY mínimo de 6%, o preço teto é R$ 20,00. A calculadora usa por padrão a média dos últimos 5 anos e deixa você trocar para 1, 3 ou 10 anos: janela curta acompanha o momento da empresa, e janela longa suaviza proventos extraordinários.',
    },
    {
      q: 'Como funciona o modelo de Gordon?',
      a: 'O modelo de Gordon divide o dividendo esperado para o próximo ano, D₁ = D₀ × (1 + g), pela diferença entre a taxa de desconto r e o crescimento g. Ele só tem resultado quando r é maior que g e fica muito sensível quando os dois estão perto. Na calculadora, o padrão é D₀ igual à média de proventos de 5 anos, r de 14% e g de 4%.',
    },
    {
      q: 'Graham ou Bazin: qual usar?',
      a: 'Depende da empresa e do objetivo. Graham olha lucro e patrimônio e serve para empresas lucrativas com patrimônio relevante. Bazin olha só os proventos e serve para quem investe por renda em pagadoras regulares. Usar os dois juntos ajuda: quando eles divergem muito, a causa costuma ser a parte do lucro que a empresa distribui.',
    },
    {
      q: 'Qual a diferença entre preço justo e preço teto?',
      a: 'Preço justo é o valor estimado da ação por uma fórmula, como Graham ou Gordon. Preço teto é o maior preço que ainda cumpre um critério da sua estratégia: no método Bazin, o preço até o qual os proventos rendem o dividend yield mínimo que você exige. Os dois são referências para comparar com a cotação, não previsões.',
    },
    {
      q: 'O que é margem de segurança?',
      a: 'É o desconto que você exige sobre o preço justo para se proteger de erros nas premissas. Com preço justo de R$ 20 e margem de 25%, o preço de referência passa a ser R$ 15. Na calculadora, a margem vale para o Graham e começa em zero, que é o padrão do site.',
    },
    {
      q: 'E o fluxo de caixa descontado (DCF)?',
      a: 'O DCF estima o valor da empresa pelo caixa que ela deve gerar nos próximos anos, descontado pelo custo de capital. É mais completo que Graham, Bazin e Gordon e serve também para empresas que não pagam dividendos. Na plataforma IAções, a tela Valuation monta um DCF de 10 anos em que a IA propõe as premissas a partir do histórico da empresa e você decide.',
    },
    {
      q: 'A calculadora serve para fundos imobiliários (FIIs)?',
      a: 'Não. A base da calculadora só tem papéis de empresas negociados na B3, os mesmos das páginas de cada ação: fundos imobiliários e ETFs ficam de fora. As fórmulas também foram pensadas para empresas: o número de Graham parte do lucro e do patrimônio de uma companhia, e as premissas padrão do site não foram calibradas para os rendimentos de um FII.',
    },
    {
      q: 'De onde vêm os dados e quando são atualizados?',
      a: 'Cotação, LPA, VPA e proventos vêm da base de dados de mercado do IAções, a mesma das páginas de cada ação, atualizada todo dia útil depois do fechamento da bolsa. A data aparece na calculadora. Os proventos são ajustados por desdobramentos e grupamentos, e a média considera dividendos e juros sobre capital próprio com data-com dentro da janela.',
    },
  ],
  definedTerms: [
    { name: 'Preço justo', description: 'Valor estimado de uma ação por um método de valuation, com premissas explícitas. É uma referência para comparar com a cotação, não uma previsão de preço.' },
    { name: 'Valor intrínseco', description: 'Valor de uma empresa calculado pelos fundamentos, como lucro, patrimônio, proventos ou caixa futuro, e não pela cotação. Graham e Gordon estimam o valor intrínseco por ação.' },
    { name: 'Preço teto', description: 'Maior preço que ainda cumpre um critério da estratégia. No método Bazin, é a média anual de proventos dividida pelo dividend yield mínimo exigido.' },
    { name: 'Margem de segurança', description: 'Desconto exigido sobre o preço justo para absorver erros nas premissas. Com margem de 25%, um preço justo de R$ 20 vira um preço de referência de R$ 15.' },
  ],
  sources: 'Cotação, LPA, VPA e proventos: base de dados de mercado do IAções (via brapi), a mesma das páginas de cada ação, atualizada todo dia útil depois do fechamento; proventos ajustados por desdobramentos e grupamentos, com filtro de lançamentos repetidos da fonte. Métodos: número de Graham (Benjamin Graham, O Investidor Inteligente), preço teto de Décio Bazin (Faça Fortuna com Ações) e modelo de crescimento de dividendos de Myron Gordon. O cálculo é feito no navegador de quem usa a página.',
  contentRevised: '2026-10-07',
};
