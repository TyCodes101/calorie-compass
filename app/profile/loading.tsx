export default function ProfileLoading() {
  return (
    <div className="app-page app-screen-narrow flex min-w-0 flex-col gap-6 py-6" aria-busy="true">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 rounded-full bg-slate-200" />
          <div className="h-8 w-56 rounded-full bg-slate-200" />
          <div className="h-5 w-full max-w-lg rounded-full bg-slate-200" />
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="app-card h-32 rounded-[28px] p-6 animate-pulse bg-slate-100" />
        <div className="app-card h-32 rounded-[28px] p-6 animate-pulse bg-slate-100" />
      </section>
      <section className="app-card min-w-0 rounded-[32px] p-2">
        <div className="animate-pulse space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 rounded-[24px] bg-slate-100" />
          ))}
        </div>
      </section>
    </div>
  );
}
