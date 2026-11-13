Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
Data Criação: 2026-11-13
Data Atualização: 2026-11-13 (revisão: select movido para o Header da página)
Descrição: Plano para (1) substituir o `TEAM_ID` fixo do client web (`apps/web`) por um "time atual" escolhido em um select box no **header de cada página** (título à esquerda, select no centro, botão de ação à direita), filtrando toda a aplicação, e (2) adicionar uma página/CRUD de "Times" (`/times`) no menu principal, que alimenta esse select. Plano aprovado e já implementado (branch `feat/web-teams`, criada a partir de `feat/web-crud-adrs`); o `Adr` ganhou `team_id` no tipo, que faltava.

# Plano: seletor de time global + CRUD de Times

## 1. Análise da proposta

A proposta é **viável e coerente com o modelo de dados**: `review_rules`, `adrs` e `review_history` já têm `team_id uuid not null` com FK para `teams(id)`. O multi-time já existe no banco (e no MCP server, cujas tools recebem `team_id` como parâmetro); o que o impede no client é uma única constante.

### Estado atual (confirmado no código e no banco cloud, projeto `ehbblydlzvamhttsjlxx`)
| Item | Situação |
|---|---|
| `src/lib/team.ts` | `export const TEAM_ID = "1111…1111"` — fixo. |
| Uso de `TEAM_ID` | `DashboardPage` (3 fetches), `RulesPage` (fetch + `createRule`), `AdrsPage` (fetch + `createAdr`), `HistoryPage` (fetch). Os thunks `fetch*` já recebem `teamId` por parâmetro e filtram com `.eq("team_id", teamId)` → **o filtro por time já está pronto; falta só trocar a origem do valor**. |
| `Sidebar.tsx` | Logo + "DevReview" no topo, `navItems` com 4 itens. **Fica sem o seletor** (só ganha o item "Times"). |
| `Header.tsx` | **Já é o componente compartilhado** pelas 4 páginas (`<Header title action />`, flex `justify-between`, 2 zonas). É o lugar natural do select → passa a ter 3 zonas. |
| Tabela `teams` | `id uuid default gen_random_uuid()` (PK), `name text not null`, `created_at timestamptz default now()`. **Só 3 colunas.** Hoje há 1 time ("Frontend"). Sem índice/constraint de unicidade em `name`. |
| FKs | As 3 tabelas filhas: `ON DELETE CASCADE` em `team_id`. |
| Permissões | RLS desabilitada; `anon` tem `SELECT/INSERT/UPDATE/DELETE` em `teams` → **não é necessária migration** para o CRUD funcionar. |
| Dados hoje | teams 1 · review_rules 8 · adrs 4 · review_history 6 (todos do time "Frontend"). |
| MCP server | `get_team_review_rules`, `search_team_adrs`, `get_review_metrics` já recebem `team_id` → **sem mudanças**; passam a servir os times novos (o UUID aparece na página de Times, ver 3.6). |

### Pontos de atenção que a proposta levanta (e como o plano os trata)
1. **Corrida de requisições ao trocar de time** — se o usuário troca A→B enquanto o fetch de A está em voo, a resposta de A pode chegar depois e sobrescrever a lista de B (dados do time errado na tela). Solução em 3.3.
2. **Excluir um time apaga tudo dele** (`ON DELETE CASCADE`): regras, ADRs e histórico. É a ação mais destrutiva do app → confirmação reforçada (3.5).
3. **Nunca ficar sem time** — com 0 times não há contexto válido; o app precisa de estado vazio e a exclusão do último time deve ser bloqueada (ou, no mínimo, tratada).
4. **Ordem de carga** — as páginas só podem buscar dados depois que os times carregarem e houver um time atual.
5. **Persistência da escolha** — sem ela, o F5 volta sempre ao primeiro time.
6. **Header em 3 zonas** — o select precisa ficar realmente centralizado (independente da largura do título e do botão) e se comportar bem em telas estreitas (ver 3.4).

## 2. Decisões

