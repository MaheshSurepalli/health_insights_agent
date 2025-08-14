import { useCallback, useState } from "react";

export function useMessages(api) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/messages");
    const raw = Array.isArray(res.data) ? [] : (res.data.messages || []);
    const formatted = raw.map((m) => ({ role: (m.role || "").toLowerCase(), text: m.text || "" }));
    setMessages(formatted);
  }, [api]);

  const send = useCallback(async (text) => {
    if (!text?.trim()) return;
    setLoading(true);
    try {
      await api.post("/chat", { message: text });
      await load();
    } finally {
      setLoading(false);
    }
  }, [api, load]);

  return { messages, setMessages, loading, load, send };
}
