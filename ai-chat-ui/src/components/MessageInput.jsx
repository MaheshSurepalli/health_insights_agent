export default function MessageInput({ input, setInput, sendMessage, disabled = false }) {
  return (
    <div className="flex items-center border-t p-3 gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => !disabled && e.key === "Enter" && sendMessage()}
        placeholder={disabled ? "Chat will unlock after analysis..." : "Type your message..."}
        className="flex-1 border border-gray-300 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        disabled={disabled}
      />
      <button
        onClick={sendMessage}
        disabled={disabled}
        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white px-5 py-2 rounded-full shadow-md"
      >
        Send
      </button>
    </div>
  );
}
