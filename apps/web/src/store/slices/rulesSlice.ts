/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Slice Redux das regras de review. Contém os thunks de acesso ao Supabase
 * (listar, criar, atualizar e excluir) e o estado de UI da página de regras (filtros, modal).
 *
 * Erros de mutação (criar/editar/excluir) ficam em `mutationError`, separados de `fetchError`,
 * para serem exibidos no próprio modal/diálogo e não no banner global de carga.
 */
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getSupabase } from "@/lib/supabase";
import { deleteTeam } from "./teamsSlice";
import { ReviewRule, RuleCategory, RuleInput, RuleSeverity } from "@/types";

/**
 * Busca as regras de um time, da mais recente para a mais antiga.
 * @param teamId UUID do time.
 * @returns Lista de regras.
 * @throws Error com a mensagem do Supabase em caso de falha.
 */
export const fetchRules = createAsyncThunk(
  "rules/fetchRules",
  async (teamId: string) => {
    const { data, error } = await getSupabase()
      .from("review_rules")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as ReviewRule[];
  }
);

/**
 * Cria uma nova regra para o time.
 * @param arg.teamId UUID do time dono da regra.
 * @param arg.input Dados da regra (descrição, categoria, severidade, status).
 * @returns A regra criada, já com `id` e `created_at` gerados pelo banco.
 * @throws Error se o Supabase retornar erro.
 */
export const createRule = createAsyncThunk(
  "rules/createRule",
  async (arg: { teamId: string; input: RuleInput }) => {
    const { data, error } = await getSupabase()
      .from("review_rules")
      .insert({
        team_id: arg.teamId,
        ...arg.input,
        rule: arg.input.rule.trim(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ReviewRule;
  }
);

/**
 * Atualiza uma regra existente.
 * @param arg.id UUID da regra.
 * @param arg.input Novos valores dos campos editáveis.
 * @returns A regra atualizada.
 * @throws Error se o Supabase falhar ou se nenhuma linha for afetada (regra inexistente).
 */
export const updateRule = createAsyncThunk(
  "rules/updateRule",
  async (arg: { id: string; input: RuleInput }) => {
    const { data, error } = await getSupabase()
      .from("review_rules")
      .update({ ...arg.input, rule: arg.input.rule.trim() })
      .eq("id", arg.id)
      .select();
    if (error) throw new Error(error.message);
    // update sem linhas afetadas não gera erro no supabase-js: tratamos explicitamente.
    if (!data || data.length === 0) throw new Error("Regra não encontrada.");
    return data[0] as ReviewRule;
  }
);

/**
 * Exclui uma regra (hard delete).
 * @param id UUID da regra.
 * @returns O `id` removido.
 * @throws Error se o Supabase falhar ou se nenhuma linha for afetada.
 */
export const deleteRule = createAsyncThunk(
  "rules/deleteRule",
  async (id: string) => {
    const { data, error } = await getSupabase()
      .from("review_rules")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Regra não encontrada.");
    return id;
  }
);

interface RulesState {
  /** Time dono dos `items` atuais (descarta respostas obsoletas ao trocar de time). */
  teamId: string | null;
  items: ReviewRule[];
  fetchError: string | null;
  loading: boolean;
  /** true enquanto uma criação/edição/exclusão está em andamento. */
  saving: boolean;
  /** Erro da última mutação (criar/editar/excluir). */
  mutationError: string | null;
  categoryFilter: RuleCategory | "all";
  severityFilter: RuleSeverity | "all";
  isModalOpen: boolean;
  editingRuleId: string | null;
}

const initialState: RulesState = {
  teamId: null,
  items: [],
  fetchError: null,
  loading: false,
  saving: false,
  mutationError: null,
  categoryFilter: "all",
  severityFilter: "all",
  isModalOpen: false,
  editingRuleId: null,
};

const rulesSlice = createSlice({
  name: "rules",
  initialState,
  reducers: {
    setCategoryFilter(state, action: PayloadAction<RuleCategory | "all">) {
      state.categoryFilter = action.payload;
    },
    setSeverityFilter(state, action: PayloadAction<RuleSeverity | "all">) {
      state.severityFilter = action.payload;
    },
    openModal(state, action: PayloadAction<string | null>) {
      state.isModalOpen = true;
      state.editingRuleId = action.payload;
      state.mutationError = null;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.editingRuleId = null;
      state.mutationError = null;
    },
    /** Limpa o erro de mutação (ex.: ao abrir/fechar o diálogo de exclusão). */
    clearMutationError(state) {
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRules.pending, (state, action) => {
        // Mudou de time: descarta a lista anterior para não exibir dados do time errado.
        if (state.teamId !== action.meta.arg) state.items = [];
        state.teamId = action.meta.arg;
        state.loading = true;
        state.fetchError = null;
      })
      .addCase(fetchRules.fulfilled, (state, action) => {
        // Resposta de um time que já não é o atual: ignora.
        if (action.meta.arg !== state.teamId) return;
        state.items = action.payload;
        state.loading = false;
        state.fetchError = null;
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        // O time exibido foi excluído (o banco apagou seus dados em cascata): limpa a lista.
        if (state.teamId === action.payload) {
          state.items = [];
          state.teamId = null;
        }
      })
      .addCase(fetchRules.rejected, (state, action) => {
        if (action.meta.arg !== state.teamId) return;
        state.loading = false;
        state.fetchError =
          action.error.message ?? "Não foi possível carregar as regras.";
      })
      .addCase(createRule.fulfilled, (state, action) => {
        // Só insere se a lista exibida ainda é a do time em que a regra/ADR foi criada.
        if (action.payload.team_id === state.teamId) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(updateRule.fulfilled, (state, action) => {
        const i = state.items.findIndex((r) => r.id === action.payload.id);
        if (i >= 0) state.items[i] = action.payload;
      })
      .addCase(deleteRule.fulfilled, (state, action) => {
        state.items = state.items.filter((r) => r.id !== action.payload);
      })
      .addMatcher(
        (a) => /^rules\/(create|update|delete)Rule\/pending$/.test(a.type),
        (state) => {
          state.saving = true;
          state.mutationError = null;
        }
      )
      .addMatcher(
        (a) => /^rules\/(create|update|delete)Rule\/fulfilled$/.test(a.type),
        (state) => {
          state.saving = false;
        }
      )
      .addMatcher(
        (a) => /^rules\/(create|update|delete)Rule\/rejected$/.test(a.type),
        (state, action) => {
          state.saving = false;
          state.mutationError =
            (action as { error?: { message?: string } }).error?.message ??
            "Não foi possível salvar a alteração.";
        }
      );
  },
});

export const {
  setCategoryFilter,
  setSeverityFilter,
  openModal,
  closeModal,
  clearMutationError,
} = rulesSlice.actions;
export default rulesSlice.reducer;
