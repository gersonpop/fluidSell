"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";

type RoleItem = {
  id: string;
  key_id: string; // mapped from key
  name: string;
  description: string | null;
  scope: string; // "user" | "admin" | "SU" | "CLIENT" etc.
  company_id: string | null;
  status?: string;
  updated_at?: string | null;
};

type ScopeItem = {id: string; value?: string; name?: string};
type ScopeCatalogItem = ScopeItem & {
  type?: string;
  typeuse?: string;
  typeUse?: string;
  type_description?: string;
  typeDescription?: string;
  Initials_PK?: string;
  initials_pk?: string;
};

type CompanyItem = {
  id: string;
  commercialName: string;
  legalName?: string | null;
};

function normalizeScopeItem(item: ScopeCatalogItem): ScopeItem | null {
  const idCandidate = item.Initials_PK ?? item.initials_pk ?? item.id;
  const id = typeof idCandidate === "string" ? idCandidate.trim() : "";
  if (!id) return null;
  const value = typeof item.value === "string" ? item.value : undefined;
  const name = typeof item.name === "string" ? item.name : undefined;
  return {id, value, name};
}

function isRoleScope(item: ScopeCatalogItem) {
  const marker = Object.values(item)
    .map((value) => String(value ?? "").toLowerCase().replace(/[_\s-]+/g, ""))
    .join(" ");
  return marker.includes("rolescope") || marker.includes("alcancedelrol");
}

type Props = {
  actorId: string;
  actorRole: "SU" | "cliente";
  companyId: string | null;
};

const DEFAULT_VISIBLE_COLUMNS = ["key_id", "name", "description", "scope", "actions"] as const;

const SCOPES_CACHE_KEY = "positions_scopes_cache";

const defaultForm = {
  key_id: "",
  name: "",
  description: "",
  scope: "",
  company_id: ""
};

