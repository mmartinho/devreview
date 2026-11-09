# PRD — DevReview MCP Server (estado mínimo + MCP Inspector)

> Documento escrito para ser executado por um agente (Claude Code / Sonnet 5.5).
> Cada seção é autocontida; siga a ordem das **Tarefas** (seção 8) e valide cada **Critério de aceite**.

- **Escopo do código:** `apps/mcp-server/` (único diretório que você deve alterar, salvo o que a seção 9 permitir)
- **Criado em:** 2026-11-09
- **Status:** pronto para implementação

---

## 1. Contexto (extraído do repositório)

DevReview é uma ferramenta de code review assistida por IA, projeto base do curso *MCP — Conectando o Agent ao Mundo Real*. Monorepo npm workspaces (`apps/*`):

| Item | Estado atual |
|---|---|
| `apps/web` | Frontend React/Vite já funcional (porta 5173). **Não tocar.** |
| `apps/mcp-server` | Esqueleto: `package.json`, `tsconfig.json`, `.env.example` e `src/index.ts` contendo apenas comentários. É o alvo deste PRD. |
| `supabase/` | Migration `00001_init_schema.sql` e `seed.sql`. Time demo fixo: `11111111-1111-1111-1111-111111111111` (Frontend). |

**Modelo de dados** (espelhado em `apps/web/src/types/index.ts`):

- `review_rules`: `id`, `team_id`, `category` (`style | architecture | security | performance`), `rule`, `severity` (`error | warning | info`), `active`.
- `review_history`: `id`, `team_id`, `pr_url`, `pr_number`, `repo`, `review_summary`, `issues_found`, `reviewed_at`.
- `adrs`: `id`, `team_id`, `title`, `context`, `decision`, `status` (`proposed | accepted | deprecated`), `created_at`.

**Estado atual de `apps/mcp-server/package.json`** (manter nome, `type: module` e `bin`):

- Scripts: `build` (`tsc`), `dev` (`tsc --watch`), `inspector` (`npx @modelcontextprotocol/inspector build/index.js`).
- Dependências já declaradas: `@modelcontextprotocol/sdk ^1.12.1`, `@supabase/supabase-js ^2.49.4`, `zod ^3.24.4`.
- `tsconfig`: `module/moduleResolution: NodeNext`, `rootDir: src`, `outDir: build`, `strict`.
- Versões realmente instaladas no `node_modules` da raiz: SDK `1.29.0`, zod `3.25.76`, supabase-js `2.101.0`. Node local `v22.13.0`.
- `apps/mcp-server/.env.example` tem `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` (valores do Supabase local). O `.gitignore` raiz já ignora `.env`, `build/` e `node_modules/`.

## 2. Objetivo

Entregar o **menor MCP server que sobe de verdade** e deixar o **MCP Inspector totalmente funcional na web**, conectado por **STDIO**, para explorarmos os conceitos do protocolo (handshake, listagem de tools, chamada com validação, erros) antes de construir as tools reais.

**Resultado observável:** `npm run inspector` abre o Inspector no navegador, conecta ao servidor, lista a tool mockada, executa-a com sucesso e rejeita entrada inválida com erro de validação do Zod.

## 3. Fora de escopo (não implementar)

- Tools reais ou consultas ao Supabase (módulo 4 do curso). Os dados são **mocks locais**.
- Transportes HTTP/SSE/Streamable HTTP.
- Autenticação, deploy, testes automatizados, CI, Docker.
- Alterações em `apps/web`, `supabase/` ou migrations.
- Mais de **uma** tool, resources ou prompts (podem ser acrescentados depois, quando formos explorar esses conceitos).

## 4. Requisitos funcionais

**RF1 — Servidor MCP mínimo.** `src/index.ts` cria um `McpServer` (de `@modelcontextprotocol/sdk/server/mcp.js`) com `name: "devreview-mcp"` e `version` igual à do `package.json`, conectado a um `StdioServerTransport` (`@modelcontextprotocol/sdk/server/stdio.js`).

**RF2 — Uma tool mockada com validação Zod.** Registrar a tool `list_review_rules`:

