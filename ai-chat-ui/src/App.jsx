// App.jsx
import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import Header from "./components/Header";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import UploadReport from "./components/UploadReport";

export default function App() {
  const { loginWithRedirect, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [canChat, setCanChat] = useState(false);     // unlock after analysis
  const [uploadLocked, setUploadLocked] = useState(false);


  function looksLikeJsonAnalysis(t = "") {
    const s = (t || "").trim();
    if (!s.startsWith("{")) return false;
    try {
      const obj = JSON.parse(s);
      return obj && typeof obj.summary === "string";
    } catch {
      return false;
    }
  }

  function renderAnalysis(analysis) {
    const summary = analysis?.summary || "No summary available.";
    const disclaimer = analysis?.disclaimer ? `\n\n_${analysis.disclaimer}_` : "";
    const metrics = Array.isArray(analysis?.metrics) ? analysis.metrics : [];
    let details = "";
    if (metrics.length) {
      const header = `| Metric | Value | Unit | Range | Status |
|---|---:|---|---|---|
`;
      const rows = metrics
        .map(m => {
          const val = (m?.value ?? "").toString();
          const unit = m?.unit ?? "";
          const range = m?.reference_range ?? "";
          const status = m?.status ?? "";
          return `| ${m?.name || ""} | ${val} | ${unit} | ${range} | ${status} |`;
        })
        .join("\n");
      details = `\n\n<details>\n<summary>See extracted values</summary>\n\n${header}${rows}\n\n</details>`;
    }
    return `### Report analysis\n\n${summary}${details}${disclaimer}`;
  }

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = await getAccessTokenSilently();
        const res = await axios.get("http://localhost:8000/messages", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const formatted = (res.data.messages || []).map((m) => ({
          role: m.role.toLowerCase(),
          text: m.text,
        }));
        
        const visible = (formatted || []).filter(
          (m) => !(m.role === "user" && /^MODE:\s*ANALYZE_JSON\b/.test(m.text || ""))
        );


        const enhanced = visible.map((m) => {
          if (m.role === "assistant" && looksLikeJsonAnalysis(m.text)) {
            try {
              const analysis = JSON.parse(m.text);
              return { ...m, text: renderAnalysis(analysis) };
            } catch {
              return m; // leave as-is if parsing fails
            }
          }
          return m;
        });
        setMessages(enhanced);

        const hasAnalysis = visible.some(
          (m) => m.role === "assistant" && looksLikeJsonAnalysis(m.text)
        );
        if (hasAnalysis) {
          setCanChat(true);
          setUploadLocked(true);
        }
      } catch (err) {
        console.error("Error fetching messages", err);
      }
    };
    if (isAuthenticated) fetchMessages();
  }, [isAuthenticated, getAccessTokenSilently]);

  const handleUploaded = ({ file, blobUrl }) => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `✅ **${file.name}** uploaded.\n\nBlob: ${blobUrl}` },
    ]);
    setCanChat(false); // keep chat off until analysis is done
  };

  const onAnalyze = async ({ file, blobUrl }) => {
    setUploadLocked(true);
    setLoading(true);
    // Add temporary "Analyzing..." bubble
    const placeholderIdx = messages.length;
    setMessages(prev => [...prev, { role: "assistant", text: "🔎 Analyzing your report…" }]);

    try {
      const token = await getAccessTokenSilently();
      const res = await axios.post(
        "http://localhost:8000/reports/analyze",
        { blobUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const analysis = res.data.analysis || {};
      const summary = analysis.summary || "No summary available.";
      const disclaimer = analysis.disclaimer ? `\n\n_${analysis.disclaimer}_` : "";

      // Build a compact metrics table if present
      let details = "";
      const metrics = Array.isArray(analysis.metrics) ? analysis.metrics : [];
      if (metrics.length) {
        const header = `| Metric | Value | Unit | Range | Status |
|---|---:|---|---|---|
`;
        const rows = metrics.map(m => {
          const val = (m.value ?? "").toString();
          const unit = m.unit ?? "";
          const range = m.reference_range ?? "";
          const status = m.status ?? "";
          return `| ${m.name || ""} | ${val} | ${unit} | ${range} | ${status} |`;
        }).join("\n");
        details = `\n\n<details>\n<summary>See extracted values</summary>\n\n${header}${rows}\n\n</details>`;
      }

      const assistantText = `### Report analysis\n\n${summary}${details}${disclaimer}`;

      // Replace placeholder message with final analysis
      setMessages(prev => {
        const copy = [...prev];
        copy[placeholderIdx] = { role: "assistant", text: assistantText };
        return copy;
      });

      // Unlock chat for follow-ups
      setCanChat(true);
    } catch (err) {
      console.error("Analyze error", err);
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: "❌ Analysis failed. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const res = await axios.post(
        "http://localhost:8000/chat",
        { message: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => [...prev, { role: "user", text: input }, { role: "assistant", text: res.data.agent_reply }]);
      setInput("");
    } catch (err) {
      console.error("Error sending message", err);
    }
    setLoading(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center p-4">
      {!isAuthenticated ? (
        <button
          onClick={() => loginWithRedirect()}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-full shadow-md hover:scale-105 transition-transform"
        >
          Log In
        </button>
      ) : (
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg flex flex-col h-[90vh]">
          <Header />
          {!uploadLocked && (
            <UploadReport onUploaded={handleUploaded} onAnalyze={onAnalyze} />
          )}
          <MessageList messages={messages} loading={loading} />
          <MessageInput input={input} setInput={setInput} sendMessage={sendMessage} disabled={!canChat} />
        </div>
      )}
    </div>
  );
}
