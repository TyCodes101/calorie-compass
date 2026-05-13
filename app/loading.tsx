export default function DashboardLoading() {
  return (
    <div className="app-page app-screen-wide flex min-w-0 flex-col gap-6 py-6" aria-busy="true">
      <section className="grid min-w-0 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="app-card min-w-0 rounded-[32px] p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="h-8 w-64 rounded-full bg-slate-200" />
            <div className="h-5 w-full max-w-xl rounded-full bg-slate-200" />
            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              <div className="h-32 rounded-[28px] bg-slate-200" />
              <div className="h-32 rounded-[28px] bg-slate-200" />
              <div className="h-32 rounded-[28px] bg-slate-200" />
            </div>
          </div>
        </div>
        <div className="app-card min-w-0 rounded-[32px] p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-3 w-24 rounded-full bg-slate-200" />
            <div className="h-16 rounded-[22px] bg-slate-200" />
            <div className="h-16 rounded-[22px] bg-slate-200" />
            <div className="h-16 rounded-[22px] bg-slate-200" />
          </div>
        </div>
      </section>
    </div>
  );
}
