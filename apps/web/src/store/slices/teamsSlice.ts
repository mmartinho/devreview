/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-13
 * Data Atualização: 2026-11-13
 * Descrição: Slice Redux dos times. Contém os thunks de acesso ao Supabase (listar com contagem
 * de registros, criar, renomear e excluir), o "time atual" (contexto aplicado a toda a aplicação)
 * e o estado de UI do modal de times.
 *
 * O time atual é persistido no `localStorage` e, ao carregar a lista, só é reaproveitado se ainda
 * existir; caso contrário usa-se o primeiro time (ordenado por nome).
 */
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getSupabase } from "@/lib/supabase";
import { Team, TeamInput, TeamWithCounts } from "@/types";

/** Chave do `localStorage` onde o id do time atual é guardado. */
const STORAGE_KEY = "devreview.currentTeamId";

/**
 * Lê o id do time atual salvo no navegador.
 * @returns O id salvo ou `null` (inexistente ou storage indisponível).
 */
function readStoredTeamId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Salva o id do time atual no navegador (falhas são ignoradas).
 * @param id Id do time atual.
 */
function storeTeamId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage indisponível (modo privado, bloqueado): segue sem persistir.
  }
}

/** Ordena times por nome (pt-BR, sem diferenciar maiúsculas). */
function byName(a: Team, b: Team): number {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
}

/** Formato bruto retornado pelo PostgREST com os embeds `count`. */
interface TeamRow extends Team {
  review_rules?: { count: number }[];
  adrs?: { count: number }[];
  review_history?: { count: number }[];
}

/**
 * Converte a linha do Supabase (com embeds `[{count}]`) em `TeamWithCounts`.
 * @param row Linha retornada pela consulta.
 * @returns Time com `rules_count`, `adrs_count` e `reviews_count`.
 */
function toTeamWithCounts(row: TeamRow): TeamWithCounts {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    rules_count: row.review_rules?.[0]?.count ?? 0,
    adrs_count: row.adrs?.[0]?.count ?? 0,
    reviews_count: row.review_history?.[0]?.count ?? 0,
  };
}

/**
 * Busca todos os times com a contagem de regras, ADRs e reviews de cada um.
 * @returns Times ordenados por nome.
 * @throws Error com a mensagem do Supabase em caso de falha.
 */
export const fetchTeams = createAsyncThunk("teams/fetchTeams", async () => {
  const { data, error } = await getSupabase()
    .from("teams")
    .select("*, review_rules(count), adrs(count), review_history(count)")
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as TeamRow[]).map(toTeamWithCounts).sort(byName);
});

/**
 * Cria um novo time.
 * @param input Nome do time.
 * @returns O time criado, já com `id` e `created_at` gerados pelo banco.
 * @throws Error se o Supabase retornar erro.
 */
