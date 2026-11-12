/** 
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-12
 * Data Atualização: 2026-11-12
 * Descrição: Módulo que registra no servidor MCP a tool "search_team_adrs", responsável por
 * buscar Architecture Decision Records (ADRs) aceitos de um time por palavra-chave.
 * 
 * Os dados são consultados na tabela "adrs" do Supabase, filtrando por time e status "accepted".
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../db/supabase.js";

/**
 * Remove caracteres com significado especial na sintaxe de filtros do PostgREST
 * (vírgula, parênteses, aspas, barra invertida e curingas), evitando injeção de filtro.
 *
 * @param {string} keyword - Termo de busca informado pelo usuário.
 * @returns {string} Termo higienizado, seguro para uso em `.or()`/`ilike`.
 */
function sanitizeKeyword(keyword: string): string {
    return keyword.replace(/[,()"'\\%*_]/g, " ").trim();
}

/**
 * Registra a tool "search_team_adrs" no servidor MCP informado.
 *
 * @param {McpServer} server - Instância do servidor MCP onde a tool será registrada.
 * @returns {void}
 * @throws {Error} Dentro do handler da tool, se a consulta ao Supabase falhar.
 */
export function registerAdrTools(server: McpServer) {
    server.registerTool(
        "search_team_adrs",
        {
            title: "Search Team ADRs",
            description:
                "Searches accepted Architecture Decision Records by keyword. " +
                "Use when a PR touches architectural concerns (state management, auth, caching, etc.).",
            inputSchema: {
                team_id: z.string().uuid().describe("UUID of the team (from the teams table)"),
                keyword: z
                    .string()
                    .min(2)
                    .describe(
                        'Search term matched against ADR title and decision (e.g., "redux", "cache", "auth")'
                    ),
            },
        },
        async ({ team_id, keyword }) => {
            const safe = sanitizeKeyword(keyword);
            if (safe.length < 2) {
                throw new Error("Invalid keyword: must contain at least 2 valid characters");
            }

            const { data, error } = await supabase
                .from("adrs")
                .select("title, decision, status")
                .eq("team_id", team_id)
                .eq("status", "accepted")
                .or(`title.ilike.%${safe}%,decision.ilike.%${safe}%`);

            if (error) {
                throw new Error(`Failed to search ADRs: ${error.message}`);
            }

            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify({ adrs: data ?? [], count: data?.length ?? 0 }),
                    },
                ],
            };
        }
    );
}
