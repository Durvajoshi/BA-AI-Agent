import { API_BASE_URL, getAuthHeader } from "../api";

export const deleteProfile = async (password) => {
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to delete account");
  return data;
};
