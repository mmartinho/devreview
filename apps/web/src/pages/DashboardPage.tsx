import { useEffect } from "react";
import { GitPullRequest, ListChecks, BookOpen, AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchRules } from "@/store/slices/rulesSlice";
import { fetchHistory } from "@/store/slices/historySlice";
import { fetchAdrs } from "@/store/slices/adrsSlice";
import { Link } from "react-router-dom";
import { selectCurrentTeamId } from "@/store/slices/teamsSlice";

function issueSeverity(issues: number): "error" | "warning" | "info" {
  if (issues >= 4) return "error";
  if (issues > 0) return "warning";
  return "info";
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const teamId = useAppSelector(selectCurrentTeamId);
  const teamsLoading = useAppSelector((s) => s.teams.loading);
  const rules = useAppSelector((s) => s.rules.items);
  const history = useAppSelector((s) => s.history.items);
  const adrs = useAppSelector((s) => s.adrs.items);

  useEffect(() => {
    if (!teamId) return;
    dispatch(fetchRules(teamId));
    dispatch(fetchHistory(teamId));
    dispatch(fetchAdrs(teamId));
  }, [dispatch, teamId]);

  const activeRules = rules.filter((r) => r.active).length;
  const totalIssues = history.reduce((acc, r) => acc + r.issues_found, 0);
  const avgIssues =
    history.length > 0
      ? (totalIssues / history.length).toFixed(1)
      : "0";

  const recentHistory = history.slice(0, 3);
  const recentRules = rules.slice(0, 4);

  return (
    <div className="flex flex-col overflow-y-auto">
      <Header title="Início" />

      <div className="flex-1 space-y-6 p-6">
        {!teamId && !teamsLoading && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Nenhum time selecionado.{" "}
            <Link to="/times" className="font-medium text-indigo-300 underline hover:text-indigo-200">
              Crie ou escolha um time
            </Link>{" "}
            para ver e cadastrar dados.
          </div>
        )}
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Reviews"
            value={history.length}
            icon={GitPullRequest}
            iconColor="bg-blue-500/20 text-blue-400"
            description="Últimos 30 dias"
          />
          <StatCard
            title="Regras Ativas"
            value={activeRules}
            icon={ListChecks}
            iconColor="bg-green-500/20 text-green-400"
            description={`de ${rules.length} regras cadastradas`}
          />
          <StatCard
            title="ADRs"
            value={adrs.length}
            icon={BookOpen}
            iconColor="bg-purple-500/20 text-purple-400"
            description="Decisões arquiteturais"
          />
          <StatCard
            title="Média de Issues"
            value={avgIssues}
            icon={AlertTriangle}
            iconColor="bg-amber-500/20 text-amber-400"
            description="Por PR revisado"
          />
        </div>

        {/* Recent content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent reviews */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">
                Últimos Reviews
              </h2>
            </div>
            <div className="divide-y divide-gray-800">
              {recentHistory.map((review) => (
                <div key={review.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      #{review.pr_number}{" "}
                      <span className="text-gray-400">{review.repo}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {review.review_summary}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <SeverityBadge severity={issueSeverity(review.issues_found)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent rules */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">
                Regras Recentes
              </h2>
            </div>
            <div className="divide-y divide-gray-800">
              {recentRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{rule.rule}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <CategoryBadge category={rule.category} />
                    <SeverityBadge severity={rule.severity} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
