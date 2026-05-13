type MacroProgressProps = {
  label: string;
  current: number;
  goal: number;
  percent: number;
  colorClass: string;
};

export function MacroProgress({ label, current, goal, percent, colorClass }: MacroProgressProps) {
  return (
    <div className="space-y-2 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-slate-300">
          {current} / {goal}g
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
