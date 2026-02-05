export default function ChatEmptyState() {
  return (
    <div className="group-data-[has-messages=true]:hidden">
      <div className="text-3xl font-semibold text-white">
        Hi there, where should we start?
      </div>
      <p className="mt-3 text-base text-slate-400">
        Ask anything to begin your onboarding session.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {[
          "Create image",
          "Write anything",
          "Summarize our company",
          "Draft onboarding goals",
        ].map((label) => (
          <button
            key={label}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
