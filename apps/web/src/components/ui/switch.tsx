/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-13
 * Data Atualização: 2026-11-13
 * Descrição: Componente Switch (toggle) no estilo shadcn/ui, implementado com um <button> nativo
 * com `role="switch"` e `aria-checked`, sem dependências adicionais.
 *
 * Alterna com um clique (ou Espaço/Enter, pelo comportamento padrão do botão) e aceita
 * `aria-labelledby`/`id` para associação com um <Label>.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Estado atual (ligado/desligado). */
  checked: boolean;
  /** Chamado com o novo estado ao clicar. */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Toggle acessível de dois estados.
 * @param props.checked Estado atual.
 * @param props.onCheckedChange Callback com o novo valor.
 * @returns Elemento <button role="switch">.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-green-600" : "bg-gray-600",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch };
