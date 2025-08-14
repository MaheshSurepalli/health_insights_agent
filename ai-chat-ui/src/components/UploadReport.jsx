import React, { useRef, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { startUpload, putToSasUrl } from "../lib/upload"; // as you already used earlier

export default function UploadReport({ onUploaded, onAnalyze }) {
  const { getAccessTokenSilently } = useAuth0();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | requesting | uploading | success | error
  const [error, setError] = useState("");
  const [last, setLast] = useState(null);       // { file, blobUrl }
  const inputRef = useRef(null);

  const accept = "application/pdf,image/png,image/jpeg,image/tiff";

  const pickFile = () => inputRef.current?.click();

  const handleFiles = useCallback(async (files) => {
    const f = files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setProgress(0);

    if (!accept.split(",").includes(f.type)) {
      setError("Unsupported file type. Please upload PDF/PNG/JPEG/TIFF.");
      return;
    }

    try {
      setStatus("requesting");
      const { sasUrl, blobUrl } = await startUpload(f, getAccessTokenSilently);

      setStatus("uploading");
      await putToSasUrl(sasUrl, f, (p) => setProgress(p));

      setStatus("success");
      setLast({ file: f, blobUrl });
      onUploaded?.({ file: f, blobUrl });

      setTimeout(() => {
        setFile(null);
        setProgress(0);
        setStatus("idle");
      }, 1200);
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Upload failed. Please try again.");
    }
  }, [getAccessTokenSilently]);

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    await handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="px-4 pt-4">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-medium text-gray-700">Upload a report</div>
          <div className="text-xs text-gray-500">PDF / PNG / JPEG / TIFF</div>
        </div>

        <div
          className={[
            "mx-4 my-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition",
            dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300",
          ].join(" ")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" ? pickFile() : null)}
          aria-label="Drag and drop your report here or choose a file"
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <div className="text-sm text-gray-600 mb-3">Drag & drop your report here</div>
          <button
            onClick={pickFile}
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={status === "requesting" || status === "uploading"}
          >
            {status === "requesting" ? "Preparing..." :
             status === "uploading" ? "Uploading..." : "Choose file"}
          </button>

          {status === "uploading" && (
            <div className="mt-4 w-full">
              <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
                <div className="h-2 rounded bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1 text-xs text-gray-500 text-center">{progress}%</div>
            </div>
          )}

          {status === "success" && (
            <div className="mt-4 text-sm text-green-700">
              File uploaded successfully. Ready for analysis.
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 text-sm text-red-600">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={() => inputRef.current?.click()}
            disabled={status === "requesting" || status === "uploading"}
          >
            Pick another
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => last?.blobUrl && onAnalyze?.(last)}
            disabled={!onAnalyze || !last?.blobUrl}
            title={!onAnalyze ? "Analysis not connected" : "Analyze the uploaded report"}
          >
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
}
