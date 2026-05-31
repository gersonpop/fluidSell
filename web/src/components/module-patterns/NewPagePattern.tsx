type NewPagePatternProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
  plain?: boolean;
};

export function NewPagePattern({title, description, children, plain = false}: NewPagePatternProps) {
  if (plain) {
    return (
      <div className="new-page-pattern-plain h-full w-full flex flex-col overflow-hidden p-3 text-slate-700">
        <h1 id="titleNewPage" className="new-page-title text-2xl font-semibold capitalize">{title}</h1>
        <p className="new-page-description mt-2 text-sm text-slate-500">{description}</p>
        {children ? (
          <div className="new-page-content mt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="new-page-pattern-container h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 flex flex-col overflow-hidden">
      <h1 id="titleNewPage" className="new-page-title text-2xl font-semibold capitalize">{title}</h1>
      <p className="new-page-description mt-2 text-sm text-slate-500">{description}</p>
      {children ? (
        <div className="new-page-content mt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      ) : null}
    </section>
  );
}


