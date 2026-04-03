import { useState } from "react";
import { useAuth } from "./auth/AuthContext";
import Sidebar from "./components/Sidebar";
import OverviewPage       from "./pages/OverviewPage";
import ValidatorPage      from "./pages/ValidatorPage";
import TextNormPage       from "./pages/TextNormPage";
import ParallelNormPage   from "./pages/ParallelNormPage";
import DataValidationPage from "./pages/DataValidationPage";
import StudentStatusPage  from "./pages/StudentStatusPage";

export default function App() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  const [active, setActive] = useState(isAdmin ? "overview" : "datavalidation");

  return (
    <div className="appShell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main">

        {/* ── Admin only ── */}
        {isAdmin && active === "overview"     && <OverviewPage />}
        {isAdmin && active === "validator"    && <ValidatorPage />}
        {isAdmin && active === "textnorm"     && <TextNormPage />}
        {isAdmin && active === "parallelnorm" && <ParallelNormPage />}

        {/* ── Admin + Student ── */}
        {active === "datavalidation" && <DataValidationPage />}

        {/* ── Student only ── */}
        {!isAdmin && active === "mystatus" && <StudentStatusPage />}

      </main>
    </div>
  );
}