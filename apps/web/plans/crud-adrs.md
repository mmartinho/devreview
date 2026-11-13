Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
Data Criação: 2026-11-13
Data Atualização: 2026-11-13
Descrição: Plano de implementação do CRUD completo (criar, alterar, excluir) de ADRs (Architecture Decision Records) no client web (`apps/web`, rota `/adrs`), persistindo no Supabase. Hoje a tela só lista os ADRs como cards. Plano aprovado e já implementado (branch `feat/web-crud-adrs`); limites de tamanho conferidos contra as ADRs existentes (máx. 52/147/126 caracteres em título/contexto/decisão).

# Plano: criar, editar e excluir ADRs

## 1. Diagnóstico

### Estado atual (confirmado no código)
| Local | Situação |
|---|---|
| `src/pages/AdrsPage.tsx` | Somente leitura: abas de filtro por status + grid de cards. Não há botão "Nova ADR", nem ações por card, nem modal. |
| `src/store/slices/adrsSlice.ts` | Só existe o thunk `fetchAdrs` (SELECT). Não há `INSERT`/`UPDATE`/`DELETE`. Também não tem o cabeçalho/JSDoc exigido pelo `CLAUDE.md`. |
| `src/pages/AdrsPage.tsx` | `statusConfig`, `formatDate`, `tabItems` estão no arquivo da página; o `Header` já aceita a prop `action` (usada em `RulesPage` para o botão "Nova Regra"). |
| `src/components/ui/` | Não existe `textarea.tsx` (Contexto e Decisão são textos longos). Existem `dialog`, `input`, `label`, `select`, `button`, `switch`. |

### O banco NÃO precisa de mudanças (verificado no Supabase cloud, projeto `ehbblydlzvamhttsjlxx`)
- Tabela `adrs`: `id uuid default gen_random_uuid()` (PK), `team_id uuid not null` (FK → `teams(id)` `ON DELETE CASCADE`), `title text not null`, `context text not null`, `decision text not null`, `status text not null default 'proposed'` com `CHECK (status IN ('proposed','accepted','deprecated'))`, `created_at timestamptz default now()`.
- Os valores do tipo `AdrStatus` do client (`proposed | accepted | deprecated`) batem com o CHECK.
- RLS desabilitada e o papel `anon` tem `SELECT/INSERT/UPDATE/DELETE` (conferido com `has_table_privilege`) → o client já pode escrever com a anon key; nenhuma migration é necessária.
- Hoje há 5 ADRs (3 aceitas, 1 proposta, 1 depreciada) para o `TEAM_ID` fixo `1111…1111`.
- O `.env` do web aponta para o cloud real → os testes gravam no banco real (ver seção 6).

### Observação sobre o identificador exibido
O rodapé do card mostra `ADR-` + 3 primeiros caracteres do UUID (ex.: `ADR-00C`). É só visual (não é chave única nem sequencial). **Mantido como está**; numeração sequencial real exigiria migration (fora do escopo, seção 7).

## 2. Decisões

| Tema | Decisão | Origem |
|---|---|---|
| RLS / segurança | **Fora do escopo**, igual ao CRUD de regras. Registrado como pendência (seção 7). | Consistência com decisão anterior do usuário |
| Exclusão | **Hard delete** com diálogo de confirmação. (Para preservar histórico já existe o status "Depreciada".) | Padrão assumido — *confirmar* |
| Edição de status | **Select** com as 3 opções (Proposta / Aceita / Depreciada) no modal, em criação **e** edição (diferente de Regras: aqui são 3 estados, não cabe um toggle). Nova ADR nasce como **Proposta**. | Padrão assumido — *confirmar* |
| Campos editáveis | `title`, `context`, `decision`, `status`. `team_id` e `created_at` não são editáveis. | Schema |
| Onde ficam as ações | Ícones **Editar** (lápis) e **Excluir** (lixeira) no canto do card, ao lado do badge de status. Sempre visíveis (não só no hover) para funcionar em touch. | Padrão assumido — *confirmar* |
| Estado/UI | Mesmo padrão de Regras: Redux Toolkit (`createAsyncThunk`) + componentes `ui/*`. Sem novas dependências. Criar apenas `ui/textarea.tsx` (padrão shadcn, `<textarea>` nativo estilizado como o `Input`). | Convenção do projeto |
| Texto completo | Os cards usam `line-clamp-2`; o modal de edição mostra o texto inteiro, então não é necessário um modal de "visualizar". | Escopo mínimo |

> Os itens "assumido" não foram respondidos; se discordar, só as seções 3.4–3.6 mudam.

## 3. Alterações propostas

### 3.1 `src/types/index.ts`
- Criar o tipo auxiliar de entrada do formulário:
  ```ts
  export type AdrInput = Pick<Adr, "title" | "context" | "decision" | "status">;
  ```
