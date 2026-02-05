import ChatClient from "@/app/components/ChatClient";

export default function ChatShell() {
  return (
    <main className="flex h-full flex-1 flex-col" aria-live="polite">
      <div className="flex h-full flex-1 min-h-0">
        <div
          id="chat-shell"
          data-has-messages="false"
          className="group flex h-full w-full flex-col min-h-0"
        >
          <ChatClient />
        </div>
      </div>
    </main>
  );
}
