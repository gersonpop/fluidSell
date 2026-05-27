"use client";

import {useCallback, useEffect, useMemo, useState} from "react";

const DEFAULT_COLUMNS = ["name", "last_name", "user_email", "phone_number", "status", "actions"];

export function DataManager() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [openRowMenu, setOpenRowMenu] = useState<number | null>(null);
  
  // Drawer state
  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMode, setActionMode] = useState("add"); // "add" | "edit"
  const [selectedRow, setSelectedRow] = useState<any>(null);
  
  // Form State
  const [form, setForm] = useState({
    user_email: "",
    name: "",
    last_name: "",
    phone_number: "",
    dni: "",
    gender: "male",
    status: "active",
    provider: "google",
    companyId: "900000000",
    country_code: "+57",
    country_iso: "CO",
    avatar: "101",
    position: "Staff"
  });

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": "users-manager-ui",
      "x-actor-role": "SU",
      "x-company-id": ""
    }),
    []
  );

  const allColumns = useMemo(
    () => [
      {key: "id_user_pk", label: "ID Usuario"},
      {key: "name", label: "Nombre"},
      {key: "last_name", label: "Apellidos"},
      {key: "user_email", label: "Correo Electrónico"},
      {key: "phone_number", label: "Teléfono"},
      {key: "dni", label: "DNI / Cédula"},
      {key: "status", label: "Estado"},
      {key: "provider", label: "Proveedor"},
      {key: "companyId", label: "Compañía ID"},
      {key: "actions", label: "Acciones"}
    ],
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/db/users", {headers});
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo cargar la lista de usuarios");
      const data = Array.isArray(body?.data) ? body.data : [];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const closeMenu = () => setOpenRowMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = String(row?.status || "").toLowerCase();
      if (statusFilter !== "all" && rowStatus !== statusFilter) return false;
      if (!term) return true;
      const text = `${String(row?.id_user_pk || "")} ${String(row?.name || "")} ${String(row?.last_name || "")} ${String(row?.user_email || "")} ${String(row?.phone_number || "")} ${String(row?.dni || "")}`.toLowerCase();
      return text.includes(term);
    });
  }, [rows, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, safePage, rowsPerPage]);

  const headerColumns = useMemo(() => allColumns.filter((column) => visibleColumns.has(column.key)), [allColumns, visibleColumns]);

  const setFormField = (fieldName: string, value: string) => {
    setForm((prev) => ({...prev, [fieldName]: value}));
  };

  const openAddDrawer = () => {
    setActionMode("add");
    setSelectedRow(null);
    setForm({
      user_email: "",
      name: "",
      last_name: "",
      phone_number: "",
      dni: "",
      gender: "male",
      status: "active",
      provider: "google",
      companyId: "900000000",
      country_code: "+57",
      country_iso: "CO",
      avatar: "101",
      position: "Staff"
    });
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const openEditDrawer = (row: any) => {
    setActionMode("edit");
    setSelectedRow(row);
    setForm({
      user_email: String(row?.user_email || ""),
      name: String(row?.name || ""),
      last_name: String(row?.last_name || ""),
      phone_number: String(row?.phone_number || ""),
      dni: String(row?.dni || ""),
      gender: String(row?.gender || "male"),
      status: String(row?.status || "active"),
      provider: String(row?.provider || "google"),
      companyId: String(row?.companyId || "900000000"),
      country_code: String(row?.country_code || "+57"),
      country_iso: String(row?.country_iso || "CO"),
      avatar: String(row?.avatar || "101"),
      position: String(row?.position || "Staff")
    });
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    window.setTimeout(() => setOpenDrawer(false), 220);
  };

  const saveItem = async () => {
    const required = [form.user_email, form.name, form.last_name].every((item) => String(item).trim().length > 0);
    if (!required) {
      setError("Completa Correo Electrónico, Nombre y Apellidos.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (actionMode === "edit" && selectedRow) {
        const response = await fetch("/api/v1/db/users", {
          method: "PATCH",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify({id: String(selectedRow?.id_user_pk || ""), ...form})
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo actualizar");
      } else {
        const response = await fetch("/api/v1/db/users", {
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

  const deleteItem = async (rowId: any) => {
    const ok = window.confirm("¿Estás seguro de que deseas eliminar este usuario?");
    if (!ok) return;
    setError("");
    try {
      const response = await fetch("/api/v1/db/users", {
        method: "DELETE",
        headers: {...headers, "content-type": "application/json"},
        body: JSON.stringify({id: String(rowId || "")})
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo eliminar");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
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

  const getStatusBadgeClass = (status: string) => {
    const clean = String(status || "").toLowerCase().trim();
    if (clean === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (clean === "pending_approval") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  const getStatusLabel = (status: string) => {
    const clean = String(status || "").toLowerCase().trim();
    if (clean === "active") return "Activo";
    if (clean === "pending_approval") return "Pendiente";
    return "Inactivo";
  };

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar usuario por nombre, correo, dni..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white lg:max-w-[44%]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 transition"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="pending_approval">Pendientes</option>
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowColumnsMenu((prev) => !prev);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm hover:bg-slate-100 transition"
              >
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
            <button
              type="button"
              onClick={openAddDrawer}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Agregar Usuario
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>Total {filteredRows.length} usuarios encontrados</p>
          <label className="flex items-center gap-2">
            Filas por página:
            <select
              value={String(rowsPerPage)}
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 outline-none"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? <p className="mt-6 text-sm text-slate-500">Cargando usuarios...</p> : null}
      {!loading && error ? <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 font-medium">
                <tr className="border-b border-slate-200">
                  {headerColumns.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-semibold text-slate-600">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRows.map((row, index) => (
                  <tr key={`${row?.id_user_pk || "row"}-${index}`} className="hover:bg-slate-50/50 transition">
                    {headerColumns.map((column) => {
                      if (column.key === "id_user_pk") {
                        return <td key={`id-${index}`} className="px-4 py-3 font-mono text-xs text-slate-400">{String(row?.id_user_pk || "").slice(0, 14)}...</td>;
                      }
                      if (column.key === "status") {
                        const statusVal = String(row?.status || "inactive");
                        return (
                          <td key={`status-${index}`} className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(statusVal)}`}>
                              {getStatusLabel(statusVal)}
                            </span>
                          </td>
                        );
                      }
                      if (column.key === "actions") {
                        return (
                          <td key={`actions-${index}`} className="relative px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenRowMenu((prev) => (prev === index ? null : index));
                              }}
                              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-200 transition"
                            >
                              ⋮
                            </button>
                            {openRowMenu === index ? (
                              <div className="absolute right-4 z-10 mt-1 w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg text-left">
                                <button type="button" onClick={() => openEditDrawer(row)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50">Editar</button>
                                <button type="button" onClick={() => deleteItem(row?.id_user_pk)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50">Eliminar</button>
                              </div>
                            ) : null}
                          </td>
                        );
                      }
                      return <td key={`${column.key}-${index}`} className="px-4 py-3 text-slate-700">{String(row?.[column.key] || "")}</td>;
                    })}
                  </tr>
                ))}
                {pagedRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={headerColumns.length}>No se encontraron usuarios que coincidan con los filtros.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
            <p>Mostrando {pagedRows.length} de {filteredRows.length} registros</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Anterior
              </button>
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-white text-xs font-semibold">{safePage}</span>
              <span>de {pages}</span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                disabled={safePage >= pages}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      ) : null}

      {openDrawer ? (
        <div className="fixed inset-0 z-50">
          <div
            className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={closeDrawer}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-[560px] bg-white p-5 shadow-2xl transition-transform duration-200 ease-out overflow-y-auto ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{actionMode === "edit" ? "Editar Usuario" : "Agregar Nuevo Usuario"}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {actionMode === "edit" ? "Edita la información del usuario de la plataforma." : "Crea una nueva cuenta de usuario y asígnale su estado base."}
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Primer Nombre *</span>
                  <input
                    value={form.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Ej. Gerson"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Apellidos *</span>
                  <input
                    value={form.last_name}
                    onChange={(event) => setFormField("last_name", event.target.value)}
                    placeholder="Ej. Porras"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Correo Electrónico *</span>
                <input
                  type="email"
                  value={form.user_email}
                  disabled={actionMode === "edit"}
                  onChange={(event) => setFormField("user_email", event.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white disabled:opacity-50 transition"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Teléfono</span>
                  <input
                    value={form.phone_number}
                    onChange={(event) => setFormField("phone_number", event.target.value)}
                    placeholder="+573001234567"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">DNI / Documento</span>
                  <input
                    value={form.dni}
                    onChange={(event) => setFormField("dni", event.target.value)}
                    placeholder="DNI o Cédula"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Estado</span>
                  <select
                    value={form.status}
                    onChange={(event) => setFormField("status", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="pending_approval">Pendiente</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Género</span>
                  <select
                    value={form.gender}
                    onChange={(event) => setFormField("gender", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Proveedor</span>
                  <select
                    value={form.provider}
                    onChange={(event) => setFormField("provider", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                  >
                    <option value="google">Google</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Código País (Prefijo)</span>
                  <input
                    value={form.country_code}
                    onChange={(event) => setFormField("country_code", event.target.value)}
                    placeholder="+57"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">ISO País</span>
                  <input
                    value={form.country_iso}
                    onChange={(event) => setFormField("country_iso", event.target.value)}
                    placeholder="CO"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Compañía ID</span>
                  <input
                    value={form.companyId}
                    onChange={(event) => setFormField("companyId", event.target.value)}
                    placeholder="ID Compañía"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Cargo / Posición</span>
                  <input
                    value={form.position}
                    onChange={(event) => setFormField("position", event.target.value)}
                    placeholder="Staff, Manager, etc."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveItem}
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition"
              >
                {saving ? "Guardando..." : actionMode === "edit" ? "Guardar" : "Crear"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export default DataManager;