- Atualizar "Data Atualização" no cabeçalho.

### 3.2 `src/components/ui/textarea.tsx` (novo)
- `forwardRef<HTMLTextAreaElement>` no estilo do `input.tsx` (mesmas classes de borda/fundo/foco), com cabeçalho e JSDoc.

### 3.3 `src/store/slices/adrsSlice.ts` — thunks e estado
Mesmo padrão de `rulesSlice.ts` (`getSupabase()`, lançam `Error(error.message)`):

| Thunk | Operação | Retorno |
|---|---|---|
| `createAdr({ teamId, input })` | `.from("adrs").insert({ team_id, ...input, title/context/decision: trim }).select().single()` | `Adr` criada (com `id`/`created_at` do banco) |
| `updateAdr({ id, input })` | `.update({ ...input, campos: trim }).eq("id", id).select()` | `Adr` atualizada |
| `deleteAdr(id)` | `.delete().eq("id", id).select("id")` | `id` removido |

> `update/delete` no supabase-js **não falham** com 0 linhas afetadas: usar `.select()` e tratar retorno vazio como erro `"ADR não encontrada."` (mesma técnica de `rulesSlice`).

Estado novo em `AdrsState`:
- `saving: boolean`, `mutationError: string | null`, `isModalOpen: boolean`, `editingAdrId: string | null` (o modal passa a ser controlado pelo Redux, como em Regras).
- Reducers: `openModal(id | null)`, `closeModal`, `clearMutationError` (limpam `mutationError`).
- `extraReducers`:
  - `createAdr.fulfilled` → `items.unshift(payload)`; **atenção**: `fetchAdrs` ordena por `created_at desc`, então uma ADR nova (data = agora) fica no topo, coerente.
  - `updateAdr.fulfilled` → substitui por `id`; `deleteAdr.fulfilled` → filtra por `id`.
  - Matchers `pending/fulfilled/rejected` com regex `/^adrs\/(create|update|delete)Adr\/.../` ajustam `saving` e `mutationError` (mesmo esquema de Regras).
- O erro de mutação fica separado de `fetchError` (que alimenta o `DataSourceBanner`).
- Adicionar cabeçalho e JSDoc (params/retorno/exceções) em todo o arquivo, conforme `CLAUDE.md`.

### 3.4 `src/pages/AdrsPage.tsx` — criar
- Botão **"Nova ADR"** (`Plus`, `bg-indigo-600`) na prop `action` do `Header`, igual ao de Regras.
- Estados locais do formulário: `formTitle`, `formContext`, `formDecision`, `formStatus` (inicial `proposed`).
- Modal (`Dialog`, `max-w-2xl`) dentro de um `<form onSubmit={handleSave}>` com:
  - **Título** (`Input`, obrigatório, ≤ 150 caracteres).
  - **Contexto** (`Textarea`, ~4 linhas, obrigatório, ≤ 2000).
  - **Decisão** (`Textarea`, ~4 linhas, obrigatório, ≤ 2000).
  - **Status** (`Select`: Proposta/Aceita/Depreciada).
  - Validação inline (`trim()` não vazio e limites), `canSave = válido && !saving`.
  - `<p role="alert">` com `mutationError`; botão "Salvando…" enquanto `saving`.
  - `onOpenChange` ignora pedidos de fechar durante `saving`.
- `handleSave`: `editingAdrId ? updateAdr : createAdr` com `.unwrap()`; fecha o modal **somente em sucesso** (em erro, mantém o que o usuário digitou).
- Efeito colateral de filtro: se a aba ativa for "Aceitas" e o usuário criar uma "Proposta", ela não aparece até trocar de aba (comportamento esperado; contadores nas abas atualizam sozinhos).

### 3.5 `src/pages/AdrsPage.tsx` — editar
- Botão lápis no card (`aria-label="Editar ADR"`) → `handleOpenEdit(adr)` preenche os 4 campos e `dispatch(openModal(adr.id))`.
- Título do modal muda para "Editar ADR" / "Nova ADR".
- `updateAdr` envia `title`, `context`, `decision`, `status`.

### 3.6 `src/pages/AdrsPage.tsx` — excluir
- Botão lixeira (`Trash2`, `aria-label="Excluir ADR"`, `hover:text-red-400`) no card, ao lado do lápis.
- Diálogo de confirmação reutilizando `Dialog`: *"Excluir a ADR «título»? Esta ação não pode ser desfeita."* com **Cancelar** / **Excluir** (vermelho). Estado local `adrToDelete`.
- Confirmar → `dispatch(deleteAdr(id)).unwrap()`; "Excluindo…", fecha no sucesso, mostra erro no próprio diálogo (e `clearMutationError` ao abrir/fechar).

