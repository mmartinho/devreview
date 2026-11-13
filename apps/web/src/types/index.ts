/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Tipos compartilhados do client web do DevReview (regras de review, histórico de
 * reviews e ADRs), espelhando as tabelas do Supabase.
 *
 * Inclui também tipos auxiliares usados nos formulários, como `RuleInput`.
 */

export type RuleSeverity = "error" | "warning" | "info";
export type RuleCategory =
  | "style"
  | "architecture"
  | "security"
  | "performance";
export type AdrStatus = "proposed" | "accepted" | "deprecated";

export interface ReviewRule {
  id: string;
  team_id: string;
  category: RuleCategory;
  rule: string;
  severity: RuleSeverity;
  active: boolean;
  created_at?: string;
}

/** Dados editáveis de uma regra (entrada do formulário de criação/edição). */
export type RuleInput = Pick<
  ReviewRule,
  "rule" | "category" | "severity" | "active"
>;

export interface ReviewHistory {
  id: string;
  pr_url: string;
  pr_number: number;
  repo: string;
  review_summary: string;
  issues_found: number;
  reviewed_at: string;
}

export interface Adr {
  id: string;
  title: string;
  context: string;
  decision: string;
  status: AdrStatus;
  created_at: string;
}
