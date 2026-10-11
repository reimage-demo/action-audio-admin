import { publicPage, logoUrl } from "./site";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App, { Portal } from "./App";
import "./styles.css";
const url = import.meta.env.VITE_CONVEX_URL;
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Unable to load the portal.</h1>
          <p>Check your connection and staff access, then reload.</p>
          <button onClick={() => location.reload()}>Reload portal</button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Setup() {
  const [preview, setPreview] = useState(false);
  return preview ? (
    <Portal demo />
  ) : (
    <div className="auth-shell">
      <div className="auth-card">
        <img src={logoUrl} alt="Action Audio" />

        <h1>Staff workspace</h1>
        <p>
          Connect this portal to Action Audio’s Convex deployment to manage
          appointments, vehicle updates, and electronics.
        </p>
        <div className="setup-note">
          Set <code>VITE_CONVEX_URL</code> in <code>admin/.env.local</code>.
          Setup instructions are in the project README.
        </div>
        <button onClick={() => setPreview(true)}>Preview the portal</button>
        <small>
          Preview uses fictional examples. Changes stay in memory and are
          discarded on refresh.
        </small>
        <a href={publicPage()}>Back to the website</a>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {url ? (
        <ConvexAuthProvider client={new ConvexReactClient(url)}>
          <App />
        </ConvexAuthProvider>
      ) : (
        <Setup />
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
