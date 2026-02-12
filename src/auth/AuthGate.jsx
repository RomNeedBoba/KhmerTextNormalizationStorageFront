import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../api/client";
import SignInPage from "../pages/SignInPage";

// Optional: auto-logout on 401 responses when making requests
export default function AuthGate({ children }) {
  const { isAuthed, logout } = useAuth();
  const [forcedOut, setForcedOut] = useState(false);

  useEffect(() => {
    // One-time interceptor to catch 401 and logout
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) {
          logout();
          setForcedOut(true);
        }
        return Promise.reject(err);
      }
    );

    return () => {
      api.interceptors.response.eject(id);
    };
  }, [logout]);

  if (!isAuthed) return <SignInPage forcedOut={forcedOut} />;
  return children;
}
