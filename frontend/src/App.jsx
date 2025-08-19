// src/App.jsx
import React, { useMemo, useState } from "react";
import { Layout, Button, Card, Spin, Flex, Grid } from "antd";
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

  const screens = Grid.useBreakpoint();
  const api = useMemo(() => createApi(getAccessTokenSilently), [getAccessTokenSilently]);
  const qc = useQueryClient();

  // Saved after file upload, used for /analyze
  const [lastBlob, setLastBlob] = useState(null); // { blobUrl, mimeType }

  // Messages are the single source of truth for UI state.
  // IMPORTANT: no initialData here — we want a real "pending" state on first load.
  const messagesQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.listMessages(),
    enabled: isAuthenticated,
    // Good defaults; tweak as you like:
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // React Query initial loader: true until the first successful response.
  const isInitialLoading = messagesQ.isInitialLoading || (messagesQ.isLoading && !messagesQ.data);
  const messages = messagesQ.data ?? [];
  const hasMessages = Array.isArray(messages) && messages.length > 0;

  // Send chat (optimistic append)
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
    },
  });

  // Analyze (append assistant markdown; Upload hides automatically as hasMessages flips true)
  const analyzeM = useMutation({
    mutationFn: () => api.analyze({ blobUrl: lastBlob?.blobUrl, mimeType: lastBlob?.mimeType }),
    onSuccess: (res) => {
      const markdown = typeof res?.analysis === "string" ? res.analysis : "";
      qc.setQueryData(["messages"], (prev = []) => [
        ...prev,
        { role: "assistant", text: markdown },
      ]);
    },
    onError: (e) => {
      qc.setQueryData(["messages"], (prev = []) => [
        ...prev,
        { role: "assistant", text: `Sorry—analysis failed.\n\n${e?.message || ""}` },
      ]);
    },
  });

  // Upload helpers
  const startUpload = async ({ filename, content_type }) =>
    api.startUpload({ filename, content_type });

  const onUploaded = ({ file, blobUrl }) => {
    setLastBlob({ blobUrl, mimeType: file.type });
  };

  // ---------- RENDER ----------

  const pagePadding = screens.xs ? 8 : screens.md ? 16 : 24;
  const maxW = screens.xl ? 1200 : 960;

  // Auth loading gate
  if (authLoading) {
    return (
      <Flex style={{ height: "100vh" }} align="center" justify="center">
        <Spin size="large" />
      </Flex>
    );
  }

  // Logged-out screen
  if (!isAuthenticated) {
    return (
      <Flex style={{ height: "100vh" }} align="center" justify="center">
        <Card>
          <Flex vertical gap={12} align="center">
            <h3 style={{ margin: 0 }}>Welcome to Health Insights</h3>
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
      <Content style={{ padding: pagePadding, display: "flex", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
            maxWidth: maxW,
            margin: "0 auto",
            minHeight: 0,
            flex: 1,
          }}
        >
          {/* INITIAL LOADER: hide Upload/Chat until messages query completes */}
          {isInitialLoading ? (
            <Flex style={{ flex: 1 }} align="center" justify="center">
              <Spin size="large" />
            </Flex>
          ) : (
            <>
              {/* First-time (no history): Upload only */}
              {!hasMessages && (
                <ReportIntake
                  startUpload={startUpload}
                  onUploaded={onUploaded}
                  onAnalyze={() => analyzeM.mutate()}
                  analyzing={analyzeM.isPending}
                />
              )}

              {/* After analysis (has messages): Chat only */}
              {hasMessages && (
                <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
                  <ChatPane
                    messages={messages}
                    sending={chatM.isPending}
                    loading={messagesQ.isFetching || analyzeM.isPending}
                    onSend={(text) => chatM.mutate(text)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Content>
    </Layout>
  );
}
