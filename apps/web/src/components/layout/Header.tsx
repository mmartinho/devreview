/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Cabeçalho compartilhado das páginas, dividido em 3 zonas: título à esquerda,
 * seletor de time (`TeamSwitcher`) ao centro e botão de ação (ex.: "Nova Regra") à direita.
 *
 * O grid `1fr / auto / 1fr` mantém o seletor centralizado independentemente do tamanho do
 * título ou da presença de ação. Abaixo de `md` o seletor passa para uma segunda linha.
 */
import { TeamSwitcher } from "./TeamSwitcher";

interface HeaderProps {
  /** Título da página (zona esquerda). */
  title: string;
  /** Elemento de ação da página, normalmente um botão de criar (zona direita). */
  action?: React.ReactNode;
  /** Exibe o seletor de time no centro (padrão: true). */
  showTeamSwitcher?: boolean;
}

/**
 * Cabeçalho de página.
 * @param props.title Título.
 * @param props.action Ação opcional à direita.
 * @param props.showTeamSwitcher Se false, oculta o seletor de time.
 * @returns Elemento <header>.
 */
export function Header({ title, action, showTeamSwitcher = true }: HeaderProps) {
  return (
    <header className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-gray-800 bg-gray-900 px-6 py-4 md:grid-cols-[1fr_auto_1fr]">
      <h1 className="col-start-1 row-start-1 min-w-0 truncate text-lg font-semibold text-white">
        {title}
      </h1>
      {showTeamSwitcher && (
        <div className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1">
          <TeamSwitcher />
        </div>
      )}
      {action && (
        <div className="col-start-2 row-start-1 justify-self-end md:col-start-3">
          {action}
        </div>
      )}
    </header>
  );
}
