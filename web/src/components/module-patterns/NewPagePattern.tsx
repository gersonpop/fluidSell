type NewPagePatternProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function NewPagePattern({title, description, children}: NewPagePatternProps) {
  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 id="titleNewPage" className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