### 3.7 Efeitos colaterais a verificar
- `DashboardPage.tsx` usa `s.adrs.items.length` (card "ADRs") e chama `fetchAdrs` ao montar → reflete criações/exclusões automaticamente.
- Layout do card: o cabeçalho passa a ter título + (badge + ícones). Garantir que títulos longos quebrem sem empurrar os botões (`min-w-0` no título, `flex-shrink-0` nos controles).
- O MCP server (`apps/mcp-server/src/tools/adrs.ts`, tool `search_team_adrs`) lê a mesma tabela; **nenhuma mudança necessária** — ADRs criadas/editadas/excluídas passam a aparecer nas buscas.

## 4. Ordem de implementação
1. `types/index.ts` (`AdrInput`).
2. `ui/textarea.tsx`.
3. `adrsSlice.ts` (thunks + estado + reducers + cabeçalho/JSDoc).
4. `AdrsPage.tsx`: criar (botão + modal + validação) → editar → excluir (botão + diálogo).
5. Ajustes de acessibilidade/layout do card e mensagens.
6. Build, testes funcionais, atualizar este plano e commit.

## 5. Plano de verificação
Sem runner de testes no `apps/web`; verificação = tipagem + funcional:

1. `npm run build` em `apps/web` (`tsc -b` + `vite build`) sem erros.
2. Replay dos thunks com a anon key contra o banco cloud via script Node (mesma técnica usada em Regras), incluindo o caso "update/delete com 0 linhas → erro", e a violação do CHECK de `status` (valor inválido deve ser rejeitado pelo banco).
3. Manual em `/adrs` (`npm run dev`, porta 5173):
   - **Criar**: preencher título/contexto/decisão → Salvar → card no topo, modal fecha, contador da aba "Propostas" sobe, "Todas" mostra a nova.
   - **Persistência**: conferir via SQL (`select * from adrs order by created_at desc limit 3;`) e F5.
   - **Validação**: campos vazios/só espaços ou acima do limite → Salvar desabilitado + mensagem; nenhuma chamada de rede.
   - **Editar**: alterar texto e status (ex.: Proposta → Aceita) → card atualizado, badge e contadores das abas corretos.
   - **Excluir**: lixeira → confirmar → some da lista e do banco; Cancelar não altera nada.
   - **Erro**: simular falha (URL do Supabase inválida/offline) → modal permanece aberto com mensagem e conteúdo preservado.
   - **Layout**: título longo e textos longos não quebram o card; foco/teclado (Enter no título submete; Esc fecha fora de `saving`).
   - **Dashboard** (`/`): contador de ADRs reflete as mudanças.
   - **MCP** (opcional): `search_team_adrs` encontra a ADR criada.
4. Limpar os dados de teste do banco cloud ao final (5 ADRs antes e depois).

## 6. Riscos e pontos de atenção
- Testes gravam no **banco cloud real** → usar títulos `[TESTE] …` e apagar depois.
- Falha silenciosa de `update/delete` com 0 linhas (tratada em 3.3).
- Sem RLS, qualquer portador da anon key (exposta no bundle) pode alterar/excluir ADRs de qualquer time.
- Duplo clique em **Salvar** → mitigado por `saving` desabilitando o botão.
- Textos longos de ADR: sem limite no banco (`text`); o limite de 150/2000 caracteres é só do client — ajustar se houver ADRs existentes maiores (verificar antes de fixar os valores).
- `ON DELETE CASCADE` em `team_id`: excluir um *time* apaga suas ADRs; não afeta o CRUD de ADRs em si.

## 7. Pendências fora do escopo
- **Habilitar RLS** em `teams`, `review_rules`, `review_history` e `adrs` (advisor `rls_disabled_in_public`, ERROR) com policies adequadas; hoje o CRUD só funciona porque as tabelas estão abertas.
- Autenticação/multi-time (hoje `TEAM_ID` fixo).
- Numeração sequencial real de ADRs (ex.: `ADR-0001`) — exigiria coluna/sequence via migration.
- Coluna `updated_at`/auditoria; histórico de mudanças de status.
- Toasts/notificações; busca textual e ordenação nos cards.

## 8. Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `apps/web/src/types/index.ts` | **+** `AdrInput` |
| `apps/web/src/components/ui/textarea.tsx` | **Novo**: componente Textarea (shadcn) |
| `apps/web/src/store/slices/adrsSlice.ts` | thunks `createAdr/updateAdr/deleteAdr`, estado de modal/saving/erro, reducers, cabeçalho e JSDoc |
| `apps/web/src/pages/AdrsPage.tsx` | botão "Nova ADR", modal de criar/editar, ações por card, diálogo de exclusão, validação, a11y, cabeçalho e JSDoc |
| Banco / migrations | **nenhuma alteração** |
