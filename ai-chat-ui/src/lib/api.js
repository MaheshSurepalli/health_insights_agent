// Small, typed-ish API client wrapping fetch with Auth0 token.
export function createApi(getAccessTokenSilently) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  async function authedFetch(path, init = {}) {
    const token = await getAccessTokenSilently();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
  }

  return {
    // chat
    async listMessages() {
      const r = await authedFetch("/messages", { method: "GET" });
      return r.json(); // { messages:[{role,text}] }
    },
    async sendChat(message) {
      const r = await authedFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return r.json(); // { thread_id, agent_reply }
    },

    // reports
    async startUpload({ filename, content_type }) {
      const r = await authedFetch("/reports/upload-url", {
        method: "POST",
        body: JSON.stringify({ filename, content_type }),
      });
      return r.json(); // { sasUrl, blobUrl }
    },
    async analyze({ blobUrl, mimeType }) {
      const r = await authedFetch("/reports/analyze", {
        method: "POST",
        body: JSON.stringify({ blobUrl, mimeType }),
      });
      return r.json(); // AnalyzeResponse
    },
  };
}

// Azure Blob PUT with progress (XHR = best for progress events)
export function putToSasUrl(sasUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sasUrl, true);
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Upload error ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(file);
  });
}
