/**
 * Nome de empresa para exibição: ranking e fatos relevantes (/ferramentas/), /airton/{T}/ e o nome
 * curto das páginas de ticker. Uma limpeza só, usada em todo lugar que mostra o nome.
 *
 * Por que existe: a brapi grava o `long_name` em inglês e com o sufixo da classe ou do instrumento
 * ("Itausa SA Non-Cum Perp Pfd Registered Shs", "Banco BTG Pactual SA Units Cons of 1 Sh + 2 Pfd
 * Shs A", "Petroleo Brasileiro SA Pfd"), e o `short_name` ou é o próprio ticker ("PETR4") ou a
 * abreviação de 12 letras da B3 com a classe colada ("KARSTEN     ON", "TIME FOR FUNON",
 * "PET MANGUINHON"). Em 07/10/2026, 111 das 180 linhas do ranking saíam com o nome cru.
 *
 * Regras (na ordem):
 *  1. sufixo de classe/instrumento em inglês sai ("Pfd…", "Non-Cum…", "Units Cons of…", "Unit",
 *     "Ctf de Deposito…", "Registered…", "Shs…");
 *  2. código de classe da B3 no fim sai ("ON", "PN", "NM", "N1"…);
 *  3. "Nome - MARCA": com uma palavra só depois do " - ", fica a marca ("… do Parana - Sanepar" →
 *     "Sanepar"); com várias, fica o que vem antes ("B3 SA - Brasil, Bolsa, Balcao" → "B3");
 *  4. "Nome-Marca" colado, com uma palavra só no fim, fica a marca ("… Gerais SA-Usiminas" →
 *     "Usiminas"); "Log-In Logistica", "Mahle-Metal Leve" e "Lojas Quero-Quero" ficam como estão;
 *  5. forma societária e o que vem depois dela saem ("Eucatex S.A. Industria e Comercio" →
 *     "Eucatex"; "… Imobiliario Ltda" → "… Imobiliario"; "Aura Minerals Inc" → "Aura Minerals"; "Nu Holdings Ltd." → "Nu Holdings").
 *     "SABESP" e "Sao" não são "SA".
 * Acento e caixa ficam como vieram (sigla como CEB e COMGAS não vira "Ceb").
 */

/** short_name/long_name que é só o ticker ("PETR4", "B3SA3"). */
const TICKER_LIKE = /^[A-Z0-9]{4}\d{1,2}$/i;

/** 1. Classe/instrumento da brapi, em inglês: corta da primeira palavra-chave até o fim. */
const INSTRUMENT = /\s*\b(?:Non-Cum|Conv\s+Pfd|Pfd|Registered|Units?|Ctf\s+de\s+Deposito|Shs)\b.*$/i;

/** 2. Código de classe/listagem da B3 no fim da abreviação ("KARSTEN     ON", "ODONTOPREV  ON      NM"). */
const CLASS_CODES = /(?:\s+(?:ON|PN|UNT|N[12M]|NM|EDJ|ED|EJ|PNA|PNB|PNC|PFD|PRF))+$/i;

/** 5. Forma societária (e tudo depois dela). "SA" só como palavra: "SABESP" e "Sao" ficam. */
const LEGAL = /[\s,]+(?:S\.\s?A\.|S\.A(?![A-Za-z])|S\/A(?![A-Za-z])|SA(?![A-Za-z])|Sa$|Ltda?\.?(?![A-Za-z])|Inc\.?(?![A-Za-z]))/;

const wordList = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const words = (s: string): number => wordList(s).length;
const tidy = (s: string): string => s.replace(/[\s,.;:–-]+$/, '').replace(/^[\s,.;:–-]+/, '').trim();

/** Nome curto de exibição a partir de UM nome cru (long_name, short_name ou nome da CVM). */
export function cleanCompanyName(raw: unknown): string {
  const base = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!base) return '';
  let s = base.replace(INSTRUMENT, '').replace(CLASS_CODES, '').trim();

  // 3. "Nome - MARCA" / "Nome - descrição".
  const spaced = /^(.+?)\s+[-–]\s+(.+)$/.exec(s);
  if (spaced) {
    const right = tidy(spaced[2].replace(LEGAL, '').replace(CLASS_CODES, ''));
    s = right && words(right) === 1 && right.length >= 2 ? right : spaced[1];
  }

  // 4. "Nome de 3+ palavras-Marca" (marca de uma palavra colada no fim). Palavra repetida é nome
  // composto, não marca: "Lojas Quero-Quero" fica.
  const glued = /^(\S.*\s.*?\S)-([A-Za-zÀ-ÿ]{3,})$/.exec(s.replace(LEGAL, '').trim());
  if (glued) {
    const left = wordList(glued[1]);
    if (left.length >= 3 && left[left.length - 1].toLowerCase() !== glued[2].toLowerCase()) s = glued[2];
  }

  // 5. Forma societária e o que vem depois.
  const legal = LEGAL.exec(s);
  if (legal && legal.index > 0) s = s.slice(0, legal.index);

  return tidy(s) || base;
}

/**
 * Nome de exibição de um papel a partir do par da brapi: o `long_name` primeiro (o `short_name`
 * é o ticker ou a abreviação truncada da B3, às vezes de um nome antigo: TRAD3 "ECONOMATICA SA"
 * contra "TC S.A."), depois o `short_name`; ticker não vale como nome. Sem nome, `fallback`.
 */
export function companyName(short: unknown, long: unknown, fallback = ''): string {
  for (const raw of [long, short]) {
    const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!s || TICKER_LIKE.test(s.replace(/\s/g, ''))) continue;
    const c = cleanCompanyName(s);
    if (c) return c;
  }
  return fallback;
}
