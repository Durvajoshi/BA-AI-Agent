import { useState } from 'react';
import '../styles/JsonViewer.css';

export function JsonViewer({ data, title = 'JSON Output' }) {
  const [expanded, setExpanded] = useState({});
  const [copyState, setCopyState] = useState("idle");

  const rootLabel = (() => {
    const upper = String(title || "").toUpperCase();
    if (upper.includes("BRD")) return "Open For BRD";
    if (upper.includes("PRD")) return "Open For PRD";
    return "Open Details";
  })();

  const formatLabel = (value) => {
    const label = String(value || "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) return "";
    return label
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const toggleExpanded = (path) => {
    setExpanded(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const renderValue = (value, path = '') => {
    if (value === null) {
      return <span className="json-null">null</span>;
    }

    if (value === undefined) {
      return <span className="json-undefined">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="json-boolean">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="json-number">{value}</span>;
    }

    if (typeof value === 'string') {
      return <span className="json-string">{value}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="json-bracket">[]</span>;
      }

      const isExpanded = expanded[path];
      const isSimpleArray = value.every(v => typeof v !== 'object' || v === null);

      if (isSimpleArray && value.length <= 3) {
        return (
          <span className="json-array-inline">
            [
            {value.map((item, i) => (
              <span key={i}>
                {renderValue(item, `${path}[${i}]`)}
                {i < value.length - 1 ? ', ' : ''}
              </span>
            ))}
            ]
          </span>
        );
      }

      return (
        <div className="json-array">
          <span
            className="json-toggle"
            onClick={() => toggleExpanded(path)}
          >
            {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Show'} Items ({value.length})
          </span>
          {isExpanded && (
            <div className="json-array-content">
              {value.map((item, i) => (
                <div key={i} className="json-array-item">
                  <span className="json-index">#{i + 1}</span>
                  <div className="json-value">
                    {renderValue(item, `${path}[${i}]`)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className="json-bracket">{'{}'}</span>;
      }

      const isExpanded = expanded[path];

      const isRoot = path === "";
      const toggleLabel = isRoot
        ? (isExpanded ? "Hide Details" : rootLabel)
        : (isExpanded ? "Hide Details" : "Details");

      return (
        <div className="json-object">
          <span
            className={`json-toggle ${isRoot ? "json-toggle-root" : ""}`}
            onClick={() => toggleExpanded(path)}
          >
            {isExpanded ? '▼' : '▶'} {toggleLabel}
          </span>
          {isExpanded && (
            <div className="json-object-content">
              {keys.map((key, i) => {
                const label = formatLabel(key);
                const words = label.split(" ").filter(Boolean);
                return (
                  <div key={i} className="json-object-property">
                    <span className="json-key">
                      {words.map((word, idx) => (
                        <span key={`${key}-${idx}`} className="json-key-word">{word}</span>
                      ))}
                    </span>
                    <span className="json-colon">:</span>
                    <div className="json-value">
                      {renderValue(value[key], `${path}.${key}`)}
                    </div>
                    {i < keys.length - 1 && <span className="json-comma">,</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="json-viewer">
      <div className="json-viewer-header">
        <h3>{title}</h3>
        <button
          className="json-copy-btn"
          onClick={async () => {
            console.log("clicked");
            const payload = JSON.stringify(data, null, 2);
            let copiedOk = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              try {
                await navigator.clipboard.writeText(payload);
                copiedOk = true;
              } catch {
                copiedOk = false;
              }
            }

            if (!copiedOk) {
              try {
                const textarea = document.createElement('textarea');
                textarea.value = payload;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.top = '-1000px';
                textarea.style.left = '-1000px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                copiedOk = document.execCommand('copy');
                document.body.removeChild(textarea);
              } catch (fallbackErr) {
                console.error('Copy failed', fallbackErr);
              }
            }

            if (copiedOk) {
              setCopyState("copied");
            } else {
              setCopyState("fallback");
              window.prompt("Copy JSON:", payload);
            }

            setTimeout(() => setCopyState("idle"), 1800);
          }}
          title="Copy JSON to clipboard"
        >
          {copyState === "copied" ? "Copied" : copyState === "fallback" ? "Press Ctrl+C" : "Copy"}
        </button>
      </div>
      <div className="json-content">
        {renderValue(data)}
      </div>
    </div>
  );
}
