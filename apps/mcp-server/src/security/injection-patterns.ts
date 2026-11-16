/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-16
 * Data Atualização: 2026-11-16
 * Descrição: Heurística (PT/EN) para detectar textos que parecem instruir o modelo em vez de
 * documentar código ou decisões, típicos de prompt injection. A detecção apenas SINALIZA o
 * texto; nunca o altera nem o bloqueia, para não esconder evidência nem gerar falso-positivo destrutivo.
 *
 * É uma camada de apoio, não uma garantia: um atacante adaptativo pode escapar dos padrões.
 */

/** Regra de detecção: padrão e motivo legível exibido em `suspicious_fields`. */
interface InjectionPattern {
  /** Expressão regular aplicada ao texto já normalizado (NFKC, sem caracteres invisíveis). */
  pattern: RegExp;
  /** Motivo curto devolvido ao modelo/usuário. */
  reason: string;
}

/** Padrões conhecidos, em português e inglês. */
const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  {
    pattern: /\b(ignor[ea]r?|desconsider[ea]r?|esque[cç]a|disregard|ignore|forget)\b[^.\n]{0,40}\b(instru[cç][õo]es|regras|rules|instructions|prompts?|anteriores|previous|above|acima)\b/i,
    reason: "pede para ignorar instruções ou regras",
  },
  {
    pattern: /\b(aprov(e|ar)|approve|lgtm)\b[^.\n]{0,30}\b(pr|pull request|tudo|todos?|qualquer|this|all|any)\b/i,
    reason: "tenta induzir aprovação do PR",
  },
  {
    pattern: /\b(responda|reply|respond|answer)\b[^.\n]{0,20}\b(apenas|somente|only|just)\b/i,
    reason: "tenta impor o formato ou conteúdo da resposta",
  },
  {
    pattern: /\b(voc[eê] (agora )?[eé]|you are now|act as|aja como|finja ser|pretend to be)\b/i,
    reason: "tenta redefinir o papel do modelo",
  },
  {
    pattern: /\b(system prompt|prompt do sistema|developer message|mensagem do sistema)\b/i,
    reason: "menciona o prompt de sistema",
  },
  {
    pattern: /(<\/?\s*(system|assistant|instructions?|tool_?(call|use))\b[^>]*>|^\s*(system|assistant)\s*:)/im,
    reason: "imita marcação de papel/sistema",
  },
  {
    pattern: /\b(chame|execute|invoque|call|invoke|run)\b[^.\n]{0,25}\b(a )?(tool|ferramenta|fun[cç][aã]o|function|get_file_contents|execute_sql)\b/i,
    reason: "tenta induzir chamada de tool",
  },
  {
    pattern: /\b(revele|mostre|exiba|reveal|print|leak|exfiltrate|cole)\b[^.\n]{0,40}\b(segredos?|secrets?|tokens?|senhas?|passwords?|\.env|api[_ ]?keys?|chaves?)\b/i,
    reason: "tenta obter segredos",
  },
  {
    pattern: /[A-Za-z0-9+/]{80,}={0,2}/,
    reason: "bloco longo que parece base64 (possível ofuscação)",
  },
];

/**
 * Detecta indícios de prompt injection em um texto.
 *
 * @param {string} text - Texto já normalizado (NFKC e sem caracteres invisíveis).
 * @returns {string[]} Motivos distintos encontrados; vazio se nada suspeito.
 */
export function detectInjection(text: string): string[] {
  const reasons: string[] = [];
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(text)) reasons.push(reason);
  }
  return reasons;
}
