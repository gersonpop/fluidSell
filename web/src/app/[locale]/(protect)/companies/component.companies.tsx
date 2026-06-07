"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSecureItem } from "@/lib/secure-store";

const DEFAULT_COLUMNS = ["commercialName", "taxId", "sector", "city", "status", "actions"];

export function CompanyManager({
  currentUserEmail,
  isSU,
  currentUserCompanyId
}: {
  currentUserEmail?: string;
  isSU?: boolean;
  currentUserCompanyId?: string;
}) {
  const permissions = useMemo(() => {
    if (isSU) {
      return { read: true, create: true, update: true, delete: true };
    }
    const cacheKey = `sidebar_modules_${currentUserEmail}_${currentUserCompanyId ?? ""}`;
    const modules = getSecureItem<any[]>(cacheKey, currentUserEmail);
    if (modules && Array.isArray(modules)) {
      const match = modules.find((m) => m.route === "/companies");
      if (match && match.permission) {
        return match.permission as { read: boolean; create: boolean; update: boolean; delete: boolean };
      }
    }
    return { read: true, create: false, update: true, delete: false };
  }, [currentUserEmail, isSU, currentUserCompanyId]);

  const [adminAllCompanies, setAdminAllCompanies] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMode, setActionMode] = useState("edit"); // "edit" | "add"
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: "success" | "warning" | "error" | "info";
    message: string;
  }>>([]);

  const showToast = useCallback((message: string, type: "success" | "warning" | "error" | "info" = "success") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const defaultForm = {
    legalName: "",
    commercialName: "",
    taxId: "",
    sector: "",
    country: "Colombia",
    city: "",
    zone: "",
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    status: "TRIAL"
  };

  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof defaultForm, string>>>({});
  const [sectorsList, setSectorsList] = useState<any[]>([
    { value: "Tecnología", name: "Tecnología" },
    { value: "Retail / Comercio", name: "Retail / Comercio" },
    { value: "Servicios", name: "Servicios" },
    { value: "Manufactura", name: "Manufactura" },
    { value: "Logística / Transporte", name: "Logística / Transporte" },
    { value: "Salud", name: "Salud" },
    { value: "Educación", name: "Educación" },
    { value: "Construcción", name: "Construcción" },
    { value: "Financiero", name: "Financiero" },
    { value: "Alimentos y Bebidas", name: "Alimentos y Bebidas" }
  ]);

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": currentUserEmail || "anonymous",
      "x-actor-role": isSU ? "SU" : "cliente",
      "x-company-id": currentUserCompanyId || "",
      ...(isSU && adminAllCompanies ? { "x-show-all-companies": "true" } : {})
    }),
    [currentUserEmail, isSU, currentUserCompanyId, adminAllCompanies]
  );

  useEffect(() => {
    fetch("/api/v1/db/st_multidata", { headers })
      .then(res => res.json())
      .then(body => {
        if (Array.isArray(body?.data)) {
          const filtered = body.data.filter((item: any) => String(item?.type || "") === "companySector");
          if (filtered.length > 0) {
            setSectorsList(filtered);
          }
        }
      })
      .catch(err => console.error("Error loading sectors in companies:", err));
  }, [headers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // If we are NOT adminAllCompanies AND not SU, we only load the actor's own company
      // The backend filters automatically based on headers
      const res = await fetch("/api/v1/db/companies", { headers });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Error al cargar compañías");
      const list = Array.isArray(body.data) ? body.data : [];
      setRows(list);

      // If we are in single company edit mode, prefill the form
      if (!isSU || !adminAllCompanies) {
        if (list.length > 0) {
          const c = list[0];
          setForm({
            legalName: c.legalName || "",
            commercialName: c.commercialName || "",
            taxId: c.taxId || "",
            sector: c.sector || "",
            country: c.country || "Colombia",
            city: c.city || "",
            zone: c.zone || "",
            address: c.address || "",
            phone: c.phone || "",
            whatsapp: c.whatsapp || "",
            email: c.email || "",
            website: c.website || "",
            status: c.status || "TRIAL"
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [headers, isSU, adminAllCompanies]);

  useEffect(() => {
    void load();
  }, [load]);

  const validate = () => {
    const errs: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.commercialName.trim()) errs.commercialName = "El nombre comercial es requerido";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = actionMode === "edit" || (!isSU || !adminAllCompanies);
      const activeId = isEdit 
        ? (selectedRow?.id || currentUserCompanyId || (rows.length > 0 ? rows[0].id : null)) 
        : null;

      const payload = {
        ...form,
        ...(activeId ? { id: activeId } : {})
      };

      const response = await fetch("/api/v1/db/companies", {
        method: activeId ? "PATCH" : "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resBody = await response.json();
      if (!response.ok) throw new Error(resBody.message || "Error al guardar");

      showToast("Datos de la compañía guardados con éxito.", "success");
      if (isSU && adminAllCompanies) {
        closeDrawer();
      }
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al guardar datos", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = (id: string) => {
    showConfirm(
      "Eliminar Compañía",
      "¿Estás seguro de que deseas eliminar permanentemente esta compañía? Esta acción borrará la compañía y todos sus datos relacionados.",
      async () => {
        try {
          const res = await fetch("/api/v1/db/companies", {
            method: "DELETE",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ id })
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.message || "Error al eliminar");
          showToast("Compañía eliminada correctamente.", "success");
          void load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "No se pudo eliminar", "error");
        }
      }
    );
  };

  const openAddDrawer = () => {
    setActionMode("add");
    setSelectedRow(null);
    setForm(defaultForm);
    setFormErrors({});
    setOpenDrawer(true);
    setTimeout(() => setDrawerVisible(true), 25);
  };

  const openEditDrawer = (row: any) => {
    setActionMode("edit");
    setSelectedRow(row);
    setForm({
      legalName: row.legalName || "",
      commercialName: row.commercialName || "",
      taxId: row.taxId || "",
      sector: row.sector || "",
      country: row.country || "Colombia",
      city: row.city || "",
      zone: row.zone || "",
      address: row.address || "",
      phone: row.phone || "",
      whatsapp: row.whatsapp || "",
      email: row.email || "",
      website: row.website || "",
      status: row.status || "TRIAL"
    });
    setFormErrors({});
    setOpenDrawer(true);
    setTimeout(() => setDrawerVisible(true), 25);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => {
      setOpenDrawer(false);
      setSelectedRow(null);
    }, 200);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchText =
        !q ||
        [r.commercialName, r.legalName, r.taxId, r.sector, r.city, r.id]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchText && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [safePage, filteredRows, rowsPerPage]);

  return (
    <section className="flex-1 flex flex-col min-h-0 text-slate-700 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      {/* Toasts overlay */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
              t.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            <span>{t.type === "success" ? "✓" : "✕"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">{confirmModal.title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{confirmModal.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header and Switches */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100 mb-4 flex-shrink-0 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isSU && adminAllCompanies ? "Administración Global de Compañías" : "Información de la Compañía"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSU && adminAllCompanies
              ? "Lista de todas las empresas dadas de alta en la plataforma FluidSell"
              : "Visualiza y edita los datos comerciales e impositivos de tu empresa"}
          </p>
        </div>

        {isSU && (
          <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-cyan-200 bg-cyan-50/50 px-4 py-2.5 text-sm text-cyan-850 transition hover:bg-cyan-100/75 shrink-0">
            <input
              type="checkbox"
              checked={adminAllCompanies}
              onChange={(e) => {
                setAdminAllCompanies(e.target.checked);
                setPage(1);
              }}
              className="rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
            />
            <span className="font-bold text-cyan-900">Administrar todas las compañías</span>
          </label>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500 animate-pulse">
          Cargando datos...
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-rose-500 font-semibold">
          {error}
        </div>
      ) : isSU && adminAllCompanies ? (
        /* TABLE VIEW FOR SU */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between flex-shrink-0">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar compañía por nombre, nit, sector o ciudad..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white md:max-w-md"
            />
            
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 transition"
              >
                <option value="all">Todos los estados</option>
                <option value="ACTIVE">Activo (ACTIVE)</option>
                <option value="TRIAL">Prueba (TRIAL)</option>
                <option value="SUSPENDED">Suspendido</option>
                <option value="CANCELLED">Cancelado</option>
              </select>

              {permissions.create && (
                <button
                  onClick={openAddDrawer}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold px-4 py-2 transition shadow-sm"
                >
                  Agregar Compañía
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 font-medium sticky top-0 z-10 border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3 font-semibold">Compañía</th>
                  <th className="px-4 py-3 font-semibold">Tax ID / NIT</th>
                  <th className="px-4 py-3 font-semibold">Sector</th>
                  <th className="px-4 py-3 font-semibold">Ubicación</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRows.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 leading-tight">{r.commercialName || "Sin Nombre"}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 truncate">{r.legalName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.taxId || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.sector || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.city ? `📍 ${r.city}, ${r.country || "Colombia"}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase border ${
                        r.status === "ACTIVE" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-250" 
                          : r.status === "TRIAL"
                            ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {permissions.update && (
                          <button
                            type="button"
                            onClick={() => openEditDrawer(r)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
                          >
                            ✏️
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            type="button"
                            onClick={() => deleteCompany(r.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pagedRows.length === 0 && (
                  <tr key="empty-companies">
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No se encontraron compañías
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500 pt-2 border-t border-slate-100 flex-shrink-0">
            <p>Mostrando {pagedRows.length} de {filteredRows.length} compañías</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Anterior
              </button>
              <span className="rounded-lg bg-cyan-600 px-3 py-1 text-white text-xs font-semibold">{safePage}</span>
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
        </div>
      ) : (
        /* SINGLE COMPANY FORM VIEW FOR CLIENTS / SU DETACHED */
        <form onSubmit={handleSave} className="space-y-5 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre Comercial</label>
              <input
                type="text"
                value={form.commercialName}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, commercialName: e.target.value }))}
                className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition ${
                  formErrors.commercialName ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-cyan-500"
                } disabled:bg-slate-50 disabled:text-slate-500`}
              />
              {formErrors.commercialName && (
                <p className="mt-1 text-2xs text-rose-500 font-semibold">{formErrors.commercialName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Razón Social</label>
              <input
                type="text"
                value={form.legalName}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Identificación Fiscal / NIT</label>
              <input
                type="text"
                value={form.taxId}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, taxId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Sector Comercial</label>
              <select
                value={form.sector}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 font-semibold bg-white"
              >
                <option value="">Seleccione un sector...</option>
                {sectorsList.map((sec) => (
                  <option key={sec.value} value={sec.value}>
                    {sec.name}
                  </option>
                ))}
                {form.sector && !sectorsList.some(s => s.value === form.sector) && (
                  <option value={form.sector}>{form.sector}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">País</label>
              <input
                type="text"
                value={form.country}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Ciudad</label>
              <input
                type="text"
                value={form.city}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Dirección Física</label>
              <input
                type="text"
                value={form.address}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Teléfono de Contacto</label>
              <input
                type="text"
                value={form.phone}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">WhatsApp Business</label>
              <input
                type="text"
                value={form.whatsapp}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Email de Contacto</label>
              <input
                type="email"
                value={form.email}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Sitio Web</label>
              <input
                type="text"
                value={form.website}
                disabled={!permissions.update}
                onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Estado de Suscripción</label>
              <select
                value={form.status}
                disabled={true} // Non-SU cannot edit status directly (it's managed by billing/SU)
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none disabled:text-slate-500 select-none cursor-not-allowed"
              >
                <option value="ACTIVE">Activo (ACTIVE)</option>
                <option value="TRIAL">Prueba (TRIAL)</option>
                <option value="SUSPENDED">Suspendido</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
          </div>

          {permissions.update && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm px-6 py-2.5 shadow-sm transition disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Drawer overlay for SU (Adding/Editing a company record) */}
      {openDrawer && (
        <div className="fixed inset-0 z-50">
          <div
            className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-200 ${
              drawerVisible ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeDrawer}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-lg bg-white p-6 shadow-2xl transition-transform duration-200 ease-out overflow-y-auto ${
              drawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {actionMode === "add" ? "Agregar Compañía" : "Editar Compañía"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Completa los campos comerciales de la compañía
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="text-2xl text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre Comercial*</label>
                <input
                  type="text"
                  value={form.commercialName}
                  onChange={(e) => setForm((prev) => ({ ...prev, commercialName: e.target.value }))}
                  className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${
                    formErrors.commercialName ? "border-rose-450 focus:border-rose-500" : "border-slate-200 focus:border-cyan-500"
                  }`}
                />
                {formErrors.commercialName && (
                  <p className="mt-1 text-2xs text-rose-500 font-semibold">{formErrors.commercialName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Razón Social</label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Identificación Fiscal / NIT</label>
                  <input
                    type="text"
                    value={form.taxId}
                    onChange={(e) => setForm((prev) => ({ ...prev, taxId: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Sector Comercial</label>
                  <select
                    value={form.sector}
                    onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 bg-white"
                  >
                    <option value="">Seleccione un sector...</option>
                    {sectorsList.map((sec) => (
                      <option key={sec.value} value={sec.value}>
                        {sec.name}
                      </option>
                    ))}
                    {form.sector && !sectorsList.some(s => s.value === form.sector) && (
                      <option value={form.sector}>{form.sector}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">País</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Ciudad</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Dirección Física</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Teléfono</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">WhatsApp</label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Sitio Web</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Estado de Suscripción</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500"
                >
                  <option value="ACTIVE">Activo (ACTIVE)</option>
                  <option value="TRIAL">Prueba (TRIAL)</option>
                  <option value="SUSPENDED">Suspendido</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm px-5 py-2.5 shadow-sm transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
