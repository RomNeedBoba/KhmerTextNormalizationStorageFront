import { createContext, useContext, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "./token";

// Decode JWT payload without a library — works for any standard JWT
function decodeToken(token) {
  try {
    const base64 = token.split(".")[1];
    const json    = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());

  const isAuthed = Boolean(token);

  // Decode once and memoize — { email, role, iat, exp }
  const user = useMemo(() => (token ? decodeToken(token) : null), [token]);

  const login = (newToken) => {
    setToken(newToken);
    setTokenState(newToken);
  };

  const logout = () => {
    clearToken();
    setTokenState("");
  };

  const value = useMemo(
    () => ({ token, isAuthed, user, login, logout }),
    [token, isAuthed, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

