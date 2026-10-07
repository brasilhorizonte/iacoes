/**
 * Backtest de carteira (SPEC §3; SPEC-v2 §B8, §C Backtest e §D).
 *
 * Fonte de verdade: honestidade-rotas.md (Backtest) e a ficha do app (app-macro-backtest.json,
 * lida em 06/10/2026). O backtest da plataforma testa CARTEIRAS com os pesos de hoje aplicados ao
 * passado (viés), em até 15 anos, buy & hold ou rebalanceamento, com ou sem dividendos, contra
 * Ibovespa, S&P 500, Dólar e CDI. NÃO testa Graham, Bazin, Gordon, teses, filtros nem sinais; não
 * modela custos, impostos, aportes nem resgates. Drawdown, volatilidade e Sharpe ficam só no
 * relatório do Otimizador (planos pagos): o card da aba Carteira não mostra mais essas métricas.
 *
 * Dado REAL (dataSource 'backtest'): Ibovespa × CDI do dados.json do build (DADOS-API §3). A tabela
 * com a data sai da seção SSR `backtest` (sections/backtest.tsx) e o widget lê o mesmo arquivo; o
 * texto perto dos números usa a nota do próprio arquivo (ibov.note). O Ibovespa é índice de RETORNO
 * TOTAL pela metodologia da B3 (proventos reinvestidos): nunca dizer "sem dividendos" sobre ele.
 * Nenhuma curva "Sua carteira" inventada: só o convite para testar a carteira na plataforma.
 *
 * O FAQ "Ibovespa ou CDI" cita os números de 30/09/2026 com a data (o FAQ não aceita token de dado);
 * a tabela da página é refeita com o último mês fechado. Ao revisar o conteúdo, atualize os dois.
 *
 * Acesso (SPEC-v2 §B2): sem link para a tabela de planos e sem limite de plano. A aba Carteira é
 * aberta a qualquer conta; nos planos pagos o backtest roda sozinho; o Otimizador é dos pagos.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const backtest: ToolContent = {
  id: 'backtest',
  slug: 'backtest-de-carteira',
  status: 'pronto',
  name: 'Backtest de carteira',
  keyword: 'backtest de carteira de ações',
  title: 'Backtest de Carteira de Ações B3 vs Ibovespa e CDI | IAções',
  description: 'Simule quanto a sua carteira teria rendido em até 15 anos contra Ibovespa e CDI. Veja Ibovespa × CDI em 1, 5, 10 e 15 anos, com dados até {data}.',
  h1: 'Backtest de carteira de ações: como a sua carteira teria se saído contra o Ibovespa e o CDI',
  answer: 'O backtest de carteira de ações simula quanto a sua carteira teria rendido no passado: aplica os pesos de hoje aos preços de até 15 anos e compara o retorno acumulado com Ibovespa, CDI, S&P 500 e dólar. Abaixo, o Ibovespa e o CDI reais, com dados até {data}.',
  blurb: 'Retorno acumulado da carteira contra Ibovespa, CDI, S&P 500 e dólar em até 15 anos, com a comparação real Ibovespa × CDI.',
  cta: {
    label: 'Testar a minha carteira',
    target: SCREENS.carteira,
    screen: 'Carteira',
    note: 'Comece com uma conta grátis: a aba Carteira é aberta a qualquer conta. Nos planos pagos, o backtest roda sozinho sempre que você muda a carteira, o período ou o rebalanceamento, e o relatório do Otimizador acrescenta drawdown e índice de Sharpe.',
  },
  finalCta: {
    title: 'Teste a sua carteira contra o Ibovespa e o CDI',
    text: 'Cadastre a carteira na aba Carteira e escolha o período, de 1 a 15 anos, o rebalanceamento e os benchmarks. O gráfico mostra o retorno acumulado com e sem dividendos, e a visão Por ativo mostra quanto cada ativo contribuiu.',
    label: 'Testar a minha carteira',
  },
  widget: {
    id: 'backtest',
    illustrative: false,
    label: 'Gráfico com dados reais do Ibovespa e do CDI acumulados, base 100 no início do período, em 1, 5, 10 ou 15 anos',
    caption: 'Ibovespa e CDI reais, base 100 no início de cada período, com dados até {data}. Retornos brutos, sem custos nem impostos. Rentabilidade passada não garante resultado futuro.',
    fallback: { kind: 'text', text: 'Gráfico do Ibovespa e do CDI acumulados em 1, 5, 10 e 15 anos. Os números de cada período estão na tabela Ibovespa × CDI, mais abaixo nesta página.' },
  },
  dataSource: 'backtest',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é backtest de carteira',
      blocks: [
        { type: 'p', text: 'O **backtest de carteira de ações** é uma simulação: pega a carteira que você tem hoje, com os mesmos pesos, e calcula quanto ela teria rendido se você a tivesse montado anos atrás. O resultado é uma curva de retorno acumulado, comparada com referências como o Ibovespa e o CDI.' },
        { type: 'p', text: 'A pergunta que ele responde é direta: a minha seleção de ações teria superado a bolsa e a renda fixa nesse período? A resposta ajuda a entender o comportamento da carteira, em que anos ela ficou para trás e quais ativos puxaram o resultado. Ela não diz como a carteira vai se sair daqui para a frente.' },
        { type: 'p', text: 'Nesta página, você vê o Ibovespa e o CDI reais em 1, 5, 10 e 15 anos, com a data dos dados. A sua carteira entra no mesmo gráfico na plataforma IAções, no Backtest da aba Carteira.' },
      ],
    },
    {
      id: 'ibovespa-x-cdi',
      title: 'Ibovespa × CDI: quanto rendeu cada um',
      blocks: [
        { type: 'p', text: 'O Ibovespa acompanha as ações mais negociadas da B3; o CDI é a taxa que remunera boa parte da renda fixa. Comparar os dois mostra quanto a bolsa pagou, ou deixou de pagar, pelo risco a mais em cada janela de tempo. É a mesma régua que o backtest usa para a sua carteira.' },
        { type: 'ssr', id: 'backtest' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona o backtest',
      blocks: [
        { type: 'p', text: 'O backtest refaz o caminho da carteira como se ela existisse desde o início do período escolhido. São quatro passos:' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**Os pesos:** o peso de cada ativo é o valor da posição hoje (cotação × quantidade) dividido pelo total da carteira. Se houver caixa, ele entra como uma parte rendendo CDI.',
            '**Os preços:** a plataforma busca as cotações diárias de cada ativo no período, de 1 a 15 anos.',
            '**A curva:** os pesos são aplicados no primeiro pregão do período, e o valor da carteira é acompanhado dia a dia, com ou sem o reinvestimento dos proventos.',
            '**A comparação:** os benchmarks começam no mesmo dia que a carteira, e o gráfico mostra o retorno acumulado de cada um desde o início.',
          ],
        },
        { type: 'h3', text: 'Buy & hold ou rebalanceamento' },
        { type: 'p', text: 'No **buy & hold**, a carteira começa com os pesos de hoje e não é ajustada: os pesos mudam conforme os preços sobem ou caem. Com **rebalanceamento**, a carteira volta aos pesos de hoje a cada mês, bimestre, trimestre, semestre ou ano, vendendo parte do que subiu e reforçando o que ficou para trás.' },
        { type: 'note', tone: 'info', text: 'Exemplo ilustrativo: uma carteira começa com 50% na Ação A e 50% na Ação B. Se a Ação A dobra de preço e a Ação B fica parada, a carteira sobe 50% e passa a ter 67% em A e 33% em B. No buy & hold, ela segue assim. Com rebalanceamento, volta a 50% em cada uma na virada do período: vende parte de A e reforça B.' },
        { type: 'h3', text: 'As contas' },
        { type: 'formula', text: 'Retorno acumulado = valor no fim ÷ valor no início − 1' },
        { type: 'formula', text: 'Base 100 no mês m = valor no mês m ÷ valor no início × 100' },
        { type: 'formula', text: 'Retorno equivalente ao ano = (1 + retorno acumulado) ^ (1 ÷ anos) − 1' },
        { type: 'formula', text: 'CDI acumulado = (1 + taxa do 1º mês) × (1 + taxa do 2º mês) × … − 1' },
        { type: 'h3', text: 'Dividendos e benchmarks' },
        { type: 'p', text: 'Com a chave **Dividendos** ligada, os proventos de cada ação são reinvestidos na data-ex, em mais ações da própria empresa, já ajustados por desdobramentos e grupamentos. Desligada, a curva usa só a variação de preço. Os benchmarks seguem as próprias regras:' },
        {
          type: 'list',
          items: [
            '**Ibovespa:** pela metodologia da B3, é um índice de retorno total: os proventos das empresas da carteira teórica são reinvestidos no próprio índice.',
            '**CDI:** a taxa de cada mês, acumulada mês a mês. É a taxa bruta, antes do imposto de renda.',
            '**S&P 500:** entra em pontos, sem dividendos, convertido para reais pelo dólar PTAX do Banco Central.',
            '**Dólar:** a cotação PTAX de venda do Banco Central.',
          ],
        },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'O backtest na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma IAções, o backtest aparece em dois lugares:' },
        {
          type: 'list',
          items: [
            '**Aba Carteira, card Backtest:** fica logo abaixo dos indicadores da carteira. Você escolhe o **Período** (1 ano, 3 anos, 5 anos, 10 anos ou 15 anos), o **Rebalanceamento** (Buy & hold, Mensal, Bimestral, Trimestral, Semestral ou Anual), os benchmarks (Ibovespa, S&P 500, Dólar e CDI), a chave **Dividendos** e a moeda (R$ ou US$). O gráfico **Retorno acumulado** mostra a carteira com e sem dividendos contra os benchmarks, e o painel **Por ativo** alterna entre o retorno de cada ativo (Desempenho) e quanto cada um contribuiu para o resultado (Attribution).',
            '**Relatório do Otimizador, seção 3 · Passado:** aplica ao passado os pesos de hoje e os da carteira escolhida na fronteira eficiente e compara as duas com o Ibovespa e o CDI. Traz as abas Performance, Drawdown e Rolling Returns e métricas como volatilidade, índice de Sharpe e máximo drawdown. Essa seção é dos planos pagos.',
          ],
        },
        { type: 'p', text: 'A simulação da aba Carteira parte de R$ 100.000 e mostra o resultado em porcentagem. Nos planos pagos, ela roda sozinha sempre que você muda a carteira, o período ou o rebalanceamento. Quando um ativo tem histórico mais curto que o período, a tela avisa.' },
        { type: 'note', tone: 'info', text: 'O card da aba Carteira não mostra drawdown, volatilidade nem índice de Sharpe: essas métricas ficam no relatório do Otimizador. O botão **Ver backtest completo no Otimizador** leva até lá.' },
      ],
    },
    {
      id: 'limites',
      title: 'Os limites do backtest',
      blocks: [
        { type: 'p', text: 'Todo backtest tem vieses. Conhecer os limites é o que separa uma leitura útil de uma promessa enganosa:' },
        {
          type: 'list',
          items: [
            '**Pesos de hoje no passado.** A carteira de hoje foi montada com o que você sabe hoje. Aplicada ao passado, ela leva vantagem: ninguém tinha essa carteira há 10 anos.',
            '**Viés de sobrevivência.** Só entram ativos que existem hoje. Empresas que quebraram, fecharam o capital ou saíram da bolsa no caminho não aparecem, e o passado parece melhor do que foi.',
            '**Ativos mais novos que o período.** Um ativo listado depois do início fica de fora no buy & hold e só entra no primeiro rebalanceamento.',
            '**Sem custos.** Corretagem, emolumentos, spread e a diferença entre o preço de tela e o executado não entram. Quanto mais rebalanceamentos, mais esses custos pesariam.',
            '**Sem impostos.** O resultado é bruto: não há desconto de imposto de renda sobre ganhos, proventos ou rendimentos do CDI.',
            '**Sem aportes nem resgates.** A simulação aplica um valor único no início e não modela depósitos ou saques ao longo do tempo.',
            '**Dentro da amostra.** Se a carteira foi escolhida olhando o mesmo período testado, como a da fronteira eficiente no Otimizador, o backtest tende a parecer melhor do que será daqui para a frente.',
            '**Passado não é previsão.** Um bom resultado nos últimos anos não garante o mesmo nos próximos.',
          ],
        },
      ],
    },
    {
      id: 'como-usar',
      title: 'Como usar o backtest no seu estudo',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Cadastre a carteira na aba Carteira com as quantidades reais: os pesos saem do valor de cada posição.',
            'Rode o backtest em mais de um período, como 5, 10 e 15 anos. Como mostra a tabela Ibovespa × CDI, quem ganha muda com a janela.',
            'Escolha o benchmark que responde à sua pergunta: o Ibovespa para comparar com a bolsa brasileira, o CDI para o custo de oportunidade da renda fixa, o S&P 500 e o dólar para a exposição ao exterior.',
            'Abra a visão Por ativo para ver quem puxou o resultado e quem segurou.',
            'Leve a carteira ao [Otimizador](/ferramentas/markowitz/) para ver o risco, o drawdown e o índice de Sharpe e comparar com a fronteira eficiente.',
            'Para estudar cada ação, use o [ranking de ações](/ferramentas/ranking-de-acoes/), a [calculadora de preço justo](/ferramentas/calculadora-preco-justo/) e a [página de cada ação](/acoes/). Para o momento da bolsa como um todo, veja o [Indicador de Buffett do Brasil](/macro/indicador-de-buffett/).',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: 'O que é backtest de carteira?',
      a: 'É uma simulação que aplica os pesos de hoje de uma carteira aos preços do passado para mostrar quanto ela teria rendido, comparada com índices como Ibovespa e CDI. Serve para entender o comportamento da carteira, não para prever o futuro.',
    },
    {
      q: 'Como fazer o backtest de uma carteira de ações?',
      a: 'Na plataforma IAções, cadastre a carteira na aba Carteira e abra o card Backtest. Escolha o período (1, 3, 5, 10 ou 15 anos), buy & hold ou rebalanceamento (mensal, bimestral, trimestral, semestral ou anual), os benchmarks (Ibovespa, S&P 500, Dólar e CDI) e se os dividendos entram. O gráfico mostra o retorno acumulado, e a visão Por ativo mostra o retorno e a contribuição de cada ativo.',
    },
    {
      q: 'Ibovespa ou CDI: quem rendeu mais em 10 e 15 anos?',
      a: 'Depende da janela. Com dados até 30/09/2026, em 10 anos (do fim de setembro de 2016 ao fim de setembro de 2026) o Ibovespa acumulou 219,3% e o CDI, 144,4%. Em 15 anos (desde o fim de setembro de 2011), o CDI acumulou 308,8% e o Ibovespa, 256,1%. São retornos brutos, sem custos nem impostos, e o Ibovespa já inclui os proventos reinvestidos. A tabela desta página traz os números do último mês fechado.',
    },
    {
      q: 'O backtest considera custos de corretagem e taxas?',
      a: 'Não. A simulação não desconta corretagem, emolumentos da B3, spread nem a diferença entre o preço de tela e o preço executado. Em carteiras com rebalanceamento frequente, esses custos tendem a pesar mais, e o resultado real fica abaixo do simulado.',
    },
    {
      q: 'O backtest desconta o imposto de renda?',
      a: 'Não. Os retornos são brutos: não há desconto de imposto sobre o ganho na venda de ações, sobre os proventos nem sobre os rendimentos atrelados ao CDI. Como a tributação depende de cada situação, considere o imposto que você pagaria de fato ao comparar.',
    },
    {
      q: 'O backtest considera dividendos?',
      a: 'Sim. Na plataforma, a chave Dividendos reinveste os proventos de cada ação na data-ex, e o gráfico mostra a carteira com e sem dividendos. O Ibovespa já é um índice de retorno total, com os proventos reinvestidos pela metodologia da B3. O S&P 500 entra em pontos, sem dividendos, convertido pelo dólar PTAX, e ativos estrangeiros entram sem proventos.',
    },
    {
      q: 'O que é viés de sobrevivência no backtest?',
      a: 'É a distorção de testar só o que sobreviveu. O backtest usa os ativos que existem hoje, então empresas que quebraram ou saíram da bolsa no caminho não aparecem, e uma carteira montada hoje tende a reunir quem deu certo. Por isso o passado costuma parecer melhor do que foi para quem investiu na época.',
    },
    {
      q: 'Rentabilidade passada garante rentabilidade futura?',
      a: 'Não. O backtest mostra como a carteira teria se comportado num período que já passou, com os pesos de hoje. Juros, lucros das empresas e preços mudam, e um bom resultado nos últimos anos não garante o mesmo nos próximos.',
    },
    {
      q: 'O backtest testa estratégias como Graham ou Bazin?',
      a: 'Não. O backtest da plataforma testa carteiras: aplica os pesos de hoje aos preços do passado. Ele não testa preços justos de Graham, Bazin ou Gordon, teses, filtros nem sinais de compra e venda.',
    },
    {
      q: 'Qual a diferença entre buy & hold e rebalanceamento?',
      a: 'No buy & hold, a carteira começa com os pesos de hoje e não é ajustada: os pesos mudam conforme os preços sobem ou caem. Com rebalanceamento, a carteira volta aos pesos de hoje a cada mês, bimestre, trimestre, semestre ou ano, vendendo parte do que subiu e reforçando o que ficou para trás.',
    },
  ],
  definedTerms: [
    { name: 'Backtest de carteira', description: 'Simulação que aplica os pesos atuais de uma carteira aos preços do passado para medir quanto ela teria rendido, em comparação com índices de referência.' },
    { name: 'Benchmark', description: 'Índice de referência usado para comparar o resultado de uma carteira, como o Ibovespa para ações brasileiras e o CDI para a renda fixa.' },
    { name: 'Índice de retorno total', description: 'Índice que soma à variação dos preços os proventos pagos, como se fossem reinvestidos. Pela metodologia da B3, o Ibovespa é um índice de retorno total.' },
    { name: 'Viés de sobrevivência', description: 'Distorção de quem testa só os ativos que existem hoje: empresas que quebraram ou saíram da bolsa somem da amostra, e o passado parece melhor do que foi.' },
    { name: 'Rebalanceamento', description: 'Ajuste periódico que devolve a carteira aos pesos-alvo, vendendo parte do que subiu e reforçando o que ficou para trás.' },
    { name: 'Drawdown', description: 'Queda do valor da carteira desde o pico anterior até o vale seguinte, em porcentagem. O máximo drawdown é a maior dessas quedas no período.' },
  ],
  sources: 'Ibovespa: pontos de fechamento do índice (B3), via brapi; pela metodologia da B3, o Ibovespa é um índice de retorno total. CDI: taxa mensal da série 4390 do Sistema Gerenciador de Séries Temporais (SGS) do Banco Central, acumulada mês a mês. Retornos brutos, sem custos nem impostos. Funcionamento do backtest: aba Carteira e relatório do Otimizador da plataforma IAções.',
  contentRevised: '2026-10-07',
};
