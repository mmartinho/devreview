/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Slice Redux do histórico de reviews. Contém o thunk de leitura no Supabase
 * (filtrado pelo time atual) e o filtro por repositório da página de histórico.
 *
 * Ao trocar de time a lista anterior é descartada e respostas obsoletas são ignoradas.
 */
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getSupabase } from "@/lib/supabase";
import { deleteTeam } from "./teamsSlice";
import { ReviewHistory } from "@/types";

export const fetchHistory = createAsyncThunk(
  "history/fetchHistory",
  async (teamId: string) => {
    const { data, error } = await getSupabase()
      .from("review_history")
      .select("*")
      .eq("team_id", teamId)
      .order("reviewed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as ReviewHistory[];
  }
);

interface HistoryState {
  /** Time dono dos `items` atuais (descarta respostas obsoletas ao trocar de time). */
  teamId: string | null;
  items: ReviewHistory[];
  fetchError: string | null;
  loading: boolean;
  repoFilter: string;
}

const initialState: HistoryState = {
  teamId: null,
  items: [],
  fetchError: null,
  loading: false,
  repoFilter: "",
};

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    setRepoFilter(state, action: PayloadAction<string>) {
      state.repoFilter = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHistory.pending, (state, action) => {
        // Mudou de time: descarta a lista anterior para não exibir dados do time errado.
        if (state.teamId !== action.meta.arg) state.items = [];
        state.teamId = action.meta.arg;
        state.loading = true;
        state.fetchError = null;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
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
      .addCase(fetchHistory.rejected, (state, action) => {
        if (action.meta.arg !== state.teamId) return;
        state.loading = false;
        state.fetchError =
          action.error.message ?? "Não foi possível carregar o histórico.";
      });
  },
});

export const { setRepoFilter } = historySlice.actions;
export default historySlice.reducer;
