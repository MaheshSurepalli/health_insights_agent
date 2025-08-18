// src/components/ChatPane.jsx
import React, { useMemo, useState } from "react";
import { Bubble, Sender } from "@ant-design/x";
import MarkdownIt from "markdown-it";

/**
 * messages: [{ role: 'user'|'assistant', text: string }]
 * sending: boolean (optional)
 * loading: boolean (optional)
 * onSend:  (text: string) => void
 */
export default function ChatPane({ messages = [], sending = false, loading = false, onSend }) {
  // Markdown renderer for assistant messages
  const md = useMemo(
    () =>
      new MarkdownIt({
        html: false,
        linkify: true,
        breaks: true,
      }),
    []
  );

  // Map backend messages -> Bubble.List items
  const items = useMemo(() => {
    const arr = Array.isArray(messages) ? messages : [];
    return arr
      .filter((m) => (m?.text || "").trim() !== "")
      .map((m, idx) => {
        const role = String(m.role || "").toLowerCase();
        const isUser = role === "user";
        const content = String(m.text || "");

        const node = isUser ? (
          content
        ) : (
          <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
        );

        return {
          key: idx,
          role,
          placement: isUser ? "end" : "start",
          variant: isUser ? "filled" : "borderless",
          content: node,
        };
      });
  }, [messages, md]);

  const [value, setValue] = useState("");

  return (
    <div
      // lightweight "card" look without AntD Card (no title/header at all)
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        padding: 12,
        gap: 8,
        background: "#fff",
      }}
    >
      {/* Scrollable chat list */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <Bubble.List
          items={items}
          autoScroll
          roles={{
            user: { placement: "end", variant: "filled" },
            assistant: { placement: "start", variant: "borderless" },
          }}
          style={{ minHeight: "100%" }}
        />
        {loading && (
          <div style={{ textAlign: "center", color: "#999", padding: "6px 0" }}>
            Loading…
          </div>
        )}
      </div>

      {/* Sender */}
      <Sender
        value={value}
        onChange={setValue}
        onSubmit={(val) => {
          const text = String(val || "").trim();
          if (!text) return;
          onSend?.(text);
          setValue("");
        }}
        placeholder="Type your message…"
        sending={sending}
      />
    </div>
  );
}
