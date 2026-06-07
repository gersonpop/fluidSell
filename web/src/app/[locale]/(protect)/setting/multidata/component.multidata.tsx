"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {getSecureItem} from "@/lib/secure-store";

type Props = {
  actorId: string;
  actorRole: "SU" | "Adm" | "user";
  companyId: string | null;
};

const DEFAULT_COLUMNS = ["id", "name", "value", "type", "actions"];

export function DataManager({actorId, actorRole, companyId}: Props) {
  const t = useTranslations("AccountConfig");
  const permissions = useMemo(() => {
    if (actorRole === "SU") {
      return { read: true, create: true, update: true, delete: true };
    }
    const cacheKey = `sidebar_modules_${actorId}_${companyId ?? ""}`;
    const modules = getSecureItem<any[]>(cacheKey, actorId);
    if (modules && Array.isArray(modules)) {
      const match = modules.find((m) => m.route === "/setting/multidata");
      if (match && match.permission) {
        return match.permission as { read: boolean; create: boolean; update: boolean; delete: boolean };
      }
    }
    return { read: true, create: false, update: false, delete: false };
  }, [actorId, actorRole, companyId]);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: "success" | "warning" | "error" | "info";
    message: string;
  }>>([]);

  const showToast = useCallback((message: string, type: "success" | "warning" | "error" | "info" = "error") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    if (error) {
      showToast(error, "error");
      setError("");
    }
  }, [error, showToast]);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMode, setActionMode] = useState("add");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [newType, setNewType] = useState({type: "", typeDescription: "", typeUse: ""});
  const [form, setForm] = useState({Initials_PK: "", name: "", value: "", type: "", typeDescription: "", typeUse: "", language: ""});
  const [localCategories, setLocalCategories] = useState<any[]>([]);

  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": actorId,
      "x-actor-role": actorRole,
      "x-company-id": companyId ?? ""
    }),
    [actorId, actorRole, companyId]
  );

  const allColumns = useMemo(
    () => [
      {key: "id", label: t("table.id")},
      {key: "Initials_PK", label: t("table.Initials_PK")},
      {key: "name", label: t("table.name")},
      {key: "value", label: t("table.value")},
      {key: "type", label: t("table.type")},
      {key: "typeDescription", label: t("table.typeDescription")},
      {key: "typeUse", label: t("table.typeUse")},
      {key: "created_at", label: t("table.created_at")},
      {key: "updated_at", label: t("table.updated_at")},
      {key: "actions", label: t("table.actions")}
    ],
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/db/st_multidata", {headers});
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo cargar multidata");
      const data = Array.isArray(body?.data) ? body.data : [];
      setRows(data);
      const defaultLanguage = data.find((row: any) => String(row?.type || "") === "language")?.value;
      if (defaultLanguage) {
        setLanguage((prev) => (prev === "all" ? String(defaultLanguage) : prev));
        setForm((prev) => ({...prev, language: prev.language || String(defaultLanguage)}));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const closeMenu = () => {
      setShowColumnsMenu(false);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const languageOptions = useMemo(() => {
    return rows.filter((item) => String(item?.type || "") === "language").sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [rows]);

  const typeUseOptions = useMemo(() => {
    const set = new Set(rows.filter((item) => String(item?.type || "") === "typeUse").map((item) => String(item?.value || "")).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((item) => {
      const type = String(item?.type || "").trim();
      if (!type) return;
      if (type === "language" || type === "typeUse") return;
      if (!map.has(type)) {
        map.set(type, {
          type,
          typeDescription: String(item?.typeDescription || ""),
          typeUse: String(item?.typeUse || "")
        });
      }
    });
    localCategories.forEach((item) => {
      const type = String(item?.type || "").trim();
      if (!type) return;
      if (!map.has(type)) {
        map.set(type, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type));
  }, [rows, localCategories]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const rowType = String(row?.type || "");
      const rowLanguage = String(row?.language || "");
      if (typeFilter !== "all" && rowType !== typeFilter) return false;
      if (language !== "all" && rowLanguage && rowLanguage !== language) return false;
      if (!term) return true;
      const text = `${String(row?.id || "")} ${String(row?.Initials_PK || "")} ${String(row?.name || "")} ${String(row?.value || "")} ${rowType} ${String(row?.typeDescription || "")} ${String(row?.typeUse || "")}`.toLowerCase();
      return text.includes(term);
    });

    const sorted = [...filtered].sort((a, b) => {
      let left = a[sortBy];
      let right = b[sortBy];

      if (left === null || left === undefined) left = "";
      if (right === null || right === undefined) right = "";

      const leftStr = String(left).toLowerCase();
      const rightStr = String(right).toLowerCase();
      if (leftStr === rightStr) return 0;
      const comparison = leftStr > rightStr ? 1 : -1;
      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [rows, search, typeFilter, language, sortBy, sortDir]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, safePage, rowsPerPage]);

  const headerColumns = useMemo(() => allColumns.filter((column) => visibleColumns.has(column.key) && (column.key !== "actions" || permissions.update || permissions.delete)), [allColumns, visibleColumns, permissions.update, permissions.delete]);

  const filteredTypeRowsForForm = useMemo(
    () => rows.filter((item) => String(item?.type || "") === String(form.type || "") && (!form.language || String(item?.language || "") === String(form.language || ""))),
    [rows, form.type, form.language]
  );

  const setFormField = (name: string, value: string) => {
    setForm((prev) => ({...prev, [name]: value}));
  };

  const openAddDrawer = () => {
    setActionMode("add");
    setSelectedRow(null);
    setNewType({type: "", typeDescription: "", typeUse: ""});
    setForm({Initials_PK: "", name: "", value: "", type: "", typeDescription: "", typeUse: "", language: language === "all" ? String(languageOptions[0]?.value || "") : language});
    setLocalCategories([]);
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const openEditDrawer = (row: any) => {
    setActionMode("edit");
    setSelectedRow(row);
    setNewType({
      type: String(row?.type || ""),
      typeDescription: String(row?.typeDescription || ""),
      typeUse: String(row?.typeUse || "")
    });
    setForm({
      Initials_PK: String(row?.Initials_PK || ""),
      name: String(row?.name || ""),
      value: String(row?.value || ""),
      type: String(row?.type || ""),
      typeDescription: String(row?.typeDescription || ""),
      typeUse: String(row?.typeUse || ""),
      language: String(row?.language || "")
    });
    setLocalCategories([]);
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    window.setTimeout(() => setOpenDrawer(false), 220);
  };

  const addCategory = () => {
    if (!newType.type.trim() || !newType.typeDescription.trim() || !newType.typeUse.trim()) {
      setError("Completa nombre, descripcion y tipo de uso para agregar categoria.");
      return;
    }
    setError("");
    const addedCat = {
      type: newType.type.trim(),
      typeDescription: newType.typeDescription.trim(),
      typeUse: newType.typeUse.trim()
    };
    setLocalCategories((prev) => {
      const exists = prev.some((cat) => cat.type === addedCat.type) ||
                     categoryOptions.some((cat) => cat.type === addedCat.type);
      if (exists) return prev;
      return [...prev, addedCat];
    });
    setForm((prev) => ({
      ...prev,
      type: addedCat.type,
      typeDescription: addedCat.typeDescription,
      typeUse: addedCat.typeUse
    }));
  };

  const saveItem = async () => {
    const required = [form.Initials_PK, form.name, form.value, form.type].every((item) => String(item).trim().length > 0);
    if (!required) {
      setError("Completa Iniciales, Nombre, Valor y Categoria.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (actionMode === "edit" && selectedRow) {
        const response = await fetch("/api/v1/db/st_multidata", {
          method: "PATCH",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify({id: String(selectedRow?.value || ""), ...form})
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo actualizar");
      } else {
        const response = await fetch("/api/v1/db/st_multidata", {
          method: "POST",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify(form)
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo crear");
      }
      closeDrawer();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (valueId: any) => {
    showConfirm(
      "¿Eliminar este registro?",
      "Esta acción es irreversible y removerá el registro del catálogo auxiliar. ¿Deseas continuar?",
      async () => {
        setError("");
        try {
          const response = await fetch("/api/v1/db/st_multidata", {
            method: "DELETE",
            headers: {...headers, "content-type": "application/json"},
            body: JSON.stringify({id: String(valueId || "")})
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body?.message || "No se pudo eliminar");
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo eliminar");
        }
      },
      "Eliminar",
      "danger"
    );
  };

  const toggleColumn = (columnKey: string) => {
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
  };

  const setSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  };

  return (
    <section className="h-full w-full flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 sm:p-5">
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="buscar por..."
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 lg:max-w-[44%]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
              <option value="all">Idioma</option>
              {languageOptions.map((item) => (
                <option key={String(item?.value || "")} value={String(item?.value || "")}>{String(item?.name || "")}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
              <option value="all">Categoria</option>
              {categoryOptions.map((item) => (
                <option key={item.type} value={item.type}>{item.type}</option>
              ))}
            </select>
            <div className="relative">
              <button type="button" onClick={(event) => {event.stopPropagation(); setShowColumnsMenu((prev) => !prev);}} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
                Columnas
              </button>
              {showColumnsMenu ? (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {allColumns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={visibleColumns.has(column.key)} onChange={() => toggleColumn(column.key)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            {permissions.create && (
              <button type="button" onClick={openAddDrawer} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Agregar</button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>Total {filteredRows.length} registros</p>
          <label className="flex items-center gap-2">
            Filas por pagina:
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
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500 shrink-0">Cargando datos...</p> : null}

      {!loading ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-slate-500">
                <tr>
                  {headerColumns.map((column) => (
                    <th key={column.key} className={`px-4 py-3 ${column.key === "actions" ? "text-center" : ""}`}>
                      {column.key !== "actions" ? (
                        <button className="font-medium" onClick={() => setSort(column.key)}>{column.label}</button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={`${row?.id || row?.value || "row"}-${index}`} className="border-t border-slate-100">
                    {headerColumns.filter(c => visibleColumns.has(c.key)).map((column) => {
                      if (column.key === "id") return <td key={`id-${index}`} className="px-4 py-3">{row?.id ?? (safePage - 1) * rowsPerPage + index + 1}</td>;
                      if (column.key === "created_at") return <td key={`created-${index}`} className="px-4 py-3">{row?.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>;
                      if (column.key === "updated_at") return <td key={`updated-${index}`} className="px-4 py-3">{row?.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>;
                      if (column.key === "actions") {
                        return (
                          <td key={`actions-${index}`} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Editar (Lápiz Azul) */}
                              {permissions.update && (
                                <div className="group relative">
                                  <button
                                    type="button"
                                    onClick={() => openEditDrawer(row)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 shadow-sm hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 transition duration-150"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                      <path d="m15 5 4 4" />
                                    </svg>
                                  </button>
                                  <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                    {t("actions.edit")}
                                  </span>
                                </div>
                              )}

                              {/* Eliminar (Basura Roja) */}
                              {permissions.delete && (
                                <div className="group relative">
                                  <button
                                    type="button"
                                    onClick={() => void deleteItem(row?.value)}
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
                              )}
                            </div>
                          </td>
                        );
                      }
                      return <td key={`${column.key}-${index}`} className="px-4 py-3">{String(row?.[column.key] || "")}</td>;
                    })}
                  </tr>
                ))}
                {pagedRows.length === 0 ? (
                  <tr key="empty-multidata">
                    <td className="px-4 py-6 text-slate-500" colSpan={headerColumns.length}>No hay resultados para el filtro actual.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center shrink-0">
            <p>0 de {filteredRows.length} en seleccion</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">{t("pagination.previous")}</button>
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-white">{safePage}</span>
              <span>de {pages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(pages, prev + 1))} disabled={safePage >= pages} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">{t("pagination.next")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {openDrawer ? (
        <div className="fixed inset-0 z-50">
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`} onClick={closeDrawer} />
          <aside className={`absolute right-0 top-0 h-full w-full max-w-[560px] bg-white p-5 shadow-2xl transition-transform duration-200 ease-out ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-semibold">{actionMode === "edit" ? "Editar Item" : "Agregar Item"}</h2>
                <p className="mt-1 text-sm text-slate-500">Realiza cambios en el registro y presiona Guardar.</p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-center text-3xl font-medium">Agregar nueva categoria</h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <input
                  value={newType.type}
                  onChange={(event) => setNewType((prev) => ({...prev, type: event.target.value}))}
                  placeholder="Nombre de la categoria"
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:col-span-3"
                />
                <select
                  value={newType.typeUse}
                  onChange={(event) => setNewType((prev) => ({...prev, typeUse: event.target.value}))}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:col-span-2"
                >
                  <option value="">Tipo de uso</option>
                  {typeUseOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <input
                  value={newType.typeDescription}
                  onChange={(event) => setNewType((prev) => ({...prev, typeDescription: event.target.value}))}
                  placeholder="Descrip. categoria"
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm sm:col-span-4"
                />
                <button type="button" onClick={addCategory} className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900 sm:col-span-1">Agregar</button>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-center text-3xl font-medium">Agregar nuevo registro</h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select value={form.language} onChange={(event) => setFormField("language", event.target.value)} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm">
                  <option value="">Idioma</option>
                  {languageOptions.map((item) => (
                    <option key={String(item?.value || "")} value={String(item?.value || "")}>{String(item?.name || "")}</option>
                  ))}
                </select>
                <select
                  value={form.type}
                  onChange={(event) => {
                    const selected = categoryOptions.find((item) => item.type === event.target.value);
                    setForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                      typeDescription: selected?.typeDescription || "",
                      typeUse: selected?.typeUse || ""
                    }));
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                >
                  <option value="">Categoria</option>
                  {categoryOptions.map((item) => (
                    <option key={item.type} value={item.type}>{item.type}</option>
                  ))}
                </select>
                <input value={form.typeUse} readOnly placeholder="Tipo de uso" className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <input
                    list="initials-options"
                    value={form.Initials_PK}
                    onChange={(event) => setFormField("Initials_PK", event.target.value)}
                    placeholder="Iniciales"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                  />
                  <datalist id="initials-options">
                    {filteredTypeRowsForForm.map((item) => (
                      <option key={`i-${String(item?.value || "")}-${String(item?.Initials_PK || "")}`} value={String(item?.Initials_PK || "")} />
                    ))}
                  </datalist>
                </div>
                <input value={form.typeDescription} readOnly placeholder="Descrip. categoria" className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <input
                    list="name-options"
                    value={form.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Nombre"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                  />
                  <datalist id="name-options">
                    {filteredTypeRowsForForm.map((item) => (
                      <option key={`n-${String(item?.value || "")}-${String(item?.name || "")}`} value={String(item?.name || "")} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <input
                    list="value-options"
                    value={form.value}
                    onChange={(event) => setFormField("value", event.target.value)}
                    placeholder="Valor"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
                  />
                  <datalist id="value-options">
                    {filteredTypeRowsForForm.map((item) => (
                      <option key={`v-${String(item?.value || "")}-${String(item?.name || "")}`} value={String(item?.value || "")} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeDrawer} className="rounded-xl px-4 py-2 text-sm text-rose-600">Cancelar</button>
              <button type="button" disabled={saving} onClick={saveItem} className="rounded-2xl bg-blue-600 px-6 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Guardando..." : actionMode === "edit" ? "Guardar" : "Crear"}</button>
            </div>
          </aside>
        </div>
      ) : null}

      {confirmModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-200" onClick={() => setConfirmModal((prev) => ({...prev, isOpen: false}))} />
          <div className="relative z-10 w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all duration-200 scale-100 opacity-100 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${confirmModal.confirmVariant === "danger" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"} mb-4`}>
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
                className={`rounded-xl ${confirmModal.confirmVariant === "danger" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-slate-900"} px-5 py-2.5 text-sm font-semibold transition shadow-sm`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toasts Container */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 max-w-md w-full pointer-events-none items-center px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border transition-all duration-300 pointer-events-auto transform translate-y-0 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : toast.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : toast.type === "info"
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {toast.type === "success" && (
              <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === "warning" && (
              <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {toast.type === "info" && (
              <svg className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === "error" && (
              <svg className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 transition shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default DataManager;

