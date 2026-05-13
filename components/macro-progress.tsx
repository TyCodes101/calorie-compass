type MacroProgressProps = {
  label: string;
  current: number;
  goal: number;
  percent: number;
  colorClass: string;
};

export function MacroProgress({ label, current, goal, percent, colorClass }: MacroProgressProps) {
  return (
    <div className="space-y-2 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="text-slate-500">
          {current} / {goal}g
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
