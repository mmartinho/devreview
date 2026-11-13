Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
Data Criação: 2026-11-13
Data Atualização: 2026-11-13
Descrição: Plano de implementação do CRUD completo (criar, alterar, excluir) de "Regras de Review" no client web (`apps/web`, rota `/regras`), persistindo no Supabase. Plano aprovado e já implementado; atualizado para refletir a troca do Select de Status por um toggle (Switch).

# Plano: persistir criação, edição e exclusão de Regras de Review

## 1. Diagnóstico

### Causa raiz (confirmada no código)
A funcionalidade **nunca foi implementada** — o modal é só visual:

| Local | Problema |
|---|---|
| `src/pages/RulesPage.tsx:277-282` | Botão **Salvar** tem `onClick={() => dispatch(closeModal())}`: apenas fecha o modal. Não lê `formRule/formCategory/formSeverity`, não valida, não chama o Supabase. |
| `src/store/slices/rulesSlice.ts` | Só existe o thunk `fetchRules` (SELECT). Não há thunks de `INSERT`, `UPDATE` ou `DELETE`. |
| `src/pages/RulesPage.tsx:181-190` | Edição: o lápis abre o modal preenchido (`handleOpenEdit`), mas o Salvar cai no mesmo bug acima — **alterar também não persiste**. |
| `src/pages/RulesPage.tsx` (tabela) | **Não existe nenhuma UI de exclusão** (nem botão, nem confirmação). |
| `src/pages/RulesPage.tsx:219-229` | Sem validação (descrição vazia seria aceita) e sem feedback de erro/loading no modal. |
| `src/pages/RulesPage.tsx:209` | `onOpenChange={() => dispatch(closeModal())}` ignora o argumento — funciona, mas fecharia o modal mesmo durante um save em andamento. |

### O banco NÃO é o problema (verificado no Supabase cloud, projeto `ehbblydlzvamhttsjlxx`)
- Tabela `review_rules`: `id uuid default gen_random_uuid()`, `team_id uuid not null`, `category`, `rule`, `severity` (todos `not null`, com `CHECK` em category/severity), `active boolean not null default true`, `created_at timestamptz default now()`. Os valores usados no client (`style|architecture|security|performance`, `error|warning|info`) batem com os CHECKs.
- **RLS desabilitada** nas 4 tabelas e o papel `anon` tem `SELECT/INSERT/UPDATE/DELETE` → o client já tem permissão de escrita com a anon key. Não é necessária nenhuma migration para o CRUD funcionar.
- `TEAM_ID` (`src/lib/team.ts`) = `1111…1111` existe em `teams` (seed) → FK satisfeita.
- `.env` do web aponta para o cloud (`https://ehbblydlzvamhttsjlxx.supabase.co`), então o INSERT cairá no mesmo banco que o dashboard mostra.

### Observação sobre `ReviewRule` (`src/types/index.ts`)
A interface não tem `created_at`, embora `fetchRules` ordene por ele e a coluna exista. Não bloqueia, mas vale incluir como opcional (`created_at?: string`) para manter o tipo fiel à tabela.

## 2. Decisões

| Tema | Decisão | Origem |
|---|---|---|
| RLS / segurança | **Fora do escopo.** Mantém tabelas sem RLS. Registrado como pendência (seção 7). | Resposta do usuário |
| Exclusão | **Hard delete** com diálogo de confirmação. (Para "pausar" já existe o status Inativa.) | Padrão assumido — *confirmar* |
| Status Ativa/Inativa | **Toggle (switch) "Status" no modal de edição**; novas regras nascem ativas. (Inicialmente planejado como Select; trocado por toggle para alternar com um clique — melhoria de UX pedida em 2026-11-13.) | Usuário |
| Estado/UI | Seguir o padrão existente: Redux Toolkit (`createAsyncThunk`) + componentes `ui/*` (shadcn) já presentes. Sem novas dependências. | Convenção do projeto |

> Os dois itens "assumido" não foram respondidos; se discordar, só a seção 3.4 / 3.5 muda.

## 3. Alterações propostas

### 3.1 `src/types/index.ts`
- Adicionar `created_at?: string` em `ReviewRule`.
- Criar tipo auxiliar para entrada do formulário:
  ```ts
  export type RuleInput = Pick<ReviewRule, "rule" | "category" | "severity" | "active">;
  ```

### 3.2 `src/store/slices/rulesSlice.ts` — novos thunks
Seguem o padrão de `fetchRules` (lançam `Error(error.message)` em falha; usam `getSupabase()`):

