/**
 * Score Qualitativo (nota qualitativa) — /ferramentas/nota-qualitativa/ (SPEC §3; SPEC-v2 §C Nota).
 *
 * Busca com demanda: "como avaliar uma empresa para investir" (kw-2: o how-to tem demanda; "nota" e
 * "score" quase não). Ângulo: guia dos 6 pilares + checklist interativo em que a pessoa dá a PRÓPRIA
 * nota (widget `nota`, dado do próprio usuário) com a mesma ponderação do app.
 *
 * Fonte de verdade (honestidade-rotas.md, Score; app-score-teses.json; analyze-governance do app,
 * lido em 07/10/2026, v1 do main e v2 do branch):
 *  - escala de 1 a 4 (1 = pior; Forte 4, Satisfatório 3, Médio 2, Fraco 1). Nunca "0 a 4" nem "/10";
 *  - 6 categorias reais e 53 perguntas: Governança 11; Management, Indústria e Vantagens Competitivas /
 *    Barreiras à Entrada 10 cada; Poder de Barganha e Riscos e Estrutura 6 cada;
 *  - nota da categoria = média das perguntas dela; nota final = média simples das 53 (2 casas). Não há
 *    peso configurado por categoria: o peso vem do nº de perguntas (nunca "pesos definidos por
 *    especialistas");
 *  - gerada por IA seguindo critérios objetivos (Formulário de Referência, demonstrações, dados de
 *    mercado; "fontes públicas" = o que o modelo já sabe: a chamada ao Gemini não tem busca na web,
 *    nem na v1 nem na v2); sem informação, a pergunta fica com 2. Não há revisão humana
 *    no código: nunca "auditada por analista". A parte apurada por cálculo (v2) não é anunciada;
 *  - recálculo em lotes manuais, não diário;
 *  - acesso: aba Score = plano IAções (e login); página da ação = nota final, 6 categorias e radar
 *    abertos a qualquer conta, inclusive a grátis; resumo e evolução = IAções; perguntas e respostas =
 *    Fundamentalista. Sem link para /#precos e sem limites de plano (SPEC-v2 §B2);
 *  - não confundir com o Qualitativo (relatório por IA sob demanda, que não muda a nota);
 *  - régua de cor do app: acima de 3,2 dourado, de 2,9 a 3,2 neutro, abaixo de 2,9 vermelho;
 *  - boa empresa não é bom preço; não é recomendação; nenhuma contagem de cobertura.
 * Exemplos com número usam só a "Ação A", fictícia, com selo (SPEC §1). Os critérios citados (Forte e
 * Fraco) são os extremos que valem igual na v1 e na v2 da metodologia. A pergunta da dívida (c6q6)
 * fica de fora de propósito: no texto da metodologia o Forte exige rating A/AA/AAA E Dív./EBITDA < 1x,
 * e a v2 apura por código só a dívida líquida/EBITDA — o mesmo exemplo não vale nas duas versões.
 * A nota não "ignora a cotação" (o modelo recebe preço e múltiplos como contexto): o que é verdade é
 * que nenhuma pergunta compara preço com valor — é assim que a página diz.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

/** As 6 categorias, com o nome da tela e o número de perguntas (o peso na nota final). */
export const NOTA_PILARES = [
  { name: 'Governança', short: 'Governança', questions: 11 },
  { name: 'Management', short: 'Management', questions: 10 },
  { name: 'Indústria', short: 'Indústria', questions: 10 },
  { name: 'Vantagens Competitivas / Barreiras à Entrada', short: 'Vantagens', questions: 10 },
  { name: 'Poder de Barganha', short: 'Barganha', questions: 6 },
  { name: 'Riscos e Estrutura', short: 'Riscos', questions: 6 },
] as const;

