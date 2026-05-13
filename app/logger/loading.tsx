export default function LoggerLoading() {
  return (
    <div className="app-page-with-action-bar app-screen-wide flex min-w-0 flex-col gap-6 py-6" aria-busy="true">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="animate-pulse space-y-4">
            <div className="h-3 w-24 rounded-full bg-slate-200" />
            <div className="h-8 w-64 rounded-full bg-slate-200" />
            <div className="h-32 rounded-[24px] bg-slate-200" />
          </div>
          <div className="animate-pulse space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="h-12 rounded-[18px] bg-slate-200" />
            <div className="h-12 rounded-[18px] bg-slate-200" />
            <div className="h-24 rounded-[24px] bg-slate-200" />
          </div>
        </div>
      </section>
    </div>
  );
}
