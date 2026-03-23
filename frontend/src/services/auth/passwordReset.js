import { API_BASE_URL } from "../api";

export const requestPasswordReset = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to request reset");
  return data;
};

export const completePasswordReset = async (email, code, newPassword) => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to reset password");
  return data;
};
