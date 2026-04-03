export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  }
}

export function clearToken() {
  localStorage.removeItem("token");
}