export const createTeam = createAsyncThunk(
  "teams/createTeam",
  async (input: TeamInput) => {
    const { data, error } = await getSupabase()
      .from("teams")
      .insert({ name: input.name.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Team;
  }
);

/**
 * Renomeia um time.
 * @param arg.id UUID do time.
 * @param arg.input Novo nome.
 * @returns O time atualizado.
 * @throws Error se o Supabase falhar ou se nenhuma linha for afetada (time inexistente).
 */
export const updateTeam = createAsyncThunk(
  "teams/updateTeam",
  async (arg: { id: string; input: TeamInput }) => {
    const { data, error } = await getSupabase()
      .from("teams")
      .update({ name: arg.input.name.trim() })
      .eq("id", arg.id)
      .select();
    if (error) throw new Error(error.message);
    // update sem linhas afetadas não gera erro no supabase-js: tratamos explicitamente.
    if (!data || data.length === 0) throw new Error("Time não encontrado.");
    return data[0] as Team;
  }
);

/**
 * Exclui um time. ATENÇÃO: o banco apaga em cascata suas regras, ADRs e histórico.
 * @param id UUID do time.
 * @returns O `id` removido.
 * @throws Error se o Supabase falhar ou se nenhuma linha for afetada.
 */
export const deleteTeam = createAsyncThunk(
  "teams/deleteTeam",
  async (id: string) => {
    const { data, error } = await getSupabase()
      .from("teams")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Time não encontrado.");
    return id;
  }
);

export interface TeamsState {
  items: TeamWithCounts[];
  /** Time atual (contexto aplicado a toda a aplicação); `null` até carregar / sem times. */
  currentTeamId: string | null;
  fetchError: string | null;
  loading: boolean;
  /** true enquanto uma criação/edição/exclusão está em andamento. */
  saving: boolean;
  /** Erro da última mutação (criar/editar/excluir). */
  mutationError: string | null;
  isModalOpen: boolean;
  editingTeamId: string | null;
}

const initialState: TeamsState = {
  items: [],
  currentTeamId: null,
  fetchError: null,
  loading: false,
  saving: false,
  mutationError: null,
  isModalOpen: false,
  editingTeamId: null,
};

/**
 * Escolhe um time atual válido: o preferido (se existir na lista), senão o primeiro.
 * @param items Times carregados.
 * @param preferred Ids candidatos, em ordem de preferência.
 * @returns Id escolhido ou `null` se não houver times.
 */
function pickCurrent(
  items: TeamWithCounts[],
  preferred: (string | null)[]
): string | null {
  for (const id of preferred) {
    if (id && items.some((t) => t.id === id)) return id;
  }
  return items[0]?.id ?? null;
}

const teamsSlice = createSlice({
  name: "teams",
  initialState,
  reducers: {
    /** Define o time atual e o persiste no navegador. */
    setCurrentTeam(state, action: PayloadAction<string>) {
      if (state.items.some((t) => t.id === action.payload)) {
        state.currentTeamId = action.payload;
        storeTeamId(action.payload);
      }
    },
    /** Abre o modal; `null` = novo time, string = id do time em edição. */
    openModal(state, action: PayloadAction<string | null>) {
      state.isModalOpen = true;
      state.editingTeamId = action.payload;
      state.mutationError = null;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.editingTeamId = null;
      state.mutationError = null;
    },
    /** Limpa o erro de mutação (ex.: ao abrir/fechar o diálogo de exclusão). */
    clearMutationError(state) {
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending, (state) => {
        state.loading = true;
        state.fetchError = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
        state.fetchError = null;
        state.currentTeamId = pickCurrent(action.payload, [
          state.currentTeamId,
          readStoredTeamId(),
        ]);
        storeTeamId(state.currentTeamId);
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.fetchError =
          action.error.message ?? "Não foi possível carregar os times.";
      })
      .addCase(createTeam.fulfilled, (state, action) => {
        state.items.push({
          ...action.payload,
          rules_count: 0,
          adrs_count: 0,
          reviews_count: 0,
        });
        state.items.sort(byName);
        // Primeiro time criado em uma base vazia já vira o time atual.
        if (!state.currentTeamId) {
          state.currentTeamId = action.payload.id;
          storeTeamId(state.currentTeamId);
        }
      })
      .addCase(updateTeam.fulfilled, (state, action) => {
        const i = state.items.findIndex((t) => t.id === action.payload.id);
        if (i >= 0) {
          state.items[i] = { ...state.items[i], name: action.payload.name };
          state.items.sort(byName);
        }
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload);
        if (state.currentTeamId === action.payload) {
          state.currentTeamId = pickCurrent(state.items, []);
          storeTeamId(state.currentTeamId);
        }
      })
      .addMatcher(
        (a) => /^teams\/(create|update|delete)Team\/pending$/.test(a.type),
        (state) => {
          state.saving = true;
          state.mutationError = null;
        }
      )
      .addMatcher(
        (a) => /^teams\/(create|update|delete)Team\/fulfilled$/.test(a.type),
        (state) => {
          state.saving = false;
        }
      )
      .addMatcher(
        (a) => /^teams\/(create|update|delete)Team\/rejected$/.test(a.type),
        (state, action) => {
          state.saving = false;
          state.mutationError =
            (action as { error?: { message?: string } }).error?.message ??
            "Não foi possível salvar a alteração.";
        }
      );
  },
});

/** Seletor do id do time atual (tipado sem importar o RootState, evitando import circular). */
export const selectCurrentTeamId = (s: { teams: TeamsState }) =>
  s.teams.currentTeamId;

export const { setCurrentTeam, openModal, closeModal, clearMutationError } =
  teamsSlice.actions;
export default teamsSlice.reducer;
