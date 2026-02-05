import Sidebar from "@/app/components/Sidebar";
import ChatShell from "@/app/components/ChatShell";

export default function Home() {
  return (
    <div className="relative min-h-screen w-screen overflow-y-auto bg-[var(--background)] text-[color:var(--foreground)] lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 app-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-[140px]" />
        <div className="glow-orb absolute -bottom-40 right-1/4 h-[380px] w-[380px] rounded-full bg-sky-400/10 blur-[140px]" />
      </div>
      <div className="relative z-10 flex h-full w-full flex-col gap-4 px-4 py-4 fade-up sm:gap-6 sm:px-6 sm:py-6 lg:flex-row">
        <Sidebar />
        <ChatShell />
      </div>
    </div>
  );
}