- Descrição: lista as regras de code review do time (dados mockados).
- Input (`zod`): `category` opcional (enum das 4 categorias) e `only_active` opcional (boolean, padrão `true`).
- Comportamento: filtra um array mockado em `src/mocks/rules.ts`, **espelhando as 8 regras do `supabase/seed.sql`** (mesmos textos, categorias, severidades e flag `active`), e devolve `content: [{ type: "text", text: <JSON.stringify(resultado, null, 2)> }]`.
- Entrada inválida (ex.: `category: "foo"`) deve resultar no erro de validação do SDK, visível no Inspector. Não capturar nem mascarar esse erro.

**RF3 — Configuração de ambiente opcional e validada.** `src/config.ts` lê `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` com Zod, ambos **opcionais** nesta fase (o servidor sobe sem `.env`). Exportar o objeto validado. Nada o consome ainda além de um log de diagnóstico em stderr indicando se estão presentes (**nunca** imprimir a chave).

**RF4 — Inspector configurado.** Ver seção 6.

## 5. Requisitos não funcionais e armadilhas

1. **STDIO: stdout é do protocolo.** Qualquer `console.log` corrompe o handshake. Todo log vai para `console.error` (stderr). Não usar `console.log` em nenhum lugar de `src/`.
2. **ESM + NodeNext:** imports relativos precisam da extensão `.js` (ex.: `import { rules } from "./mocks/rules.js"`).
3. **Shebang:** a primeira linha de `src/index.ts` deve ser `#!/usr/bin/env node` (o `bin` aponta para `build/index.js`).
4. **Zod v3:** manter `^3.24.4` (instalado 3.25.76). Não migrar para v4. Passe o *shape* (`{ category: z.enum(...).optional() }`) ao `registerTool`/`tool`, conforme a API do SDK instalado; confirme a assinatura em `node_modules/@modelcontextprotocol/sdk` antes de codar, pois ela mudou entre versões.
5. **Encerramento limpo:** tratar `SIGINT`/`SIGTERM` fechando o servidor; erros fatais no `main()` vão para stderr com `process.exit(1)`.
6. **Windows (PowerShell/Git Bash):** use caminhos relativos nos scripts e `node build/index.js`; não dependa de `bash` nos scripts do `package.json`.
7. **Comentários (regra global do usuário):** todo arquivo de código começa com o cabeçalho abaixo, e toda função/método tem JSDoc com `@param`, `@returns` e `@throws` quando aplicável. Ao editar um arquivo, atualize "Data Atualização".

   ```ts
   /**
    * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
    * Data Criação: 2026-11-09
    * Data Atualização: 2026-11-09
    * Descrição: <até 2 parágrafos>
    */
   ```

## 6. Dependências e o "MCP server do Supabase"

**Dependências obrigatórias (já em `dependencies`):** `@modelcontextprotocol/sdk`, `zod`, `@supabase/supabase-js`. Esta última fica instalada mas **sem uso** até o módulo 4.

**MCP server do Supabase (`@supabase/mcp-server-supabase`, v0.16.1 no npm):** é um servidor MCP pronto, não uma biblioteca. Ele **não é importado pelo nosso código**; ele entra como **um segundo servidor STDIO configurado no Inspector**, para compararmos o nosso servidor com um servidor real. Regras:

- Adicionar como `devDependency` de `apps/mcp-server` (versão exata, sem `^`), para o `npx` não baixar a cada execução.
- Ele exige um **access token pessoal do Supabase** e normalmente um `--project-ref` de projeto na nuvem; o banco local do Docker **não** substitui isso. Por isso, no `mcp.inspector.json` ele fica **desabilitado por padrão** e **o aceite deste PRD não depende dele**.
- O token vem de variável de ambiente (`SUPABASE_ACCESS_TOKEN`), nunca escrito em arquivo versionado. Use `--read-only`.
- **Decisão em aberto para o usuário** (registre no relatório final, não decida sozinho): usar o projeto na nuvem do usuário, ou se há endpoint MCP no Supabase CLI local (a CLI instalada é a 3.0.0; verifique na documentação oficial antes de afirmar que existe).

**Arquivos do Inspector** (`apps/mcp-server/mcp.inspector.json`):

```json
{
  "mcpServers": {
    "devreview": {
      "command": "node",
      "args": ["build/index.js"],
      "env": {}
    }
  }
}
```

Scripts a ajustar em `package.json` (manter `build` e `dev`):

- `inspector`: `npm run build && npx @modelcontextprotocol/inspector --config mcp.inspector.json --server devreview`
- Fixar a versão do `@modelcontextprotocol/inspector` como `devDependency` (a última publicada no npm é 2.14.0 — confirme com `npm view` e use uma versão estável ≥ 2 semanas) e trocar `npx` por chamada local, para ser reprodutível.

