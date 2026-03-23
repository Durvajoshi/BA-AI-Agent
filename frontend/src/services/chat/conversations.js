import { API_BASE_URL, getAuthHeader } from "../api";

export const createConversation = async () => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });
  if (!response.ok) throw new Error("Failed to create conversation");
  return response.json();
};

export const getAllConversations = async () => {
  const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to fetch conversations");
  return response.json();
};

export const getConversationMessages = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/messages`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to fetch messages");
  return response.json();
};

export const updateConversationTitle = async (conversationId, title) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/title`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Failed to update title");
  return response.json();
};

export const toggleConversationPin = async (conversationId, isPinned) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}/pin`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ isPinned }),
  });
  if (!response.ok) throw new Error("Failed to pin/unpin conversation");
  return response.json();
};

export const deleteConversation = async (conversationId) => {
  const response = await fetch(`${API_BASE_URL}/chat/conversation/${conversationId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to delete conversation");
  return response.json();
};

export const cleanupEmptyConversations = async () => {
  const response = await fetch(`${API_BASE_URL}/chat/cleanup-empty-conversations`, {
    method: "POST",
    headers: getAuthHeader(),
  });
  if (!response.ok) {
    console.warn("Failed to cleanup empty conversations");
    return { success: false };
  }
  return response.json();
};
