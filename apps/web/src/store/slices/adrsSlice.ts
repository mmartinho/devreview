/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Slice Redux das ADRs. Contém os thunks de acesso ao Supabase (listar, criar,
 * atualizar e excluir) e o estado de UI da página de ADRs (filtro por status, modal).
 *
 * Erros de mutação ficam em `mutationError`, separados de `fetchError`, para serem exibidos no
 * próprio modal/diálogo e não no banner global de carga.
 */
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getSupabase } from "@/lib/supabase";
import { Adr, AdrInput, AdrStatus } from "@/types";

/**
 * Busca as ADRs de um time, da mais recente para a mais antiga.
 * @param teamId UUID do time.
 * @returns Lista de ADRs.
 * @throws Error com a mensagem do Supabase em caso de falha.
 */
export const fetchAdrs = createAsyncThunk(
  "adrs/fetchAdrs",
  async (teamId: string) => {
    const { data, error } = await getSupabase()
      .from("adrs")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Adr[];
  }
);

/**
 * Normaliza os campos de texto (trim) de uma entrada de ADR.
 * @param input Dados do formulário.
 * @returns Cópia com título, contexto e decisão sem espaços nas pontas.
 */
function trimInput(input: AdrInput): AdrInput {
  return {
    ...input,
    title: input.title.trim(),
    context: input.context.trim(),
    decision: input.decision.trim(),
  };
}

/**
 * Cria uma nova ADR para o time.
 * @param arg.teamId UUID do time dono da ADR.
 * @param arg.input Título, contexto, decisão e status.
 * @returns A ADR criada, já com `id` e `created_at` gerados pelo banco.
 * @throws Error se o Supabase retornar erro (ex.: violação do CHECK de status).
 */
export const createAdr = createAsyncThunk(
  "adrs/createAdr",
  async (arg: { teamId: string; input: AdrInput }) => {
    const { data, error } = await getSupabase()
      .from("adrs")
      .insert({ team_id: arg.teamId, ...trimInput(arg.input) })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Adr;
  }
);

/**
 * Atualiza uma ADR existente.
 * @param arg.id UUID da ADR.
 * @param arg.input Novos valores dos campos editáveis.
 * @returns A ADR atualizada.
 * @throws Error se o Supabase falhar ou se nenhuma linha for afetada (ADR inexistente).
 */
export const updateAdr = createAsyncThunk(
  "adrs/updateAdr",
  async (arg: { id: string; input: AdrInput }) => {
    const { data, error } = await getSupabase()
      .from("adrs")
      .update(trimInput(arg.input))
      .eq("id", arg.id)
      .select();
    if (error) throw new Error(error.message);
    // update sem linhas afetadas não gera erro no supabase-js: tratamos explicitamente.
    if (!data || data.length === 0) throw new Error("ADR não encontrada.");
    return data[0] as Adr;
  }
);

/**
 * Exclui uma ADR (hard delete).
 * @param id UUID da ADR.
 * @returns O `id` removido.
 * @throws Error se o Supabase falhar ou se nenhuma linha for afetada.
 */
export const deleteAdr = createAsyncThunk(
  "adrs/deleteAdr",
  async (id: string) => {
    const { data, error } = await getSupabase()
      .from("adrs")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("ADR não encontrada.");
    return id;
  }
);

interface AdrsState {
  items: Adr[];
  fetchError: string | null;
  loading: boolean;
  statusFilter: AdrStatus | "all";
  /** true enquanto uma criação/edição/exclusão está em andamento. */
  saving: boolean;
  /** Erro da última mutação (criar/editar/excluir). */
  mutationError: string | null;
  isModalOpen: boolean;
  editingAdrId: string | null;
}

const initialState: AdrsState = {
  items: [],
  fetchError: null,
  loading: false,
  statusFilter: "all",
  saving: false,
  mutationError: null,
  isModalOpen: false,
  editingAdrId: null,
};

const adrsSlice = createSlice({
  name: "adrs",
  initialState,
  reducers: {
    setStatusFilter(state, action: PayloadAction<AdrStatus | "all">) {
      state.statusFilter = action.payload;
    },
    /** Abre o modal; `null` = nova ADR, string = id da ADR em edição. */
    openModal(state, action: PayloadAction<string | null>) {
      state.isModalOpen = true;
      state.editingAdrId = action.payload;
      state.mutationError = null;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.editingAdrId = null;
      state.mutationError = null;
    },
    /** Limpa o erro de mutação (ex.: ao abrir/fechar o diálogo de exclusão). */
    clearMutationError(state) {
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdrs.pending, (state) => {
        state.loading = true;
        state.fetchError = null;
      })
      .addCase(fetchAdrs.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
        state.fetchError = null;
      })
      .addCase(fetchAdrs.rejected, (state, action) => {
        state.loading = false;
        state.fetchError =
          action.error.message ?? "Não foi possível carregar as ADRs.";
      })
      .addCase(createAdr.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateAdr.fulfilled, (state, action) => {
        const i = state.items.findIndex((a) => a.id === action.payload.id);
        if (i >= 0) state.items[i] = action.payload;
      })
      .addCase(deleteAdr.fulfilled, (state, action) => {
        state.items = state.items.filter((a) => a.id !== action.payload);
      })
      .addMatcher(
        (a) => /^adrs\/(create|update|delete)Adr\/pending$/.test(a.type),
        (state) => {
          state.saving = true;
          state.mutationError = null;
        }
      )
      .addMatcher(
        (a) => /^adrs\/(create|update|delete)Adr\/fulfilled$/.test(a.type),
        (state) => {
          state.saving = false;
        }
      )
      .addMatcher(
        (a) => /^adrs\/(create|update|delete)Adr\/rejected$/.test(a.type),
        (state, action) => {
          state.saving = false;
          state.mutationError =
            (action as { error?: { message?: string } }).error?.message ??
            "Não foi possível salvar a alteração.";
        }
      );
  },
});

export const { setStatusFilter, openModal, closeModal, clearMutationError } =
  adrsSlice.actions;
export default adrsSlice.reducer;
