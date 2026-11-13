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
  team_id: string;
  title: string;
  context: string;
  decision: string;
  status: AdrStatus;
  created_at: string;
}

/** Time (contexto de dados: regras, ADRs e histórico pertencem a um time). */
export interface Team {
  id: string;
  name: string;
  created_at?: string;
}

/** Time com a contagem de registros associados (listagem em /times). */
export interface TeamWithCounts extends Team {
  rules_count: number;
  adrs_count: number;
  reviews_count: number;
}

/** Dados editáveis de um time (entrada do formulário de criação/edição). */
export type TeamInput = Pick<Team, "name">;

/** Dados editáveis de uma ADR (entrada do formulário de criação/edição). */
export type AdrInput = Pick<Adr, "title" | "context" | "decision" | "status">;
