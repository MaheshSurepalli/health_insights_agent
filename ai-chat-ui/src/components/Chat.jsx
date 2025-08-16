// src/components/Chat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Input, Button, Spin } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { TextArea } = Input;

export default function Chat({ messages = [], loading = false, disabled = false, onSend }) {
  const msgs = useMemo(
    () =>
      (Array.isArray(messages) ? messages : [])
        .filter((m) => (m?.text || "").trim() !== "")
        .map((m) => ({ ...m, role: (m?.role || "").toLowerCase() })),
    [messages]
  );

  const [value, setValue] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const send = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend?.(v);
    setValue("");
  };

  return (
    <Card title="Chat" style={{ display: "flex", flexDirection: "column", height: 520 }}>
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 4,
        }}
      >
        {msgs.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "75%",
                  borderRadius: 16,
                  padding: "10px 14px",
                  background: isUser ? "#1677ff" : "#f5f5f5",
                  color: isUser ? "#fff" : "inherit",
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ textAlign: "center", color: "#999" }}>
            <Spin size="small" /> &nbsp;Loading…
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={disabled ? "Chat unlocks after analysis…" : "Type your message…"}
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={disabled}
        />
        <Button type="primary" onClick={send} disabled={disabled || !value.trim()}>
          Send
        </Button>
      </div>
    </Card>
  );
}
