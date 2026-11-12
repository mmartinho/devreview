/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-12
 * Data Atualização: 2026-11-12
 * Descrição: Módulo que registra no servidor MCP a tool "get_team_review_rules", que retorna as
 * regras de code review ativas de um time, opcionalmente filtradas por categoria.
 * 
 * Os dados são lidos da tabela "review_rules" do Supabase e ordenados por severidade.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../db/supabase.js";

/**
 * Registra a tool "get_team_review_rules" no servidor MCP informado.
 *
 * @param {McpServer} server - Instância do servidor MCP onde a tool será registrada.
 * @returns {void}
 * @throws {Error} Dentro do handler da tool, se a consulta ao Supabase falhar.
 */
export function registerReviewRulesTools(server: McpServer) {
  server.registerTool(
    "get_team_review_rules",
    {
      title: "Get Team Review Rules",
      description:
        "Retrieves active code review rules for a team, grouped by category. " +
        "Use when reviewing a PR to know the team's coding standards.",
      inputSchema: {
        team_id: z.string().uuid().describe("UUID of the team (from the teams table)"),
        category: z
          .enum(["style", "architecture", "security", "performance"])
          .nullable()
          .optional()
          .describe("Filter by category. Omit to get all categories."),
      },
    },
    async ({ team_id, category }) => {
      let query = supabase
        .from("review_rules")
        .select("category, rule, severity")
        .eq("team_id", team_id)
        .eq("active", true)
        .order("severity");

      if (category) query = query.eq("category", category);

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch review rules: ${error.message}`);
      }

      const rules = data ?? [];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ rules, count: rules.length }),
          },
        ],
      };
    }
  );
}
