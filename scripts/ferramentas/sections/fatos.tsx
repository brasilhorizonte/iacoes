/**
 * Seção SSR "fatos" (content/fatos.ts, seção "Últimos fatos relevantes e comunicados"), logo depois
 * da lista de documentos (FatosList do page.tsx, que leva cada documento a /airton/T/ quando a
 * página existe, senão a /T/). Aqui cada empresa com documento recente ganha os DOIS links internos
 * (SPEC-v2 §B5: os itens linkam /airton/T/, se existir, e /T/):
 *
 *   - "Fatos relevantes de T" → /airton/T/, só quando o dados.json aponta para ela (data.ts
 *     resolveDocPage só devolve /airton/T/ com a página no disco);
 *   - "Preço justo de T" → /T/, só quando /T/index.html é página de verdade no disco, e não o stub
 *     de redirect (mesma regra do hasRealPage do gerador e do realPage de index.ts). Link para
 *     página que não existe vira 404 no GSC.
 *
 * A leitura do disco é a mesma ponte leve dos rodapés de ticker e macro (site.ts SITE_ROOT, como em
 * ticker/components/links-ferramentas.ts): só lê, não escreve nada. Nome da empresa é dado externo
 * (data-fonte="cvm", SPEC-v2 §E1); ticker e rótulos são autorais. Sem CTA para o app aqui.
 */
import * as React from 'react';
import { closeSync, openSync, readSync } from 'fs';
import { join } from 'path';
import { SITE_ROOT } from '../site';
import type { FatoItem } from '../types';
import type { SsrProps } from './index';

const TICKER_RE = /^[A-Z0-9]{4}\d{1,2}$/;

/** /{T}/index.html existe e é página de verdade (não o stub com meta refresh, como ELET3 → AXIA3). */
export function paginaDaAcaoNoDisco(t: string, root: string = SITE_ROOT): boolean {
  if (!TICKER_RE.test(t)) return false;
  let fd: number | null = null;
  try {
    fd = openSync(join(root, t, 'index.html'), 'r');
    const buf = Buffer.alloc(2048);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return !buf.toString('utf-8', 0, n).includes('http-equiv="refresh"');
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

export interface EmpresaDaLista {
  t: string;
  /** Nome como veio do dado (externo); vazio quando é só o ticker. */
  name: string;
  /** /airton/T/ quando existe. */
  airton: string | null;
  /** /T/ quando é página de verdade. */
  page: string | null;
}

/**
 * Empresas da lista, na ordem do documento mais recente de cada uma, sem repetir ticker. Fica fora
 * a empresa sem nenhum dos dois links (não acontece com o dados.json do gerador).
 */
export function empresasDaLista(items: FatoItem[], hasPage: (t: string) => boolean = paginaDaAcaoNoDisco): EmpresaDaLista[] {
  const out: EmpresaDaLista[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!TICKER_RE.test(it.t) || seen.has(it.t)) continue;
    seen.add(it.t);
    const airton = it.url === `/airton/${it.t}/` ? it.url : null;
    const page = hasPage(it.t) ? `/${it.t}/` : null;
    if (!airton && !page) continue;
    const name = String(it.name || '').trim();
    out.push({ t: it.t, name: name && name !== it.t ? name : '', airton, page });
  }
  return out;
}

const LINK = 'font-medium text-gold-strong underline-offset-2 hover:underline';

export function FatosEmpresas({ m, block }: SsrProps) {
  const d = m.env.fatos;
  if (!d || !d.items.length) return null;
  const limit = typeof block.props?.limit === 'number' ? block.props.limit : d.items.length;
  const empresas = empresasDaLista(d.items.slice(0, limit));
  if (!empresas.length) return null;
  return (
    <div className="space-y-3 pt-2" data-ssr="fatos">
      <h3 className="text-base font-semibold">Empresas com documentos recentes</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Para cada empresa, a página com os fatos relevantes e comunicados recentes dela (quando existe) e a página da ação, com preço justo, indicadores e proventos.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {empresas.map((e) => (
          <li key={e.t} className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card px-4 py-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-sm font-semibold">{e.t}</span>
              {e.name && <span className="truncate text-xs text-muted-foreground" data-fonte="cvm">{e.name}</span>}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {e.airton && <a href={e.airton} data-track="tool-fatos-empresa-docs" className={LINK}>Fatos relevantes de {e.t}</a>}
              {e.page && <a href={e.page} data-track="tool-fatos-empresa-acao" className={LINK}>Preço justo de {e.t}</a>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
