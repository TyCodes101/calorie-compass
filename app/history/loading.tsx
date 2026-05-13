export default function HistoryLoading() {
  return (
    <div className="app-page app-screen flex min-w-0 flex-col gap-6 py-6" aria-busy="true">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 rounded-full bg-slate-200" />
          <div className="h-8 w-56 rounded-full bg-slate-200" />
          <div className="h-4 w-full max-w-xl rounded-full bg-slate-200" />
        </div>
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="h-4 w-32 rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-24 rounded-full bg-slate-200" />
                <div className="mt-4 h-10 rounded-[18px] bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="app-card min-w-0 rounded-[24px] p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-32 rounded-full bg-slate-200" />
              <div className="h-4 w-full max-w-sm rounded-full bg-slate-200" />
              <div className="h-10 rounded-[18px] bg-slate-200" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
