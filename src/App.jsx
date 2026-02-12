import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TextNormPage from "./pages/TextNormPage";
import ParallelNormPage from "./pages/ParallelNormPage"; // ✅ NEW

function Overview() {
  return (
    <div className="card" style={{ padding: 14 }}>
      <h2 style={{ marginTop: 0 }}>Overview</h2>
      <div className="smallMuted">Dashboard Later</div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("textnorm");

  return (
    <div className="appShell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main">
        {active === "overview" && <Overview />}
        {active === "textnorm" && <TextNormPage />}
        {active === "parallelnorm" && <ParallelNormPage />} {/* ✅ NEW */}
      </main>
    </div>
  );
}