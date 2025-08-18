// src/App.jsx
import React, { useMemo, useState } from "react";
import { Layout, Button, Card, Spin, Flex, App as AntApp } from "antd";
import HeaderBar from "./components/Header.jsx";
import ReportIntake from "./components/ReportIntake.jsx";
import ChatPane from "./components/ChatPane.jsx";
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
  const { message } = AntApp.useApp ? AntApp.useApp() : { message: { success() {}, error() {} }};

  const api = useMemo(() => createApi(getAccessTokenSilently), [getAccessTokenSilently]);
  const qc = useQueryClient();

  // Remember the blob we just uploaded (for /analyze)
  const [lastBlob, setLastBlob] = useState(null); // { blobUrl, mimeType }

  // Single source of truth for UI state
  const messagesQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.listMessages(),
    enabled: isAuthenticated,
    initialData: [],
  });

  const messages = messagesQ.data || [];
  const hasMessages = Array.isArray(messages) && messages.length > 0;

  // Chat
  const chatM = useMutation({
    mutationFn: (text) => api.sendChat(text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: ["messages"] });
      const prev = qc.getQueryData(["messages"]) || [];
      qc.setQueryData(["messages"], [...prev, { role: "user", text }]);
      return { prev };
    },
    onSuccess: (res) => {
      qc.setQueryData(["messages"], (prev = []) => [
        ...prev,
        { role: "assistant", text: res.agent_reply },
      ]);
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["messages"], ctx.prev);
      message.error("Failed to send message.");
    },
  });

  // Analyze → append assistant markdown; Upload card will hide automatically (hasMessages becomes true)
  const analyzeM = useMutation({
    mutationFn: () => api.analyze({ blobUrl: lastBlob.blobUrl, mimeType: lastBlob.mimeType }),
    onSuccess: (res) => {
      const markdown = typeof res?.analysis === "string" ? res.analysis : "";
      qc.setQueryData(["messages"], (prev = []) => [
        ...prev,
        { role: "assistant", text: markdown },
      ]);
      message.success("Analysis complete.");
    },
    onError: (e) => {
      qc.setQueryData(["messages"], (prev = []) => [
        ...prev,
        { role: "assistant", text: `Sorry—analysis failed.\n\n${e?.message || ""}` },
      ]);
      message.error("Analysis failed.");
    },
  });

  const startUpload = async ({ filename, content_type }) =>
    api.startUpload({ filename, content_type });

  const onUploaded = ({ file, blobUrl }) => {
    setLastBlob({ blobUrl, mimeType: file.type });
  };


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
    <Layout style={{ height: "100vh" }}>
      <HeaderBar />
      <Content style={{ padding: 16, display: "flex", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
            maxWidth: 960,
            margin: "0 auto",
            minHeight: 0,
            flex: 1,
          }}
        >
          {/* FIRST LOGIN (no messages): Upload & Analyze only */}
          {!hasMessages && (
            <ReportIntake
              startUpload={startUpload}
              onUploaded={onUploaded}
              onAnalyze={() => analyzeM.mutate()}
              analyzing={analyzeM.isPending}
            />
          )}

          {/* AFTER ANALYZE (has messages): Chat only */}
          {hasMessages && (
            <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
              <ChatPane
                messages={messages}
                sending={chatM.isPending}
                loading={messagesQ.isLoading || analyzeM.isPending}
                onSend={(text) => chatM.mutate(text)}
              />
            </div>
          )}
        </div>
      </Content>
    </Layout>
  );
}
