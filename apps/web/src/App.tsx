import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { RulesPage } from "@/pages/RulesPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { AdrsPage } from "@/pages/AdrsPage";
import { TeamsPage } from "@/pages/TeamsPage";

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/regras" element={<RulesPage />} />
          <Route path="/historico" element={<HistoryPage />} />
          <Route path="/adrs" element={<AdrsPage />} />
          <Route path="/times" element={<TeamsPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
