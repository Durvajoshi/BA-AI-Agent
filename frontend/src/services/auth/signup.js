import { API_BASE_URL } from "../api";

export const signup = async (email, password, fullName, jiraBaseUrl, jiraEmail, jiraApiToken, jiraLeadAccountId) => {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName, jiraBaseUrl, jiraEmail, jiraApiToken, jiraLeadAccountId, otpVerified: true })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Signup failed");
  return data;
};
