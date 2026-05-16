type MacroProgressProps = {
  label: string;
  current: number;
  goal: number;
  percent: number;
  colorClass: string;
  trackClass: string;
  pillClass: string;
};

function formatMacroValue(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function MacroProgress({ label, current, goal, percent, colorClass, trackClass, pillClass }: MacroProgressProps) {
  const clampedPercent = Math.max(0, Math.min(percent, 100));
  const currentValue = formatMacroValue(current);
  const goalValue = formatMacroValue(goal);

  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-white/96 px-4 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.22)] sm:px-4.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
            <span className="text-[0.82rem] font-semibold tracking-[-0.01em] text-slate-700">{label}</span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[1.95rem] font-semibold tracking-[-0.05em] text-slate-950">{currentValue}g</span>
            <span className="pb-1 text-sm font-medium text-slate-400">of {goalValue}g</span>
          </div>
        </div>
        <span
          className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ${pillClass}`}
        >
          {percent}%
        </span>
      </div>

      <div className={`mt-4 h-3 overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${clampedPercent}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-medium tracking-[0.01em] text-slate-500">
        <span>{currentValue}g consumed</span>
        <span>{goalValue}g goal</span>
      </div>
    </div>
  );
}