| Thunk | Operação | Retorno |
|---|---|---|
| `createRule({ teamId, input })` | `.from("review_rules").insert({ team_id, ...input, rule: input.rule.trim() }).select().single()` | `ReviewRule` criada (já com `id`/`created_at` do banco) |
| `updateRule({ id, input })` | `.update({ ...input }).eq("id", id).select().single()` | `ReviewRule` atualizada |
| `deleteRule(id)` | `.delete().eq("id", id)` (**sem `team_id` no corpo**; filtrar também por `.eq("team_id", TEAM_ID)` por segurança extra) | `id` removido |

> Atenção: `update/delete` no supabase-js **não falham** quando 0 linhas são afetadas. Usar `.select().single()` (update) e `.select("id")` (delete) e tratar retorno vazio como erro ("Regra não encontrada").

Estado novo em `RulesState`:
- `saving: boolean` (create/update em andamento) e `deletingId: string | null`.
- `mutationError: string | null` — erro das mutações, exibido **no modal** (não no `DataSourceBanner`, que é só de carga).
- `deleteTargetId: string | null` para o diálogo de confirmação (ou estado local da página — ver 3.5).

`extraReducers`:
- `createRule.fulfilled` → `items.unshift(payload)` (mantém a ordem `created_at desc` do fetch), `saving=false`.
- `updateRule.fulfilled` → substitui o item pelo `id`.
- `deleteRule.fulfilled` → `items = items.filter(r => r.id !== payload)`.
- `*.pending` → `saving=true; mutationError=null`; `*.rejected` → `saving=false; mutationError=action.error.message`.
- Novo reducer `clearMutationError` e chamá-lo em `openModal`/`closeModal`.

O **fechamento do modal só ocorre após o `fulfilled`** (via `await dispatch(...).unwrap()` no componente) — em caso de erro o modal permanece aberto exibindo a mensagem, sem perder o que o usuário digitou.

### 3.3 `src/pages/RulesPage.tsx` — salvar (criar/alterar)
1. Criar `handleSave()`:
   - Validar: `formRule.trim()` não vazio (e limite razoável, ex.: ≤ 500 caracteres). Mensagem inline sob o campo; `Salvar` desabilitado enquanto inválido ou `saving`.
   - Se `editingRuleId` → `dispatch(updateRule({ id, input })).unwrap()`; senão → `dispatch(createRule({ teamId: TEAM_ID, input })).unwrap()`.
   - Em sucesso: `dispatch(closeModal())`. Em erro: o `mutationError` já está no estado; só renderizar.
2. Trocar `onClick` do botão **Salvar** para `handleSave`; mostrar "Salvando…" (e desabilitar Cancelar/fechar) enquanto `saving`.
3. Ajustar `onOpenChange={(open) => { if (!open && !saving) dispatch(closeModal()); }}`.
4. Permitir `Enter` no input submeter o formulário (envolver o conteúdo em `<form onSubmit>`).
5. Exibir `mutationError` no corpo do modal (texto vermelho, mesmo estilo do `DataSourceBanner`).
6. Estado inicial do modal "Nova Regra" continua `style/warning` (já ok em `handleOpenNew`).

### 3.4 `src/pages/RulesPage.tsx` — alterar (status)
- Adicionar `formActive` (`useState<boolean>(true)`), preenchido em `handleOpenEdit` com `rule.active` e resetado para `true` em `handleOpenNew`.
- Adicionar no modal um **toggle (`Switch`)** "Status" — visível **apenas na edição** (na criação a regra nasce ativa). Alterna com um clique (ou Espaço/Enter); o valor só é gravado ao clicar em **Salvar**.
  - Novo componente `src/components/ui/switch.tsx`: `<button role="switch" aria-checked>` nativo, **sem nova dependência** (não usa `@radix-ui/react-switch`). Props: `checked`, `onCheckedChange`.
  - Visual: trilho verde quando Ativa, cinza quando Inativa; rótulo "Status: Ativa/Inativa" ao lado muda junto (cor verde/cinza). Associado ao rótulo via `aria-labelledby`.
- `updateRule` envia `rule`, `category`, `severity`, `active`.