| Tema | Decisão | Origem |
|---|---|---|
| Localização do select | **No `Header` de cada página, na zona central**: título à esquerda, select no meio, botão de ação ("Nova Regra", "Nova ADR", "Novo Time") à direita. Implementado **uma única vez** no `Header` compartilhado — as páginas não repetem o select. O seletor sai da Sidebar (mais espaço, nomes longos legíveis). | Pedido do usuário (revisão) |
| Fonte do "time atual" | Novo slice Redux `teamsSlice` (`items`, `currentTeamId`, `loading`, `fetchError`, `saving`, `mutationError`, modal). Seletor `selectCurrentTeam`. | Convenção do projeto (Redux Toolkit) |
| Persistência da escolha | `localStorage` (chave `devreview.currentTeamId`), com `try/catch`; ao carregar os times, só é usada se o id ainda existir na lista, senão cai no 1º time (ordenado por `name`). | Padrão assumido — *confirmar* |
| Ao trocar de time | Limpar `items` de `rules`/`adrs`/`history` e refazer os fetches da página atual (não da rota inteira); resetar filtros? **Não** — mantém filtros de categoria/severidade/status/repositório. | Padrão assumido |
| Remover `TEAM_ID` | `lib/team.ts` deixa de exportar a constante; páginas passam a ler `currentTeamId` do store. (Mantém um comentário sobre o seed do time demo.) | Proposta do usuário |
| Menu | Novo item **"Times"** (`/times`, ícone `Users`) em `navItems`, depois de "ADRs". | Proposta do usuário |
| Apresentação da lista de Times | **Tabela** (como Regras): Nome, nº de regras / ADRs / reviews, criado em, ações. Contagens via embed do PostgREST: `select("*, review_rules(count), adrs(count), review_history(count)")` — 1 query, sem migration. | Padrão assumido — *confirmar* |
| Campos do CRUD | Apenas `name` (única coluna editável do schema). Sem migration para descrição, slug etc. | Schema atual |
| Nome duplicado | Validação **no client** (comparação case-insensitive com a lista carregada) + aviso; **sem** constraint no banco neste plano. Opcional (seção 7): índice único `lower(name)`. | Padrão assumido — *confirmar* |
| Exclusão | **Hard delete** com diálogo que mostra quantos registros serão apagados (ex.: "8 regras, 4 ADRs e 6 reviews") e exige **digitar o nome do time** para habilitar "Excluir". **Bloqueada** quando só existir 1 time. Se o time excluído for o atual, troca para outro. | Padrão assumido (ação destrutiva) — *confirmar* |
| Criar time | Após criar, o time passa a existir no select; **não** troca automaticamente (evita surpresa). | Padrão assumido |
| RLS / auth | **Fora do escopo** (mesma decisão anterior). Ver seção 7: sem RLS/auth, "time atual" é só um filtro de UI, não uma barreira de segurança. | Decisão anterior do usuário |

> Os itens "confirmar" não foram respondidos; se discordar, só a seção correspondente muda.

## 3. Alterações propostas

### 3.1 Tipos — `src/types/index.ts`
```ts
export interface Team {
  id: string;
  name: string;
  created_at?: string;
}
/** Time com contagem de registros associados (listagem em /times). */
export interface TeamWithCounts extends Team {
  rules_count: number;
  adrs_count: number;
  reviews_count: number;
}
export type TeamInput = Pick<Team, "name">;
```

### 3.2 `src/store/slices/teamsSlice.ts` (novo)
Mesmo padrão de `rulesSlice`/`adrsSlice` (cabeçalho, JSDoc, `getSupabase()`, matchers `pending/fulfilled/rejected`):

| Thunk | Operação | Retorno |
|---|---|---|
| `fetchTeams()` | `.from("teams").select("*, review_rules(count), adrs(count), review_history(count)").order("name")` e mapeia `[{count}]` → `*_count` | `TeamWithCounts[]` |
| `createTeam({ name })` | `.insert({ name: trim }).select().single()` | `Team` |
| `updateTeam({ id, name })` | `.update({ name: trim }).eq("id", id).select()`; vazio → erro "Time não encontrado." | `Team` |
| `deleteTeam(id)` | `.delete().eq("id", id).select("id")`; vazio → erro | `id` |

