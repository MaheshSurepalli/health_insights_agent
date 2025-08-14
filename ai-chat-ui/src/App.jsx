import React, { useState, useEffect, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Header from "./components/Header";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import UploadReport from "./components/UploadReport";
import { createApiClient } from "./lib/api";
import { useMessages } from "./hooks/useMessages";
import { useAnalysis } from "./hooks/useAnalysis";

export default function App() {
  const { loginWithRedirect, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [canChat, setCanChat] = useState(false);
 const [input, setInput] = useState("");
 const [uploadLocked, setUploadLocked] = useState(false);

 const api = useMemo(() => createApiClient(getAccessTokenSilently), [getAccessTokenSilently]);
 const { messages, setMessages, loading, load, send } = useMessages(api);
 const { analyze } = useAnalysis(api, setMessages, setCanChat);

  useEffect(() => {
    if (isAuthenticated) {
      load().then(() => {
        // if there is any history, allow chat; upload stays gated by your flow
        if (messages.length > 0) setCanChat(true);
      });
    }
  }, [isAuthenticated, load]);

  const handleUploaded = ({ file, blobUrl }) => {
    setMessages((prev) => [...prev, { role: "assistant", text: `✅ **${file.name}** uploaded.\n\nBlob: ${blobUrl}` }]);
    setCanChat(false);
  };

  const onAnalyze = async ({ blobUrl }) => {
    setUploadLocked(true);
    await analyze({ blobUrl });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    await send(input.trim());
    setInput("");
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center p-4">
      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-full shadow-md hover:scale-105 transition-transform">
          Log In
        </button>
      ) : (
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg flex flex-col h-[90vh]">
          <Header />
          {!uploadLocked && <UploadReport onUploaded={handleUploaded} onAnalyze={onAnalyze} />}
          <MessageList messages={messages} loading={loading} />
          <MessageInput input={input} setInput={setInput} sendMessage={sendMessage} disabled={!canChat} />
        </div>
      )}
    </div>
  );
}
