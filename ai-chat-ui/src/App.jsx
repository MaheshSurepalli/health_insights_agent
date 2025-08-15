// src/App.jsx
import * as React from "react";
import { useMemo, useState, useCallback } from "react";
import {
  Container,
  Stack,
  Button,
  CssBaseline,
  Paper,
  Typography,
} from "@mui/material";
import Header from "./components/Header.jsx";
import UploadPanel from "./components/UploadPanel.jsx";
import Chat from "./components/Chat.jsx";
import { useAuth0 } from "@auth0/auth0-react";
import { createApi } from "./lib/api.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function App() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
    user, // 👈 need this to scope localStorage by user
  } = useAuth0();

  const api = useMemo(() => createApi(getAccessTokenSilently), [getAccessTokenSilently]);
  const qc = useQueryClient();

  // Local UI state
  const [canChat, setCanChat] = useState(false);
  const [uploadLocked, setUploadLocked] = useState(false);
  const [lastBlob, setLastBlob] = useState(null); // { blobUrl, mimeType }

  // Key in localStorage that is unique per user
  const ANALYSIS_KEY = useMemo(
    () => (user?.sub ? `hasAnalysis:${user.sub}` : null),
    [user?.sub]
  );

  // Detect an analysis message by looking for a Markdown "Summary" heading in an assistant reply
  const detectAnalysis = useCallback((msgs) => {
    const arr = Array.isArray(msgs) ? msgs : [];
    return arr.some(
      (m) =>
        String(m?.role || "").toLowerCase() === "assistant" &&
        /(^|\n)#{1,6}\s*summary\b/i.test(String(m?.text || ""))
    );
  }, []);

  // 1) Load messages (backend returns a plain array)
  const messagesQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.listMessages(), // -> Promise<Message[]>
    enabled: isAuthenticated,
    initialData: [],
    onSuccess: (msgs) => {
      const analyzed = detectAnalysis(msgs);

      setCanChat(analyzed);
      setUploadLocked(analyzed);

      // Persist or clear the per-user flag
      if (ANALYSIS_KEY) {
        if (analyzed) {
          localStorage.setItem(ANALYSIS_KEY, "1");
        } else {
          localStorage.removeItem(ANALYSIS_KEY);
        }
      }
    },
  });

  // Also honor the per-user persisted flag immediately after login (before messages arrive)
  React.useEffect(() => {
    if (!isAuthenticated || !ANALYSIS_KEY) return;
    const stored = localStorage.getItem(ANALYSIS_KEY) === "1";
    if (stored) {
      setCanChat(true);
      setUploadLocked(true);
    } else {
      setCanChat(false);
      setUploadLocked(false);
    }
  }, [isAuthenticated, ANALYSIS_KEY]);

  // 2) Send chat with optimistic update
  const chatM = useMutation({
    mutationFn: (text) => api.sendChat(text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: ["messages"] });
      const prev = qc.getQueryData(["messages"]);
      qc.setQueryData(["messages"], [...(prev || []), { role: "user", text }]);
      return { prev };
    },
    onSuccess: (res) => {
      qc.setQueryData(["messages"], (prev) => [
        ...(prev || []),
        { role: "assistant", text: res.agent_reply },
      ]);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["messages"], ctx.prev);
    },
  });

  // 3) Analyze (push full Markdown; lock upload + enable chat; persist per-user)
  const analyzeM = useMutation({
    mutationFn: () =>
      api.analyze({ blobUrl: lastBlob.blobUrl, mimeType: lastBlob.mimeType }),
    onSuccess: (res) => {
      const markdown = typeof res?.analysis === "string" ? res.analysis : "";
      qc.setQueryData(["messages"], (prev = []) => [
        ...(Array.isArray(prev) ? prev : []),
        { role: "assistant", text: markdown },
      ]);

      setCanChat(true);
      setUploadLocked(true);
      if (ANALYSIS_KEY) localStorage.setItem(ANALYSIS_KEY, "1");
    },
    onError: (e) => {
      qc.setQueryData(["messages"], (prev = []) => [
        ...(Array.isArray(prev) ? prev : []),
        { role: "assistant", text: `Sorry—analysis failed.\n\n${e?.message || ""}` },
      ]);
    },
  });

  // 4) Upload helpers
  const startUpload = async ({ filename, content_type }) =>
    api.startUpload({ filename, content_type });

  const onUploaded = ({ file, blobUrl }) => {
    setLastBlob({ blobUrl, mimeType: file.type });
    // Keep chat locked until analysis completes
    setCanChat(false);
  };

  if (authLoading) return <div style={{ padding: 32 }}>Loading…</div>;

  return (
    <React.Fragment>
      <CssBaseline />
      <Container
        maxWidth="md"
        sx={{ py: 2, minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {!isAuthenticated ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Welcome to Health Insights
            </Typography>
            <Button variant="contained" onClick={() => loginWithRedirect()}>
              Log In
            </Button>
          </Paper>
        ) : (
          <Stack sx={{ gap: 2, flex: 1 }}>
            <Header />
            {!uploadLocked && (
              <UploadPanel
                startUpload={startUpload}
                onUploaded={onUploaded}
                onAnalyze={() => analyzeM.mutate()}
              />
            )}
            <Chat
              messages={messagesQ.data || []}
              loading={
                messagesQ.isPending ||
                messagesQ.isLoading ||
                chatM.isPending ||
                analyzeM.isPending
              }
              disabled={!canChat}
              onSend={(text) => chatM.mutate(text)}
            />
          </Stack>
        )}
      </Container>
    </React.Fragment>
  );
}
