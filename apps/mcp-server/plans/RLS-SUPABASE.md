# Plano — Row Level Security (RLS) no Supabase do DevReview

- **Criado em:** 2026-11-16
- **Status:** plano — **nada implementado**
- **Autor:** Marcus Martinho
- **Origem:** decisão 4 de `PROMPT-INJECTION-DEFENSE.md` (RLS tratado em plano separado) e observação de `SUPABASE-MCP-PLAN.md` §5 (RLS desligado, decisão adiada).
- **Escopo real:** este plano cruza `supabase/` (migrations), `apps/web` (autenticação) e `apps/mcp-server` (cliente do banco). Apesar de morar em `apps/mcp-server/plans/`, a execução vai tocar nos três, o que o PRD original proibia; **a execução exige autorização explícita**.

---

## 1. Estado atual (verificado no código)

| Peça | Como acessa o banco | Consequência |
|---|---|---|
| `apps/web` (`src/lib/supabase.ts`) | `createClient(url, VITE_SUPABASE_ANON_KEY)`; **sem login** (nenhum uso de `auth` no código) | A chave anon vai no bundle público. Quem a tem é o papel `anon` do Postgres. |
| `apps/web` (slices) | `select/insert/update/delete` em `teams`, `review_rules`, `adrs`; leitura em `review_history` | CRUD completo de todas as tabelas, feito como `anon`. |
| `apps/mcp-server` (`src/db/supabase.ts`) | `SUPABASE_SERVICE_KEY` (papel `service_role`) | **Ignora RLS por definição.** Mesmo com RLS ligado, o MCP continua vendo tudo. |
| `00001_init_schema.sql` | 4 tabelas, sem `enable row level security`, sem policies, sem tabela de membros | Para a API pública, qualquer pessoa com a URL + anon key lê e escreve **tudo**, de todos os times, inclusive apagar times. |
| Cloud (`ehbblydlzvamhttsjlxx`) | Migration e seed aplicados; RLS desligado (conferido em 2026-11-09) | Exposição já real, não só teórica. |

### Riscos que o RLS resolve

1. **Escrita anônima** em `adrs`/`review_rules`: é a **fonte da injeção armazenada** (vetor nº 1 do plano de prompt injection).
2. **Vazamento entre times:** nada impede ler dados de outro `team_id`.
3. **Destruição de dados:** `delete` em `teams` cascateia para tudo.
4. **Vazamento da anon key** deixa de ser equivalente a acesso total.

### Dois pontos que o plano **não** pode ignorar

- **Ligar RLS sem policies quebra o `apps/web`** (anon passa a ver 0 linhas) e **não afeta o MCP** (service_role bypassa). O inverso do que parece.
- **A service key no MCP anula a proteção por time.** As tools recebem `team_id` como argumento; se o modelo for manipulado, pode pedir dados de outro time e o servidor entrega. RLS sozinho não cobre isso; ver §3.4.

## 2. Decisão central: como identificar "quem escreve"

RLS precisa de uma identidade. Hoje não existe. Alternativas:

| Opção | Descrição | Resolve a escrita anônima? | Custo |
|---|---|---|---|
| **A. Supabase Auth + membros de time (recomendada)** | Login (magic link/e-mail+senha) no web; tabela `team_members`; policies por `auth.uid()` | Sim, de forma real | Médio: tela de login, sessão, tabela, policies |
| B. Anon somente leitura | `select` liberado para `anon`; sem policies de escrita | Sim, mas **quebra o CRUD do web** (criar/editar/excluir ADR, regra, time) | Baixo, mas regride funcionalidades já entregues (commits `d663970`, `f1ca683`) |
| C. Backend/Edge Function como único escritor | Web chama API própria; banco só aceita service_role | Sim | Alto: nova camada |
| D. Manter como está, só documentar | Sem mudança | Não | Nenhum; aceita o risco (ok apenas para demo local) |

**Recomendação: A**, em fases, para que cada fase seja entregável e reversível. A opção B serve como **degrau temporário** se o usuário quiser fechar a escrita anônima antes de ter login (ao custo de desligar o CRUD do web).

## 3. Desenho proposto (opção A)

### 3.1 Modelo de dados (migration `00002_rls_team_members.sql`)