Comportamento padrão do Inspector que deve ser conhecido: UI em `http://localhost:6274` e proxy em `6277`, com **token de sessão** impresso no terminal (a URL já vem com `MCP_PROXY_AUTH_TOKEN`). Não desativar a autenticação (`DANGEROUSLY_OMIT_AUTH`).

## 7. Estrutura final esperada

```
apps/mcp-server/
├── PRD.md                 (este arquivo)
├── .env.example           (já existe)
├── mcp.inspector.json     (novo)
├── package.json           (ajustado)
├── tsconfig.json          (sem mudanças, salvo necessidade comprovada)
└── src/
    ├── index.ts           (entrypoint: server + stdio + tool)
    ├── config.ts          (env com Zod, opcional)
    └── mocks/
        └── rules.ts       (8 regras espelhando o seed)
```

## 8. Tarefas (executar em ordem)

1. **Ler** `apps/mcp-server/package.json`, `tsconfig.json`, `src/index.ts`, `supabase/seed.sql` e a assinatura de `McpServer` em `node_modules/@modelcontextprotocol/sdk` (versão 1.29.0).
2. **Mocks:** criar `src/mocks/rules.ts` com as 8 regras do seed, tipadas (`RuleCategory`, `RuleSeverity`).
3. **Config:** criar `src/config.ts` (Zod, campos opcionais).
4. **Servidor:** reescrever `src/index.ts` conforme RF1–RF3 e os itens 1–5 da seção 5.
5. **Build:** `npm -w apps/mcp-server run build` deve passar sem erros de tipo.
6. **Smoke test sem UI** (stdio cru), exigindo `initialize` e depois `tools/list`:

   ```bash
   printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node apps/mcp-server/build/index.js
   ```

   A saída deve conter `list_review_rules`. Se houver qualquer linha não-JSON no stdout, há um `console.log` a remover.
7. **Inspector:** criar `mcp.inspector.json`, ajustar scripts, adicionar `@modelcontextprotocol/inspector` e `@supabase/mcp-server-supabase` como `devDependencies`, rodar `npm install` na raiz.
8. **Verificação no navegador** (ferramenta de navegador embutida do app): rodar `npm -w apps/mcp-server run inspector` em background, abrir a URL com token, **Connect**, aba *Tools* → *List Tools* → executar `list_review_rules` com e sem filtros, e enviar `category: "foo"` para ver o erro de validação.
9. **Atualizar o README raiz** com uma subseção curta "MCP Server + Inspector" (comandos e portas). Única alteração permitida fora de `apps/mcp-server`.
10. **Não** fazer commit; deixar as mudanças no working tree.

## 9. Critérios de aceite

- [ ] `npm install` na raiz e `npm -w apps/mcp-server run build` concluem sem erro.
- [ ] O smoke test da tarefa 6 lista `list_review_rules` e o stdout contém **apenas** JSON-RPC.
- [ ] `npm -w apps/mcp-server run inspector` abre o Inspector; o status fica **Connected** usando transporte **STDIO**.
- [ ] `list_review_rules` sem argumentos retorna as **7** regras ativas; com `only_active: false` retorna as **8**; com `category: "security"` retorna as 2 de segurança ativas.
- [ ] `category: "foo"` produz erro de validação visível no Inspector (o servidor não cai).
- [ ] O servidor sobe e funciona **sem** `.env` e **sem** Docker/Supabase em execução.
- [ ] Nenhum `console.log` em `src/`; nenhum segredo impresso ou versionado.
- [ ] Todos os arquivos novos seguem o cabeçalho e o JSDoc da seção 5, item 7.
- [ ] `git status` mostra mudanças apenas em `apps/mcp-server/**`, `package-lock.json` e `README.md`.

## 10. Relatório final esperado do agente

Responder com: arquivos criados/alterados, versões efetivamente instaladas (SDK, zod, inspector, mcp-server-supabase), resultado de cada critério de aceite (marcando o que **não** foi verificado), a URL/porta do Inspector e a **decisão em aberto** sobre o MCP do Supabase (seção 6).

## 11. Próximos passos (fora deste PRD)

Substituir os mocks por consultas ao Supabase local (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`), acrescentar tools `get_review_history` e `list_adrs`, e então explorar resources e prompts no Inspector.