Estado: `items`, `currentTeamId: string | null`, `loading`, `fetchError`, `saving`, `mutationError`, `isModalOpen`, `editingTeamId`.
Reducers: `setCurrentTeam(id)` (grava no `localStorage`), `openModal/closeModal/clearMutationError`.
`fetchTeams.fulfilled`: define `currentTeamId` (persistido válido → senão 1º da lista → senão `null`).
`deleteTeam.fulfilled`: remove da lista; se era o atual, escolhe o 1º restante.
`createTeam.fulfilled`: insere ordenado por `name`, com contagens `0`.
Seletores exportados: `selectCurrentTeamId`, `selectCurrentTeam`.
Registrar `teams: teamsReducer` em `store/index.ts`.

### 3.3 Troca de time sem dados "vazando" (corrida de requisições)
Nos slices `rules`, `adrs` e `history`:
- Novo reducer/`extraReducers` que reage a `setCurrentTeam` (via `addCase(setCurrentTeam, …)`): zera `items` e `fetchError`.
- Guardar em cada `fetch*` o `teamId` solicitado (disponível em `action.meta.arg`) e, no `fulfilled`, **ignorar o resultado se `meta.arg !== currentTeamId`**. Como o slice não vê o estado global, a forma mais simples é o thunk checar `getState().teams.currentTeamId` ao final e lançar `ConditionError`/retornar `rejectWithValue("stale")` tratado silenciosamente; alternativa equivalente: gravar `requestedTeamId` no `pending` e comparar no `fulfilled`.
- Ao trocar de time dentro de uma mutação em andamento: `saving` já bloqueia modais; o select fica `disabled` enquanto `saving` (qualquer slice) para não trocar de contexto no meio de uma gravação.
- `createRule/createAdr` passam a usar `teamId` do time atual (evita criar no time errado).

### 3.4 Header em 3 zonas com o seletor de time — `Header.tsx` + `TeamSwitcher.tsx` (novo)
Hoje `<Header title action />` já é compartilhado pelas 4 páginas, então **o select é implementado uma única vez dentro do `Header`** e nenhuma página repete código dele.

- **Layout**: `grid grid-cols-[1fr_auto_1fr] items-center gap-4`:
  - zona esquerda: `<h1>` (título), `justify-self-start`, `min-w-0 truncate`;
  - zona central: `<TeamSwitcher />`, com largura fixa (`w-56`);
  - zona direita: `{action}`, `justify-self-end`.
  O `1fr / auto / 1fr` mantém o select **realmente centralizado**, mesmo quando o título é longo ("ADRs — Decisões de Arquitetura") ou a página não tem botão (Início, Histórico → zona direita vazia, o select continua no centro).
- **Telas estreitas** (< `md`): vira 2 linhas — linha 1: título + ação; linha 2: select ocupando a largura toda (ordem via classes responsivas).
- **Props do `Header`**: `title`, `action?` (inalteradas → as páginas existentes não precisam mudar a chamada) e `showTeamSwitcher?: boolean` (padrão `true`; permite desligar numa tela futura sem contexto de time).
- **`TeamSwitcher`** (`components/layout/TeamSwitcher.tsx`): usa o `Select` já existente (`ui/select`), valor = `currentTeamId`, opções = `items` (nome), `onValueChange → dispatch(setCurrentTeam(id))`; ícone `Users`, `aria-label="Time"`, nome truncado com `title` completo; `disabled` enquanto `saving` em qualquer slice.
  - Carregando: placeholder "Carregando times…", desabilitado.
  - Sem times: no lugar do select, link "Criar o primeiro time" → `/times`.
  - Erro de carga: tratado pelo `DataSourceBanner` (passa a incluir `teams.fetchError`).
- **Sidebar**: **sem seletor**; só ganha o item `{ to: "/times", label: "Times", icon: Users }` em `navItems`.
- **Na própria página `/times`** o select continua no header (consistência; mostra o time atual); o botão "Usar este time" deixa de ser necessário.

