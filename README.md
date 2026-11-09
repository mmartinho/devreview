# DevReview

Ferramenta de code review assistida por IA — projeto base do Curso 5: MCP, Conectando o Agent ao Mundo Real.

## Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Redux Toolkit
- **Backend (construído durante o curso):** Node.js, @modelcontextprotocol/sdk, Zod
- **Banco de dados:** Supabase (PostgreSQL)

## Pré-requisitos

- Node.js 20+
- npm 10+
- Supabase CLI (`npm install -g supabase`)

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o Supabase local
npx supabase start

# 3. Aplicar migrations e seed data
npx supabase db reset

# 4. Copiar variáveis de ambiente
cp apps/web/.env.example apps/web/.env

# 5. Iniciar o frontend
npm run dev
```

O app abre em `http://localhost:5173`.
O Supabase Studio fica em `http://localhost:54323`.

## MCP Server + Inspector

O servidor (`apps/mcp-server`) usa transporte STDIO e, por ora, expõe uma única tool mockada (`list_review_rules`). Não precisa de Supabase nem de `.env`.

```bash
# Compila e abre o MCP Inspector (UI web) já apontando para o servidor
npm -w apps/mcp-server run inspector
```

O Inspector 2.x imprime no terminal a URL com token (UI em `http://127.0.0.1:6274`). Na aba *Servers* conecte `devreview` e use a aba *Tools*. Para testar validação, use "Edit as JSON" com `{"category":"foo"}`.

## Estrutura

```
devreview/
├── apps/
│   ├── web/          # Frontend React
│   └── mcp-server/   # MCP Server (construído durante o curso)
├── supabase/         # Configuração, migrations e seed data
└── docs/             # Documentação do curso (gitignored)
```
