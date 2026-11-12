#!/usr/bin/env node
/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-12
 * Descrição: Entrypoint do DevReview MCP Server. Cria um McpServer conectado
 * por STDIO e registra 3 tools
 *
 * Em STDIO o stdout pertence ao protocolo: todo log deve ir para stderr (console.error).
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerReviewRulesTools } from "./tools/review-rules.js"
import { registerAdrTools } from "./tools/adrs.js"
import { registerMetricsTools } from './tools/metrics.js';


/** Versão lida do package.json (fonte única de verdade). */
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

const server = new McpServer({ name: "devreview-mcp", version });

registerReviewRulesTools(server);
registerAdrTools(server);
registerMetricsTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