### 3.5 Página de Times — `src/pages/TeamsPage.tsx` (novo) + rota
- Rota `/times` em `App.tsx`; `fetchTeams()` é disparado **uma vez no App** (não na página), pois o select global depende dele; a página também re-busca ao montar para atualizar contagens.
- `Header` "Times" com botão **"Novo Time"** (mesmo estilo dos botões de Regras/ADRs) na zona direita; select de time no centro, como nas demais páginas.
- Tabela: **Nome** (com badge "Atual" no time selecionado), **Regras / ADRs / Reviews** (contagens), **Criado em**, e ações (lápis, lixeira — mesmo padrão de Regras).
- Modal criar/editar (padrão de Regras/ADRs): campo **Nome** (obrigatório, trim, ≤ 80 caracteres, duplicado case-insensitive bloqueado com mensagem), `<form onSubmit>`, fecha só em sucesso, erro no modal, `saving` desabilita botões.
- Exclusão: diálogo (`Dialog`, no padrão já usado em Regras/ADRs) com texto "Excluir o time «X»? Serão apagados **8 regras, 4 ADRs e 6 reviews**. Esta ação não pode ser desfeita." e campo para **digitar o nome** do time; o botão "Excluir" (vermelho) só habilita quando o texto confere. Lixeira **desabilitada** (com `title` explicativo) quando `items.length === 1`.
- Coluna/ação "Copiar ID" (UUID) — útil porque as tools do MCP server exigem `team_id`; copia via `navigator.clipboard` (com `try/catch`).

### 3.6 Páginas existentes passam a usar o time atual
| Arquivo | Mudança |
|---|---|
| `Header.tsx` | 3 zonas (título · `TeamSwitcher` · ação); props existentes inalteradas (3.4). As 4 páginas ganham o select **sem alterar a chamada** `<Header title action />`. |
| `DashboardPage.tsx` | `const teamId = useAppSelector(selectCurrentTeamId)`; `useEffect` dispara os 3 fetches **somente se `teamId`** e depende de `[dispatch, teamId]`. |
| `RulesPage.tsx` | Idem no fetch; `createRule({ teamId, … })`; sem time → estado vazio. |
| `AdrsPage.tsx` | Idem. |
| `HistoryPage.tsx` | Idem. |
| Todas | Estado "sem time selecionado": mensagem + link para `/times` (escrita inline em cada página); botões "Nova Regra/ADR" desabilitados enquanto não há time. |
| `DataSourceBanner.tsx` | Incluir `teams.fetchError` na cascata de erros. |
| `lib/team.ts` | Remover `TEAM_ID` (ou reduzir a comentário/constante de seed); `grep` garante que nenhum import restou. |

### 3.7 Efeitos colaterais a verificar
- `Dashboard` (contagens, "regras recentes") reflete o time atual e atualiza ao trocar.
- Modais abertos + troca de time: o select agora fica no header, acessível por teclado com o modal aberto. Tratar fechando modais em `setCurrentTeam` (o select também fica `disabled` enquanto `saving`), para nunca gravar no time errado.
- Cabeçalhos/JSDoc exigidos pelo `CLAUDE.md` em todos os arquivos novos/alterados.
- Nenhuma mudança no MCP server nem no banco.

## 4. Ordem de implementação
1. `types` (`Team`, `TeamWithCounts`, `TeamInput`).
2. `teamsSlice` + registro no `store` + `localStorage` da escolha.
3. Guarda contra dados obsoletos nos slices `rules/adrs/history` (3.3) e reação a `setCurrentTeam`.
4. `Header` em 3 zonas + `TeamSwitcher`; item "Times" no `Sidebar`; `DataSourceBanner`.
5. Trocar `TEAM_ID` por `currentTeamId` nas 4 páginas, com estado "sem time"; remover `lib/team.ts`.
6. `TeamsPage` (lista → criar/editar → excluir com confirmação reforçada); rota em `App.tsx`.
7. Build, replay dos thunks, testes manuais, atualizar este plano, commit.

## 5. Plano de verificação
Sem runner de testes no `apps/web`; verificação = tipagem + funcional:

