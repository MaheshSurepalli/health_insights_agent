import React, { useState } from "react";
import { Upload, Button, Modal, message } from "antd";
import { UploadOutlined, PlayCircleOutlined } from "@ant-design/icons";

function makeCustomRequest(startUpload, onUploaded, setBlobUrl, msgApi) {
  return async ({ file, onProgress, onError, onSuccess }) => {
    try {
      // 1) Ask backend for SAS URL (snake_case as backend expects)
      const { sasUrl, blobUrl } = await startUpload({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
      });

      // 2) Upload to Blob with progress via XHR
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sasUrl, true);
      xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ percent: Math.round((e.loaded / e.total) * 100) });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setBlobUrl(blobUrl);
          onUploaded?.({ file, blobUrl }); // ← no chat message here
          onSuccess?.({}, file);
          msgApi?.success?.("Upload complete.");
        } else {
          const err = new Error(xhr.responseText || `Upload error ${xhr.status}`);
          onError?.(err);
          msgApi?.error?.(err.message);
        }
      };

      xhr.onerror = () => {
        const err = new Error("Network error during upload");
        onError?.(err);
        msgApi?.error?.(err.message);
      };

      xhr.send(file);
    } catch (err) {
      onError?.(err);
      msgApi?.error?.(err?.message || "Upload failed.");
    }
  };
}

export default function UploadPanel({ startUpload, onUploaded, onAnalyze }) {
  const [fileList, setFileList] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // Proper AntD message hook
  const [msgApi, contextHolder] = message.useMessage();

  const handlePreview = async (file) => {
    let src = file.url || file.preview;
    if (!src && file.originFileObj) {
      src = URL.createObjectURL(file.originFileObj);
      file.preview = src;
    }
    setPreviewSrc(src || "");
    setPreviewTitle(file.name || "Preview");
    setPreviewOpen(true);
  };

  const handleChange = ({ fileList: next }) => {
    setFileList(next.slice(-1)); // keep only one
  };

  const beforeUpload = (file) => {
    const ok =
      file.type === "application/pdf" ||
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/tiff";
    if (!ok) {
      msgApi.error("Please select a PDF, PNG, JPEG, or TIFF file.");
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await onAnalyze?.();
      msgApi.success("Analysis complete.");
    } catch (e) {
      msgApi.error(e?.message || "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const uploadProps = {
    multiple: false,
    maxCount: 1,
    fileList,
    beforeUpload,
    listType: "text", // simple row; no inline preview grid
    showUploadList: { showPreviewIcon: true, showRemoveIcon: true, showDownloadIcon: false },
    onChange: handleChange,
    onPreview: handlePreview,
    customRequest: makeCustomRequest(startUpload, onUploaded, setBlobUrl, msgApi),
  };

  return (
    <>
      {contextHolder}
      <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />}>Choose report</Button>
        </Upload>

        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={!blobUrl || fileList.length === 0}
            loading={analyzing}
            onClick={handleAnalyze}
          >
            Analyze
          </Button>
        </div>

        <Modal
          open={previewOpen}
          title={previewTitle}
          footer={null}
          onCancel={() => {
            if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
            setPreviewOpen(false);
            setPreviewSrc("");
          }}
          width={900}
        >
          {previewSrc ? (
            (fileList[0]?.type === "application/pdf" || previewTitle?.toLowerCase()?.endsWith(".pdf")) ? (
              <object data={previewSrc} type="application/pdf" width="100%" height="600px">
                <p>
                  PDF preview isn’t available here.{" "}
                  <a href={previewSrc} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                  .
                </p>
              </object>
            ) : (
              <img alt="preview" src={previewSrc} style={{ width: "100%" }} />
            )
          ) : (
            <div>No preview available.</div>
          )}
        </Modal>
      </div>
    </>
  );
}
