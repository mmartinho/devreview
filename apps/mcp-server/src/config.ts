/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-09
 * Descrição: Leitura e validação (Zod) das variáveis de ambiente do servidor MCP.
 * Nesta fase todas são opcionais: o servidor sobe sem `.env` e usa apenas dados mockados.
 *
 * As variáveis do Supabase ainda não são consumidas; ficam prontas para o módulo 4.
 */
import { z } from "zod";

/** Schema das variáveis de ambiente (todas opcionais nesta fase). */
const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
});

/**
 * Valida o ambiente informado.
 *
 * @param env - Mapa de variáveis (padrão: `process.env`).
 * @returns Objeto de configuração validado.
 * @throws {z.ZodError} Se alguma variável presente tiver formato inválido (ex.: URL malformada).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}

/** Configuração validada do processo atual. */
export const config = loadConfig();
