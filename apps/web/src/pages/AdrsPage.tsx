/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Página "ADRs — Decisões de Arquitetura" (rota /adrs). Exibe as ADRs do time como
 * cards, com filtro por status, e permite criar, editar e excluir ADRs, persistindo no Supabase
 * via thunks do `adrsSlice`.
 *
 * O modal de criação/edição só fecha após o sucesso da operação; em caso de erro a mensagem é
 * exibida no próprio modal e os dados digitados são preservados.
 */
import { useEffect, useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdrs,
  setStatusFilter,
  openModal,
  closeModal,
  createAdr,
  updateAdr,
  deleteAdr,
  clearMutationError,
} from "@/store/slices/adrsSlice";
import { TEAM_ID } from "@/lib/team";
import { Adr, AdrStatus } from "@/types";
import { cn } from "@/lib/utils";

/** Limites de tamanho dos campos (validação apenas no client). */
const MAX_TITLE_LENGTH = 150;
const MAX_TEXT_LENGTH = 2000;

const statusConfig: Record<
  AdrStatus,
  { label: string; className: string }
> = {
  proposed: {
    label: "Proposta",
    className:
      "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  },
  accepted: {
    label: "Aceita",
    className:
      "bg-green-500/20 text-green-400 border border-green-500/30",
  },
  deprecated: {
    label: "Depreciada",
    className:
      "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  },
};

/**
 * Formata uma data ISO em pt-BR (ex.: "21 de fev. de 2026").
 * @param iso Data em ISO 8601.
 * @returns Data formatada.
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const tabItems: { value: AdrStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "proposed", label: "Propostas" },
  { value: "accepted", label: "Aceitas" },
  { value: "deprecated", label: "Depreciadas" },
];

export function AdrsPage() {
  const dispatch = useAppDispatch();
  const {
    items: adrs,
    statusFilter,
    isModalOpen,
    editingAdrId,
    saving,
    mutationError,
  } = useAppSelector((s) => s.adrs);

  const [formTitle, setFormTitle] = useState("");
  const [formContext, setFormContext] = useState("");
  const [formDecision, setFormDecision] = useState("");
  const [formStatus, setFormStatus] = useState<AdrStatus>("proposed");
  const [adrToDelete, setAdrToDelete] = useState<Adr | null>(null);

  const title = formTitle.trim();
  const context = formContext.trim();
  const decision = formDecision.trim();
  const titleTooLong = title.length > MAX_TITLE_LENGTH;
  const contextTooLong = context.length > MAX_TEXT_LENGTH;
  const decisionTooLong = decision.length > MAX_TEXT_LENGTH;
  const canSave =
    title.length > 0 &&
    context.length > 0 &&
    decision.length > 0 &&
    !titleTooLong &&
    !contextTooLong &&
    !decisionTooLong &&
    !saving;

  useEffect(() => {
    dispatch(fetchAdrs(TEAM_ID));
  }, [dispatch]);

  const filtered =
    statusFilter === "all"
      ? adrs
      : adrs.filter((a) => a.status === statusFilter);

  const countByStatus = (status: AdrStatus) =>
    adrs.filter((a) => a.status === status).length;

  /** Abre o modal em modo criação (formulário limpo, status "Proposta"). */
  function handleOpenNew() {
    setFormTitle("");
    setFormContext("");
    setFormDecision("");
    setFormStatus("proposed");
    dispatch(openModal(null));
  }

  /**
   * Abre o modal em modo edição com os dados da ADR.
   * @param adr ADR a editar.
   */
  function handleOpenEdit(adr: Adr) {
    setFormTitle(adr.title);
    setFormContext(adr.context);
    setFormDecision(adr.decision);
    setFormStatus(adr.status);
    dispatch(openModal(adr.id));
  }

  /**
   * Valida e persiste a ADR (cria ou atualiza conforme `editingAdrId`).
   * Fecha o modal só em sucesso; em erro, o `mutationError` do slice é exibido no modal.
   * @param e Evento de submit do formulário.
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const input = { title, context, decision, status: formStatus };
    try {
      if (editingAdrId) {
        await dispatch(updateAdr({ id: editingAdrId, input })).unwrap();
      } else {
        await dispatch(createAdr({ teamId: TEAM_ID, input })).unwrap();
      }
      dispatch(closeModal());
    } catch {
      // Erro já registrado em `mutationError` pelo slice.
    }
  }

  /** Abre o diálogo de confirmação de exclusão. */
  function handleAskDelete(adr: Adr) {
    dispatch(clearMutationError());
    setAdrToDelete(adr);
  }

  /** Confirma a exclusão da ADR selecionada; fecha o diálogo só em sucesso. */
  async function handleConfirmDelete() {
    if (!adrToDelete) return;
    try {
      await dispatch(deleteAdr(adrToDelete.id)).unwrap();
      setAdrToDelete(null);
    } catch {
      // Erro exibido no diálogo via `mutationError`.
    }
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <Header
        title="ADRs — Decisões de Arquitetura"
        action={
          <Button
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-500"
            onClick={handleOpenNew}
          >
            <Plus className="h-4 w-4" />
            Nova ADR
          </Button>
        }
      />

      <div className="flex-1 space-y-5 p-6">
        {/* Tabs filter */}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => dispatch(setStatusFilter(v as AdrStatus | "all"))}
        >
          <TabsList className="bg-gray-900 border border-gray-800">
            {tabItems.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400"
              >
                {label}
                {value !== "all" && (
                  <span className="ml-1.5 text-xs text-gray-600">
                    ({countByStatus(value as AdrStatus)})
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((adr) => {
            const { label, className: statusClass } = statusConfig[adr.status];
            return (
              <div
                key={adr.id}
                className="flex flex-col rounded-lg border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-white">
                    {adr.title}
                  </h3>
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusClass
                    )}
                  >
                    {label}
                  </span>
                </div>

                {/* Date */}
                <p className="mt-1 text-xs text-gray-600">
                  {formatDate(adr.created_at)}
                </p>

                {/* Context */}
                <div className="mt-3 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Contexto
                  </p>
                  <p className="mt-1 break-words text-sm text-gray-400 line-clamp-2">
                    {adr.context}
                  </p>
                </div>

                {/* Decision */}
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Decisão
                  </p>
                  <p className="mt-1 break-words text-sm italic text-gray-400 line-clamp-2">
                    {adr.decision}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <FileText className="h-3 w-3" />
                    <span className="text-xs">ADR-{adr.id.slice(0, 3).toUpperCase()}</span>
                  </div>
                  <div className="-mr-2 flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar ADR"
                      className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => handleOpenEdit(adr)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir ADR"
                      className="h-8 w-8 text-gray-500 hover:text-red-400"
                      onClick={() => handleAskDelete(adr)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-gray-500">
              Nenhuma ADR encontrada para este filtro.
            </div>
          )}
        </div>
      </div>

      {/* Modal de criação/edição */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open && !saving) dispatch(closeModal());
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-gray-800 bg-gray-900 text-white sm:max-w-2xl">
          <form onSubmit={handleSave} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {editingAdrId ? "Editar ADR" : "Nova ADR"}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Registre o contexto e a decisão de arquitetura tomada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="adr-title" className="text-gray-300">
                  Título
                </Label>
                <Input
                  id="adr-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Adoção de Redux Toolkit"
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-600"
                  aria-invalid={titleTooLong}
                  autoFocus
                />
                {titleTooLong && (
                  <p className="text-xs text-red-400">
                    O título deve ter no máximo {MAX_TITLE_LENGTH} caracteres.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adr-context" className="text-gray-300">
                  Contexto
                </Label>
                <Textarea
                  id="adr-context"
                  rows={4}
                  value={formContext}
                  onChange={(e) => setFormContext(e.target.value)}
                  placeholder="Qual problema ou situação motivou a decisão?"
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-600"
                  aria-invalid={contextTooLong}
                />
                {contextTooLong && (
                  <p className="text-xs text-red-400">
                    O contexto deve ter no máximo {MAX_TEXT_LENGTH} caracteres.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adr-decision" className="text-gray-300">
                  Decisão
                </Label>
                <Textarea
                  id="adr-decision"
                  rows={4}
                  value={formDecision}
                  onChange={(e) => setFormDecision(e.target.value)}
                  placeholder="O que foi decidido?"
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-600"
                  aria-invalid={decisionTooLong}
                />
                {decisionTooLong && (
                  <p className="text-xs text-red-400">
                    A decisão deve ter no máximo {MAX_TEXT_LENGTH} caracteres.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-300">Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as AdrStatus)}
                >
                  <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gray-700 bg-gray-900">
                    <SelectItem value="proposed">Proposta</SelectItem>
                    <SelectItem value="accepted">Aceita</SelectItem>
                    <SelectItem value="deprecated">Depreciada</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Confirmação de exclusão */}
      <Dialog
        open={adrToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setAdrToDelete(null);
            dispatch(clearMutationError());
          }
        }}
      >
        <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir ADR</DialogTitle>
            <DialogDescription className="text-gray-400">
              Excluir a ADR «{adrToDelete?.title}»? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          {mutationError && adrToDelete && (
            <p role="alert" className="text-sm text-red-400">
              {mutationError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white"
              disabled={saving}
              onClick={() => {
                setAdrToDelete(null);
                dispatch(clearMutationError());
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-500"
              disabled={saving}
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
