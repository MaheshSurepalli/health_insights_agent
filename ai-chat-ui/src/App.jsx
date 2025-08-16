// src/App.jsx
import React, { useMemo, useState } from "react";
import { Layout, Button, Card, Spin, Flex } from "antd";
import HeaderBar from "./components/Header.jsx";
import UploadPanel from "./components/UploadPanel.jsx";
import Chat from "./components/Chat.jsx";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "./lib/api.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const { Content } = Layout;

export default function App() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();

  const api = useMemo(() => createApi(getAccessTokenSilently), [getAccessTokenSilently]);
  const qc = useQueryClient();

  // Blob chosen & uploaded (ready for analysis)
  const [lastBlob, setLastBlob] = useState(null); // { blobUrl, mimeType }

  // Fetch messages. This is the single source of truth for UI state.
  const messagesQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.listMessages(), // -> Message[]
    enabled: isAuthenticated,
    initialData: [],
  });

  const messages = messagesQ.data || [];
  const messageCount = Array.isArray(messages) ? messages.length : 0;

  // UI derivation (DRY):
  // - First login (no history): messageCount === 0 → show Upload; Chat disabled
  // - After analysis: messageCount > 0 → hide Upload; Chat enabled
  const showUpload = isAuthenticated && messageCount === 0;
  const chatDisabled = messageCount === 0;

  // Chat mutation (optimistic)
  const chatM = useMutation({
    mutationFn: (text) => api.sendChat(text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: ["messages"] });
      const prev = qc.getQueryData(["messages"]) || [];
      qc.setQueryData(["messages"], [...prev, { role: "user", text }]);
      return { prev };
    },
    onSuccess: (res) => {
      qc.setQueryData(["messages"], (prev = []) => [...prev, { role: "assistant", text: res.agent_reply }]);
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["messages"], ctx.prev);
    },
  });

  // Analyze mutation
  const analyzeM = useMutation({
    mutationFn: () => api.analyze({ blobUrl: lastBlob.blobUrl, mimeType: lastBlob.mimeType }),
    onSuccess: (res) => {
      const markdown = typeof res?.analysis === "string" ? res.analysis : "";
      qc.setQueryData(["messages"], (prev = []) => [...prev, { role: "assistant", text: markdown }]);
    },
    onError: (e) => {
      qc.setQueryData(["messages"], (prev = []) => [
        ...prev,
        { role: "assistant", text: `Sorry—analysis failed.\n\n${e?.message || ""}` },
      ]);
    },
  });

  // Upload helpers
  const startUpload = async ({ filename, content_type }) => api.startUpload({ filename, content_type });
  const onUploaded = ({ file, blobUrl }) => setLastBlob({ blobUrl, mimeType: file.type });

  if (authLoading) {
    return (
      <Flex style={{ height: "100vh" }} align="center" justify="center">
        <Spin size="large" />
      </Flex>
    );
    }

  if (!isAuthenticated) {
    return (
      <Flex style={{ height: "100vh" }} align="center" justify="center">
        <Card>
          <Flex vertical gap={12} align="center">
            <h3>Welcome to Health Insights</h3>
            <Button type="primary" onClick={() => loginWithRedirect()}>
              Log In
            </Button>
          </Flex>
        </Card>
      </Flex>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <HeaderBar />
      <Content style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 960, margin: "0 auto", width: "100%" }}>
        {/* First login → show Upload; Chat disabled */}
        {showUpload && (
          <UploadPanel
            startUpload={startUpload}
            onUploaded={onUploaded}
            onAnalyze={() => analyzeM.mutate()}
          />
        )}

        {/* Chat always present (disabled until analysis exists) */}
        <Chat
          messages={messages}
          loading={messagesQ.isLoading || chatM.isPending || analyzeM.isPending}
          disabled={chatDisabled}
          onSend={(text) => chatM.mutate(text)}
        />
      </Content>
    </Layout>
  );
}
