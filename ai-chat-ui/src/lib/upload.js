// src/lib/upload.js
export async function startUpload(file, getAccessTokenSilently, baseUrl = import.meta.env.VITE_API_BASE_URL) {
  const token = await getAccessTokenSilently();
  const res = await fetch(`${baseUrl}/reports/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to start upload: ${msg}`);
  }

  // Expected: { sasUrl, blobUrl }
  const json = await res.json();
  if (!json?.sasUrl || !json?.blobUrl) {
    throw new Error("Upload endpoint did not return SAS URL.");
  }
  return json;
}

// Use XHR to get reliable upload progress events
export function putToSasUrl(sasUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sasUrl, true);
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload error ${xhr.status}: ${xhr.responseText || "Unknown error"}`));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading to Azure Blob."));
    xhr.send(file);
  });
}
