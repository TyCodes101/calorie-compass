type MacroProgressProps = {
  label: string;
  current: number;
  goal: number;
  percent: number;
  colorClass: string;
};

export function MacroProgress({ label, current, goal, percent, colorClass }: MacroProgressProps) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/85 p-3.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <span className="font-medium text-slate-900">{label}</span>
          <p className="mt-1 text-xs text-slate-500">
            {current} / {goal}g
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
