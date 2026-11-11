#!/usr/bin/env node
/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-11
 * Descrição: Entrypoint do DevReview MCP Server em estado mínimo. Cria um McpServer conectado
 * por STDIO e registra uma única tool mockada, `list_review_rules`, com entrada validada por Zod.
 *
 * Em STDIO o stdout pertence ao protocolo: todo log deve ir para stderr (console.error).
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config.js";
import { RULE_CATEGORIES, rules } from "./mocks/rules.js";

/** Versão lida do package.json (fonte única de verdade). */
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

/**
 * Cria o servidor MCP e registra suas tools.
 *
 * @returns Instância de McpServer pronta para `connect()`.
 */
function createServer(): McpServer {
  const server = new McpServer({ name: "devreview-mcp", version });

  server.registerTool(
    "list_review_rules",
    {
      title: "Listar regras de review",
      description: "Lista as regras de code review do time (dados mockados).",
      inputSchema: {
        // nullish(): o Inspector envia `null` (não omite o campo) ao limpar o select.
        category: z.enum(RULE_CATEGORIES).nullish().describe("Filtra por categoria"),
        only_active: z.boolean().default(true).describe("Retorna apenas regras ativas"),
      },
    },
    async ({ category, only_active }) => {
      const result = rules.filter(
        (r) => (!category || r.category === category) && (!only_active || r.active),
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}

/**
 * Inicializa o servidor e o conecta ao transporte STDIO.
 *
 * @returns Promise resolvida após a conexão.
 * @throws Erro de conexão do transporte (tratado em `.catch` abaixo).
 */
async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());

  console.error(
    `[devreview-mcp] v${version} em STDIO. Supabase: URL ${config.SUPABASE_URL ? "presente" : "ausente"}, ` +
      `chave ${config.SUPABASE_SERVICE_KEY ? "presente" : "ausente"}.`,
  );

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[devreview-mcp] erro fatal:", err);
  process.exit(1);
});
