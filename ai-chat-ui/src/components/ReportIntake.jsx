// src/components/ReportIntake.jsx
import React, { useRef, useState } from "react";
import { Card, Button, Modal, App as AntApp, Flex } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { Attachments } from "@ant-design/x";

/**
 * startUpload: ({ filename, content_type }) => { sasUrl, blobUrl }
 * onUploaded:  ({ file, blobUrl }) => void
 * onAnalyze:   () => Promise<void>
 */
export default function ReportIntake({ startUpload, onUploaded, onAnalyze, analyzing }) {
  const { message } = AntApp.useApp ? AntApp.useApp() : { message: { success() {}, error() {} }};
  const [fileList, setFileList] = useState([]);
  const [preview, setPreview] = useState({ open: false, url: "", title: "" });
  const [blobUrl, setBlobUrl] = useState("");

  const ref = useRef(null);

  const beforeUpload = (file) => {
    const ok =
      file.type === "application/pdf" ||
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/tiff";
    if (!ok) {
      message.error("Please select a PDF, PNG, JPEG, or TIFF file.");
      return Upload.LIST_IGNORE; // same semantics as antd Upload
    }
    return true;
  };

  // Attachments supports the same Upload props under the hood (per docs)
  const customRequest = async ({ file, onProgress, onError, onSuccess }) => {
    try {
      const { sasUrl, blobUrl: finalBlobUrl } = await startUpload({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
      });

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
          setBlobUrl(finalBlobUrl);
          onUploaded?.({ file, blobUrl: finalBlobUrl });
          onSuccess?.({}, file);
          message.success("Upload complete.");
        } else {
          const err = new Error(xhr.responseText || `Upload error ${xhr.status}`);
          onError?.(err);
          message.error(err.message);
        }
      };

      xhr.onerror = () => {
        const err = new Error("Network error during upload");
        onError?.(err);
        message.error(err.message);
      };

      xhr.send(file);
    } catch (err) {
      onError?.(err);
      message.error(err?.message || "Upload failed.");
    }
  };

  const handlePreview = async (file) => {
    const url = file.url || file.preview || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : "");
    setPreview({ open: true, url, title: file.name || "Preview" });
  };

  return (
    <Card title="Upload a report">
      <Attachments
        ref={ref}
        items={fileList}
        onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
        // upload behavior (compatible with antd Upload)
        beforeUpload={beforeUpload}
        customRequest={customRequest}
        showUploadList={{ showPreviewIcon: true, showRemoveIcon: true, showDownloadIcon: false }}
        maxCount={1}
        listType="text"
        onPreview={handlePreview}
        placeholder={{
          title: "Click or drop files here",
          description: "PDF or image of your lab report",
        }}
      />

      <Flex justify="end" gap={8} style={{ marginTop: 12 }}>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={!blobUrl || fileList.length === 0}
          loading={analyzing}
          onClick={() => onAnalyze?.()}
        >
          Analyze
        </Button>
      </Flex>

      <Modal
        open={preview.open}
        title={preview.title}
        footer={null}
        onCancel={() => {
          if (preview.url?.startsWith("blob:")) URL.revokeObjectURL(preview.url);
          setPreview({ open: false, url: "", title: "" });
        }}
        width={900}
      >
        {preview.url ? (
          (fileList[0]?.type === "application/pdf" || preview.title?.toLowerCase()?.endsWith(".pdf")) ? (
            <object data={preview.url} type="application/pdf" width="100%" height="600px">
              <p>
                PDF preview isn’t available here.{" "}
                <a href={preview.url} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
                .
              </p>
            </object>
          ) : (
            <img alt="preview" src={preview.url} style={{ width: "100%" }} />
          )
        ) : (
          <div>No preview available.</div>
        )}
      </Modal>
    </Card>
  );
}
