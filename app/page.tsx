import Sidebar from "@/app/components/Sidebar";
import ChatShell from "@/app/components/ChatShell";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-[var(--background)] text-[color:var(--foreground)] lg:fixed lg:inset-0 lg:h-screen lg:w-screen lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 app-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-[140px]" />
        <div className="glow-orb absolute -bottom-40 right-1/4 h-[380px] w-[380px] rounded-full bg-sky-400/10 blur-[140px]" />
      </div>
      <div className="relative z-10 flex h-full w-full flex-col fade-up lg:flex-row">
        <Sidebar />
        <ChatShell />
      </div>
    </div>
  );
}