### 3.5 `src/pages/RulesPage.tsx` — excluir
- Nova coluna de ação: ao lado do lápis, botão `Trash2` (lucide) com `aria-label="Excluir regra"`, estilo `hover:text-red-400`. Ajustar largura da coluna (`w-16` → `w-24`).
- Adicionar `aria-label="Editar regra"` ao botão do lápis (acessibilidade; hoje não tem).
- Diálogo de confirmação reutilizando `Dialog`: *"Excluir a regra «…»? Esta ação não pode ser desfeita."* com **Cancelar** / **Excluir** (vermelho). Estado `ruleToDelete` local na página.
- Confirmar → `dispatch(deleteRule(id)).unwrap()`; mostrar "Excluindo…", fechar no sucesso, exibir erro no próprio diálogo em falha.

### 3.6 Efeitos colaterais a verificar
- `DashboardPage.tsx` usa `s.rules.items` (contagem de ativas, 4 regras recentes) — como o thunk atualiza o mesmo estado, reflete automaticamente; só validar que continua coerente após criar/excluir.
- `DashboardPage` chama `fetchRules` ao montar → sem conflito.
- Contador "N regras" e filtros operam sobre `items` → atualizam sozinhos.
- O MCP server (`apps/mcp-server/src/tools/review-rules.ts`) lê a mesma tabela; nenhuma mudança necessária (regras novas/editadas/excluídas passam a aparecer na tool `get_team_review_rules`).

## 4. Ordem de implementação
1. `types/index.ts` (tipos).
2. `rulesSlice.ts` (thunks + estado + reducers).
3. `RulesPage.tsx`: salvar/criar → editar (status) → excluir (UI + diálogo).
4. Ajustes de acessibilidade/mensagens.

## 5. Plano de verificação
Não há testes automatizados no `apps/web` (sem runner configurado); a verificação é manual + tipagem:

1. `npm run build` em `apps/web` (roda `tsc -b`) — sem erros de tipo.
2. Subir o client (`npm run dev`, porta 5173) e, em `/regras`:
   - **Criar**: preencher descrição + categoria + severidade → Salvar → regra aparece no topo da lista, modal fecha, contador sobe.
   - **Persistência**: conferir via Supabase (`select * from review_rules order by created_at desc limit 3;`) e recarregar a página (F5) → regra continua.
   - **Validação**: descrição vazia → Salvar desabilitado/mensagem; não chama a rede.
   - **Editar**: alterar descrição/categoria/severidade e alternar o toggle de status (um clique) → Salvar → linha atualizada e badge de status correto; conferir no banco.
   - **Excluir**: lixeira → confirmar → some da lista e do banco; Cancelar não altera nada.
   - **Erro**: simular falha (ex.: URL do Supabase inválida / offline) → modal permanece aberto com a mensagem; nada é fechado nem perdido.
   - **Filtros**: criar regra de categoria X com filtro em Y ativo → não aparece até limpar o filtro (comportamento esperado; considerar aviso no futuro).
   - **Dashboard** (`/`): contadores refletem as mudanças.
   - **MCP** (opcional): `get_team_review_rules` retorna a regra criada.
3. Limpar ao final os dados de teste criados no banco cloud.

## 6. Riscos e pontos de atenção
- O `.env` aponta para o **banco cloud real**: os testes manuais gravam lá → usar descrições identificáveis (ex.: `[TESTE] …`) e apagá-las depois.
- Falha silenciosa de `update/delete` com 0 linhas (tratada em 3.2).
- Sem RLS, qualquer cliente com a anon key (que fica exposta no bundle do navegador) pode alterar/excluir regras de qualquer time — ver pendência abaixo.
- Duplo clique em **Salvar** pode criar regra duplicada → mitigado pelo `saving` desabilitando o botão.

## 7. Pendências fora do escopo (registradas)
- **Habilitar RLS** em `teams`, `review_rules`, `review_history` e `adrs` (advisor do Supabase: `rls_disabled_in_public`, nível ERROR) com policies adequadas; hoje o CRUD só funciona *porque* a tabela está aberta.
- Autenticação/multi-time (hoje `TEAM_ID` fixo).
- Migration para `updated_at`/auditoria, se desejado.
- Atualizar `DataSourceBanner`/toasts se for adotada uma lib de notificações.

## 8. Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `apps/web/src/types/index.ts` | `created_at?`, `RuleInput` |
| `apps/web/src/store/slices/rulesSlice.ts` | thunks `createRule/updateRule/deleteRule`, estado e reducers |
| `apps/web/src/pages/RulesPage.tsx` | `handleSave`, validação, toggle de status no modal, botão/diálogo de exclusão, a11y |
| `apps/web/src/components/ui/switch.tsx` | **Novo**: componente Switch (toggle) acessível, sem dependências |
| Banco / migrations | **nenhuma alteração** |
