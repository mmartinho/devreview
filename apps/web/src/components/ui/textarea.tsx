/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-13
 * Data Atualização: 2026-11-13
 * Descrição: Componente Textarea no estilo shadcn/ui, com as mesmas classes base do `Input`.
 * Usado nos campos de texto longo (ex.: Contexto e Decisão das ADRs).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Área de texto multilinha.
 * @param props Atributos nativos de <textarea>.
 * @returns Elemento <textarea> estilizado.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
