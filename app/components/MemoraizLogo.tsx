
type MemoraizLogoProps = {
  className?: string;
  label?: string;
};

export default function MemoraizLogo({ className, label = "Memoraiz" }: MemoraizLogoProps) {
  return (
    <div className={`logo-mark ${className ?? ""}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/memoraiz-logo.svg"
        alt={label}
        className="h-full w-auto"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
