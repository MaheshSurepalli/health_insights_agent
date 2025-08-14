import { useCallback } from "react";
import { analysisToMarkdown } from "../lib/analysisRender";

export function useAnalysis(api, setMessages, setCanChat) {
  const analyze = useCallback(async ({ blobUrl }) => {
    const placeholder = { role: "assistant", text: "🔎 Analyzing your report…" };
    let idx = -1;
    setMessages((prev) => { idx = prev.length; return [...prev, placeholder]; });

    const res = await api.post("/reports/analyze", { blobUrl });
    const analysis = res.data?.analysis || {};
    const md = analysisToMarkdown(analysis);

    setMessages((prev) => {
      const copy = [...prev];
      copy[idx] = { role: "assistant", text: md };
      return copy;
    });
    setCanChat(true);
    return analysis;
  }, [api, setMessages, setCanChat]);

  return { analyze };
}
