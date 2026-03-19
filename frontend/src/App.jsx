import { useEffect, useState, useRef, useContext } from "react";
import mermaid from "mermaid";
import { AuthContext } from "./context/AuthContext";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { ConversationHistory } from "./components/ConversationHistory";
import { Profile } from "./components/Profile";
import { JsonViewer } from "./components/JsonViewer";
import * as chatApi from "./api/chatApi";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ForgotPassword } from "./components/ForgotPassword";

function ChatInterface() {
  const { user, logout } = useContext(AuthContext);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [diagram, setDiagram] = useState(null);
  const [input, setInput] = useState("");
  const [hasBA, setHasBA] = useState(false);
  const [isExported, setIsExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [diagramZoom, setDiagramZoom] = useState(100);

  // Add this near your other state variables (like diagram, messages, etc.)
  const [activeTab, setActiveTab] = useState("diagram"); // options: "diagram", "gherkin", "schema"
  const [gherkin, setGherkin] = useState("");
  const [dataSchema, setDataSchema] = useState("");

  const [isGeneratingPRD, setIsGeneratingPRD] = useState(false);
  const [hasGeneratedPRD, setHasGeneratedPRD] = useState(false);
  const [prdMarkdown, setPrdMarkdown] = useState("");

  const [isGeneratingBRD, setIsGeneratingBRD] = useState(false);
  const [hasGeneratedBRD, setHasGeneratedBRD] = useState(false);
  const [brdMarkdown, setBrdMarkdown] = useState("");

  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const [architecture, setArchitecture] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [risk, setRisk] = useState("");
  const [estimate, setEstimate] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState(false);
  
  // Free tier state
  const [freeTierStatus, setFreeTierStatus] = useState({
    free_messages_used: user?.free_messages_used || 0,
    free_tier_limit: 3,
    has_openrouter_key: !!user?.has_openrouter_key,
    free_tier_exhausted: (user?.free_messages_used || 0) >= 3 && !user?.has_openrouter_key
  });
  const [showFreeTierPopup, setShowFreeTierPopup] = useState(false);

  // Inside loadDiagram(id)

  const [showJiraError, setShowJiraError] = useState(false); // <--- PASTE THIS

  const pollInterval = useRef(null);
  const diagramRef = useRef(null);
  const diagramWrapperRef = useRef(null);
  const chatScrollRef = useRef(null);

  const fetchFreeTierStatus = async () => {
    try {
      const status = await chatApi.getFreeTierStatus();
      setFreeTierStatus(status);
    } catch (err) {
      console.error("Error fetching free tier status:", err);
    }
  };

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose"
    });
  }, []);

  useEffect(() => {
    // Cleanup empty conversations on app load
    const cleanup = async () => {
      try {
        await chatApi.cleanupEmptyConversations();
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    };
    cleanup();

    const id = localStorage.getItem("conversationId");
    if (id) {
      setConversationId(id);
      loadMessages(id);
      loadDiagram(id);
      startPolling(id);
    } else {
      createNewChat();
    }

    fetchFreeTierStatus();

    return () => clearInterval(pollInterval.current);
  }, []);

  const checkStatus = async (cid) => {
    if (!cid) return;
    try {
      const data = await chatApi.checkJiraStatus(cid);
      if (data.exists) {
        setHasBA(true);
        setIsExported(data.isExported);
        // Optional: if (data.isExported) clearInterval(pollInterval.current);
      }
    } catch (err) {
      console.error("Status check error:", err);

      // STOP POLLING on Auth Errors (401/403)
      // This prevents the infinite loop if the token is bad
      if (err.message.includes("401") || err.message.includes("403") || err.message.includes("Unauthorized")) {
        console.warn("Stopping poll due to authentication error.");
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
      }
    }
  };

  const startPolling = (cid) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    checkStatus(cid);
    pollInterval.current = setInterval(() => checkStatus(cid), 10000);
  };

  const createNewChat = async () => {
    try {
      const data = await chatApi.startNewConversation();
      localStorage.setItem("conversationId", data.conversationId);
      setConversationId(data.conversationId);
      setMessages([]);
      setDiagram(null);
      setHasBA(false);
      setIsExported(false);
      setHasGeneratedPRD(false);
      setPrdMarkdown("");
      setHasGeneratedBRD(false);
      setBrdMarkdown("");
      startPolling(data.conversationId);
    } catch (err) {
      console.error("Create chat error:", err);
      alert("Failed to create new chat");
    }
  };

  const loadMessages = async (id) => {
    try {
      const data = await chatApi.loadMessages(id);
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error("Load messages error:", err);
    }
  };


  const loadDiagram = async (id, specificVersionId = null) => {
    try {
      setIsLoadingVersions(true);

      // Load current diagram from original API if no specific version requested 
      // OR load versions first
      const allVersions = await chatApi.getVersions(id);
      setVersions(allVersions);

      // Default to returning the selected version's data if we have versions
      if (allVersions && allVersions.length > 0) {
        let activeVersion;
        if (specificVersionId) {
          activeVersion = allVersions.find(v => v.id === specificVersionId) || allVersions[0];
        } else {
          activeVersion = allVersions[0]; // Latest version is 0th index
        }

        setSelectedVersionId(activeVersion.id);

        setDiagram(activeVersion.diagram_definition || "");
        setGherkin(activeVersion.gherkin_definition || "");
        setDataSchema(activeVersion.schema_definition || "");
        setBrdMarkdown(activeVersion.brd_markdown || "");
        setHasGeneratedPRD(!!activeVersion.prd_markdown);
        setHasGeneratedBRD(!!activeVersion.brd_markdown);

        setArchitecture(activeVersion.architecture_definition || "");
        setCompetitors(activeVersion.competitor_analysis || "");
        setRisk(activeVersion.risk_analysis || "");
        setEstimate(activeVersion.project_estimate || "");
      } else {
        // Fallback to original API just in case
        const data = await chatApi.loadDiagram(id);
        setDiagram(data.diagram || "");
        setGherkin(data.gherkin || "");
        setDataSchema(data.schema || "");
        setArchitecture(data.architecture || "");
        setCompetitors(data.competitors || "");
        setRisk(data.risk || "");
        setEstimate(data.estimate || "");
      }

    } catch (err) {
      console.error("Failed to load specifications or versions:", err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleVersionChange = (e) => {
    const vId = e.target.value;
    loadDiagram(conversationId, vId);
  };


  useEffect(() => {
    if (activeTab !== "diagram" || !diagram || !diagramRef.current) return; // Only render when active tab is diagram

    const cleanDiagram = diagram
      .replace(/```mermaid/g, "")
      .replace(/```/g, "")
      .replace(/^workflowDiagram\s*/i, "")
      // 1. Remove spaces ONLY after commas in class definitions
      .replace(/(class\s+[\w,]+),\s+/g, "$1,")
      // 2. Fix the specific "A1, C1, C2" issue by removing space after comma globally in class lines
      .replace(/class\s+([^;]+)/g, (match, p1) => {
        return `class ${p1.replace(/,\s+/g, ',').trim()}`;
      })
      // 3. Remove trailing commas before a newline or end of string
      .replace(/,\s*$/gm, "")
      .replace(/stroke:\s*$/gm, "")
      .trim();

    const normalizeMermaid = (src, options = { stripStyles: false }) => {
      let output = src
        .replace(/\r\n/g, "\n")
        .replace(/\u00A0/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

      // Remove non-mermaid notes/comments that the LLM sometimes appends.
      output = output.filter(line => !/^note\s*:/i.test(String(line || "").trim()));

      // Fix a common Mermaid error: "naked" continuation edges like:
      //   S1["Start"]
      //     --> P1["Next"]
      // Mermaid requires an explicit source node: S1 --> P1
      let lastNodeId = "";
      output = output
        .map(line => {
          let t = String(line || "").trim();

          t = t
            .replace(/\[\{/g, "[")
            .replace(/\}\]/g, "]")
            .replace(/\{"/g, "{")
            .replace(/"\}/g, "}")
            .replace(/\{([^}]*)\}/g, (match, body) => {
              const cleaned = String(body).replace(/\|+/g, " ").replace(/"/g, "").trim();
              return `{${cleaned}}`;
            });

          if (/^(-->|--\|)/.test(t) && lastNodeId) {
            t = `${lastNodeId} ${t}`;
          }

          const nodeMatch = t.match(/^([A-Za-z][A-Za-z0-9_]*)\s*[\[\(\{]/);
          if (nodeMatch) lastNodeId = nodeMatch[1];

          return t;
        })
        .filter(Boolean);

      if (options.stripStyles) {
        output = output.filter(line => {
          const lower = line.toLowerCase();
          return !(
            lower.startsWith("class ") ||
            lower.startsWith("classdef ") ||
            lower.startsWith("style ") ||
            lower.startsWith("linkstyle ")
          );
        });
      }

      let text = output.join("\n");
      if (!/^(flowchart|graph|sequenceDiagram|stateDiagram|erDiagram|classDiagram|journey|gantt|pie)\b/i.test(text.trim())) {
        text = `flowchart TD\n${text}`;
      }
      return text;
    };

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(
          "activityDiagram-" + Date.now(),
          normalizeMermaid(cleanDiagram)
        );

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.overflow = 'auto'; // Allow vertical scrolling if necessary
        wrapper.style.width = '100%';    // Make sure wrapper width is 100% of parent container
        wrapper.style.maxWidth = '100%'; // Ensure no overflow

        wrapper.innerHTML = svg;

        diagramRef.current.innerHTML = ''; // Clear any previous diagram
        diagramRef.current.appendChild(wrapper);

        const svgElement = wrapper.querySelector("svg");
        if (svgElement) {
          svgElement.style.width = "auto";  // let width grow with zoom
          svgElement.style.maxWidth = "none"; // remove max width restrictions
          svgElement.style.height = "auto";
          svgElement.style.display = "block";
          svgElement.style.transformOrigin = "top left"; // zoom from top-left for natural scroll
          svgElement.style.transform = `scale(${diagramZoom / 100})`;
        }
      } catch (err) {
        try {
          const fallback = normalizeMermaid(cleanDiagram, { stripStyles: true });
          const { svg } = await mermaid.render(
            "activityDiagram-fallback-" + Date.now(),
            fallback
          );

          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.justifyContent = 'center';
          wrapper.style.alignItems = 'flex-start';
          wrapper.style.overflow = 'auto';
          wrapper.style.width = '100%';
          wrapper.style.maxWidth = '100%';
          wrapper.innerHTML = svg;

          diagramRef.current.innerHTML = '';
          diagramRef.current.appendChild(wrapper);

          const svgElement = wrapper.querySelector("svg");
          if (svgElement) {
            svgElement.style.width = "auto";
            svgElement.style.maxWidth = "none";
            svgElement.style.height = "auto";
            svgElement.style.display = "block";
            svgElement.style.transformOrigin = "top left";
            svgElement.style.transform = `scale(${diagramZoom / 100})`;
          }
        } catch (fallbackErr) {
          console.error("Mermaid render error:", err, fallbackErr);
          diagramRef.current.innerHTML = `
        <pre style="color:var(--danger-600);padding:12px;background:#ffeceb;border-radius:var(--radius-sm);border-left:4px solid var(--danger-600);margin:0;font-size:12px;">
    Invalid Mermaid syntax.

    ${cleanDiagram}
        </pre>
      `;
        }
      }
    };



    renderDiagram();
  }, [diagram, diagramZoom, activeTab]); // Add activeTab to the dependency array

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.length]);


  const handleZoomIn = () => {
    setDiagramZoom(prev => Math.min(prev + 10, 200));
    applyZoom(diagramZoom + 10);
  };

  const handleZoomOut = () => {
    setDiagramZoom(prev => Math.max(prev - 10, 50));
    applyZoom(diagramZoom - 10);
  };

  const handleResetZoom = () => {
    setDiagramZoom(100);
    applyZoom(100);
  };

  const applyZoom = (zoomLevel) => {
    if (diagramWrapperRef.current) {
      const svg = diagramWrapperRef.current.querySelector("svg");
      if (svg) {
        svg.style.transform = `scale(${zoomLevel / 100})`;
        svg.style.transformOrigin = "top center";
      }
    }
  };

  const handleDownloadDiagram = () => {
    if (!diagramWrapperRef.current) return;

    const svg = diagramWrapperRef.current.querySelector("svg");
    if (!svg) return;

    // Create a download link for SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    // Download SVG
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sendMessage = async () => {
    if (!input.trim() || isAiThinking) return;

    const content = input;
    setInput("");
    setIsAiThinking(true);

    setMessages(prev => [...prev, { sender: "user", content }]);

    try {
      const result = await chatApi.sendMessage(conversationId, content);
      
      // Update free tier usage if returned from backend
      if (result.free_messages_used !== undefined) {
        setFreeTierStatus(prev => ({
          ...prev,
          free_messages_used: result.free_messages_used,
          free_tier_exhausted: result.free_messages_used >= prev.free_tier_limit && !prev.has_openrouter_key
        }));
      }

      await loadMessages(conversationId);
      await loadDiagram(conversationId);
      await checkStatus(conversationId);
    } catch (err) {
      console.error("Send message error:", err);
      if (err.status === 402 || err.code === "FREE_TIER_EXHAUSTED") {
        setShowFreeTierPopup(true);
        fetchFreeTierStatus();
      } else {
        alert("Failed to send message: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleExport = async () => {
    if (isExporting || !hasBA) return;

    // Check if Jira credentials exist in the user context
    const isJiraConfigured =
      user?.jira_base_url &&
      user?.jira_email &&
      user?.jira_lead_account_id;

    if (!isJiraConfigured) {
      setShowJiraError(true);
      return;
    }

    setIsExporting(true);
    try {
      const data = await chatApi.exportToJira(conversationId);
      if (data.projectKey) {
        setIsExported(true);
        // Use the user's base URL instead of a hardcoded one
        window.open(
          `${user.jira_base_url}/browse/${data.projectKey}`,
          "_blank"
        );
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Export failed. Check console.");
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePRDAction = async () => {
    if (hasGeneratedPRD && prdMarkdown) {
      const blob = new Blob([prdMarkdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PRD_${conversationId}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    setIsGeneratingPRD(true);
    try {
      const data = await chatApi.generatePRD(conversationId);
      setPrdMarkdown(data.prd);
      setHasGeneratedPRD(true);
    } catch (err) {
      console.error("PRD generation error:", err);
      alert("Failed to generate PRD. Check console.");
    } finally {
      setIsGeneratingPRD(false);
    }
  };

  const handleBRDAction = async () => {
    if (hasGeneratedBRD && brdMarkdown) {
      const blob = new Blob([brdMarkdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BRD_${conversationId}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    setIsGeneratingBRD(true);
    try {
      const data = await chatApi.generateBRD(conversationId);
      setBrdMarkdown(data.brd);
      setHasGeneratedBRD(true);
    } catch (err) {
      console.error("BRD generation error:", err);
      alert("Failed to generate BRD. Check console.");
    } finally {
      setIsGeneratingBRD(false);
    }
  };

  const parseJsonIfPossible = (raw) => {
    if (typeof raw !== "string") return null;
    let text = raw.trim();
    if (!text) return null;

    if (text.startsWith("```")) {
      const lines = text.split("\n");
      if (lines.length >= 2 && lines[0].startsWith("```")) {
        lines.shift();
        if (lines[lines.length - 1].startsWith("```")) {
          lines.pop();
        }
        text = lines.join("\n").trim();
      }
    }

    const findJsonSubstring = (input) => {
      const objIndex = input.indexOf("{");
      const arrIndex = input.indexOf("[");
      let startIndex = -1;
      if (objIndex !== -1 && arrIndex !== -1) {
        startIndex = Math.min(objIndex, arrIndex);
      } else if (objIndex !== -1) {
        startIndex = objIndex;
      } else if (arrIndex !== -1) {
        startIndex = arrIndex;
      }
      if (startIndex < 0) return null;

      const stack = [];
      let inString = false;
      let escape = false;

      for (let i = startIndex; i < input.length; i += 1) {
        const ch = input[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === "\"") {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === "{" || ch === "[") {
          stack.push(ch);
        } else if (ch === "}" || ch === "]") {
          const last = stack.pop();
          if ((ch === "}" && last !== "{") || (ch === "]" && last !== "[")) {
            return null;
          }
          if (stack.length === 0) {
            return input.slice(startIndex, i + 1);
          }
        }
      }
      return null;
    };

    const candidate = findJsonSubstring(text);
    if (!candidate) return null;

    try {
      const normalized = candidate
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  };


  return (
    <div style={styles.container}>
      {showProfile ? (
        <Profile onBackToChat={() => setShowProfile(false)} />
      ) : (
        <>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              {versions.length > 0 && (
                <select
                  style={styles.versionSelect}
                  value={selectedVersionId || ''}
                  onChange={handleVersionChange}
                  disabled={isLoadingVersions}
                >
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number} {v.version_number === versions[0]?.version_number ? "(Latest)" : ""}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleExport}
                disabled={!hasBA || isExporting}
                style={{
                  ...styles.exportBtn,
                  backgroundColor: !hasBA
                    ? "var(--bg-muted)"
                    : isExported
                      ? "var(--success-600)"
                      : "var(--brand-600)",
                  cursor:
                    hasBA && !isExporting ? "pointer" : "not-allowed"
                }}
              >
                {isExporting
                  ? "Syncing Jira..."
                  : !hasBA
                    ? "Generating BA..."
                    : isExported
                      ? "Update Jira Epic"
                      : "Export to Jira"}
              </button>
              <button
                onClick={handlePRDAction}
                disabled={!hasBA || isGeneratingPRD}
                style={{
                  ...styles.exportBtn,
                  backgroundColor: !hasBA ? "var(--bg-muted)" : hasGeneratedPRD ? "var(--success-600)" : "var(--brand-600)",
                  cursor: hasBA && !isGeneratingPRD ? "pointer" : "not-allowed",
                }}
              >
                {isGeneratingPRD ? "Generating PRD..." : hasGeneratedPRD ? "Download PRD" : "Generate PRD"}
              </button>
              <button
                onClick={handleBRDAction}
                disabled={!hasBA || isGeneratingBRD}
                style={{
                  ...styles.exportBtn,
                  backgroundColor: !hasBA ? "var(--bg-muted)" : hasGeneratedBRD ? "var(--success-600)" : "var(--brand-600)",
                  cursor: hasBA && !isGeneratingBRD ? "pointer" : "not-allowed",
                }}
              >
                {isGeneratingBRD ? "Generating BRD..." : hasGeneratedBRD ? "Download BRD" : "Generate BRD"}
              </button>
              {isAiThinking && (
                <span style={styles.thinkingText}>
                  AI is thinking...
                </span>
              )}
            </div>
            <div style={styles.headerRight}>
              {/* Free Tier Badge */}
              {!freeTierStatus.has_openrouter_key && (
                <div style={styles.freeTierBadge} title="Free Tier Usage">
                  <span style={styles.freeTierCounter}>
                    {freeTierStatus.free_messages_used}/{freeTierStatus.free_tier_limit} free
                  </span>
                </div>
              )}
              <span style={styles.userEmail}>{user?.email}</span>
              <button
                style={styles.profileBtn}
                onClick={() => setShowProfile(true)}
                title="Profile Settings"
              >
                👤
              </button>
              <button style={styles.logoutBtn} onClick={logout}>
                Logout
              </button>
            </div>
          </div>

          <div style={styles.mainContainer}>
            <ConversationHistory
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              currentConversationId={conversationId}
              onSelectConversation={(id) => {
                localStorage.setItem("conversationId", id);
                setConversationId(id);
                setMessages([]);
                setDiagram(null);
                setHasBA(false);
                setIsExported(false);
                setHasGeneratedPRD(false);
                setPrdMarkdown("");
                setHasGeneratedBRD(false);
                setBrdMarkdown("");
                loadMessages(id);
                loadDiagram(id);
                startPolling(id);
              }}
              onNewChat={createNewChat}
            />

            <div style={styles.splitContainer}>
              <div style={{
                ...styles.chat,
                width: isRightPaneCollapsed ? "100%" :
                  isSidebarCollapsed ? "65%" : "60%",
                borderRight: isRightPaneCollapsed ? "none" : "1px solid var(--border)"
              }} ref={chatScrollRef}>
                {messages.length === 0 && (
                  <div style={styles.emptyState}>
                    Describe your requirement to get started.
                  </div>
                )}
                {messages.map((m, i) => {
                  const parsedJson = parseJsonIfPossible(m.content);
                  const showJson = !!parsedJson && m.sender !== "user";
                  return (
                    <div
                      key={i}
                      style={{
                        ...styles.msg,
                        alignSelf:
                          showJson ? "stretch" : (m.sender === "user" ? "flex-end" : "flex-start"),
                        background:
                          showJson ? "transparent" : (m.sender === "user"
                            ? "linear-gradient(135deg, rgba(47, 99, 166, 0.12) 0%, rgba(59, 120, 199, 0.18) 100%)"
                            : "var(--bg-elevated)"),
                        border:
                          showJson ? "none" : (m.sender === "user"
                            ? "1px solid rgba(47, 99, 166, 0.22)"
                            : "1px solid var(--border)"),
                        boxShadow:
                          showJson ? "none" : (m.sender === "user"
                            ? "0 8px 18px rgba(36, 82, 138, 0.18)"
                            : "var(--shadow-xs)"),
                        padding: showJson ? "0" : styles.msg.padding,
                        maxWidth: showJson ? "100%" : styles.msg.maxWidth
                      }}
                    >
                      {showJson ? (
                        <JsonViewer
                          data={parsedJson}
                          title={parsedJson?.title || "Structured Output"}
                        />
                      ) : (
                        <pre style={styles.pre}>{m.content}</pre>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{
                ...styles.diagramPane,
                width: isSidebarCollapsed ? "35%" : "40%",
                display: isRightPaneCollapsed ? "none" : "flex",
                transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)"
              }}>
                <div style={styles.tabHeader}>
                  <button
                    onClick={() => setActiveTab("diagram")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "diagram" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "diagram" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Diagram
                  </button>
                  <button
                    onClick={() => setActiveTab("gherkin")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "gherkin" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "gherkin" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Gherkin (QA)
                  </button>
                  <button
                    onClick={() => setActiveTab("schema")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "schema" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "schema" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Data Schema
                  </button>
                  <button
                    onClick={() => setActiveTab("architecture")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "architecture" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "architecture" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Architecture
                  </button>
                  <button
                    onClick={() => setActiveTab("competitors")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "competitors" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "competitors" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Competitors
                  </button>
                  <button
                    onClick={() => setActiveTab("risk")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "risk" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "risk" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Risk Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab("estimate")}
                    style={{
                      ...styles.tabBtn,
                      borderBottom: activeTab === "estimate" ? "2px solid var(--brand-600)" : "none",
                      color: activeTab === "estimate" ? "var(--brand-600)" : "var(--text-3)"
                    }}
                  >
                    Estimation
                  </button>
                </div>


                <div style={styles.tabContent}>
                  {activeTab === "diagram" && (
                    <>
                      <div style={styles.diagramHeader}>
                        <h3 style={styles.diagramPaneTitle}>Activity Diagram</h3>
                        {diagram && (
                          <div style={styles.diagramControls}>
                            <button onClick={handleZoomOut} style={styles.diagramBtn}>🔍−</button>
                            <span style={styles.zoomLevel}>{diagramZoom}%</span>
                            <button onClick={handleZoomIn} style={styles.diagramBtn}>🔍+</button>
                            <button onClick={handleResetZoom} style={styles.diagramBtn}>↺</button>
                            <button onClick={handleDownloadDiagram} style={styles.diagramBtn}>⬇️</button>
                          </div>
                        )}
                      </div>
                      {diagram ? (
                        <div style={styles.diagramRefWrapper} ref={diagramWrapperRef}>
                          <div ref={diagramRef} />
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Diagram will appear here.</div>
                      )}
                    </>
                  )}

                  {activeTab === "gherkin" && (
                    <div style={styles.textTabContent}>
                      <h3 style={styles.tabHeading}>Acceptance Criteria (Gherkin)</h3>
                      {gherkin ? (
                        <div style={styles.preBlock}>
                          <ReactMarkdown>{gherkin}</ReactMarkdown>
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Gherkin scenarios will appear here.</div>
                      )}
                    </div>
                  )}

                  {activeTab === "schema" && (
                    <div style={styles.textTabContent}>
                      <h3 style={styles.tabHeading}>Data Dictionary</h3>
                      {dataSchema ? (
                        <div className="markdown-table-wrapper" style={styles.schemaWrapper}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {dataSchema}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Data schema will appear here.</div>
                      )}
                    </div>
                  )}

                  {activeTab === "architecture" && (
                    <div style={styles.textTabContent}>
                      <h3 style={styles.tabHeading}>System Architecture</h3>
                      {architecture ? (
                        <div className="markdown-table-wrapper" style={styles.schemaWrapper}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {architecture}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Architecture analysis will appear here.</div>
                      )}
                    </div>
                  )}

                  {activeTab === "competitors" && (
                    <div style={styles.textTabContent}>
                      <h3 style={styles.tabHeading}>Competitor Analysis</h3>
                      {competitors ? (
                        <div className="markdown-table-wrapper" style={styles.schemaWrapper}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {competitors}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Competitor analysis will appear here.</div>
                      )}
                    </div>
                  )}

                  {activeTab === "risk" && (
                    <div style={styles.textTabContent}>
                      <h3 style={styles.tabHeading}>Risk Analysis</h3>
                      {risk ? (
                        <div className="markdown-table-wrapper" style={styles.schemaWrapper}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {risk}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Risk analysis will appear here.</div>
                      )}
                    </div>
                  )}

                  {activeTab === "estimate" && (
                    <div style={styles.textTabContent}>
                      <h3 style={styles.tabHeading}>Project Estimation</h3>
                      {estimate ? (
                        <div className="markdown-table-wrapper" style={styles.schemaWrapper}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {estimate}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div style={styles.emptyTabState}>Estimation analysis will appear here.</div>
                      )}
                    </div>
                  )}


                </div>
              </div>

              <div style={{
                ...styles.paneToggleWrap,
                left: isRightPaneCollapsed ? "100%" : (isSidebarCollapsed ? "65%" : "60%")
              }}>
                <button
                  onClick={() => setIsRightPaneCollapsed(!isRightPaneCollapsed)}
                  style={styles.paneToggleBtn}
                  title={isRightPaneCollapsed ? "Expand Panel" : "Collapse Panel"}
                >
                  {isRightPaneCollapsed ? "‹" : "›"}
                </button>
              </div>
            </div>
          </div>

          <div style={styles.inputBar}>
            <input
              style={styles.input}
              value={input}
              disabled={isAiThinking}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={
                isAiThinking
                  ? "Waiting for response..."
                  : "Ask a question or request a change..."
              }
            />
            <button
              onClick={sendMessage}
              disabled={isAiThinking || !input.trim()}
              style={{
                ...styles.sendBtn,
                opacity:
                  isAiThinking || !input.trim() ? 0.5 : 1
              }}
            >
              Send
            </button>
          </div>

          {/* Modals - Projecting to Root level for proper positioning */}
          {showJiraError && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <div style={{ fontSize: "40px", marginBottom: "15px" }}>⚠️</div>
                <h3 style={{ margin: "0 0 10px 0", color: "var(--text-1)" }}>Jira Configuration Required</h3>
                <p style={{ color: "var(--text-2)", marginBottom: "25px", fontSize: "14px", lineHeight: "1.5" }}>
                  Please update jira credentials in profile for export.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button
                    style={styles.diagramBtn}
                    onClick={() => setShowJiraError(false)}
                  >
                    Cancel
                  </button>
                  <button
                    style={styles.sendBtn}
                    onClick={() => {
                      setShowJiraError(false);
                      setShowProfile(true);
                    }}
                  >
                    Go to Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {showFreeTierPopup && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <div style={{ fontSize: "50px", marginBottom: "15px" }}>🎁</div>
                <h2 style={{ margin: "0 0 10px 0", color: "var(--text-1)" }}>Free Tier Exhausted</h2>
                <p style={{ color: "var(--text-2)", marginBottom: "25px", fontSize: "15px", lineHeight: "1.6" }}>
                  You've used your 3 free AI messages. To continue generating requirements and diagrams, please add your own <strong>OpenRouter API Key</strong> in Profile Settings.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button
                    style={styles.diagramBtn}
                    onClick={() => setShowFreeTierPopup(false)}
                    aria-label="Close dialog"
                  >
                    Maybe Later
                  </button>
                  <button
                    style={{ ...styles.sendBtn, background: "var(--brand-600)" }}
                    onClick={() => {
                      setShowFreeTierPopup(false);
                      setShowProfile(true);
                    }}
                  >
                    Add API Key
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function App() {
  const { user, loading } = useContext(AuthContext);
  // view can be: "login", "signup", "forgot"
  const [view, setView] = useState("login");

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (view === "signup") {
      return <Signup onSwitchToLogin={() => setView("login")} />;
    }
    if (view === "forgot") {
      return <ForgotPassword onBackToLogin={() => setView("login")} />;
    }
    return (
      <Login
        onSwitchToSignup={() => setView("signup")}
        onSwitchToForgot={() => setView("forgot")}
      />
    );
  }

  return <ChatInterface />;
}

/* ===============================
   Styles
================================ */
const styles = {

  previewContainer: {
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-subtle)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)"
  },
  previewToolbar: {
    padding: "10px 12px",
    background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 100%)",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px"
  },
  previewBox: {
    flex: 1,
    padding: "16px",
    overflowY: "auto",
    backgroundColor: "var(--bg-elevated)"
  },
  tabHeading: {
    margin: "0 0 10px 0",
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--text-1)",
    fontFamily: "var(--font-display)"
  },
  schemaWrapper: {
    padding: "6px",
    overflowX: "auto",
    backgroundColor: "var(--bg-elevated)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)"
  },
  // ... rest of your styles
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-sans)",
    backgroundColor: "var(--bg)",
    color: "var(--text-1)"
  },
  tabHeader: {
    display: "flex",
    flexWrap: "wrap",
    borderBottom: "1px solid var(--border)",
    marginBottom: "12px",
    gap: "8px",
    padding: "6px 8px",
    background: "var(--bg-subtle)",
    borderRadius: "var(--radius-sm)"
  },
  tabBtn: {
    padding: "8px 12px",
    background: "transparent",
    border: "1px solid transparent",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-3)",
    transition: "all var(--transition-fast)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "none",
    marginRight: "0",
    flex: "0 0 auto",          // 👈 prevents shrinking weirdly
    whiteSpace: "nowrap"
  },

  tabContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
    minHeight: 0,
    padding: "0",
    gap: "12px",
    paddingBottom: "8px"
  },
  textTabContent: {
    padding: "14px",
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-xs)",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  emptyTabState: {
    color: "var(--text-3)",
    fontSize: "13px",
    textAlign: "center",
    marginTop: "20px"
  },
  preBlock: {
    background: "var(--bg-subtle)",
    padding: "14px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    whiteSpace: "pre-wrap",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backdropFilter: "blur(4px)"
  },
  modalContent: {
    background: "var(--bg-elevated)",
    padding: "30px",
    borderRadius: "var(--radius-md)",
    width: "90%",
    maxWidth: "400px",
    textAlign: "center",
    boxShadow: "var(--shadow-lg)",
    border: "1px solid var(--border)"
  },
  loadingContainer: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-sans)",
    fontSize: "16px",
    background: "linear-gradient(135deg, #f7f9fc 0%, #ffffff 100%)"
  },
  header: {
    padding: "14px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.9)",
    borderBottom: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    zIndex: 10,
    backdropFilter: "blur(10px)"
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    rowGap: "8px"
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  userEmail: {
    fontSize: "13px",
    color: "var(--text-2)",
    fontWeight: "600"
  },
  profileBtn: {
    width: "36px",
    height: "36px",
    padding: "0",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-pill)",
    cursor: "pointer",
    fontSize: "16px",
    color: "var(--text-2)",
    transition: "all var(--transition-fast)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--shadow-xs)"
  },
  exportBtn: {
    padding: "10px 16px",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontWeight: "600",
    fontSize: "12.5px",
    transition: "all var(--transition-fast)",
    boxShadow: "var(--shadow-xs)",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap"
  },
  thinkingText: {
    fontSize: "12px",
    color: "var(--text-3)",
    fontStyle: "italic",
    animation: "pulse 1.5s infinite"
  },
  newChatBtn: {
    padding: "8px 12px",
    background: "transparent",
    color: "var(--brand-600)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all var(--transition-fast)",
    boxShadow: "none"
  },
  logoutBtn: {
    padding: "8px 14px",
    background: "var(--danger-600)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    transition: "all var(--transition-fast)",
    boxShadow: "var(--shadow-xs)"
  },
  mainContainer: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    gap: "0",
    background: "transparent"
  },
  chat: {
    width: "60%",
    minHeight: 0,
    overflowY: "auto",
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, var(--bg-elevated) 40%, var(--bg-subtle) 100%)",
    flexGrow: 0,
    borderRight: "1px solid var(--border)"
  },
  emptyState: {
    textAlign: "center",
    marginTop: "60px",
    color: "var(--text-3)",
    fontSize: "15px"
  },
  versionSelect: {
    padding: "8px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-1)",
    backgroundColor: "var(--bg-elevated)",
    cursor: "pointer",
    outline: "none",
    boxShadow: "var(--shadow-xs)"
  },
  msg: {
    padding: "14px 18px",
    borderRadius: "18px",
    maxWidth: "85%",
    boxShadow: "var(--shadow-sm)",
    lineHeight: "1.55",
    border: "1px solid var(--border)",
    fontSize: "13.5px",
    letterSpacing: "0.01em"
  },
  pre: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    color: "inherit"
  },
  inputBar: {
    display: "flex",
    padding: "14px 20px",
    background: "rgba(255, 255, 255, 0.95)",
    borderTop: "1px solid var(--border)",
    gap: "12px",
    alignItems: "center",
    boxShadow: "0 -10px 26px rgba(15, 23, 42, 0.12)",
    backdropFilter: "blur(10px)"
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "var(--radius-pill)",
    border: "1px solid var(--border)",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
    transition: "all var(--transition-fast)",
    backgroundColor: "var(--bg-elevated)",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.08)"
  },
  sendBtn: {
    padding: "10px 20px",
    background: "linear-gradient(135deg, var(--brand-600) 0%, var(--brand-500) 100%)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    boxShadow: "var(--shadow-xs)",
    flexShrink: 0
  },
  splitContainer: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    position: "relative",
    alignItems: "stretch",
    overflow: "hidden",
    gap: "0"
  },

  diagramHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    gap: "12px",
    overflowX: "hidden"
  },
  diagramPaneTitle: {
    margin: "0",
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--text-1)",
    fontFamily: "var(--font-display)"
  },
  diagramControls: {
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  diagramBtn: {
    padding: "6px 10px",
    background: "var(--bg-elevated)",
    color: "var(--text-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    transition: "all var(--transition-fast)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  zoomLevel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-3)",
    minWidth: "45px",
    textAlign: "center"
  },
  diagramRefWrapper: {
    width: "100%",
    maxHeight: "100%",
    overflowX: "auto",       // allow horizontal scroll when zoomed
    overflowY: "auto",       // vertical scroll if content is tall
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    background: "var(--bg-subtle)",
    padding: "12px",
    flex: 1,
    boxSizing: "border-box",   // important so padding doesn’t cause overflow
    position: "relative",      // allow positioning children if needed
    // OPTIONAL: add padding-bottom to give scrollbar space if needed
    paddingBottom: "20px"      // extra space so horizontal scrollbar doesn’t cover content
  },

  diagramPane: {
    width: "40%",
    padding: "18px",
    background: "var(--bg-elevated)",
    borderLeft: "1px solid var(--border)",
    overflowY: "auto",
    overflowX: "hidden",
    maxHeight: "100%",
    minHeight: 0,
    flexGrow: 0,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box"
  },
  paneToggleWrap: {
    position: "absolute",
    top: "50%",
    transform: "translate(-100%, -50%)",
    zIndex: 120,
    width: "5%",
    minWidth: "32px",
    display: "flex",
    justifyContent: "flex-end",
    pointerEvents: "none",
    transition: "left 300ms cubic-bezier(0.4, 0, 0.2, 1)"
  },
  paneToggleBtn: {
    width: "30px",
    height: "56px",
    borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
    background: "#24528A",
    color: "var(--text-)",
    border: "1px solid var(--border)",
    borderRight: "none",
    boxShadow: "-2px 0 10px rgba(15, 23, 42, 0.12)",
    padding: "0",
    fontSize: "16px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "580px",
    cursor: "pointer",
    pointerEvents: "auto",
    transition: "all var(--transition-fast)"
  },

};

export default App;
