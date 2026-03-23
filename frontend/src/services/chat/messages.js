import { API_BASE_URL, getAuthHeader } from "../api";

export const sendMessage = async (conversationId, content) => {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ conversationId, content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to send message");
  return data;
};

export const getFreeTierStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/chat/free-tier-status`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to fetch free tier status");
  return response.json();
};
