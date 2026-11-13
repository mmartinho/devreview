/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-13
 * Data Atualização: 2026-11-13
 * Descrição: Select do time atual, exibido no centro do `Header` de todas as páginas. Ao escolher
 * um time, toda a aplicação (regras, ADRs, histórico e início) passa a mostrar os dados dele.
 *
 * Fica desabilitado enquanto há uma gravação em andamento (para não trocar de contexto no meio
 * de uma criação/edição) e mostra um link para criar o primeiro time quando não há nenhum.
 */
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCurrentTeam } from "@/store/slices/teamsSlice";

/**
 * Seletor do time atual.
 * @returns Select (ou link "Criar o primeiro time" quando a lista está vazia).
 */
export function TeamSwitcher() {
  const dispatch = useAppDispatch();
  const { items, currentTeamId, loading } = useAppSelector((s) => s.teams);
  const busy = useAppSelector(
    (s) => s.teams.saving || s.rules.saving || s.adrs.saving
  );

  if (!loading && items.length === 0) {
    return (
      <Link
        to="/times"
        className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"
      >
        <Users className="h-4 w-4" />
        Criar o primeiro time
      </Link>
    );
  }

  return (
    <Select
      value={currentTeamId ?? undefined}
      onValueChange={(id) => dispatch(setCurrentTeam(id))}
      disabled={busy || (loading && items.length === 0)}
    >
      <SelectTrigger
        aria-label="Time"
        className="w-full border-gray-700 bg-gray-800 text-sm text-white md:w-56"
      >
        <Users className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectValue placeholder="Carregando times…" />
        </span>
      </SelectTrigger>
      <SelectContent className="border-gray-700 bg-gray-900">
        {items.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
