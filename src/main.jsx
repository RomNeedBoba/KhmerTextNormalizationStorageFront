import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import "./styles/signin.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/page.css";
import "./styles/table.css";
import "./styles/modal.css";
import "./styles/pills.css";
import "./styles/khmerPreview.css";

import { AuthProvider } from "./auth/AuthContext.jsx";
import AuthGate from "./auth/AuthGate.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>
);