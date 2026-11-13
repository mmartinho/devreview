/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-13
 * Data Atualização: 2026-11-13
 * Descrição: Página "Times" (rota /times). Lista os times com a contagem de regras, ADRs e reviews
 * e permite criar, renomear e excluir times, persistindo no Supabase via thunks do `teamsSlice`.
 * Os times cadastrados alimentam o select de time atual exibido no `Header`.
 *
 * Excluir um time apaga em cascata suas regras, ADRs e histórico; por isso o diálogo mostra as
 * quantidades e exige digitar o nome do time. O último time não pode ser excluído.
 */
import { useEffect, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  openModal,
  closeModal,
  clearMutationError,
} from "@/store/slices/teamsSlice";
import { TeamWithCounts } from "@/types";

/** Tamanho máximo do nome de um time (validação apenas no client). */
const MAX_NAME_LENGTH = 80;

/**
 * Formata uma data ISO em pt-BR (ex.: "13 de nov. de 2026").
 * @param iso Data em ISO 8601.
 * @returns Data formatada ou "—" se vazia.
 */
function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TeamsPage() {
  const dispatch = useAppDispatch();
  const {
    items: teams,
    currentTeamId,
    isModalOpen,
    editingTeamId,
    saving,
    mutationError,
  } = useAppSelector((s) => s.teams);

  const [formName, setFormName] = useState("");
  const [teamToDelete, setTeamToDelete] = useState<TeamWithCounts | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const name = formName.trim();
  const nameTooLong = name.length > MAX_NAME_LENGTH;
  const duplicated = teams.some(
    (t) => t.id !== editingTeamId && t.name.toLowerCase() === name.toLowerCase()
  );
  const canSave = name.length > 0 && !nameTooLong && !duplicated && !saving;
  const canDeleteConfirm =
    teamToDelete !== null && confirmText.trim() === teamToDelete.name && !saving;

  useEffect(() => {
    // Atualiza as contagens ao abrir a página.
    dispatch(fetchTeams());
  }, [dispatch]);

  /** Abre o modal em modo criação. */
  function handleOpenNew() {
    setFormName("");
    dispatch(openModal(null));
  }

  /**
   * Abre o modal em modo edição com o nome do time.
   * @param team Time a renomear.
   */
  function handleOpenEdit(team: TeamWithCounts) {
    setFormName(team.name);
    dispatch(openModal(team.id));
  }

  /**
   * Valida e persiste o time (cria ou renomeia conforme `editingTeamId`).
   * Fecha o modal só em sucesso; em erro, o `mutationError` do slice é exibido no modal.
   * @param e Evento de submit do formulário.
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    try {
      if (editingTeamId) {
        await dispatch(
          updateTeam({ id: editingTeamId, input: { name } })
        ).unwrap();
      } else {
        await dispatch(createTeam({ name })).unwrap();
      }
      dispatch(closeModal());
    } catch {
      // Erro já registrado em `mutationError` pelo slice.
    }
  }

  /** Abre o diálogo de confirmação de exclusão. */
  function handleAskDelete(team: TeamWithCounts) {
    dispatch(clearMutationError());
    setConfirmText("");
    setTeamToDelete(team);
  }

  /** Fecha o diálogo de exclusão sem excluir. */
  function handleCancelDelete() {
    setTeamToDelete(null);
    dispatch(clearMutationError());
  }

  /** Confirma a exclusão do time selecionado; fecha o diálogo só em sucesso. */
  async function handleConfirmDelete() {
    if (!teamToDelete || !canDeleteConfirm) return;
    try {
      await dispatch(deleteTeam(teamToDelete.id)).unwrap();
      setTeamToDelete(null);
    } catch {
      // Erro exibido no diálogo via `mutationError`.
    }
  }

  /**
   * Copia o UUID do time (necessário nas tools do MCP server, que pedem `team_id`).
   * @param id UUID do time.
   */
  async function handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard indisponível: ignora.
    }
  }

  const onlyOneTeam = teams.length <= 1;

  return (
    <div className="flex flex-col overflow-y-auto">
      <Header
        title="Times"
        action={
          <Button
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-500"
            onClick={handleOpenNew}
          >
            <Plus className="h-4 w-4" />
            Novo Time
          </Button>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center">
          <span className="ml-auto text-xs text-gray-500">
            {teams.length} time{teams.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Nome</TableHead>
                <TableHead className="w-24 text-gray-400">Regras</TableHead>
                <TableHead className="w-24 text-gray-400">ADRs</TableHead>
                <TableHead className="w-24 text-gray-400">Reviews</TableHead>
                <TableHead className="w-36 text-gray-400">Criado em</TableHead>
                <TableHead className="w-32 text-gray-400" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow
                  key={team.id}
                  className="border-gray-800 hover:bg-gray-800/50"
                >
                  <TableCell className="text-sm text-white">
                    <div className="flex items-center gap-2">
                      <span className="break-words">{team.name}</span>
                      {team.id === currentTeamId && (
                        <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                          Atual
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-300">
                    {team.rules_count}
                  </TableCell>
                  <TableCell className="text-sm text-gray-300">
                    {team.adrs_count}
                  </TableCell>
                  <TableCell className="text-sm text-gray-300">
                    {team.reviews_count}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(team.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copiar ID do time"
                      title={copiedId === team.id ? "ID copiado!" : "Copiar ID"}
                      className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => handleCopyId(team.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar time"
                      className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => handleOpenEdit(team)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir time"
                      title={
                        onlyOneTeam
                          ? "Não é possível excluir o único time"
                          : "Excluir time"
                      }
                      disabled={onlyOneTeam}
                      className="h-8 w-8 text-gray-500 hover:text-red-400"
                      onClick={() => handleAskDelete(team)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {teams.length === 0 && (
                <TableRow className="border-gray-800">
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-gray-500"
                  >
                    Nenhum time cadastrado. Crie o primeiro time para começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal de criação/edição */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open && !saving) dispatch(closeModal());
        }}
      >
        <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
          <form onSubmit={handleSave} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {editingTeamId ? "Editar Time" : "Novo Time"}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                O time aparece no seletor do topo de todas as páginas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="team-name" className="text-gray-300">
                  Nome
                </Label>
                <Input
                  id="team-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Backend"
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-600"
                  aria-invalid={nameTooLong || duplicated}
                  autoFocus
                />
                {nameTooLong && (
                  <p className="text-xs text-red-400">
                    O nome deve ter no máximo {MAX_NAME_LENGTH} caracteres.
                  </p>
                )}
                {duplicated && (
                  <p className="text-xs text-red-400">
                    Já existe um time com este nome.
                  </p>
                )}
              </div>

              {mutationError && (
                <p role="alert" className="text-sm text-red-400">
                  {mutationError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="text-gray-400 hover:text-white"
                disabled={saving}
                onClick={() => dispatch(closeModal())}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500"
                disabled={!canSave}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão (reforçada: digitar o nome) */}
      <Dialog
        open={teamToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !saving) handleCancelDelete();
        }}
      >
        <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir time</DialogTitle>
            <DialogDescription className="text-gray-400">
              Excluir o time «{teamToDelete?.name}»? Serão apagados{" "}
              <strong className="text-red-300">
                {teamToDelete?.rules_count} regra
                {teamToDelete?.rules_count !== 1 ? "s" : ""},{" "}
                {teamToDelete?.adrs_count} ADR
                {teamToDelete?.adrs_count !== 1 ? "s" : ""} e{" "}
                {teamToDelete?.reviews_count} review
                {teamToDelete?.reviews_count !== 1 ? "s" : ""}
              </strong>
              . Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="team-confirm" className="text-gray-300">
              Para confirmar, digite o nome do time
            </Label>
            <Input
              id="team-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={teamToDelete?.name}
              autoComplete="off"
              className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-600"
            />
          </div>
          {mutationError && teamToDelete && (
            <p role="alert" className="text-sm text-red-400">
              {mutationError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white"
              disabled={saving}
              onClick={handleCancelDelete}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-500"
              disabled={!canDeleteConfirm}
              onClick={handleConfirmDelete}
            >
              {saving ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
