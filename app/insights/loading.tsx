export default function InsightsLoading() {
  return (
    <div className="app-page app-screen-wide flex min-w-0 flex-col gap-6 py-6" aria-busy="true">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-8 w-72 rounded-full bg-slate-200" />
          <div className="h-5 w-full max-w-2xl rounded-full bg-slate-200" />
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="app-card h-36 rounded-[28px] p-6 animate-pulse bg-slate-100" />
        ))}
      </section>
    </div>
  );
}
