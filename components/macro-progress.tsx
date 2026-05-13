type MacroProgressProps = {
  label: string;
  current: number;
  goal: number;
  percent: number;
  colorClass: string;
};

export function MacroProgress({ label, current, goal, percent, colorClass }: MacroProgressProps) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-[0_14px_28px_rgba(148,163,184,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <span className="font-medium text-slate-900">{label}</span>
          <p className="mt-1 text-xs text-slate-500">
            {current} / {goal}g
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{percent}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colorClass} shadow-[0_6px_12px_rgba(15,23,42,0.12)]`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
