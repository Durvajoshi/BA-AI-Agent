import { API_BASE_URL, getAuthHeader } from "../api";

export const updateProfile = async (updates) => {
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to update profile");
  return data.user;
};
