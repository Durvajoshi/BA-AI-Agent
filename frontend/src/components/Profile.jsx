import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import * as authApi from "../services/auth";

export function Profile({ onBackToChat }) {
  const { user, logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  const [formData, setFormData] = useState({
    email: user?.email || "",
    fullName: user?.full_name || "",
    jiraBaseUrl: user?.jira_base_url || "",
    jiraEmail: user?.jira_email || "",
    jiraApiToken: "",
    jiraLeadAccountId: user?.jira_lead_account_id || "",
    openrouterApiKey: ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [deleteData, setDeleteData] = useState({
    deletePassword: ""
  });

  // Update formData when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || "",
        fullName: user.full_name || "",
        jiraBaseUrl: user.jira_base_url || "",
        jiraEmail: user.jira_email || "",
        jiraApiToken: "",
        jiraLeadAccountId: user.jira_lead_account_id || "",
        openrouterApiKey: ""
      });
    }
  }, [user]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDeleteChange = (e) => {
    const { name, value } = e.target;
    setDeleteData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e) => {
    console.log("handleUpdateProfile called");
    e.preventDefault();
    setError("");
    setMessage("");
    
    console.log("Form data:", formData);
    
    // Validate required fields
    if (!formData.jiraBaseUrl.trim()) {
      console.log("Validation failed: jiraBaseUrl empty");
      setError("Jira Base URL is required");
      return;
    }
    if (!formData.jiraEmail.trim()) {
      console.log("Validation failed: jiraEmail empty");
      setError("Jira Email is required");
      return;
    }
    if (!formData.jiraLeadAccountId.trim()) {
      console.log("Validation failed: jiraLeadAccountId empty");
      setError("Jira Lead Account ID is required");
      return;
    }

    console.log("Validation passed");
    setLoading(true);

    try {
      const updateData = {
        jiraBaseUrl: formData.jiraBaseUrl,
        jiraEmail: formData.jiraEmail,
        jiraLeadAccountId: formData.jiraLeadAccountId
      };

      // Only include jiraApiToken if it was changed
      if (formData.jiraApiToken) {
        updateData.jiraApiToken = formData.jiraApiToken;
      }

      // Always include openrouterApiKey so user can save or clear it
      // If they left it blank, it means "don't change" — only send if they typed something
      if (formData.openrouterApiKey !== "") {
        updateData.openrouterApiKey = formData.openrouterApiKey;
      }

      console.log("About to call authApi.updateProfile with:", updateData);
      const result = await authApi.updateProfile(updateData);
      console.log("API call successful, result:", result);

      setMessage("Profile updated successfully!");
      // Reset API token fields after successful update
      setFormData(prev => ({
        ...prev,
        jiraApiToken: "",
        openrouterApiKey: ""
      }));
    } catch (err) {
      console.error("Update error:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!passwordData.currentPassword.trim()) {
      setError("Current Password is required");
      return;
    }

    if (!passwordData.newPassword.trim()) {
      setError("New Password is required");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.updateProfile({
        currentPassword: passwordData.currentPassword,
        password: passwordData.newPassword
      });

      setMessage("Password updated successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setShowPasswordForm(false);
    } catch (err) {
      console.error("Password update error:", err);
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!deleteData.deletePassword.trim()) {
      setError("Password is required to delete account");
      return;
    }

    if (!window.confirm("Are you sure? This action cannot be undone. All your conversations and data will be permanently deleted.")) {
      return;
    }

    setLoading(true);

    try {
      await authApi.deleteProfile(deleteData.deletePassword);
      setMessage("Account deleted successfully. Logging out...");
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBackToChat} style={styles.backBtn}>
          ← Back to Chat
        </button>
        <h1 style={styles.title}>Profile Settings</h1>
        <div style={{ width: "80px" }} />
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Account Information</h2>
          
          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <form onSubmit={handleUpdateProfile} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled={true}
                style={{ ...styles.input, ...styles.readOnlyInput }}
              />
              <small style={styles.hint}>Email cannot be changed</small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                disabled={true}
                style={{ ...styles.input, ...styles.readOnlyInput }}
              />
              <small style={styles.hint}>Full name cannot be changed</small>
            </div>

            <h3 style={styles.subTitle}>🤖 AI API Key</h3>

            <div style={styles.formGroup}>
              <label style={styles.label}>OpenRouter API Key</label>
              <div style={styles.keyStatusBadge}>
                {user?.has_openrouter_key
                  ? <span style={styles.keyStatusSaved}>✓ Key saved — you have full access</span>
                  : <span style={styles.keyStatusMissing}>⚠ No key saved — free tier applies (3 messages)</span>
                }
              </div>
              <input
                type="password"
                name="openrouterApiKey"
                placeholder={user?.has_openrouter_key ? "Enter new key to replace current" : "sk-or-v1-..."}
                value={formData.openrouterApiKey}
                onChange={handleFormChange}
                disabled={loading}
                style={styles.input}
              />
              <small style={styles.hint}>
                Get your free key at{" "}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={styles.link}>
                  openrouter.ai/keys
                </a>. Leave blank to keep the current key unchanged.
              </small>
            </div>

            <h3 style={styles.subTitle}>Jira Credentials</h3>

            <div style={styles.formGroup}>
              <label style={styles.label}>Jira Base URL <span style={styles.required}>*</span></label>
              <input
                type="text"
                name="jiraBaseUrl"
                placeholder="https://your-domain.atlassian.net"
                value={formData.jiraBaseUrl}
                onChange={handleFormChange}
                disabled={loading}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Jira Email <span style={styles.required}>*</span></label>
              <input
                type="email"
                name="jiraEmail"
                value={formData.jiraEmail}
                onChange={handleFormChange}
                disabled={loading}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Jira API Token <span style={styles.hint}>(leave blank to keep current)</span></label>
              <input
                type="password"
                name="jiraApiToken"
                placeholder="Enter new token if you want to change it"
                value={formData.jiraApiToken}
                onChange={handleFormChange}
                disabled={loading}
                style={styles.input}
              />
              <small style={styles.hint}>
                Get your token from https://id.atlassian.com/manage-profile/security/api-tokens
              </small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Jira Lead Account ID <span style={styles.required}>*</span></label>
              <input
                type="text"
                name="jiraLeadAccountId"
                value={formData.jiraLeadAccountId}
                onChange={handleFormChange}
                disabled={loading}
                style={styles.input}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Security</h2>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm(true);
                setError("");
                setMessage("");
              }}
              style={styles.changePasswordBtn}
            >
              Change Password
            </button>
          ) : (
            <form onSubmit={handleUpdatePassword} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Current Password <span style={styles.required}>*</span></label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>New Password <span style={styles.required}>*</span></label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm New Password <span style={styles.required}>*</span></label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.buttonGroup}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...styles.submitBtn,
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Saving..." : "Update Password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setError("");
                    setMessage("");
                  }}
                  disabled={loading}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Danger Zone</h2>
          
          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}
          
          {!showDeleteForm ? (
            <div>
              <p style={styles.dangerText}>
                Deleting your account is permanent and cannot be undone. All your conversations and data will be deleted.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteForm(true);
                  setError("");
                  setMessage("");
                }}
                style={styles.deleteBtn}
              >
                Delete Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeleteProfile} style={styles.form}>
              <div style={styles.warningBox}>
                <p style={styles.warningText}>
                  ⚠️ This action cannot be undone. Enter your password to permanently delete your account and all associated data.
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password <span style={styles.required}>*</span></label>
                <input
                  type="password"
                  name="deletePassword"
                  value={deleteData.deletePassword}
                  onChange={handleDeleteChange}
                  disabled={loading}
                  style={styles.input}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div style={styles.buttonGroup}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...styles.deleteSubmitBtn,
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Deleting..." : "Permanently Delete Account"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteForm(false);
                    setDeleteData({ deletePassword: "" });
                    setError("");
                    setMessage("");
                  }}
                  disabled={loading}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 30px",
    background: "var(--bg-elevated)",
    borderBottom: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)"
  },
  backBtn: {
    padding: "10px 20px",
    background: "var(--bg-subtle)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all var(--transition-fast)"
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "600",
    color: "var(--text-1)",
    fontFamily: "var(--font-display)"
  },
  content: {
    flex: 1,
    overflowY: "auto",
    maxWidth: "800px",
    margin: "0 auto",
    width: "100%",
    padding: "30px 20px"
  },
  section: {
    background: "var(--bg-elevated)",
    borderRadius: "var(--radius-md)",
    padding: "25px",
    marginBottom: "20px",
    boxShadow: "var(--shadow-sm)",
    border: "1px solid var(--border)"
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text-1)",
    marginTop: 0,
    marginBottom: "20px",
    borderBottom: "2px solid var(--brand-600)",
    paddingBottom: "10px"
  },
  subTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--text-2)",
    marginTop: "25px",
    marginBottom: "15px"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--text-1)"
  },
  required: {
    color: "var(--danger-600)",
    fontSize: "18px",
    marginLeft: "4px"
  },
  input: {
    padding: "12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    fontSize: "14px",
    outline: "none",
    transition: "all var(--transition-fast)",
    fontFamily: "inherit"
  },
  readOnlyInput: {
    backgroundColor: "var(--bg-muted)",
    color: "var(--text-3)",
    cursor: "not-allowed"
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-3)",
    marginTop: "4px"
  },
  error: {
    padding: "12px",
    background: "#ffebee",
    color: "var(--danger-600)",
    borderRadius: "var(--radius-sm)",
    marginBottom: "15px",
    fontSize: "14px",
    border: "1px solid rgba(180, 35, 24, 0.4)"
  },
  success: {
    padding: "12px",
    background: "rgba(15, 118, 110, 0.12)",
    color: "var(--success-600)",
    borderRadius: "var(--radius-sm)",
    marginBottom: "15px",
    fontSize: "14px",
    border: "1px solid rgba(15, 118, 110, 0.4)"
  },
  submitBtn: {
    padding: "12px 24px",
    background: "var(--brand-600)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    boxShadow: "var(--shadow-xs)"
  },
  changePasswordBtn: {
    padding: "12px 24px",
    background: "var(--bg-subtle)",
    color: "var(--text-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all var(--transition-fast)"
  },
  cancelBtn: {
    padding: "12px 24px",
    background: "var(--bg-subtle)",
    color: "var(--text-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all var(--transition-fast)"
  },
  deleteBtn: {
    padding: "12px 24px",
    background: "var(--danger-600)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    boxShadow: "var(--shadow-xs)"
  },
  deleteSubmitBtn: {
    padding: "12px 24px",
    background: "var(--danger-600)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    boxShadow: "var(--shadow-xs)"
  },
  dangerText: {
    color: "var(--danger-600)",
    fontSize: "14px",
    marginBottom: "15px",
    lineHeight: "1.5"
  },
  warningBox: {
    background: "rgba(180, 35, 24, 0.08)",
    border: "1px solid rgba(180, 35, 24, 0.4)",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    marginBottom: "15px"
  },
  warningText: {
    color: "var(--danger-600)",
    margin: 0,
    fontSize: "14px",
    lineHeight: "1.5"
  },
  buttonGroup: {
    display: "flex",
    gap: "12px"
  },
  keyStatusBadge: {
    marginBottom: "8px"
  },
  keyStatusSaved: {
    display: "inline-block",
    padding: "4px 12px",
    background: "rgba(15, 118, 110, 0.1)",
    color: "var(--success-600)",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    border: "1px solid rgba(15, 118, 110, 0.35)"
  },
  keyStatusMissing: {
    display: "inline-block",
    padding: "4px 12px",
    background: "rgba(180, 120, 0, 0.1)",
    color: "#b46000",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    border: "1px solid rgba(180, 120, 0, 0.35)"
  },
  link: {
    color: "var(--brand-600)",
    textDecoration: "none"
  }
};
