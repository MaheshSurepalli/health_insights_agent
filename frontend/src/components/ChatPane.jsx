// src/components/ChatPane.jsx
import React, { useMemo, useState } from "react";
import { Bubble, Sender } from "@ant-design/x";
import MarkdownIt from "markdown-it";
import { Grid } from "antd";

/**
 * messages: [{ role: 'user'|'assistant', text: string }]
 * sending: boolean (optional)
 * loading: boolean (optional)
 * onSend:  (text: string) => void
 */
export default function ChatPane({ messages = [], sending = false, loading = false, onSend }) {
  // Markdown renderer for assistant content
  const md = useMemo(
    () =>
      new MarkdownIt({
        html: false,
        linkify: true,
        breaks: true,
      }),
    []
  );

  // Map backend messages 
  const items = useMemo(() => {
    const arr = Array.isArray(messages) ? messages : [];
    return arr
      .filter((m) => (m?.text || "").trim() !== "")
      .map((m, idx) => {
        const role = String(m.role || "").toLowerCase();
        const isUser = role === "user";
        const content = String(m.text || "");

        return {
          key: idx,
          role,
          content: isUser ? (
            content
          ) : (
            <div
              className="chat-md"
              // If you want stricter sanitization, run through DOMPurify here.
              dangerouslySetInnerHTML={{ __html: md.render(content) }}
              style={{
                lineHeight: 1.55,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                fontSize: 14,
                // tighten headings inside the bubble
                // (kept inline so no global CSS needed)
              }}
            />
          ),
        };
      });
  }, [messages, md]);

  const [value, setValue] = useState("");
  const screens = Grid.useBreakpoint();
  const pad = screens.xs ? 8 : 12;

  return (
    <div
      // Borderless "card" with soft elevation; no visible border around bubbles
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
      }}
    >
      {/* Scrollable chat list with its own internal padding */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: pad, // controls the gap between container edges and bubbles
        }}
      >
        <Bubble.List
          items={items}
          autoScroll
          roles={{
            user: {
              placement: "end",
              variant: "filled",
              styles: {
                content: {
                  background: "#1677ff", // AntD primary
                  color: "#fff",
                },
              },
            },
            assistant: {
              placement: "start",
              variant: "borderless",
              styles: {
                content: {
                  background: "#f7f8fa", // softer than #f5f5f5
                  color: "inherit",
                },
              },
            },
          }}
          style={{ minHeight: "100%" }}
        />
        {loading && (
          <div style={{ textAlign: "center", color: "#999", padding: "6px 0" }}>
            Loading…
          </div>
        )}
      </div>

      {/* Subtle divider above the sender to visually separate input from messages */}
      <div style={{ borderTop: "1px solid #f0f0f0", padding: pad }}>
        <Sender
          value={value}
          onChange={setValue}
          onSubmit={(val) => {
            const text = String(val || "").trim();
            if (!text || sending) return;
            onSend?.(text);
            setValue("");
          }}
          placeholder="Type your message…"
          loading={sending} // spinner inside the input while sending
        />
      </div>
    </div>
  );
}
