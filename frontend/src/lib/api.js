// src/lib/api.js
export function createApi(getAccessTokenSilently) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  if (!API_BASE) throw new Error("VITE_API_BASE not set");

  const join = (b, p) => `${b.replace(/\/+$/, "")}${p.startsWith("/") ? p : "/" + p}`;

  async function authedFetch(path, init = {}) {
    const token = await getAccessTokenSilently();
    const res = await fetch(join(API_BASE, path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${text ? ` – ${text}` : ""}`);
    }
    return res;
  }

  return {
    async listMessages() {
      const r = await authedFetch("/messages", { method: "GET" });
      const data = await r.json();
      return Array.isArray(data) ? data : (data?.messages ?? []);
    },
    async sendChat(message) {
      const r = await authedFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return r.json(); // { agent_reply }
    },
    async startUpload({ filename, content_type }) {
      const r = await authedFetch("/reports/upload-url", {
        method: "POST",
        body: JSON.stringify({ filename, content_type: content_type || "application/octet-stream" }),
      });
      return r.json(); // { sasUrl, blobUrl }
    },
    async analyze({ blobUrl, mimeType }) {
      const r = await authedFetch("/reports/analyze", {
        method: "POST",
        body: JSON.stringify({ blobUrl, mimeType }),
      });
      return r.json(); // { analysis }
    },
  };
}
