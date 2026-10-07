/**
 * Ponte leve para os rodapés das outras páginas (ticker e macro) linkarem o hub /ferramentas/
 * só quando ele existe no disco — lição dos 404 no GSC: nunca linkar página que não existe.
 * Sem dependências pesadas: importar este arquivo não puxa o módulo de ferramentas inteiro.
 */
import { existsSync } from 'fs';
import { join } from 'path';

/** Raiz do site (onde o gerador escreve as páginas). */
export const SITE_ROOT = join(__dirname, '..', '..');

export const TOOLS_HUB_PATH = '/ferramentas/';

/** O hub /ferramentas/ está publicado no disco (é gerado no build; na 1ª execução ainda não existe). */
export const toolsHubExists = (root: string = SITE_ROOT): boolean => existsSync(join(root, 'ferramentas', 'index.html'));
