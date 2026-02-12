import { Suspense } from "react";
import ChatClient from "@/app/components/ChatClient";

export default function ChatShell() {
  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-live="polite">
      <div
        id="chat-shell"
        data-has-messages="false"
        className="group flex w-full flex-1 flex-col min-h-0"
      >
        <Suspense fallback={<div className="h-full w-full" />}>
          <ChatClient />
        </Suspense>
      </div>
    </main>
  );
}
