import axios from "axios";
import { getToken } from "../auth/token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "https://khmertextnormalizationstorage.onrender.com",
});

// Attach Authorization header
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If unauthorized, let the app redirect (we'll handle it in AuthGate)
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);