import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Preview Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--danger-600)' }}>
          <h4>❌ Prototype Render Crash</h4>
          <p>The generated code contains a runtime error. Try regenerating the BA.</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', boxShadow: 'none' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
