/**
 * Ranking de ações (SPEC §3; SPEC-v2 §C Ranking e §D) — página com DADO REAL do build.
 * scripts/ferramentas/data.ts (buildRanking) escreve /ferramentas/ranking-de-acoes/dados.json
 * (DADOS-API §1); a seção SSR sections/ranking.tsx desenha as quatro abas (DY 12m com a média de
 * 5 anos ao lado, P/L, P/VP e ROE; 20 empresas cada; mediana do setor; data do dado); as props do
 * bloco dizem quais abas viram o ItemList do JSON-LD (model.ts); o widget widgets/ranking.js mostra
 * os primeiros de cada aba com reordenação.
 *
 * Honestidade (honestidade-rotas.md, Rankings): ordenação por indicador objetivo, não recomendação;
 * nenhum rótulo de valor sobre as ações (os termos proibidos só do ranking estão em site.ts, e o
 * Radar aparece só como "Radar"); a tela Rankings do app é parcial no plano grátis (filtros,
 * screeners e exportação são dos planos pagos), não tem filtro de liquidez nem filtros salvos, e o
 * "ROIC" dela é ROA — a página não promete nada disso. Os cortes citados no texto são os de
 * RANKING_DEFAULTS (data.ts). Tokens: {data} = data da cotação (dd/mm/aaaa), {n} = empresas.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const ranking: ToolContent = {
  id: 'ranking',
  slug: 'ranking-de-acoes',
  status: 'pronto',
  name: 'Rankings de ações',
  keyword: 'ranking de ações',
  title: 'Ranking de Ações B3: Dividendos, P/L, P/VP e ROE | IAções',
  description: 'Ranking de ações da B3 por dividend yield, P/L, P/VP e ROE, com a mediana do setor e dados de {data}. Ordenação por indicador, não recomendação.',
  h1: 'Ranking de ações da B3 por dividendos, P/L, P/VP e ROE',
  answer: 'Este ranking de ações da B3 ordena {n} empresas com valor de mercado a partir de R$ 1 bilhão por dividend yield de 12 meses, P/L, P/VP e ROE, com dados de {data}. É uma ordenação por indicador objetivo, para estudo, e não uma recomendação de investimento.',
  blurb: 'Ações da B3 ordenadas por dividend yield, P/L, P/VP e ROE, com a mediana do setor e o dado do último pregão.',
  cta: {
    label: 'Abrir os Rankings',
    target: SCREENS.rankings,
    screen: 'Rankings',
    note: 'A tela Rankings da plataforma pede login. Com a conta grátis você vê a tabela e ordena pelos principais indicadores; os filtros, os screeners prontos e a exportação em CSV fazem parte dos planos pagos.',
  },
  finalCta: {
    title: 'Combine critérios na plataforma',
    text: 'Na tela Rankings, você ordena por P/L, DY, ROE ou preço justo, compara até 5 ações lado a lado e monta uma simulação de carteira com as escolhidas. Nos planos pagos, combina filtros por setor, porte e faixas de indicadores e usa os screeners prontos.',
    label: 'Abrir os Rankings',
  },
  widget: {
    id: 'ranking',
    illustrative: false,
    label: 'Ranking de ações da B3 por dividend yield, P/L, P/VP e ROE, com dados reais do último pregão',
    caption: 'Os primeiros de cada aba, com dados de {data}. Ordenação por indicador, não recomendação; as listas completas estão logo abaixo.',
  },
  dataSource: 'ranking',
  sections: [
    {
      id: 'ranking',
      title: 'Ranking de ações por indicador',
      // itemList/itemLimit: abas e linhas por aba que viram o ItemList do JSON-LD (model.ts, itemListFor).
      blocks: [{ type: 'ssr', id: 'ranking', props: { itemList: ['dy', 'pl', 'pvp', 'roe'], itemLimit: 8 } }],
    },
    {
      id: 'o-que-e',
      title: 'O que é um ranking de ações',
      blocks: [
        { type: 'p', text: 'Um **ranking de ações** põe as empresas da bolsa em ordem por um indicador objetivo: quem pagou mais proventos em relação à cotação, quem tem o menor preço em relação ao lucro ou ao patrimônio, quem tem a maior rentabilidade sobre o patrimônio. É o jeito mais rápido de sair de centenas de papéis para uma lista curta, que você estuda com calma.' },
        { type: 'p', text: 'Este ranking usa quatro indicadores clássicos da análise fundamentalista: dividend yield (DY) de 12 meses, P/L, P/VP e ROE. Cada aba mostra as 20 primeiras empresas e, ao lado de cada uma, a mediana do setor. No DY aparece também a média de 5 anos, que ajuda a separar o provento recorrente do pontual.' },
        { type: 'p', text: 'Ordenar não é avaliar. Um indicador sozinho não diz se o preço está justo: um P/L baixo pode vir de um lucro que vai cair, e um DY alto, de um provento que não se repete. Use a lista como ponto de partida e confira o valor da empresa na [página de cada ação](/acoes/), com o preço justo por Graham, Bazin e Gordon, e na [calculadora de preço justo](/ferramentas/calculadora-preco-justo/).' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como o ranking é montado',
      blocks: [
        { type: 'p', text: 'O ranking é refeito todo dia útil, à noite, depois do fechamento da bolsa, com a última cotação disponível. A data do dado aparece acima das tabelas e no quadro do topo da página.' },
        { type: 'h3', text: 'Quem entra' },
        {
          type: 'list',
          items: [
            'Empresas com valor de mercado a partir de **R$ 1 bilhão** e cotação dos últimos 7 dias.',
            '**Uma classe de ação por empresa:** entre a ordinária, a preferencial e a unit de uma mesma companhia, fica a mais negociada em reais no pregão.',
            'Sem BDRs, fundos imobiliários e ETFs.',
            'Só ações com página no IAções, para que cada linha leve à análise completa.',
          ],
        },
        { type: 'h3', text: 'As contas e os cortes de cada aba' },
        {
          type: 'table',
          caption: 'Conta, ordem e corte de cada aba do ranking',
          head: ['Aba', 'Como é calculado', 'Ordem e corte'],
          rows: [
            ['**DY 12m**', 'Proventos com data-com nos últimos 12 meses ÷ cotação', 'Maior primeiro. Entra o DY positivo de até 25% e de até 2 vezes a média de 5 anos; acima disso, é provento atípico e fica fora da aba'],
            ['**P/L**', 'Cotação ÷ lucro por ação dos últimos 12 meses', 'Menor primeiro. Entra o P/L a partir de 0,1 e abaixo de 100; empresa com prejuízo fica de fora'],
            ['**P/VP**', 'Cotação ÷ valor patrimonial por ação', 'Menor primeiro. Entra o P/VP de 0,2 a 20'],
            ['**ROE**', 'Lucro dos últimos 12 meses ÷ patrimônio líquido', 'Maior primeiro. Entra o ROE positivo de até 100%'],
          ],
        },
        { type: 'formula', text: 'Média de 5 anos = média anual dos proventos dos últimos 5 anos ÷ cotação de hoje' },
        { type: 'p', text: 'Os proventos são os dividendos e os juros sobre capital próprio, ajustados por desdobramento e grupamento e sem as duplicatas da fonte. Restituição de capital e data-com futura não entram na conta.' },
        { type: 'p', text: 'Nas abas P/L, P/VP e ROE, o último balanço publicado precisa ter no máximo 200 dias, e o P/L e o P/VP da base precisam bater com a conta feita a partir da cotação, com diferença de até 5%. Número que não fecha fica fora da aba, porque costuma ser erro de dado.' },
        { type: 'h3', text: 'Provento atípico' },
        { type: 'p', text: 'A marca **provento atípico** vale para a ação cujos proventos dos últimos 12 meses passam do dobro da média anual de 5 anos, ou cujo DY de 12 meses passa de 25%. Ela fica fora da aba DY e continua normalmente nas abas de P/L, P/VP e ROE. Em geral, é um dividendo extraordinário, que não se repete, ou uma empresa que passou a pagar proventos há pouco tempo e ainda não tem histórico.' },
        { type: 'p', text: 'Um exemplo do mecanismo: no fim de 2025, várias empresas aprovaram dividendos extraordinários antes de a nova regra de tributação de dividendos começar a valer. Esses pagamentos pesam no DY de 12 meses até completar um ano da data-com, sem dizer nada sobre os proventos dos anos seguintes. A marca é uma régua automática, não um julgamento da empresa: confira os proventos ano a ano na página da ação.' },
        { type: 'h3', text: 'A mediana do setor' },
        { type: 'p', text: 'Ao lado de cada número aparece a mediana do setor: o valor do meio entre as empresas do mesmo setor neste ranking, só com números dentro dos cortes. No DY, a conta inclui quem não pagou proventos em 12 meses. Com menos de 3 empresas no setor, ela fica em branco. A mediana é uma régua para comparar a empresa com as parecidas, não um alvo.' },
      ],
    },
    {
      id: 'como-usar',
      title: 'Como usar o ranking no seu estudo',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Escolha a aba que responde à sua pergunta: renda (DY), preço em relação ao lucro (P/L), preço em relação ao patrimônio (P/VP) ou rentabilidade (ROE).',
            'Compare cada número com a mediana do setor. Bancos, elétricas e varejo negociam a múltiplos diferentes: a régua certa é o setor.',
            'Na aba DY, olhe a média de 5 anos ao lado. Um DY de 12 meses muito acima dela costuma ser provento que não se repete.',
            'Cruze os indicadores: P/VP baixo com ROE baixo conta uma história diferente de P/VP baixo com ROE alto.',
            'Abra a página da ação: preço justo por Graham, Bazin e Gordon, demonstrações financeiras de 10 anos e proventos. Acompanhe também os [fatos relevantes](/ferramentas/fatos-relevantes/) da empresa.',
            'Se a ideia continuar de pé, avalie o negócio com a [nota qualitativa](/ferramentas/nota-qualitativa/) e registre a sua [tese de investimento](/ferramentas/tese-de-investimento/), com preço-alvo e critérios.',
          ],
        },
        { type: 'h3', text: 'Cotação baixa não quer dizer preço baixo' },
        { type: 'p', text: 'Uma ação de R$ 2 não está mais em conta que uma de R$ 50 só por causa da cotação. O que compara o preço com a empresa são os múltiplos, como P/L e P/VP, e o valuation, que estima quanto a empresa vale. Para essa conta, use a [calculadora de preço justo](/ferramentas/calculadora-preco-justo/) ou monte um [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/) na plataforma.' },
        { type: 'p', text: 'Para o retrato da bolsa inteira, e não de uma empresa, acompanhe o [Indicador de Buffett](/macro/indicador-de-buffett/), que compara o valor de mercado das empresas listadas com o PIB.' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'Os Rankings na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma IAções, a tela **Rankings** é uma tabela com os papéis da base, sem BDRs e ETFs, que você ordena clicando no cabeçalho das colunas. Ela vai além das quatro listas desta página:' },
        {
          type: 'list',
          items: [
            '**Preço justo** por Graham, Bazin e Gordon e a média dos três, com a diferença para a cotação. Sem um número salvo por você, a tela usa as premissas padrão e marca o valor com "~".',
            '**Colunas** de P/L, EV/EBIT, DY, ROE, beta, volatilidade e queda máxima, e mais de 60 colunas extras de margens, dívida, balanço e geração de caixa.',
            '**Filtros** por setor, porte, faixas de indicadores, margens, crescimento, geração de caixa e Nota Qualitativa mínima, além de quatro screeners prontos.',
            '**Comparar** até 5 ações lado a lado e montar uma simulação de carteira com as selecionadas.',
            '**Exportar CSV** com as colunas e as ações que você escolher.',
          ],
        },
        { type: 'p', text: 'Com a conta grátis, você vê a tabela e ordena pelos principais indicadores. Os filtros, os screeners prontos e a exportação fazem parte dos planos pagos. Clicar em um ticker abre a página da ação na plataforma, com preço justo, indicadores, proventos, documentos da CVM e a sua tese.' },
        { type: 'p', text: 'Nos planos pagos, a aba **Radar** traz outras quatro listas Top 20 (menor P/L, maior ROE, maior DY e maior crowdedness), recalculadas toda vez que você abre a tela e já sem as empresas com risco elevado. Veja como o [Radar](/ferramentas/radar-de-oportunidades/) funciona.' },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**Um indicador por vez.** Cada aba ordena por um número só. Uma empresa sólida pode ficar fora de todas as listas, e uma empresa em dificuldade pode aparecer no topo de uma delas.',
            '**Retrato do fim do dia.** O ranking é refeito uma vez por dia útil, à noite. No pregão seguinte, a cotação muda e os indicadores também.',
            '**Balanço publicado.** P/L, P/VP e ROE usam o último demonstrativo publicado. Um fato posterior só entra no número com o balanço seguinte.',
            '**Proventos da fonte.** O DY e a média de 5 anos dependem do cadastro de proventos. Um provento gravado em dobro ou fora de data infla o número; os cortes da aba DY e a marca de provento atípico reduzem esse risco, mas não o eliminam.',
            '**Sem filtro de liquidez.** O corte é por valor de mercado, não por volume negociado. Confira a liquidez do papel antes de qualquer decisão.',
            '**Não é recomendação.** A lista ordena números. Não diz o que fazer com eles.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: 'Como o ranking de ações é calculado e quando é atualizado?',
      a: 'O ranking é refeito todo dia útil, à noite, depois do fechamento, com a última cotação disponível. Entram empresas com valor de mercado a partir de R$ 1 bilhão, uma classe de ação por empresa, sem BDRs, fundos imobiliários e ETFs. Cada aba ordena por um indicador (DY de 12 meses, P/L, P/VP ou ROE), aplica cortes para tirar números fora da realidade e mostra as 20 primeiras. A data do dado aparece acima das tabelas.',
    },
    {
      q: 'Ação de cotação baixa está mais em conta?',
      a: 'Não necessariamente. A cotação sozinha não diz se o preço é alto ou baixo em relação à empresa: uma ação de R$ 3 pode custar 30 vezes o lucro, e uma de R$ 80, 5 vezes. Para comparar preço e empresa, use múltiplos como P/L e P/VP e, depois, um valuation, que estima quanto a empresa vale.',
    },
    {
      q: 'P/VP abaixo de 1 quer dizer que a ação está com desconto?',
      a: 'Não necessariamente. P/VP abaixo de 1 quer dizer que a bolsa avalia a empresa por menos que o patrimônio líquido do balanço. Pode ser desconto, mas também patrimônio que vale menos do que o registrado, rentabilidade baixa ou um risco que o balanço ainda não mostra. Compare com a mediana do setor e com o ROE da empresa.',
    },
    {
      q: 'Qual P/L é considerado baixo?',
      a: 'Depende do setor e do crescimento esperado do lucro. Setores maduros costumam negociar a P/L menores que os de crescimento rápido, e um lucro em alta justifica um P/L maior. Por isso o ranking mostra a mediana do setor ao lado de cada empresa. Um P/L muito abaixo da mediana pode ser desconto ou sinal de que o mercado espera um lucro menor.',
    },
    {
      q: 'Dividend yield muito alto pode ser uma armadilha?',
      a: 'Pode. Um DY alto às vezes vem de um provento extraordinário, que não se repete, ou de uma cotação que caiu por problema da empresa. Por isso o ranking mostra a média de 5 anos ao lado do DY de 12 meses e tira da aba DY quem passa de 25% ou de 2 vezes a própria média de 5 anos. Esses casos aparecem à parte, marcados como provento atípico.',
    },
    {
      q: 'O que quer dizer provento atípico?',
      a: 'É a marca que o ranking dá quando os proventos dos últimos 12 meses passam do dobro da média anual de 5 anos, ou quando o DY de 12 meses passa de 25%. Em geral é um dividendo extraordinário, que não se repete, ou uma empresa que passou a pagar há pouco tempo. A ação fica fora da aba DY e continua nas abas de P/L, P/VP e ROE.',
    },
    {
      q: 'Qual a diferença entre este ranking e a página Ações da B3?',
      a: 'A página Ações da B3 é o diretório: reúne as ações com página no IAções, agrupadas por setor, com cotação, P/L, DY e valor de mercado. Este ranking é um recorte ordenado: só empresas a partir de R$ 1 bilhão, uma classe por empresa, com cortes para números fora da realidade e as 20 primeiras de cada indicador, ao lado da mediana do setor.',
    },
    {
      q: 'Por que uma ação conhecida não aparece no ranking?',
      a: 'Os motivos mais comuns são valor de mercado abaixo de R$ 1 bilhão, outra classe da mesma empresa mais negociada no dia, balanço com mais de 200 dias, número fora do corte da aba (prejuízo, P/L acima de 100 ou provento atípico) ou não estar entre as 20 primeiras daquele indicador. A empresa continua com a própria página no IAções.',
    },
    {
      q: 'Dá para filtrar por setor ou por liquidez?',
      a: 'Nesta página, não: as listas são fixas e trazem a mediana do setor como referência. Na tela Rankings da plataforma, os filtros por setor, porte e faixas de indicadores fazem parte dos planos pagos. Não há filtro por volume negociado: a liquidez aparece só como crowdedness, que compara o volume do último pregão com a média de 10 pregões.',
    },
    {
      q: 'O ranking é recomendação de investimento?',
      a: 'Não. É uma ordenação por indicador objetivo, para estudo. Estar no topo de uma lista não quer dizer que a ação vai subir nem que o preço está justo. A decisão depende da sua análise do valor da empresa, dos riscos e dos documentos que ela publica.',
    },
  ],
  sources: 'Cotação, valor de mercado, P/L, P/VP, ROE e setor: base de cotações da plataforma IAções (dados de mercado via brapi). Proventos: base de proventos da plataforma, ajustados por desdobramento e grupamento e sem as duplicatas da fonte. Data do último balanço: demonstrações financeiras da base. Ranking refeito todo dia útil, à noite.',
  contentRevised: '2026-10-07',
};
