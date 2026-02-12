import Sidebar from "@/app/components/Sidebar";
import ChatShell from "@/app/components/ChatShell";

export default function Home() {
  return (
    <div className="relative flex w-full flex-1 flex-col fade-up lg:flex-row bg-[var(--background)] text-[color:var(--foreground)] lg:overflow-hidden">
      <Sidebar />
      <ChatShell />
    </div>
  );
}