1. `npm run build` (`tsc -b` + `vite build`) sem erros; `grep TEAM_ID apps/web/src` sem resultados.
2. **Replay dos thunks** via script Node com a anon key (mesma técnica de Regras/ADRs): criar time, editar nome, embed de contagens (`review_rules(count)…`), inserir regra/ADR no time novo, excluir time e **confirmar o CASCADE** (as linhas filhas somem), update/delete com 0 linhas → erro.
3. **Manual**:
   - Select mostra os times e o atual; trocar de time muda Regras, ADRs, Histórico e Dashboard (listas e contadores), mantendo os filtros.
   - **Isolamento**: criar regra/ADR no time B; voltar ao A → não aparece; conferir `team_id` no banco.
   - **Persistência**: F5 mantém o time escolhido; id inexistente no `localStorage` → cai no 1º time sem erro.
   - **Corrida**: trocar A→B→A rapidamente (throttling "Slow 3G" no DevTools) → a tela sempre mostra os dados do time atual.
   - **Times**: criar, editar, nome vazio/duplicado/>80 → bloqueado; excluir exige digitar o nome; contagens corretas no diálogo; excluir o time atual troca para outro; lixeira desabilitada com 1 time.
   - **Sem times** (simulado): estado vazio nas páginas e no select, sem erros no console.
   - **Layout do header**: título à esquerda, select **centralizado** e botão à direita em todas as páginas (inclusive Início/Histórico, sem botão); título longo e nome de time longo truncam sem deslocar o select; abaixo de `md` o header quebra em 2 linhas.
4. **Dados de teste**: criar times `[TESTE] …` e **excluí-los ao final**; conferir que "Frontend" mantém 8 regras, 4 ADRs e 6 reviews (contagem antes/depois, como nas rodadas anteriores).

## 6. Riscos e pontos de atenção
- **Exclusão em cascata**: apagar o time "Frontend" apagaria todos os dados atuais; por isso a confirmação por digitação, a contagem exibida e o bloqueio do último time. Nunca testar a exclusão no time "Frontend" — só em times `[TESTE]`.
- **Banco cloud real**: o `.env` aponta para ele; qualquer teste grava lá.
- **Sem RLS/auth**: "time atual" é apenas filtro de interface; qualquer portador da anon key lê/altera dados de qualquer time (mesma pendência anterior).
- **Compatibilidade com Supabase local** (`supabase/seed.sql` usa o UUID fixo): continua funcionando — o time do seed simplesmente aparece no select.
- **Embed de contagens** exige que as FKs sejam detectáveis pelo PostgREST (são, via `*_team_id_fkey`); se o schema cache falhar, fallback é 3 queries `count` por time.
- **Corrida de requisições** (3.3) é o bug mais provável dessa feature se for omitida.

## 7. Pendências fora do escopo
- **RLS + autenticação** (Supabase Auth): vincular usuários a times (tabela `team_members`) e policies por `team_id`; só então o seletor viraria "times do usuário".
- Índice único `lower(name)` em `teams` (migration) para impedir nomes duplicados também no banco.
- Colunas extras em `teams` (descrição, slug) e `updated_at`.
- Soft delete / arquivamento de times (em vez de hard delete com cascade).
- Toasts e deep-link do time na URL (ex.: `?time=<id>`), para compartilhar o contexto.

## 8. Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `apps/web/src/types/index.ts` | **+** `Team`, `TeamWithCounts`, `TeamInput` |
| `apps/web/src/store/slices/teamsSlice.ts` | **Novo**: thunks, `currentTeamId`, persistência, seletores |
| `apps/web/src/store/index.ts` | registrar `teams` |
| `apps/web/src/store/slices/{rules,adrs,history}Slice.ts` | limpar ao trocar de time; ignorar respostas obsoletas |
| `apps/web/src/components/layout/TeamSwitcher.tsx` | **Novo**: select do time atual (usado dentro do `Header`) |
| `apps/web/src/components/layout/Header.tsx` | grid de 3 zonas (título · select · ação), prop opcional `showTeamSwitcher` |
| `apps/web/src/components/layout/Sidebar.tsx` | **somente** o item de menu "Times" (o seletor NÃO fica aqui) |
| `apps/web/src/components/layout/DataSourceBanner.tsx` | incluir `teams.fetchError` |
| `apps/web/src/pages/TeamsPage.tsx` | **Novo**: lista + CRUD + exclusão reforçada |
| `apps/web/src/App.tsx` | rota `/times`; `fetchTeams` no carregamento |
| `apps/web/src/pages/{Dashboard,Rules,Adrs,History}Page.tsx` | usar `currentTeamId`; estado "sem time" |
| `apps/web/src/lib/team.ts` | remover `TEAM_ID` |
| Banco / MCP server | **nenhuma alteração** |
