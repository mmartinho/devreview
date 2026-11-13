/**
 * Autor(es): Marcus Martinho (marcus.antonio.martinho.silva@gmail.com), Claude Sonnet 5.5
 * Data Criação: 2026-11-09
 * Data Atualização: 2026-11-13
 * Descrição: Layout base da aplicação (sidebar + área principal). Também carrega a lista de times
 * uma única vez ao iniciar, pois o time atual (select do `Header`) depende dela em todas as páginas.
 */
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { DataSourceBanner } from "./DataSourceBanner";
import { useAppDispatch } from "@/store/hooks";
import { fetchTeams } from "@/store/slices/teamsSlice";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <DataSourceBanner />
        {children}
      </main>
    </div>
  );
}