export const nota: ToolContent = {
  id: 'nota',
  slug: 'nota-qualitativa',
  status: 'pronto',
  name: 'Score Qualitativo',
  keyword: 'como avaliar uma empresa para investir',
  title: 'Como Avaliar uma Empresa para Investir (Checklist) | IAções',
  description: 'Como avaliar uma empresa para investir: checklist de governança, gestão, setor, vantagens, barganha e riscos, com nota de 1 a 4 em cada pilar.',
  h1: 'Como avaliar uma empresa para investir: a nota qualitativa de 1 a 4',
  answer: 'Saber como avaliar uma empresa para investir começa por seis pilares do negócio: governança, gestão, indústria, vantagens competitivas, poder de barganha e riscos. A nota qualitativa da IAções dá a cada pilar uma nota de 1 a 4 (1 é a pior), a partir de 53 perguntas com critérios objetivos respondidas por IA. Não é recomendação.',
  blurb: 'Checklist dos 6 pilares para avaliar uma empresa e a nota qualitativa de 1 a 4 da plataforma, gerada por IA com critérios objetivos.',
  cta: {
    label: 'Abrir o Score Qualitativo',
    target: SCREENS.score,
    screen: 'Score',
    note: 'A aba Score faz parte do plano IAções e exige login. A nota de cada empresa coberta, com as 6 categorias, também aparece na [página da ação na plataforma](#ver-nota), aberta a qualquer conta, inclusive a grátis.',
  },
  finalCta: {
    title: 'Veja a nota qualitativa das empresas na plataforma',
    text: 'Na aba Score, do plano IAções, compare até 5 empresas pelas 6 categorias e veja a evolução da nota. A nota de cada empresa coberta também aparece na página da ação, aberta a qualquer conta.',
    label: 'Abrir o Score Qualitativo',
  },
  widget: {
    id: 'nota',
    illustrative: true,
    label: 'Checklist interativo dos 6 pilares da nota qualitativa: dê a sua nota de 1 a 4 a cada pilar e veja a nota final ponderada pelo número de perguntas',
    caption: 'O checklist não usa dado de nenhuma empresa: as notas são suas e não são enviadas nem guardadas. A conta é a da plataforma: cada pilar pesa pelo número de perguntas (11, 10, 10, 10, 6 e 6, de 53).',
    fallback: { kind: 'chips', items: NOTA_PILARES.map((p) => p.name) },
  },
  dataSource: 'evergreen',
  sections: [
    {
      id: 'o-que-e',
      title: 'Como avaliar uma empresa para investir',
      blocks: [
        { type: 'p', text: 'Saber **como avaliar uma empresa para investir** é separar duas perguntas. A primeira é se o negócio é bom: quem manda, quem administra, em que setor ele compete e o que o protege da concorrência. A segunda é se o preço da ação faz sentido. Esta página trata da primeira; a segunda é trabalho do valuation.' },
        { type: 'p', text: 'A primeira pergunta pede **análise qualitativa**: olhar o que o balanço ainda não mostra. Um lucro alto vale menos do que parece quando o controlador decide contra o acionista minoritário, quando um único cliente responde por metade das vendas ou quando a receita depende de um contrato com o governo.' },
        { type: 'p', text: 'Para organizar essa leitura, a IAções usa seis pilares: Governança, Management, Indústria, Vantagens Competitivas / Barreiras à Entrada, Poder de Barganha e Riscos e Estrutura. Cada pilar reúne perguntas objetivas, e cada pergunta recebe uma nota de 1 a 4. O resultado é a **nota qualitativa**, que a plataforma mostra na tela **Score**. O checklist no topo desta página usa os mesmos pilares e a mesma conta para você chegar à sua própria nota.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona a nota qualitativa de 1 a 4',
      blocks: [
        { type: 'p', text: 'A nota segue a metodologia qualitativa da Brasil Horizonte: 53 perguntas divididas em 6 categorias. Cada pergunta tem critérios escritos para quatro níveis: **Forte (4)**, **Satisfatório (3)**, **Médio (2)** e **Fraco (1)**. Na escala, 1 é a pior nota e 4 a melhor.' },
        { type: 'p', text: 'Quem responde é um modelo de inteligência artificial. Ele lê o **Formulário de Referência** que a empresa entrega à CVM, as demonstrações financeiras e indicadores de mercado. Quando a informação não está nesses documentos, o modelo usa o que já sabe de fontes públicas: ele não faz busca na internet, então essa parte pode estar desatualizada. Cada nota sai com uma justificativa curta. Quando a informação não aparece em lugar nenhum, a pergunta recebe a nota 2, com o aviso de que faltou informação.' },
        { type: 'h3', text: 'O peso de cada pilar' },
        { type: 'p', text: 'A nota de cada categoria é a média das perguntas dela. A nota final é a média simples das 53 perguntas, com duas casas decimais. Não existe um peso escolhido para cada categoria: o peso vem do número de perguntas. Por isso Governança, com 11 perguntas, pesa quase o dobro de Poder de Barganha, com 6.' },
        {
          type: 'table',
          caption: 'Número de perguntas e peso de cada pilar na nota final',
          head: ['Pilar', 'Perguntas', 'Peso na nota final'],
          rows: [
            ['**Governança**', '11 perguntas', '20,8%'],
            ['**Management**', '10 perguntas', '18,9%'],
            ['**Indústria**', '10 perguntas', '18,9%'],
            ['**Vantagens Competitivas / Barreiras à Entrada**', '10 perguntas', '18,9%'],
            ['**Poder de Barganha**', '6 perguntas', '11,3%'],
            ['**Riscos e Estrutura**', '6 perguntas', '11,3%'],
          ],
        },
        { type: 'formula', text: 'Nota final = (11 × Governança + 10 × Management + 10 × Indústria + 10 × Vantagens + 6 × Barganha + 6 × Riscos) ÷ 53' },
        { type: 'h3', text: 'Exemplo: a conta da nota final' },
        { type: 'p', text: 'Exemplo ilustrativo com uma empresa fictícia, a Ação A. A soma das notas de cada pilar, dividida pelo número de perguntas, dá a média do pilar; a soma de tudo, dividida por 53, dá a nota final.' },
        {
          type: 'table',
          caption: 'Exemplo ilustrativo: notas da Ação A, empresa fictícia',
          head: ['Pilar', 'Perguntas', 'Soma das notas', 'Média do pilar'],
          rows: [
            ['**Governança**', '11 perguntas', '35', '3,18'],
            ['**Management**', '10 perguntas', '30', '3,00'],
            ['**Indústria**', '10 perguntas', '25', '2,50'],
            ['**Vantagens Competitivas / Barreiras à Entrada**', '10 perguntas', '31', '3,10'],
            ['**Poder de Barganha**', '6 perguntas', '12', '2,00'],
            ['**Riscos e Estrutura**', '6 perguntas', '16', '2,67'],
            ['**Nota final**', '53 perguntas', '149', '2,81'],
          ],
        },
        { type: 'note', tone: 'info', text: 'A média simples das seis médias daria 2,74. A nota final da Ação A é 2,81 porque o pilar mais bem avaliado, Governança, tem 11 perguntas, e o pior, Poder de Barganha, tem só 6. Exemplo ilustrativo: a Ação A não existe.' },
      ],
    },
    {
      id: 'os-6-pilares',
      title: 'Os 6 pilares: o que perguntar sobre a empresa',
      blocks: [
        { type: 'p', text: 'Cada pilar abaixo traz perguntas que ajudam a dar a sua nota. Elas resumem, em linguagem simples, as perguntas da metodologia, que no total são 53.' },
        {
          type: 'cards',
          items: [
            { title: 'Governança · 11 perguntas', tone: 'gold', text: 'Quem controla a empresa e como decide. O controlador também é o CEO? Quantos conselheiros são independentes? Quanto das ações circula no mercado (free float)? As decisões de investimento, aquisições e dividendos dos últimos anos deram retorno? Há infrações recentes ou comunicação ruim com investidores?' },
            { title: 'Management · 10 perguntas', tone: 'blue', text: 'Quem administra e o que já entregou. CEO e CFO têm histórico de bons resultados? A empresa cumpre o guidance que divulga? A remuneração dos executivos depende de resultado de longo prazo? Eles têm ações da empresa? Existe plano de sucessão?' },
            { title: 'Indústria · 10 perguntas', tone: 'teal', text: 'O setor em que a empresa compete. Ele está crescendo, maduro ou encolhendo? Depende muito de juros, câmbio, PIB ou commodities? Poucas empresas dividem o mercado, ou a competição é pulverizada? Há espaço para ganhar participação ou para aquisições?' },
            { title: 'Vantagens Competitivas / Barreiras à Entrada · 10 perguntas', tone: 'emerald', text: 'O que protege o negócio. A empresa tem escala ou custo menor que os concorrentes? É líder do setor? Tem marca, tecnologia, licença ou canal de distribuição difícil de copiar? As margens ficam acima das dos pares? Ela se adapta rápido quando o mercado muda?' },
            { title: 'Poder de Barganha · 6 perguntas', tone: 'purple', text: 'Quem dita preço e condições. A empresa depende de poucos fornecedores ou de poucos clientes? Trocar de fornecedor custa caro para os clientes dela? Existem substitutos baratos para o que ela vende? É fácil um concorrente novo entrar?' },
            { title: 'Riscos e Estrutura · 6 perguntas', tone: 'red', text: 'O que pode dar errado. A regulação do setor muda com frequência? Uma parte grande da receita depende do governo? O negócio exige muito capital em ativos? As vendas se concentram numa só região? A ação tem liquidez? A dívida está sob controle?' },
          ],
        },
        { type: 'h3', text: 'Exemplos de critério objetivo' },
        { type: 'p', text: 'Cada pergunta da metodologia descreve os quatro níveis. Alguns exemplos dos dois extremos:' },
        {
          type: 'table',
          caption: 'Exemplos de critério das perguntas da nota qualitativa: o nível Forte (4) e o nível Fraco (1)',
          head: ['Pilar', 'Pergunta', 'Forte (4)', 'Fraco (1)'],
          rows: [
            ['**Governança**', 'Quanto das ações circula no mercado (free float)?', 'De 40% a 60%', 'Menos de 20%'],
            ['**Management**', 'A empresa entrega o guidance que divulga?', 'Superou o guidance em mais de 80% dos trimestres dos últimos 3 anos', 'Não divulga guidance ou ficou abaixo dele em mais de 80% dos trimestres'],
            ['**Indústria**', 'Em que fase do ciclo está o setor?', 'Crescimento acelerado: mais de 20% ao ano nos próximos 5 anos', 'Declínio: menos de 5% ao ano ou encolhendo'],
            ['**Vantagens**', 'A margem EBITDA é melhor que a dos concorrentes?', 'Mais de 5 pontos percentuais acima dos pares', 'Mais de 5 pontos percentuais abaixo dos pares'],
            ['**Poder de Barganha**', 'As vendas dependem de poucos clientes?', 'Mais de mil clientes, nenhum com mais de 10% das vendas', 'Menos de 10 clientes somando mais de 50% das vendas'],
            ['**Riscos e Estrutura**', 'Quanto da receita depende do governo?', 'Menos de 10% da receita exposta a governo e política', 'Mais de 50% da receita dependente do governo'],
          ],
        },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'O Score Qualitativo na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma, a nota qualitativa de cada empresa coberta já vem pronta: você consulta, não precisa gerar nada. Ela aparece em três lugares:' },
        {
          type: 'list',
          items: [
            '**Aba Score:** a lista das empresas com nota, da maior para a menor, com busca por ticker, empresa ou setor e filtro por setor. Em **Detalhe**, você vê a nota final, as notas por categoria, a evolução da nota e o resumo da análise. Em **Comparar**, põe até 5 empresas lado a lado num radar com as 6 categorias.',
            '**Página da ação:** na Visão geral de cada ação, a nota final aparece como "X,XX / 4", com as 6 categorias e um radar na escala de 1 a 4.',
            '**Outras telas:** a nota também aparece no Rankings, com coluna e filtro de nota mínima, nos cartões de Minhas Teses e no Radar, onde é condição da lista Oportunidades Claras.',
          ],
        },
        { type: 'p', text: 'As cores seguem uma régua fixa: notas acima de 3,2 aparecem em dourado, de 2,9 a 3,2 em azul-petróleo e abaixo de 2,9 em vermelho. O checklist desta página usa a mesma régua.' },
        { type: 'h3', text: 'Quem acessa o quê' },
        {
          type: 'list',
          items: [
            'A aba **Score** faz parte do plano IAções e exige login.',
            'Na página da ação, a nota final, as 6 categorias e o radar ficam abertos a qualquer conta, inclusive a grátis. O resumo da análise e a evolução da nota são do plano IAções.',
            'As respostas pergunta a pergunta, com a justificativa de cada nota, são do plano Fundamentalista.',
            'No Rankings, nos cartões de Minhas Teses e no Radar, a nota também é do plano IAções.',
          ],
        },
        { type: 'ssr', id: 'nota-ativo' },
        { type: 'note', tone: 'info', text: 'Não confunda o Score com o **Qualitativo**, outra tela da plataforma. O Qualitativo escreve, por IA e sob demanda, um relatório sobre a empresa que você escolher. Gerar esse relatório não muda a nota de 1 a 4 do Score.' },
      ],
    },
    {
      id: 'boa-empresa-bom-preco',
      title: 'Boa empresa não quer dizer bom preço',
      blocks: [
        { type: 'p', text: 'A nota qualitativa não diz se a ação está cara ou barata: nenhuma das 53 perguntas compara o preço da ação com o valor da empresa. Uma empresa excelente pode estar cara demais, e uma empresa mediana pode estar barata. Por isso a nota responde só a metade da pergunta.' },
        { type: 'p', text: 'Depois de avaliar o negócio, compare o preço com o valor estimado da empresa. A [calculadora de preço justo](/ferramentas/calculadora-preco-justo/) aplica Graham, Bazin e Gordon, e o [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/) projeta o caixa que a empresa deve gerar. Para comparar indicadores entre empresas, veja o [ranking de ações](/ferramentas/ranking-de-acoes/); para uma triagem por regras fixas, o [Radar de oportunidades](/ferramentas/radar-de-oportunidades/). Os números de cada empresa estão na [página de cada ação](/acoes/).' },
        { type: 'p', text: 'Se a ideia continuar de pé depois das duas perguntas, registre a [tese de investimento](/ferramentas/tese-de-investimento/), com os critérios que fariam você mudar de ideia.' },
      ],
    },
    {
      id: 'como-usar',
      title: 'Como usar o checklist',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Escolha uma empresa e separe o material: o Formulário de Referência e os resultados mais recentes ficam no site de relações com investidores da empresa e no site da CVM.',
            'Em cada pilar, leia as perguntas-guia e marque de 1 (Fraco) a 4 (Forte). Sem informação para responder, marque 2, como faz a metodologia.',
            'Veja a nota final: o checklist pesa cada pilar pelo número de perguntas, como a plataforma, e pinta a nota com a mesma régua de cor.',
            'Compare com a nota da plataforma: digite o ticker no fim do checklist para abrir a página da ação. Onde as notas divergem, vale ler mais.',
            'Por fim, olhe o preço: a nota não diz se a ação está cara ou barata.',
          ],
        },
        { type: 'p', text: 'As notas que você marca ficam só nesta página: não são enviadas nem guardadas. Ao recarregar, o checklist recomeça.' },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**A nota é gerada por IA.** Ela segue critérios objetivos, mas pode errar, e não há uma etapa de revisão humana de cada nota. Use como ponto de partida para o estudo.',
            '**Informação que falta vira nota 2.** Quando o dado não aparece no Formulário de Referência nem em fontes públicas, a pergunta fica com 2. Empresas com pouca informação pública tendem a ter nota mais perto de 2 (Médio).',
            '**Atualização em lotes.** A nota não muda todo dia: ela é recalculada em lotes, sem calendário fixo. A evolução da nota aparece quando há pelo menos duas leituras.',
            '**Nem toda ação tem nota.** Quando falta, a página da ação na plataforma avisa.',
            '**Qualidade não é preço.** Nenhuma pergunta da nota compara o preço da ação com o valor da empresa: ela não diz se a ação está cara ou barata.',
            '**Não é recomendação.** A nota descreve a qualidade do negócio por critérios fixos. A decisão de investir depende da sua análise.',
          ],
        },
      ],
    },
  ],
  definedTerms: [
    { name: 'Análise qualitativa', description: 'Avaliação do que não aparece direto nos números de uma empresa: governança, qualidade da gestão, setor, vantagens competitivas, relação com clientes e fornecedores e riscos do negócio.' },
    { name: 'Governança corporativa', description: 'Conjunto de regras e práticas que definem quem controla a empresa, como as decisões são tomadas e como o acionista minoritário é protegido: conselho, controle, transparência e remuneração.' },
    { name: 'Free float', description: 'Parte das ações de uma empresa que circula livremente na bolsa, fora das mãos do controlador e de pessoas ligadas a ele.' },
    { name: 'Vantagem competitiva (moat)', description: 'Proteção que permite à empresa lucrar mais que os concorrentes por muitos anos, como escala, marca, tecnologia, licença ou rede de distribuição difícil de copiar.' },
    { name: 'Poder de barganha', description: 'Força da empresa para negociar preço e condições com fornecedores e clientes. Depende de quantos existem, de quanto custa trocar, dos substitutos e da facilidade de entrada de concorrentes.' },
    { name: 'Skin in the game', description: 'Expressão em inglês para quando executivos e conselheiros têm parte relevante do próprio patrimônio em ações da empresa, o que aproxima os interesses deles dos do acionista.' },
  ],
  faq: [
    {
      q: 'Como saber se uma empresa é boa para investir?',
      a: 'Olhe o negócio antes do preço. Veja quem controla a empresa e como decide, o histórico de quem administra, o setor, o que a protege da concorrência, a força dela diante de clientes e fornecedores e os riscos, como dívida e regulação. Depois compare o preço da ação com o valor estimado da empresa: uma empresa boa comprada caro demais pode ser um investimento ruim.',
    },
    {
      q: 'O que é a nota qualitativa e como ela é calculada?',
      a: 'É uma nota de 1 a 4 (1 é a pior) que resume 53 perguntas sobre a empresa, divididas em 6 categorias: Governança, Management, Indústria, Vantagens Competitivas / Barreiras à Entrada, Poder de Barganha e Riscos e Estrutura. Cada pergunta recebe de 1 a 4 por critérios objetivos. A nota de cada categoria é a média das perguntas dela, e a nota final é a média das 53, então categorias com mais perguntas pesam mais.',
    },
    {
      q: 'O que é governança corporativa e por que ela pesa mais na nota?',
      a: 'Governança corporativa é o conjunto de regras que define quem controla a empresa, como as decisões são tomadas e como o acionista minoritário é protegido. Na nota qualitativa, Governança tem 11 das 53 perguntas, cerca de 21% da nota final, o maior peso entre as 6 categorias. As perguntas tratam de controle, free float, conselheiros independentes, alocação de capital, transparência e remuneração.',
    },
    {
      q: 'Como avaliar a gestão (management) de uma empresa?',
      a: 'Compare o que os executivos prometeram com o que entregaram. Veja o histórico do CEO e do CFO, se a empresa cumpre o guidance que divulga, se a remuneração depende de resultado de longo prazo, se os executivos têm ações da empresa e se existe plano de sucessão. Na nota qualitativa, Management tem 10 perguntas.',
    },
    {
      q: 'O que é vantagem competitiva de uma empresa?',
      a: 'É o que permite à empresa lucrar mais que os concorrentes por muito tempo, também chamado de moat. Exemplos: escala com custo menor, marca forte, tecnologia própria, licença exclusiva e rede de distribuição difícil de copiar. Um sinal prático é a margem: na nota qualitativa, margem EBITDA mais de 5 pontos percentuais acima dos pares conta como Forte.',
    },
    {
      q: 'O que é poder de barganha e quanto ele pesa na nota?',
      a: 'É a força da empresa para negociar com fornecedores e clientes. Quem depende de poucos fornecedores ou de poucos clientes, ou vende algo fácil de substituir, tem pouco poder de barganha. Na nota qualitativa, Poder de Barganha tem 6 das 53 perguntas, cerca de 11% da nota final.',
    },
    {
      q: 'Uma nota qualitativa alta quer dizer que a ação é um bom investimento?',
      a: 'Não necessariamente. A nota avalia a qualidade do negócio e não diz se o preço da ação está alto ou baixo: uma empresa com nota alta pode estar cara. Use a nota junto com o valuation, como o preço justo por Graham, Bazin e Gordon ou o fluxo de caixa descontado. A nota não é recomendação de investimento.',
    },
    {
      q: 'Qual a diferença entre a nota qualitativa e o F-Score de Piotroski?',
      a: 'O F-Score de Piotroski soma 9 testes de sim ou não feitos só com as demonstrações financeiras, sobre lucro, caixa, endividamento, liquidez e eficiência, e vai de 0 a 9. A nota qualitativa olha o que o balanço não mostra, como controle, gestão, setor e vantagens competitivas, e vai de 1 a 4. A plataforma IAções não calcula o F-Score.',
    },
    {
      q: 'Quem dá a nota qualitativa e com que frequência ela muda?',
      a: 'A nota é gerada por inteligência artificial seguindo os critérios da metodologia, a partir do Formulário de Referência entregue à CVM, das demonstrações financeiras e de dados de mercado. Não há revisão humana de cada nota, e ela pode conter erros. A nota é recalculada em lotes, sem calendário fixo: ela não é atualizada todo dia.',
    },
    {
      q: 'Onde vejo a nota qualitativa de uma empresa?',
      a: 'Na página da ação na plataforma IAções, onde a nota final, as 6 categorias e o radar ficam abertos a qualquer conta, inclusive a grátis. Nem toda empresa tem nota; quando falta, a página avisa. A aba Score, com a lista de empresas, o detalhe e a comparação entre até 5 empresas, faz parte do plano IAções.',
    },
  ],
  sources: 'Metodologia, categorias, número de perguntas, escala, régua de cor e acesso: telas Score e página da ação da plataforma IAções (metodologia qualitativa da Brasil Horizonte). A nota usa o Formulário de Referência entregue à CVM, demonstrações financeiras e dados de mercado da plataforma. F-Score: Joseph Piotroski, Journal of Accounting Research (2000).',
  contentRevised: '2026-10-07',
};