- `team_members(team_id uuid references teams on delete cascade, user_id uuid references auth.users on delete cascade, role text check (role in ('admin','editor','viewer')), primary key (team_id, user_id))`.
- Índice em `team_members(user_id)` e, para as policies, nos `team_id` das tabelas filhas (`review_rules`, `review_history`, `adrs`) se ainda não houver.
- Funções auxiliares `security definer` com `set search_path = ''`, para evitar recursão de RLS e hijack de path:
  - `public.is_team_member(p_team_id uuid) returns boolean`
  - `public.has_team_role(p_team_id uuid, p_roles text[]) returns boolean`
  Dentro das policies usar `(select auth.uid())` (avaliado uma vez, melhor performance). Revogar `execute` de `anon` nessas funções.
- **Trigger/função de criação de time:** quem cria um time vira `admin` (senão `insert` em `teams` fica sem dono). Preferir RPC `create_team(name)` `security definer` a policy de insert aberta.

### 3.2 Policies (todas `to authenticated`; nenhuma para `anon`)

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `teams` | membro | insert via RPC `create_team`; update/delete: `admin` |
| `team_members` | membro do mesmo time | `admin` do time |
| `review_rules` | membro | `admin` ou `editor` |
| `adrs` | membro | `admin` ou `editor` |
| `review_history` | membro | **sem escrita pelo cliente** (gravada pelo fluxo de review, via service/role dedicado) |

- `enable row level security` em **todas** as 5 tabelas; `with check` espelhando o `using` nas escritas (impede mover linha para outro `team_id`).
- Revogar grants padrão de `anon` nas tabelas (`revoke all on ... from anon`) como segunda trava, além do RLS.
- **Defesa extra barata, independente de auth** (alinhada ao plano de prompt injection): `check (char_length(rule) <= 500)`, `char_length(title) <= 200`, `char_length(decision/context) <= 4000`. Limita o tamanho útil de um payload.

### 3.3 `apps/web`

- Tela de login e guarda de rotas (Supabase Auth), sessão persistida pelo `supabase-js`.
- O seletor de time (commit `f1ca683`) passa a listar apenas times do usuário (RLS já filtra no `select`).
- Criar time passa a chamar a RPC `create_team`.
- UI de gestão de membros: **fora do escopo inicial**; adicionar membros via SQL/painel no começo.
- Tratar erro de RLS: `update`/`delete` sem permissão retornam 0 linhas sem erro (os slices já tratam esse caso; revisar a mensagem para "sem permissão").

### 3.4 `apps/mcp-server` (privilégio mínimo)

O MCP é o consumidor que **mais importa para prompt injection**, e hoje roda com `service_role`.

Opções, da mais simples à mais forte:

1. **Time fixo por ambiente (recomendada para a fase 1):** variável `DEVREVIEW_TEAM_ID`; as tools **ignoram/validam** o `team_id` do argumento contra ela (rejeitam se diferir). Um modelo manipulado não alcança outro time. Mudança pequena e compatível com o envelope do plano de prompt injection.
2. **Papel Postgres dedicado, somente leitura** (`mcp_reader`) com `select` nas 3 tabelas lidas e policies próprias, autenticado por JWT assinado/segredo próprio, em vez de `service_role`. Remove o poder de escrita/DDL do processo.
3. **JWT do usuário** repassado ao MCP (RLS aplica por `auth.uid()`). Mais correto, mas exige fluxo de token em um servidor STDIO; avaliar só se o MCP virar remoto.

`service_role` deve ficar **só** em tarefas administrativas (seed, migrations), nunca no processo que o modelo aciona.

## 4. Fases

| Fase | Entrega | Reversível? |
|---|---|---|
| 0 | **Diagnóstico:** rodar `get_advisors` (security) e listar policies/RLS do projeto cloud; confirmar que a cloud tem exatamente o schema da migration; inventariar quem usa a anon key | n/a (leitura) |
| 1 | **MCP com time fixo** (§3.4-1) e service key só no MCP. Não toca no banco nem no web. | Sim |
| 2 | Migration `00002`: `team_members`, funções, RLS + policies, checks de tamanho. Aplicar primeiro no **Supabase local** (`db reset`) e só depois na cloud. | Sim (migration de rollback) |
| 3 | `apps/web`: login, guarda de rotas, `create_team` RPC, mensagens de permissão | Sim |
| 4 | MCP com papel de leitura dedicado (§3.4-2); revogar uso de `service_role` fora de seed/migrations | Sim |
| 5 | Remover anon grants residuais; rotacionar a anon e a service keys se foram expostas | Parcial |

