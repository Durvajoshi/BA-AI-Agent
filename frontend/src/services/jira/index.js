import { API_BASE_URL, getAuthHeader } from "../api";

export const checkJiraStatus = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/jira/status/${conversationId}`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to check Jira status");
  return response.json();
};

export const exportToJira = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/jira/export/${conversationId}`, {
    method: "POST",
    headers: getAuthHeader(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to export to Jira");
  return data;
};
