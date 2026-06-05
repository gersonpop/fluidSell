"use client";

import { useState } from "react";

export function DynamicComponent({ isSU }: { isSU?: boolean }) {
  const [showAllCompanies, setShowAllCompanies] = useState(false);

  return (
    <section className="space-y-4">
      {isSU && (
        <div className="flex items-center gap-2 select-none rounded-xl border border-cyan-200 bg-cyan-50/50 px-4 py-3 text-sm text-cyan-850">
          <input
            type="checkbox"
            id="su-show-all-workflow"
            checked={showAllCompanies}
            onChange={(e) => setShowAllCompanies(e.target.checked)}
            className="rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
          />
          <label htmlFor="su-show-all-workflow" className="font-bold text-cyan-900 cursor-pointer">
            Ver todas las compañías simultáneamente (Superusuario)
          </label>
        </div>
      )}
      <p className="text-sm text-slate-600">Este módulo se ha creado dinámicamente con contenido básico.</p>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-800">Contenido básico</h2>
        <p className="mt-1 text-xs text-slate-500">Puedes editar este componente en `component.workflow.tsx` para agregar tu lógica de negocio.</p>
      </div>
    </section>
  );
}

export default DynamicComponent;