**Atenção de ordem:** a fase 2 sem a fase 3 **derruba o CRUD do web** (anon deixa de ter acesso). As duas devem ser aplicadas na cloud juntas, ou a fase 2 só vai para a cloud depois de o web estar pronto. Por isso a fase 1 vem antes: dá proteção ao MCP sem quebrar nada.

## 5. Seed e dados demo

- `seed.sql` roda como `postgres`, que **bypassa RLS**; continua funcionando.
- O time demo `11111111-...` precisa de pelo menos um `team_members` (admin) ligado a um usuário real; sem isso o web mostra lista vazia. Incluir no seed um usuário demo local (`auth.users`) **somente para ambiente local**, nunca na cloud.
- Documentar como adicionar o próprio usuário como admin na cloud (SQL manual).

## 6. Verificação

Sem framework de testes no projeto; usar SQL e roteiro manual:

- [ ] `get_advisors` (security) sem alertas de "RLS disabled" e sem "policy always true".
- [ ] Como `anon` (cliente sem login): `select` em todas as tabelas retorna 0 linhas e qualquer escrita é negada.
- [ ] Usuário do time A **não** lê, altera nem apaga dados do time B (testar com dois usuários, `set local role authenticated` + `request.jwt.claims`).
- [ ] `viewer` lê, mas não escreve; `editor` escreve regras/ADRs, mas não gerencia membros/time; `admin` faz tudo do seu time.
- [ ] Tentativa de `update ... set team_id = <outro time>` falha (`with check`).
- [ ] Inserir regra/ADR acima do limite de tamanho falha.
- [ ] Web: login, listagem por time, CRUD de ADR/regra e criação de time funcionam; usuário sem papel recebe mensagem de permissão, não lista vazia silenciosa.
- [ ] MCP: com `DEVREVIEW_TEAM_ID` definido, chamada com outro `team_id` é rejeitada; sem a variável o servidor falha ao subir (ou cai em modo explícito documentado).
- [ ] Smoke test do PRD §8.6 (stdout só JSON-RPC) continua passando.

## 7. Riscos e armadilhas

- **Recursão de RLS** se a policy de `team_members` consultar a própria tabela sem função `security definer`. Por isso as funções auxiliares.
- **`security definer` sem `search_path` fixo** é vetor de hijack; sempre `set search_path = ''` e nomes qualificados.
- **Performance:** `auth.uid()` fora de `(select ...)` reavalia por linha; faltar índice em `team_id`/`user_id` degrada a policy.
- **`update`/`delete` bloqueado por RLS não gera erro**, só 0 linhas: a UI precisa tratar (já há tratamento parcial nos slices).
- **Cloud em uso:** aplicar migration direto na cloud é difícil de desfazer; sempre local primeiro e, se possível, usar branch/projeto de teste. O MCP `supabase-devreview-cloud` está `read_only=true`, então a aplicação deve ser por `supabase db push` ou trocando temporariamente a flag (decisão do usuário).
- **Dados já existentes** na cloud podem ter conteúdo malicioso gravado enquanto estava aberta: fazer uma revisão manual de `review_rules` e `adrs` antes/depois.
- **Chaves expostas:** a anon key é pública por desenho (aceitável com RLS correto), mas se a `service_role` já saiu da máquina (commit, log, chat), rotacionar.
- RLS **não** protege contra um membro legítimo malicioso escrevendo uma regra com injeção; para isso valem as camadas do plano `PROMPT-INJECTION-DEFENSE.md`. Os dois planos se complementam.

## 8. Decisões em aberto para o usuário

1. **Opção de identidade:** A (Supabase Auth + membros, recomendada), B (anon só leitura, desliga o CRUD do web), C (backend) ou D (aceitar o risco, só demo)?
2. **Método de login** no web: magic link por e-mail, e-mail+senha ou OAuth (GitHub, já que o projeto usa GitHub)?
3. **Papéis:** os três (`admin/editor/viewer`) ou simplificar para membro único?
4. **MCP:** começar pelo time fixo via `DEVREVIEW_TEAM_ID` (fase 1) e depois papel de leitura dedicado, como proposto?
5. **Cloud:** posso aplicar a migration na cloud via `supabase db push`, ou prefere trocar `read_only=false` temporariamente? E a cloud deve ser tratada como produção ou como ambiente de curso descartável?
6. **Ordem em relação ao plano de prompt injection:** executar o RLS antes, depois ou em paralelo? (Sugestão: fase 1 deste plano junto com o plano de prompt injection; fases 2-5 em seguida.)
