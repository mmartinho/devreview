/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Página "Regras de Review" (rota /regras). Lista as regras do time com filtros por
 * categoria e severidade e permite criar, editar (status Ativa/Inativa via toggle) e excluir regras,
 * persistindo no Supabase via thunks do `rulesSlice`.
 *
 * O modal de criação/edição só fecha após o sucesso da operação; em caso de erro a mensagem é
 * exibida no próprio modal e os dados digitados são preservados.
 */
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchRules,
  setCategoryFilter,
  setSeverityFilter,
  openModal,
  closeModal,
  createRule,
  updateRule,
  deleteRule,
  clearMutationError,
} from "@/store/slices/rulesSlice";
import { TEAM_ID } from "@/lib/team";
import { ReviewRule, RuleCategory, RuleSeverity } from "@/types";

/** Tamanho máximo aceito para a descrição de uma regra. */
const MAX_RULE_LENGTH = 500;

export function RulesPage() {
  const dispatch = useAppDispatch();
  const {
    items: rules,
    categoryFilter,
    severityFilter,
    isModalOpen,
    editingRuleId,
    saving,
    mutationError,
  } = useAppSelector((s) => s.rules);

  const [formRule, setFormRule] = useState("");
  const [formCategory, setFormCategory] = useState<RuleCategory>("style");
  const [formSeverity, setFormSeverity] = useState<RuleSeverity>("warning");
  const [formActive, setFormActive] = useState(true);
  const [ruleToDelete, setRuleToDelete] = useState<ReviewRule | null>(null);

  const trimmedRule = formRule.trim();
  const ruleTooLong = trimmedRule.length > MAX_RULE_LENGTH;
  const canSave = trimmedRule.length > 0 && !ruleTooLong && !saving;

  useEffect(() => {
    dispatch(fetchRules(TEAM_ID));
  }, [dispatch]);

  const editingRule = editingRuleId
    ? rules.find((r) => r.id === editingRuleId)
    : null;

  function handleOpenNew() {
    setFormRule("");
    setFormCategory("style");
    setFormSeverity("warning");
    setFormActive(true);
    dispatch(openModal(null));
  }

  /**
   * Abre o modal em modo edição com os dados da regra.
   * @param id UUID da regra a editar.
   */
  function handleOpenEdit(id: string) {
    const rule = rules.find((r) => r.id === id);
    if (rule) {
      setFormRule(rule.rule);
      setFormCategory(rule.category);
      setFormSeverity(rule.severity);
      setFormActive(rule.active);
      dispatch(openModal(id));
    }
  }

  /**
   * Valida e persiste a regra (cria ou atualiza conforme `editingRuleId`).
   * Fecha o modal só em sucesso; em erro, o `mutationError` do slice é exibido no modal.
   * @param e Evento de submit do formulário.
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const input = {
      rule: trimmedRule,
      category: formCategory,
      severity: formSeverity,
      active: editingRuleId ? formActive : true,
    };
    try {
      if (editingRuleId) {
        await dispatch(updateRule({ id: editingRuleId, input })).unwrap();
      } else {
        await dispatch(createRule({ teamId: TEAM_ID, input })).unwrap();
      }
      dispatch(closeModal());
    } catch {
      // Erro já registrado em `mutationError` pelo slice.
    }
  }

  /** Abre o diálogo de confirmação de exclusão. */
  function handleAskDelete(rule: ReviewRule) {
    dispatch(clearMutationError());
    setRuleToDelete(rule);
  }

  /** Confirma a exclusão da regra selecionada; fecha o diálogo só em sucesso. */
  async function handleConfirmDelete() {
    if (!ruleToDelete) return;
    try {
      await dispatch(deleteRule(ruleToDelete.id)).unwrap();
      setRuleToDelete(null);
    } catch {
      // Erro exibido no diálogo via `mutationError`.
    }
  }

  const filtered = rules.filter((rule) => {
    const matchCategory =
      categoryFilter === "all" || rule.category === categoryFilter;
    const matchSeverity =
      severityFilter === "all" || rule.severity === severityFilter;
    return matchCategory && matchSeverity;
  });

  return (
    <div className="flex flex-col overflow-y-auto">
      <Header
        title="Regras de Review"
        action={
          <Button
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-500"
            onClick={handleOpenNew}
          >
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select
            value={categoryFilter}
            onValueChange={(v) =>
              dispatch(setCategoryFilter(v as RuleCategory | "all"))
            }
          >
            <SelectTrigger className="w-44 border-gray-700 bg-gray-900 text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="border-gray-700 bg-gray-900">
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="style">Estilo</SelectItem>
              <SelectItem value="architecture">Arquitetura</SelectItem>
              <SelectItem value="security">Segurança</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={severityFilter}
            onValueChange={(v) =>
              dispatch(setSeverityFilter(v as RuleSeverity | "all"))
            }
          >
            <SelectTrigger className="w-40 border-gray-700 bg-gray-900 text-sm">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent className="border-gray-700 bg-gray-900">
              <SelectItem value="all">Todas severidades</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="warning">Aviso</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-gray-500">
            {filtered.length} regra{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-gray-800 bg-gray-900">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Regra</TableHead>
                <TableHead className="w-36 text-gray-400">Categoria</TableHead>
                <TableHead className="w-28 text-gray-400">Severidade</TableHead>
                <TableHead className="w-24 text-gray-400">Status</TableHead>
                <TableHead className="w-24 text-gray-400" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rule) => (
                <TableRow
                  key={rule.id}
                  className="border-gray-800 hover:bg-gray-800/50"
                >
                  <TableCell className="text-sm text-white">
                    {rule.rule}
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={rule.category} />
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={rule.severity} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        rule.active
                          ? "inline-flex items-center rounded-full border border-green-500/30 bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400"
                          : "inline-flex items-center rounded-full border border-gray-600/30 bg-gray-600/20 px-2.5 py-0.5 text-xs font-medium text-gray-400"
                      }
                    >
                      {rule.active ? "Ativa" : "Inativa"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar regra"
                      className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => handleOpenEdit(rule.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir regra"
                      className="h-8 w-8 text-gray-500 hover:text-red-400"
                      onClick={() => handleAskDelete(rule)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow className="border-gray-800">
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-gray-500"
                  >
                    Nenhuma regra encontrada com os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open && !saving) dispatch(closeModal());
        }}
      >
        <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-lg">
         <form onSubmit={handleSave} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra" : "Nova Regra"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-text" className="text-gray-300">
                Descrição da regra
              </Label>
              <Input
                id="rule-text"
                value={formRule}
                onChange={(e) => setFormRule(e.target.value)}
                placeholder="Ex: Nunca expor tokens em código-fonte"
                className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-600"
                aria-invalid={ruleTooLong}
                autoFocus
              />
              {ruleTooLong && (
                <p className="text-xs text-red-400">
                  A descrição deve ter no máximo {MAX_RULE_LENGTH} caracteres.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-gray-300">Categoria</Label>
                <Select
                  value={formCategory}
                  onValueChange={(v) => setFormCategory(v as RuleCategory)}
                >
                  <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gray-700 bg-gray-900">
                    <SelectItem value="style">Estilo</SelectItem>
                    <SelectItem value="architecture">Arquitetura</SelectItem>
                    <SelectItem value="security">Segurança</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-300">Severidade</Label>
                <Select
                  value={formSeverity}
                  onValueChange={(v) => setFormSeverity(v as RuleSeverity)}
                >
                  <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gray-700 bg-gray-900">
                    <SelectItem value="error">Erro</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingRule && (
              <div className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-800 px-3 py-2.5">
                <Label id="rule-active-label" className="text-gray-300">
                  Status:{" "}
                  <span
                    className={formActive ? "text-green-400" : "text-gray-400"}
                  >
                    {formActive ? "Ativa" : "Inativa"}
                  </span>
                </Label>
                <Switch
                  aria-labelledby="rule-active-label"
                  checked={formActive}
                  onCheckedChange={setFormActive}
                />
              </div>
            )}

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
        open={ruleToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setRuleToDelete(null);
            dispatch(clearMutationError());
          }
        }}
      >
        <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir regra</DialogTitle>
            <DialogDescription className="text-gray-400">
              Excluir a regra «{ruleToDelete?.rule}»? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          {mutationError && ruleToDelete && (
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
                setRuleToDelete(null);
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