export function PositionsConfigClient({actorId, actorRole, companyId}: Props) {
  const t = useTranslations("AccountConfig");
  const router = useRouter();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<keyof RoleItem>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDrawerVisible, setFormDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof defaultForm, string>>>({});

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmLabel?: string;
    confirmVariant?: "danger" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Confirmar",
    confirmVariant: "danger" | "warning" = "danger"
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmModal((prev) => ({...prev, isOpen: false}));
      },
      confirmLabel,
      confirmVariant
    });
  };

  const pageSize = rowsPerPage;

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": actorId,
      "x-actor-role": actorRole,
      "x-company-id": companyId ?? "",
      "content-type": "application/json"
    }),
    [actorId, actorRole, companyId]
  );

  // Load static scopes from localStorage immediately on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(SCOPES_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setScopes(parsed);
          }
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchList = [
        fetch("/api/v1/db/roles", {headers}),
        fetch("/api/v1/db/st_multidata", {headers})
      ];
      if (actorRole === "SU") {
        fetchList.push(fetch("/api/v1/db/companies", {headers}));
      }

      const responses = await Promise.all(fetchList);
      
      const rolesRes = responses[0];
      const scopesRes = responses[1];
      const companiesRes = responses[2];

      const rolesBody = await rolesRes.json();
      const scopesBody = await scopesRes.json();

      if (!rolesRes.ok) throw new Error(rolesBody.message ?? "No se pudieron cargar los cargos");
      if (!scopesRes.ok) throw new Error(scopesBody.message ?? "No se pudieron cargar los scopes");

      setRoles((rolesBody.data ?? []) as RoleItem[]);

      const rawScopes = (scopesBody.data ?? []) as ScopeCatalogItem[];
      const roleScopes = rawScopes.filter(isRoleScope).map(normalizeScopeItem).filter((item): item is ScopeItem => item !== null);
      
      setScopes(roleScopes);
      if (typeof window !== "undefined") {
        localStorage.setItem(SCOPES_CACHE_KEY, JSON.stringify(roleScopes));
      }

      if (actorRole === "SU" && companiesRes) {
        const companiesBody = await companiesRes.json();
        if (companiesRes.ok) {
          setCompanies((companiesBody.data ?? []) as CompanyItem[]);
        }
      }

      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [headers, actorRole]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) {
        await loadData();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    const closeMenu = () => {
      setShowColumnsMenu(false);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const visibleRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = roles.filter((item) => {
      const textMatch =
        term.length === 0 ||
        [item.key_id, item.name, item.description ?? ""].join(" ").toLowerCase().includes(term);
      const scopeMatch = scopeFilter === "all" || item.scope === scopeFilter;
      return textMatch && scopeMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      let left = a[sortBy];
      let right = b[sortBy];

      if (left === null || left === undefined) left = "";
      if (right === null || right === undefined) right = "";

      if (typeof left === "number" && typeof right === "number") {
        return sortDir === "asc" ? left - right : right - left;
      }

      const leftStr = String(left).toLowerCase();
      const rightStr = String(right).toLowerCase();
      if (leftStr === rightStr) return 0;
      const comparison = leftStr > rightStr ? 1 : -1;
      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [roles, search, scopeFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleRoles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRoles = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleRoles.slice(start, start + pageSize);
  }, [safePage, visibleRoles, pageSize]);

  const tableColumns = useMemo(
    () => {
      const cols = [
        {key: "id", label: "ID"},
        {key: "key_id", label: "ID Clave"},
        {key: "name", label: "Nombre"},
        {key: "description", label: "Descripción"},
        {key: "scope", label: "Alcance (Scope)"}
      ];
      if (actorRole === "SU") {
        cols.push({key: "company_id", label: "Empresa"});
      }
      cols.push({key: "actions", label: "Acciones"});
      return cols;
    },
    [actorRole]
  );

  const headerColumns = useMemo(() => tableColumns.filter((column) => visibleColumns.has(column.key) || column.key === "company_id" && actorRole === "SU"), [tableColumns, visibleColumns, actorRole]);

  function toggleColumn(columnKey: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        if (next.size === 1) return prev;
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }

  function clearFormState() {
    setForm({
      key_id: "",
      name: "",
      description: "",
      scope: scopes[0]?.id ?? "user",
      company_id: companyId ?? companies[0]?.id ?? "900000000"
    });
    setEditingId(null);
    setFormErrors({});
  }

  function openCreateForm() {
    clearFormState();
    setIsFormOpen(true);
    window.setTimeout(() => setFormDrawerVisible(true), 10);
  }

  function onEdit(item: RoleItem) {
    setIsFormOpen(true);
    window.setTimeout(() => setFormDrawerVisible(true), 10);
    setEditingId(item.id);
    setForm({
      key_id: item.key_id,
      name: item.name,
      description: item.description ?? "",
      scope: item.scope,
      company_id: item.company_id ?? companyId ?? "900000000"
    });
    setFormErrors({});
  }

  function closeFormDrawer() {
    setFormDrawerVisible(false);
    window.setTimeout(() => setIsFormOpen(false), 220);
  }

  async function onSubmit() {
    const errors: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.name.trim()) errors.name = "Nombre del cargo es obligatorio";
    if (!form.key_id.trim()) errors.key_id = "ID Clave es obligatorio";
    if (form.key_id.trim().length > 5) errors.key_id = "ID Clave debe tener máximo 5 caracteres";
    if (!form.scope.trim()) errors.scope = "Alcance es obligatorio";
    if (actorRole === "SU" && !form.company_id.trim()) errors.company_id = "Empresa es obligatoria para el Super Usuario";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        key: form.key_id.trim().toUpperCase(),
        key_id: form.key_id.trim().toUpperCase(),
        description: form.description || null,
        scope: form.scope,
        company_id: actorRole === "SU" ? form.company_id : (companyId || "900000000")
      };

      const response = await fetch("/api/v1/db/roles", {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editingId ? {...payload, id: editingId} : payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "No se pudo guardar el cargo");
      setSuccess(editingId ? "Cargo actualizado correctamente" : "Cargo creado correctamente");
      clearFormState();
      closeFormDrawer();
      await loadData();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: RoleItem) {
    showConfirm(
      "¿Eliminar este cargo?",
      `Esta acción eliminará el cargo ${item.name} de forma permanente y removerá todos los privilegios asociados. ¿Deseas continuar?`,
      async () => {
        setSaving(true);
        try {
          const response = await fetch("/api/v1/db/roles", {
            method: "DELETE",
            headers,
            body: JSON.stringify({id: item.id})
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message ?? "No se pudo eliminar el cargo");
          setSuccess("Cargo eliminado correctamente");
          await loadData();
          router.refresh();
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el cargo");
        } finally {
          setSaving(false);
        }
      },
      "Eliminar",
      "danger"
    );
  }

  function setSort(column: keyof RoleItem) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  if (loading && roles.length === 0) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">Cargando Cargos...</section>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 sm:p-5">
      <article className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold">Administración de Cargos</h2>
          <p className="text-sm text-slate-500">Crea y administra los cargos (roles) del sistema desde BD usando API dinámica.</p>
        </header>

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full gap-2 md:grid-cols-[1fr_220px] lg:max-w-[62%]">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por ID Clave, nombre o descripción..."
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm"
              />
              <select
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
              >
                <option value="all">Todos los Alcances</option>
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowColumnsMenu((value) => !value);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                >
                  Columnas
                </button>
                {showColumnsMenu ? (
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {tableColumns.map((column) => (
                      <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                        <input type="checkbox" checked={visibleColumns.has(column.key)} onChange={() => toggleColumn(column.key)} />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <button onClick={openCreateForm} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Agregar Cargo</button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{visibleRoles.length} resultados</span>
            <label className="flex items-center gap-2">
              Filas por página:
              <select
                value={String(rowsPerPage)}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-500">
                <tr>
                  {headerColumns.map((column) => (
                    <th key={column.key} className={`px-4 py-3 ${column.key === "actions" ? "text-center" : ""}`}>
                      {column.key !== "actions" ? (
                        <button className="font-medium" onClick={() => setSort(column.key as keyof RoleItem)}>{column.label}</button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRoles.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    {headerColumns.map((column) => {
                      if (column.key === "id") return <td key={`${item.id}-id`} className="px-4 py-3 font-mono text-xs">{item.id}</td>;
                      if (column.key === "key_id") return <td key={`${item.id}-key_id`} className="px-4 py-3 font-mono font-medium">{item.key_id}</td>;
                      if (column.key === "name") return <td key={`${item.id}-name`} className="px-4 py-3 font-semibold">{item.name}</td>;
                      if (column.key === "description") return <td key={`${item.id}-description`} className="px-4 py-3 max-w-[240px] truncate">{item.description ?? "-"}</td>;
                      if (column.key === "scope") {
                        const scopeName = scopes.find(s => s.id === item.scope)?.value ?? item.scope;
                        return <td key={`${item.id}-scope`} className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{scopeName}</span></td>;
                      }
                      if (column.key === "company_id") {
                        const comp = companies.find(c => c.id === item.company_id);
                        const compName = comp ? `${comp.commercialName} (${item.company_id})` : (item.company_id ?? "-");
                        return <td key={`${item.id}-company`} className="px-4 py-3 font-mono text-xs truncate max-w-[180px]">{compName}</td>;
                      }
                      return (
                        <td key={`${item.id}-actions`} className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Editar (Lápiz Azul) */}
                            <div className="group relative">
                              <button
                                type="button"
                                onClick={() => onEdit(item)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 shadow-sm hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition duration-150"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  <path d="m15 5 4 4" />
                                </svg>
                              </button>
                              <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                Editar
                              </span>
                            </div>

                            {/* Eliminar (Basura Roja) */}
                            <div className="group relative">
                              <button
                                type="button"
                                onClick={() => void onDelete(item)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 transition duration-150"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4.5 w-4.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                              <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                Eliminar
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {pagedRoles.length === 0 ? (
                  <tr>
                    <td colSpan={headerColumns.length} className="px-3 py-6 text-center text-slate-500">No hay cargos registrados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
            <p>Mostrando {pagedRoles.length} de {visibleRoles.length} cargos</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">{t("pagination.previous")}</button>
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-white">{safePage}</span>
              <span>de {totalPages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">{t("pagination.next")}</button>
            </div>
          </div>
        </div>
      </article>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50">
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${formDrawerVisible ? "opacity-100" : "opacity-0"}`} onClick={closeFormDrawer} />
          <aside className={`absolute right-0 top-0 h-full w-full max-w-[520px] overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-200 ease-out ${formDrawerVisible ? "translate-x-0" : "translate-x-full"}`}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-semibold">{editingId ? "Editar Cargo" : "Crear Cargo"}</h3>
                <p className="text-sm text-slate-500">Configura los parámetros del cargo con persistencia en tiempo real.</p>
              </div>
              <button type="button" onClick={closeFormDrawer} className="text-2xl text-slate-400 hover:text-slate-700">×</button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">ID Clave (Max 5 letras, ej: ADM)</label>
                <input
                  value={form.key_id}
                  disabled={!!editingId}
                  onChange={(e) => setForm((s) => ({...s, key_id: e.target.value.toUpperCase().slice(0, 5)}))}
                  placeholder="Ej: VEN"
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm disabled:text-slate-500 disabled:bg-slate-200"
                />
                {formErrors.key_id ? <p className="mt-1 text-xs text-rose-600">{formErrors.key_id}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre del Cargo</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({...s, name: e.target.value}))}
                  placeholder="Ej: Vendedor de Mostrador"
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                />
                {formErrors.name ? <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Alcance (Scope)</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm((s) => ({...s, scope: e.target.value}))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                >
                  {scopes.map((scope) => (
                    <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                  ))}
                </select>
                {formErrors.scope ? <p className="mt-1 text-xs text-rose-600">{formErrors.scope}</p> : null}
              </div>

              {actorRole === "SU" ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Empresa (Asignar Cargo a Cliente)</label>
                  <select
                    value={form.company_id}
                    onChange={(e) => setForm((s) => ({...s, company_id: e.target.value}))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                  >
                    <option value="">-- Seleccionar Empresa --</option>
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id}>{comp.commercialName || comp.legalName || comp.id}</option>
                    ))}
                  </select>
                  {formErrors.company_id ? <p className="mt-1 text-xs text-rose-600">{formErrors.company_id}</p> : null}
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Descripción del Cargo</label>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm((s) => ({...s, description: e.target.value}))}
                  placeholder="Escribe una breve descripción del rol..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => {
                  clearFormState();
                  closeFormDrawer();
                }}
                className="rounded-xl px-4 py-2 text-sm text-rose-600"
              >
                Cancelar
              </button>
              <button
                disabled={saving}
                onClick={() => void onSubmit()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition"
              >
                {saving ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Cargo"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {confirmModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-200" onClick={() => setConfirmModal((prev) => ({...prev, isOpen: false}))} />
          <div className="relative z-10 w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all duration-200 scale-100 opacity-100 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">{confirmModal.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({...prev, isOpen: false}))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmModal.onConfirm();
                }}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm"
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default PositionsConfigClient;