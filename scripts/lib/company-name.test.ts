/**
 * Nome de empresa para exibição (scripts/lib/company-name.ts). Uso: npm run -s test:dados
 * Os nomes são os de brapi_quotes lidos pela anon key em 07/10/2026 (long_name e short_name reais).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCompanyName, companyName } from './company-name';

test('sufixo de classe/instrumento da brapi (em inglês) sai', () => {
  const casos: [string, string][] = [
    ['Petroleo Brasileiro SA Pfd', 'Petroleo Brasileiro'],
    ['Itausa SA Non-Cum Perp Pfd Registered Shs', 'Itausa'],
    ['Banco BTG Pactual SA Units Cons of 1 Sh + 2 Pfd Shs A', 'Banco BTG Pactual'],
    ['Itau Unibanco Holding SA Pfd', 'Itau Unibanco Holding'],
    ['Klabin SA Ctf de Deposito de Acoes Cons of 1 Sh + 4 Pfd Shs', 'Klabin'],
    ['Transmissora Alianca De Energia Eletrica S.A. Unit', 'Transmissora Alianca De Energia Eletrica'],
    ['Banco Santander (Brasil) S.A. Units Cons of 1 Sh + 1 Pfd Sh', 'Banco Santander (Brasil)'],
    ['Banco ABC Brasil SA Conv Pfd', 'Banco ABC Brasil'],
    ['Banco Bmg SA BMG Pfd Registered Shs -144A- Reg S', 'Banco Bmg'],
    ['Energisa SA Pfd Shs Non-Voting', 'Energisa'],
    ['Unipar Carbocloro SA Pfd Class B', 'Unipar Carbocloro'],
    ['Banco do Estado do Rio Grande do Sul SA Pfd Series B', 'Banco do Estado do Rio Grande do Sul'],
    ['Braskem S.A. Pfd A', 'Braskem'],
    ['Karsten S.A.Non-Cum Perp Pfd Registered Shs', 'Karsten'],
    ['PBG S.A.Registered Shs', 'PBG'],
    ['Cia de Participacoes Alianca da Bahia Registered', 'Cia de Participacoes Alianca da Bahia'],
    ['BRBI BR Partners S.A. Units Cons of 1 Sh and 2 Pfd Shs', 'BRBI BR Partners'],
  ];
  for (const [cru, limpo] of casos) assert.equal(cleanCompanyName(cru), limpo, cru);
});

test('forma societária sai com o que vem depois; "SABESP", "Sao" e "LWSA" ficam', () => {
  const casos: [string, string][] = [
    ['Ambev SA', 'Ambev'],
    ['Vale S.A.', 'Vale'],
    ['Automob Participacoes S.A', 'Automob Participacoes'],
    ['Eucatex S.A. Industria e Comercio', 'Eucatex'],
    ['M. Dias Branco SA Industria e Comercio de Alimentos', 'M. Dias Branco'],
    ['Mundial S.A.- Produtos de Consumo', 'Mundial'],
    ['Plano & Plano Desenvolvimento Imobiliario Ltda', 'Plano & Plano Desenvolvimento Imobiliario'],
    ['Rede D\'Or Sao Luiz SA', 'Rede D\'Or Sao Luiz'],
    ['Companhia de Saneamento Basico do Estado de Sao Paulo SABESP', 'Companhia de Saneamento Basico do Estado de Sao Paulo SABESP'],
    ['LWSA S.A.', 'LWSA'],
    ['Localiza Rent A Car SA', 'Localiza Rent A Car'],
    ['Companhia Brasileira de Distribuicao', 'Companhia Brasileira de Distribuicao'],
    ['Petróleo Brasileiro S.A. - Petrobras', 'Petrobras'],
  ];
  for (const [cru, limpo] of casos) assert.equal(cleanCompanyName(cru), limpo, cru);
});

test('"Nome - MARCA" fica com a marca; "Nome - descrição" fica com o nome; marca colada no hífen', () => {
  const casos: [string, string][] = [
    ['Companhia de Saneamento do Parana - Sanepar Units Cons of 1 Sh + 4 Pfd Shs', 'Sanepar'],
    ['Banco do Estado de Sergipe SA - Banese Non-Cum Perp Pfd Registered Shs', 'Banese'],
    ['Companhia de Gas de Sao Paulo - COMGAS', 'COMGAS'],
    ['Companhia Energetica de Brasilia - CEB Pfd B', 'CEB'],
    ['B3 SA - Brasil, Bolsa, Balcao', 'B3'],
    ['Banestes S.A. - Banco do Estado do Espirito Santo', 'Banestes'],
    ['Energisa Mato Grosso - Distribuidora de Energia Sa', 'Energisa Mato Grosso'],
    ['TPI - Triunfo Participacoes e Investimentos SA', 'TPI'],
    ['Usinas Siderurgicas de Minas Gerais SA-Usiminas Pfd A', 'Usiminas'],
    ['Cia de Ferro Ligas da Bahia-Ferbasa Pfd', 'Ferbasa'],
    ['Companhia Energetica do Ceara-COELCE', 'COELCE'],
    ['Mahle-Metal Leve S.A.', 'Mahle-Metal Leve'],
    ['Log-In Logistica Intermodal SA', 'Log-In Logistica Intermodal'],
    ['Lojas Quero-Quero SA', 'Lojas Quero-Quero'],                  // nome composto, não marca
    ['Aura Minerals Inc Shs Unsponsored Brazilian Depositary Receipt Repr 1 Sh', 'Aura Minerals'],
    ['Nu Holdings Ltd. Shs -A- Sponsored Brazilian Depositary Receipt Repr 0.16667 Sh -A-', 'Nu Holdings'],
    // Nome da CVM (company_name / título de ITR).
    ['BCO ESTADO DE SERGIPE S.A. - BANESE', 'BANESE'],
    ['GRUPO TOKY S.A. - EM RECUPERAÇÃO JUDICIAL', 'GRUPO TOKY'],
  ];
  for (const [cru, limpo] of casos) assert.equal(cleanCompanyName(cru), limpo, cru);
});

test('abreviação da B3: classe no fim sai; vazio fica vazio', () => {
  assert.equal(cleanCompanyName('KARSTEN     ON'), 'KARSTEN');
  assert.equal(cleanCompanyName('ODONTOPREV  ON      NM'), 'ODONTOPREV');
  assert.equal(cleanCompanyName('WETZEL S/A  PN'), 'WETZEL');
  assert.equal(cleanCompanyName(''), '');
  assert.equal(cleanCompanyName(null), '');
});

test('companyName: long_name primeiro (o short_name é o ticker ou a abreviação da B3); ticker não é nome', () => {
  assert.equal(companyName('PETR4', 'Petroleo Brasileiro SA Pfd', 'PETR4'), 'Petroleo Brasileiro');
  assert.equal(companyName('KARSTEN     ON', 'Karsten S.A.', 'CTKA3'), 'Karsten');
  assert.equal(companyName('TIME FOR FUNON', 'T4F Entretenimento S.A.', 'SHOW3'), 'T4F Entretenimento');
  assert.equal(companyName('ECONOMATICA SA', 'TC S.A.', 'TRAD3'), 'TC');                 // abreviação de nome antigo
  assert.equal(companyName('Empresa AAA3', 'Empresa AAA3 S.A.'), 'Empresa AAA3');
  assert.equal(companyName('RUMO3', 'RUMO3', 'RUMO3'), 'RUMO3');                          // só ticker: fallback
  assert.equal(companyName('', '', 'XPTO3'), 'XPTO3');
  assert.equal(companyName('Petrobras', ''), 'Petrobras');
});
