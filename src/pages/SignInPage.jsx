import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function SignInPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState("rpphyrom.dev@gmail.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      login(res.data.token);
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signinShell">
      <form className="card signinCard" onSubmit={submit}>
        <h2 className="signinTitle">Sign In</h2>
        <div className="smallMuted">Internal access for researchers</div>

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

        <div className="formGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
