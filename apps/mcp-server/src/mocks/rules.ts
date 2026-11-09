/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-09
 * Descrição: Dados mockados das regras de code review do time demo. Espelha, com os mesmos
 * textos, categorias, severidades e flag `active`, as 8 regras inseridas em `supabase/seed.sql`.
 *
 * Serve como fonte de dados local enquanto o servidor MCP não consulta o Supabase (módulo 4 do curso).
 */

/** Categorias válidas de regra (mesmo CHECK da tabela `review_rules`). */
export const RULE_CATEGORIES = ["style", "architecture", "security", "performance"] as const;

/** Severidades válidas de regra (mesmo CHECK da tabela `review_rules`). */
export const RULE_SEVERITIES = ["error", "warning", "info"] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

/** Regra de code review (subconjunto de `review_rules` relevante para o mock). */
export interface ReviewRule {
  id: string;
  team_id: string;
  category: RuleCategory;
  rule: string;
  severity: RuleSeverity;
  active: boolean;
}

/** ID fixo do time demo (seed em `supabase/seed.sql`). */
export const TEAM_ID = "11111111-1111-1111-1111-111111111111";

/** As 8 regras do seed, na mesma ordem do SQL. */
export const rules: ReviewRule[] = [
  { category: "security", severity: "error", active: true, rule: "Nunca expor chaves de API ou tokens em código-fonte" },
  { category: "architecture", severity: "error", active: true, rule: "Separar lógica de negócio da camada de apresentação" },
  { category: "performance", severity: "warning", active: true, rule: "Evitar renderizações desnecessárias em componentes React" },
  { category: "style", severity: "warning", active: true, rule: "Usar nomenclatura camelCase para variáveis e funções" },
  { category: "architecture", severity: "warning", active: false, rule: "Evitar dependências circulares entre módulos" },
  { category: "style", severity: "info", active: true, rule: "Documentar funções públicas com JSDoc" },
  { category: "performance", severity: "info", active: true, rule: "Utilizar lazy loading para rotas secundárias" },
  { category: "security", severity: "warning", active: true, rule: "Validar e sanitizar todos os inputs do usuário" },
].map((r, i) => ({
  ...r,
  id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  team_id: TEAM_ID,
})) as ReviewRule[];
