import { API_BASE_URL, getAuthHeader } from "../api";

export const getVersions = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/versions`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to fetch versions");
  return response.json();
};

export const getActivityDiagram = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/activity-diagram`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to fetch activity diagram");
  return response.json();
};

export const generatePrototype = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/generate-prototype`, {
    method: "POST",
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to generate prototype");
  return response.json();
};

export const generatePRD = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/generate-prd`, {
    method: "POST",
    headers: getAuthHeader(),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate PRD");
  }
  return response.json();
};

export const generateBRD = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/generate-brd`, {
    method: "POST",
    headers: getAuthHeader(),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate BRD");
  }
  return response.json();
};
