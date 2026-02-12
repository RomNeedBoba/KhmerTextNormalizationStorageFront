import { createContext, useContext, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "./token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());

  const isAuthed = Boolean(token);

  const login = (newToken) => {
    setToken(newToken);
    setTokenState(newToken);
  };

  const logout = () => {
    clearToken();
    setTokenState("");
  };

  const value = useMemo(() => ({ token, isAuthed, login, logout }), [token, isAuthed]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
