import { AlertTriangle } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { isSupabaseConfigured } from "@/lib/supabase";

export function DataSourceBanner() {
  const rulesErr = useAppSelector((s) => s.rules.fetchError);
  const historyErr = useAppSelector((s) => s.history.fetchError);
  const adrsErr = useAppSelector((s) => s.adrs.fetchError);
  const teamsErr = useAppSelector((s) => s.teams.fetchError);
  const fetchError = teamsErr ?? rulesErr ?? historyErr ?? adrsErr;

  if (!isSupabaseConfigured) {
    return (
      <div className="flex shrink-0 items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <p>
          <span className="font-medium">Supabase não configurado.</span> Copie{" "}
          <code className="rounded bg-black/30 px-1 py-0.5 text-xs">
            apps/web/.env.example
          </code>{" "}
          para{" "}
          <code className="rounded bg-black/30 px-1 py-0.5 text-xs">apps/web/.env</code>{" "}
          e reinicie o Vite.
        </p>
      </div>
    );
  }

  if (!fetchError) return null;

  const hint =
    /fetch|network|failed/i.test(fetchError) || fetchError.includes("ECONNREFUSED")
      ? " Se o .env já está certo, inicie o banco: npx supabase start e depois npx supabase db reset."
      : "";

  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
      <p>
        <span className="font-medium">Não foi possível falar com o Supabase.</span>{" "}
        {fetchError}.{hint}
      </p>
    </div>
  );
}
