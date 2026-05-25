"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";

type ModuleItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  route: string | null;
  icon: string | null;
  sort_order: number;
  status: "active" | "inactive";
  parent: string | null;
  scope_id: string;
  content?: string | null;
  updated_at?: string | null;
};

type ScopeItem = {id: string; value?: string; name?: string};
type StatusItem = {value: string; label: string};
type PageContentItem = {value: string; label: string};
type ScopeCatalogItem = ScopeItem & {
  type?: string;
  typeuse?: string;
  typeUse?: string;
  type_description?: string;
  typeDescription?: string;
  Initials_PK?: string;
  initials_pk?: string;
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

const defaultForm = {
  code: "",
  name: "",
  description: "",
  route: "",
  icon: "",
  sort_order: "100",
  status: "",
  parent: "/",
  scope_id: "",
  content: "newPage"
};

export function ModulesConfigClient({actorId, actorRole, companyId}: Props) {
  const t = useTranslations("AccountConfig");
  const router = useRouter();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [pageContents, setPageContents] = useState<PageContentItem[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"code" | "name" | "status" | "updated_at">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof defaultForm, string>>>({});

  const pageSize = 8;

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [modulesRes, scopesRes] = await Promise.all([
        fetch("/api/v1/db/modules", {headers}),
        fetch("/api/v1/db/st_multidata", {headers})
      ]);
      const modulesBody = await modulesRes.json();
      const scopesBody = await scopesRes.json();
      if (!modulesRes.ok) throw new Error(modulesBody.message ?? t("errors.loadModules"));
      if (!scopesRes.ok) throw new Error(scopesBody.message ?? t("errors.loadScopes"));
      setModules((modulesBody.data ?? []) as ModuleItem[]);
      const rawScopes = (scopesBody.data ?? []) as ScopeCatalogItem[];
      const roleScopes = rawScopes.filter(isRoleScope).map(normalizeScopeItem).filter((item): item is ScopeItem => item !== null);
      setScopes(roleScopes);
      const statusOptions = rawScopes
        .filter((item) => String(item.type ?? "").toLowerCase() === "modulestatus")
        .map((item) => ({
          value: String(item.value ?? "").trim(),
          label: String(item.name ?? item.value ?? "").trim()
        }))
        .filter((item) => item.value.length > 0);
      const dedupStatuses = Array.from(new Map(statusOptions.map((item) => [item.value.toLowerCase(), item])).values());
      setStatuses(dedupStatuses);
      const pageContentOptions = rawScopes
        .filter((item) => String(item.type ?? "").toLowerCase() === "pagecontent")
        .map((item) => ({
          value: String(item.value ?? "").trim(),
          label: String(item.name ?? item.value ?? "").trim()
        }))
        .filter((item) => item.value.length > 0);
      const dedupPageContent = Array.from(new Map(pageContentOptions.map((item) => [item.value.toLowerCase(), item])).values());
      setPageContents(dedupPageContent);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [headers, t]);

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

  const visibleModules = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = modules.filter((item) => {
      const textMatch =
        term.length === 0 ||
        [item.code, item.name, item.route ?? "", item.description ?? ""].join(" ").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const scopeMatch = scopeFilter === "all" || item.scope_id === scopeFilter;
      return textMatch && statusMatch && scopeMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      const left = String(a[sortBy] ?? "").toLowerCase();
      const right = String(b[sortBy] ?? "").toLowerCase();
      if (left === right) return 0;
      const comparison = left > right ? 1 : -1;
      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [modules, search, statusFilter, scopeFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleModules.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedModules = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleModules.slice(start, start + pageSize);
  }, [safePage, visibleModules]);

  function clearFormState() {
    setForm((current) => ({
      ...defaultForm,
      status: statuses.find((item) => item.value.toLowerCase() === "active")?.value ?? statuses[0]?.value ?? current.status
    }));
    setEditingId(null);
    setIconPreview(null);
    setFormErrors({});
  }

  function openCreateForm() {
    clearFormState();
    setIsFormOpen(true);
  }

  function onEdit(item: ModuleItem) {
    setIsFormOpen(true);
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      route: item.route ?? "",
      icon: item.icon ?? "",
      sort_order: String(item.sort_order),
      status: item.status,
      parent: item.parent ?? "/",
      scope_id: item.scope_id,
      content: item.content ?? "newPage"
    });
    setIconPreview(item.icon ?? null);
    setFormErrors({});
  }

  async function onIconFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((state) => ({...state, icon: result}));
      setIconPreview(result || null);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit() {
    const errors: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.name.trim()) errors.name = t("errors.requiredName");
    if (!form.scope_id.trim()) errors.scope_id = t("errors.requiredScope");
    if (!form.sort_order.trim() || Number.isNaN(Number(form.sort_order))) {
      errors.sort_order = t("errors.numericOrder");
    }
    if (!form.status.trim()) errors.status = t("errors.requiredStatus");
    if (!form.parent.trim()) errors.parent = "parent es obligatorio. Usa '/' para raiz";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order),
        parent: form.parent,
        description: form.description || null,
        route: form.route || null,
        icon: form.icon || null
      };
      if (!editingId) {
        delete (payload as {code?: string}).code;
      }
      const response = await fetch("/api/v1/db/modules", {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editingId ? {...payload, id: editingId} : payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? t("errors.save"));
      setSuccess(editingId ? t("success.updated") : t("success.created"));
      clearFormState();
      setIsFormOpen(false);
      await loadData();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("errors.save"));
    } finally {
      setSaving(false);
    }
  }

  async function onChangeStatus(item: ModuleItem, nextStatus: "active" | "inactive") {
    const confirmation = window.confirm(
      nextStatus === "inactive"
        ? t("confirm.deactivate", {name: item.name})
        : t("confirm.reactivate", {name: item.name})
    );
    if (!confirmation) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/db/modules", {
        method: nextStatus === "inactive" ? "DELETE" : "PATCH",
        headers,
        body: JSON.stringify(nextStatus === "inactive" ? {id: item.id} : {id: item.id, status: "active"})
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? t("errors.status"));
      setSuccess(nextStatus === "inactive" ? t("success.deactivated") : t("success.reactivated"));
      await loadData();
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : t("errors.status"));
    } finally {
      setSaving(false);
    }
  }

  function setSort(column: "code" | "name" | "status" | "updated_at") {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">{t("loadingModules")}</section>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-lg font-semibold">{t("menu.application")}</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-lg bg-sky-100 px-3 py-2 font-medium text-sky-900">{t("menu.moduleConfig")}</div>
              <div className="rounded-lg px-3 py-2 text-slate-600">{t("menu.generalConfig")}</div>
              <div className="rounded-lg px-3 py-2 text-slate-600">{t("menu.labelPrint")}</div>
            </div>
          </aside>

        <article className="space-y-4">
          <header>
            <h2 className="text-2xl font-semibold">{t("title")}</h2>
            <p className="text-sm text-slate-500">{t("description")}</p>
          </header>

          {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_180px_220px_auto]">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("controls.searchPlaceholder")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive");
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">{t("controls.allStatuses")}</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <select
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">{t("controls.allScopes")}</option>
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                ))}
              </select>
              <button onClick={openCreateForm} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">{t("controls.addModule")}</button>
            </div>
          </div>

          {isFormOpen ? (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">{editingId ? t("form.edit") : t("form.create")}</div>
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.code")}</label>
                  <input
                    value={form.code}
                    disabled
                    placeholder={editingId ? t("form.immutableCode") : t("form.autoCode")}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.name")}</label>
                  <input value={form.name} onChange={(e) => setForm((s) => ({...s, name: e.target.value}))} placeholder={t("form.name")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  {formErrors.name ? <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.route")}</label>
                  <input value={form.route} onChange={(e) => setForm((s) => ({...s, route: e.target.value}))} placeholder={t("form.route")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.pageContent")}</label>
                  <select
                    value={form.content}
                    onChange={(e) => setForm((s) => ({...s, content: e.target.value}))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {pageContents.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.order")}</label>
                  <input value={form.sort_order} onChange={(e) => setForm((s) => ({...s, sort_order: e.target.value}))} placeholder={t("form.order")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  {formErrors.sort_order ? <p className="mt-1 text-xs text-rose-600">{formErrors.sort_order}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.status")}</label>
                  <select value={form.status} onChange={(e) => setForm((s) => ({...s, status: e.target.value}))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  {formErrors.status ? <p className="mt-1 text-xs text-rose-600">{formErrors.status}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.scope")}</label>
                  <select value={form.scope_id} onChange={(e) => setForm((s) => ({...s, scope_id: e.target.value}))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {scopes.map((scope) => (
                      <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                    ))}
                  </select>
                  {formErrors.scope_id ? <p className="mt-1 text-xs text-rose-600">{formErrors.scope_id}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.parent")}</label>
                  <select
                    value={form.parent}
                    onChange={(e) => setForm((s) => ({...s, parent: e.target.value}))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="/">{t("form.root")}</option>
                    {modules
                      .filter((moduleItem) => {
                        if (!moduleItem.route || moduleItem.route.trim().length === 0) return false;
                        if (!editingId) return true;
                        return moduleItem.id !== editingId;
                      })
                      .map((moduleItem) => (
                        <option key={moduleItem.id} value={moduleItem.id}>
                          {moduleItem.route}
                        </option>
                      ))}
                  </select>
                </div>
                {formErrors.parent ? <p className="mt-1 text-xs text-rose-600">{formErrors.parent}</p> : null}
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:row-span-2">
                  <label className="mb-2 block text-xs text-slate-500">{t("form.icon")}</label>
                  <input type="file" accept="image/*" onChange={(e) => void onIconFile(e.target.files?.[0] ?? null)} className="text-xs" />
                  {iconPreview ? <Image src={iconPreview} alt="Preview" width={40} height={40} className="mt-2 rounded object-cover" unoptimized /> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">{t("form.descriptionField")}</label>
                  <input value={form.description} onChange={(e) => setForm((s) => ({...s, description: e.target.value}))} placeholder={t("form.descriptionField")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button disabled={saving} onClick={() => void onSubmit()} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? t("form.saving") : editingId ? t("form.saveChanges") : t("form.createModule")}</button>
                <button
                  onClick={() => {
                    clearFormState();
                    setIsFormOpen(false);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  {t("form.cancel")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t("table.results", {count: visibleModules.length})}</span>
            <span>{t("table.pageOf", {page: safePage, total: totalPages})}</span>
          </div>

          <div className="rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2"><button className="font-medium" onClick={() => setSort("code")}>{t("table.code")}</button></th>
                  <th className="px-3 py-2"><button className="font-medium" onClick={() => setSort("name")}>{t("table.name")}</button></th>
                  <th className="px-3 py-2">{t("table.route")}</th>
                  <th className="px-3 py-2"><button className="font-medium" onClick={() => setSort("status")}>{t("table.status")}</button></th>
                  <th className="px-3 py-2"><button className="font-medium" onClick={() => setSort("updated_at")}>{t("table.updatedAt")}</button></th>
                  <th className="px-3 py-2">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedModules.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{item.code}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.route ?? "-"}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">{item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => onEdit(item)} className="rounded-md border border-slate-300 px-2 py-1">{t("actions.edit")}</button>
                        {item.status === "active" ? (
                          <button onClick={() => void onChangeStatus(item, "inactive")} className="rounded-md border border-rose-200 px-2 py-1 text-rose-600">{t("actions.deactivate")}</button>
                        ) : (
                          <button onClick={() => void onChangeStatus(item, "active")} className="rounded-md border border-emerald-200 px-2 py-1 text-emerald-700">{t("actions.reactivate")}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pagedModules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">{t("table.empty")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">{t("pagination.previous")}</button>
            <button disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">{t("pagination.next")}</button>
          </div>
        </article>
      </div>
    </section>
  );
}
