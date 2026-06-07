"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSecureItem } from "@/lib/secure-store";

const DEFAULT_COLUMNS = ["commercialName", "legalName", "taxId", "phone", "status", "actions"];

export function DataManager({ currentUserEmail, currentUserImage, currentUserProvider, isSU, currentUserCompanyId, currentUserRole }: { currentUserEmail?: string; currentUserImage?: string; currentUserProvider?: string; isSU?: boolean; currentUserCompanyId?: string; currentUserRole?: string }) {
  const permissions = useMemo(() => {
    if (isSU) {
      return { read: true, create: true, update: true, delete: true };
    }
    const cacheKey = `sidebar_modules_${currentUserEmail}_${currentUserCompanyId ?? ""}`;
    const modules = getSecureItem<any[]>(cacheKey, currentUserEmail);
    if (modules && Array.isArray(modules)) {
      const match = modules.find((m) => m.route === "/companies/manager");
      if (match && match.permission) {
        return match.permission as { read: boolean; create: boolean; update: boolean; delete: boolean };
      }
    }
    return { read: true, create: false, update: false, delete: false };
  }, [currentUserEmail, isSU, currentUserCompanyId]);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
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

  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMode, setActionMode] = useState("add"); // "add" | "edit"
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const [viewingDetailsRow, setViewingDetailsRow] = useState<any>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"principal" | "contacto" | "ubicacion" | "sucursales" | "colaboradores">("principal");
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
  const [citiesList, setCitiesList] = useState<any[]>([]);
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

  // Sucursales local storage/session persistence cache
  const [sucursalesCache, setSucursalesCache] = useState<Record<string, any[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("fluidsell_sucursales_cache");
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("fluidsell_sucursales_cache", JSON.stringify(sucursalesCache));
    }
  }, [sucursalesCache]);

  const defaultSucursalForm = {
    name: "",
    address: "",
    city: "",
    phone: "",
    type: "Física"
  };
  const [sucursalForm, setSucursalForm] = useState(defaultSucursalForm);

  const currentDetailsRow = useMemo(() => {
    if (!viewingDetailsRow) return null;
    return rows.find((r) => r.id === viewingDetailsRow.id) || viewingDetailsRow;
  }, [rows, viewingDetailsRow]);

  const currentSucursales = useMemo(() => {
    if (!currentDetailsRow) return [];
    const compId = currentDetailsRow.id;
    if (sucursalesCache[compId]) {
      return sucursalesCache[compId];
    }
    return [
      {
        id: `matriz-${compId}`,
        name: "Casa Matriz",
        address: currentDetailsRow.address || "Dirección Principal",
        city: currentDetailsRow.city || "Ciudad Principal",
        phone: currentDetailsRow.phone || "Teléfono Principal",
        type: "Principal"
      }
    ];
  }, [currentDetailsRow, sucursalesCache]);

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
    onConfirm: () => { }
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
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      confirmLabel,
      confirmVariant
    });
  };

  const defaultForm = {
    commercialName: "",
    legalName: "",
    taxId: "",
    sector: "",
    country: "",
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

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": currentUserEmail ?? "companies-manager-ui",
      "x-actor-role": isSU ? "SU" : (currentUserRole || "cliente"),
      "x-company-id": currentUserCompanyId ?? ""
    }),
    [currentUserEmail, isSU, currentUserRole, currentUserCompanyId]
  );

  const allColumns = useMemo(
    () => {
      const cols = [
        { key: "id", label: "ID Compañía" },
        { key: "commercialName", label: "Nombre Comercial" },
        { key: "legalName", label: "Razón Social" },
        { key: "taxId", label: "NIT / Tax ID" },
        { key: "sector", label: "Sector" },
        { key: "phone", label: "Teléfono" },
        { key: "status", label: "Estado" }
      ];
      if (permissions.update || permissions.delete) {
        cols.push({ key: "actions", label: "Acciones" });
      }
      return cols;
    },
    [permissions]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/db/companies", { headers });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo cargar la lista de compañías");
      setRows(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al cargar datos", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && rows.length > 0 && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
      const userComp = rows.find((r) => r.id === currentUserCompanyId);
      if (userComp) {
        setViewingDetailsRow(userComp);
        setIsEditing(false);
        setForm({
          commercialName: String(userComp.commercialName || ""),
          legalName: String(userComp.legalName || ""),
          taxId: String(userComp.taxId || ""),
          sector: String(userComp.sector || ""),
          country: String(userComp.country || ""),
          city: String(userComp.city || ""),
          zone: String(userComp.zone || ""),
          address: String(userComp.address || ""),
          phone: String(userComp.phone || ""),
          whatsapp: String(userComp.whatsapp || ""),
          email: String(userComp.email || ""),
          website: String(userComp.website || ""),
          status: String(userComp.status || "TRIAL")
        });
      }
    }
  }, [loading, rows, currentUserCompanyId, hasInitiallyLoaded]);

  const loadCollaborators = useCallback(async () => {
    try {
      const [resUsers, resRoles, resAssignments, resCities, resMultidata] = await Promise.all([
        fetch("/api/v1/db/users", { headers }),
        fetch("/api/v1/db/roles", { headers }),
        fetch("/api/v1/db/role_assignments", { headers }),
        fetch("/api/v1/db/st_city", { headers }).catch(() => null),
        fetch("/api/v1/db/st_multidata", { headers }).catch(() => null)
      ]);

      const dataUsers = await resUsers.json();
      const dataRoles = await resRoles.json();
      const dataAssignments = await resAssignments.json();
      const dataCities = resCities ? await resCities.json() : null;
      const dataMultidata = resMultidata ? await resMultidata.json() : null;

      if (resUsers.ok && Array.isArray(dataUsers?.data)) {
        setUsersList(dataUsers.data);
      }
      if (resRoles.ok && Array.isArray(dataRoles?.data)) {
        setRolesList(dataRoles.data);
      }
      if (resAssignments.ok && Array.isArray(dataAssignments?.data)) {
        setAssignmentsList(dataAssignments.data);
      }
      if (dataCities && Array.isArray(dataCities?.data)) {
        setCitiesList(dataCities.data);
      }
      if (dataMultidata && Array.isArray(dataMultidata?.data)) {
        const filteredSectors = dataMultidata.data.filter((item: any) => String(item?.type || "") === "companySector");
        if (filteredSectors.length > 0) {
          setSectorsList(filteredSectors);
        }
      }
    } catch (err) {
      console.error("Error loading collaborators:", err);
    }
  }, [headers]);

  useEffect(() => {
    void loadCollaborators();
  }, [loadCollaborators]);

  const companyCollaborators = useMemo(() => {
    if (!currentDetailsRow) return [];
    return usersList.filter((u) => u.companyId === currentDetailsRow.id);
  }, [usersList, currentDetailsRow]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = String(row?.status || "").toLowerCase();
      if (statusFilter !== "all" && rowStatus !== statusFilter) return false;
      if (!term) return true;
      const text = `${String(row?.id || "")} ${String(row?.commercialName || "")} ${String(row?.legalName || "")} ${String(row?.taxId || "")} ${String(row?.sector || "")} ${String(row?.phone || "")} ${String(row?.email || "")}`.toLowerCase();
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

  const setFormField = (fieldName: keyof typeof defaultForm, value: string) => {
    setForm((prev) => ({ ...prev, [fieldName]: value }));
  };

  const openAddDrawer = () => {
    if (!isSU) {
      showToast("Solo el Super Usuario puede registrar nuevas compañías.", "warning");
      return;
    }
    setIsAdding(true);
    setIsEditing(false);
    setViewingDetailsRow(null);
    setForm(defaultForm);
    setFormErrors({});
    setActiveDetailsTab("principal");
  };

  const openEditDrawer = (row: any) => {
    if (!isSU && row.id !== currentUserCompanyId) {
      showToast("No tienes permisos para editar la configuración de otra compañía.", "warning");
      return;
    }
    setViewingDetailsRow(row);
    setIsAdding(false);
    setIsEditing(true);
    setForm({
      commercialName: String(row?.commercialName || ""),
      legalName: String(row?.legalName || ""),
      taxId: String(row?.taxId || ""),
      sector: String(row?.sector || ""),
      country: String(row?.country || ""),
      city: String(row?.city || ""),
      zone: String(row?.zone || ""),
      address: String(row?.address || ""),
      phone: String(row?.phone || ""),
      whatsapp: String(row?.whatsapp || ""),
      email: String(row?.email || ""),
      website: String(row?.website || ""),
      status: String(row?.status || "TRIAL")
    });
    setFormErrors({});
    setActiveDetailsTab("principal");
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    window.setTimeout(() => setOpenDrawer(false), 220);
  };

  const openAddSucursalDrawer = () => {
    setSucursalForm(defaultSucursalForm);
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const addSucursal = (newSucursal: any) => {
    if (!currentDetailsRow) return;
    const compId = currentDetailsRow.id;
    const existing = sucursalesCache[compId] || [
      {
        id: `matriz-${compId}`,
        name: "Casa Matriz",
        address: currentDetailsRow.address || "Dirección Principal",
        city: currentDetailsRow.city || "Ciudad Principal",
        phone: currentDetailsRow.phone || "Teléfono Principal",
        type: "Principal"
      }
    ];
    const updated = [...existing, { id: `branch-${Date.now()}`, ...newSucursal }];
    setSucursalesCache(prev => ({ ...prev, [compId]: updated }));
    showToast("Sucursal agregada exitosamente.", "success");
    closeDrawer();
  };

  const handleSaveSucursal = () => {
    if (!sucursalForm.name.trim() || !sucursalForm.address.trim() || !sucursalForm.city.trim() || !sucursalForm.phone.trim()) {
      showToast("Por favor, completa todos los campos requeridos (*).", "warning");
      return;
    }
    addSucursal(sucursalForm);
  };

  const handleCancel = () => {
    if (isEditing && viewingDetailsRow) {
      setIsEditing(false);
      setForm({
        commercialName: String(viewingDetailsRow.commercialName || ""),
        legalName: String(viewingDetailsRow.legalName || ""),
        taxId: String(viewingDetailsRow.taxId || ""),
        sector: String(viewingDetailsRow.sector || ""),
        country: String(viewingDetailsRow.country || ""),
        city: String(viewingDetailsRow.city || ""),
        zone: String(viewingDetailsRow.zone || ""),
        address: String(viewingDetailsRow.address || ""),
        phone: String(viewingDetailsRow.phone || ""),
        whatsapp: String(viewingDetailsRow.whatsapp || ""),
        email: String(viewingDetailsRow.email || ""),
        website: String(viewingDetailsRow.website || ""),
        status: String(viewingDetailsRow.status || "TRIAL")
      });
      setFormErrors({});
    } else {
      setViewingDetailsRow(null);
      setIsAdding(false);
      setIsEditing(false);
      setForm(defaultForm);
      setFormErrors({});
    }
  };

  const validate = () => {
    const errs: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.commercialName.trim()) errs.commercialName = "El nombre comercial es requerido";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveItem = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = viewingDetailsRow !== null;
      const response = await fetch("/api/v1/db/companies", {
        method: isEdit ? "PATCH" : "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(isEdit ? { id: viewingDetailsRow.id, ...form } : form)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "No se pudo guardar la compañía");

      showToast(isEdit ? "Compañía actualizada exitosamente." : "Compañía registrada exitosamente.", "success");

      if (isEdit) {
        await load();
        setViewingDetailsRow((prev: any) => ({ ...prev, ...form }));
        setIsEditing(false);
      } else {
        setIsAdding(false);
        await load();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al guardar compañía", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (rowId: any) => {
    if (!isSU) {
      showToast("Solo el Super Usuario puede eliminar compañías del sistema.", "warning");
      return;
    }
    showConfirm(
      "¿Eliminar esta compañía?",
      "Esta acción eliminará definitivamente la compañía y todos los datos asociados del sistema. ¿Deseas continuar?",
      async () => {
        try {
          const response = await fetch("/api/v1/db/companies", {
            method: "DELETE",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ id: String(rowId || "") })
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body?.message || "No se pudo eliminar");
          showToast("Compañía eliminada exitosamente.", "success");
          await load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "No se pudo eliminar", "error");
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

  const getStatusBadgeClass = (status: string) => {
    const clean = String(status || "").toUpperCase().trim();
    if (clean === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (clean === "SUSPENDED") return "bg-amber-50 text-amber-700 border-amber-200";
    if (clean === "TRIAL") return "bg-blue-50 text-blue-700 border-blue-200";
    if (clean === "CANCELLED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-slate-50 text-slate-500 border-slate-200";
  };

  const canEditCompany = (companyId: string) => {
    return permissions.update && (isSU || companyId === currentUserCompanyId);
  };

  const canDeleteCompany = (companyId: string) => {
    return permissions.delete && isSU;
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 overflow-hidden text-slate-700 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        {currentDetailsRow || isAdding ? (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {/* Header with Title and Close Button */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 pb-3.5 mb-5 select-none">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {isAdding ? "Registrar Compañía" : "Detalles de Compañía"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdding ? "Registra una nueva empresa en el sistema." : "Visualiza y gestiona la información de la empresa."}
                </p>
              </div>
              {isSU && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-2xl text-slate-400 hover:text-slate-655 transition cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* Split Panel */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden gap-6">

              {/* LEFT COLUMN: Profile Info Summary (w-full md:w-72 lg:w-80) */}
              <div className="w-full md:w-54 lg:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6 flex flex-col items-center">
                {/* Circle Avatar / Logo */}
                <div className="h-50 w-50 rounded-full border-4 border-white shadow-md relative overflow-hidden bg-slate-50 flex items-center justify-center select-none uppercase ring-1 ring-slate-200">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-3xl font-extrabold text-white">
                    {(isAdding ? (form.commercialName || "?") : (currentDetailsRow.commercialName || "C")).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                  </div>
                </div>

                {/* Company Name */}
                <h3 className="text-xl font-bold text-slate-800 text-center mt-4 truncate w-full px-2 leading-tight">
                  {isAdding ? (form.commercialName || "Nueva Compañía") : currentDetailsRow.commercialName}
                </h3>

                {/* Status Badge */}
                <span className={`mt-2 inline-flex items-center px-3.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-sm select-none ${getStatusBadgeClass(isAdding ? form.status : currentDetailsRow.status)}`}>
                  {getStatusLabel(isAdding ? form.status : currentDetailsRow.status)}
                </span>

                {/* Divider */}
                <div className="w-full border-b border-slate-100 my-5" />

                {/* Info Rows */}
                <div className="w-full space-y-4 px-2 select-none">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">ID Compañía</span>
                    <span className="text-slate-800 text-sm font-semibold font-mono block mt-0.5 select-all">
                      {isAdding ? "—" : currentDetailsRow.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">NIT / Tax ID</span>
                    <span className="text-slate-800 text-sm font-semibold font-mono block mt-0.5 select-all">
                      {(isAdding ? form.taxId : currentDetailsRow.taxId) || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">Correo Electrónico</span>
                    <span className="text-slate-800 text-sm font-semibold block mt-0.5 truncate select-all">
                      {(isAdding ? form.email : currentDetailsRow.email) || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">Sitio Web</span>
                    <span className="text-slate-800 text-sm font-semibold block mt-0.5 truncate">
                      {(isAdding ? form.website : currentDetailsRow.website) || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Tab Navigation & Input Form Fields (w-full md:flex-1) */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                {/* Selector de Pestañas (Tabs) */}
                <div className="flex-shrink-0 flex border-b border-slate-200 mb-5 select-none">
                  {(["principal", "contacto", "ubicacion", "sucursales", "colaboradores"] as const).map((tabId) => {
                    const isDisabled = isAdding && (tabId === "sucursales" || tabId === "colaboradores");
                    const tabLabels = {
                      principal: "Información General",
                      contacto: "Contacto",
                      ubicacion: "Ubicación",
                      sucursales: "Sucursales",
                      colaboradores: "Colaboradores"
                    };
                    return (
                      <button
                        key={tabId}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setActiveDetailsTab(tabId)}
                        className={`pb-3 px-4 text-center text-sm font-semibold border-b-2 transition duration-205 cursor-pointer capitalize disabled:opacity-40 disabled:cursor-not-allowed ${activeDetailsTab === tabId
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-400 hover:text-slate-655"
                          }`}
                      >
                        {tabLabels[tabId]}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Contents */}
                <div className="flex-1 min-h-0 pb-6">
                  {activeDetailsTab === "principal" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600">Nombre Comercial *</span>
                        <input
                          value={form.commercialName}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("commercialName", event.target.value)}
                          placeholder="Ej. FluidSell LatinAmerica"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                        {formErrors.commercialName ? <p className="text-xs text-red-500 mt-1">{formErrors.commercialName}</p> : null}
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600">Razón Social / Razón Legal</span>
                        <input
                          value={form.legalName}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("legalName", event.target.value)}
                          placeholder="Ej. FluidSell S.A.S."
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">NIT / Tax ID</span>
                        <input
                          value={form.taxId}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("taxId", event.target.value)}
                          placeholder="Ej. 900.123.456-7"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-mono text-xs font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">Sector Industrial</span>
                        <select
                          value={form.sector}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("sector", event.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
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
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600">Estado de Suscripción</span>
                        <select
                          value={form.status}
                          disabled={!isAdding && (!isEditing || !isSU)}
                          onChange={(event) => setFormField("status", event.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        >
                          <option value="ACTIVE">Activo</option>
                          <option value="SUSPENDED">Suspendido</option>
                          <option value="TRIAL">Prueba</option>
                          <option value="CANCELLED">Cancelado</option>
                        </select>
                      </label>
                    </div>
                  )}

                  {activeDetailsTab === "contacto" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">País / Prefijo</span>
                        <input
                          type="text"
                          value="Colombia (57)"
                          disabled
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">Teléfono Corporativo *</span>
                        <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-slate-50/50 focus-within:border-blue-500 focus-within:bg-white transition duration-200 overflow-hidden">
                          <span className="flex items-center justify-center bg-slate-100/80 px-3.5 text-sm font-semibold text-slate-500 border-r border-slate-200 select-none">
                            +57
                          </span>
                          <input
                            value={form.phone}
                            disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                            onChange={(event) => setFormField("phone", event.target.value)}
                            placeholder="3001234567"
                            className="w-full bg-transparent px-4 py-2.5 text-sm text-slate-800 outline-none disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">WhatsApp Oficial</span>
                        <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-slate-50/50 focus-within:border-blue-500 focus-within:bg-white transition duration-200 overflow-hidden">
                          <span className="flex items-center justify-center bg-slate-100/80 px-3.5 text-sm font-semibold text-slate-500 border-r border-slate-200 select-none">
                            +57
                          </span>
                          <input
                            value={form.whatsapp}
                            disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                            onChange={(event) => setFormField("whatsapp", event.target.value)}
                            placeholder="3007654321"
                            className="w-full bg-transparent px-4 py-2.5 text-sm text-slate-800 outline-none disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">Email Corporativo *</span>
                        <input
                          type="email"
                          value={form.email}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("email", event.target.value)}
                          placeholder="Ej. contacto@empresa.com"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600">Sitio Web</span>
                        <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-slate-50/50 focus-within:border-blue-500 focus-within:bg-white transition duration-200 overflow-hidden">
                          <span className="flex items-center justify-center bg-slate-100/80 px-3.5 text-sm font-semibold text-slate-500 border-r border-slate-200 select-none">
                            https://
                          </span>
                          <input
                            value={form.website.replace(/^https?:\/\//, "")}
                            disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                            onChange={(event) => setFormField("website", event.target.value ? "https://" + event.target.value.replace(/^https?:\/\//, "") : "")}
                            placeholder="www.empresa.com"
                            className="w-full bg-transparent px-4 py-2.5 text-sm text-blue-600 hover:text-blue-750 outline-none disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                          />
                        </div>
                      </label>
                    </div>
                  )}

                  {activeDetailsTab === "ubicacion" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600">Dirección Física</span>
                        <input
                          value={form.address}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("address", event.target.value)}
                          placeholder="Ej. Calle 100 #15-20"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">Ciudad</span>
                        <input
                          value={form.city}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("city", event.target.value)}
                          placeholder="Ej. Bogotá"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-600">Zona / Región</span>
                        <input
                          value={form.zone}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("zone", event.target.value)}
                          placeholder="Ej. Norte"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600">País</span>
                        <input
                          value={form.country}
                          disabled={!isAdding && (!isEditing || !canEditCompany(currentDetailsRow?.id))}
                          onChange={(event) => setFormField("country", event.target.value)}
                          placeholder="Ej. Colombia"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 disabled:bg-slate-100/60 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
                        />
                      </label>
                    </div>
                  )}

                  {activeDetailsTab === "sucursales" && !isAdding && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center select-none">
                        <h3 className="text-sm font-bold text-slate-800">Sucursales Registradas</h3>
                        {(isSU || (currentDetailsRow && currentDetailsRow.id === currentUserCompanyId)) && (
                          <button
                            type="button"
                            onClick={openAddSucursalDrawer}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm cursor-pointer"
                          >
                            + Agregar Sucursal
                          </button>
                        )}
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-slate-50 text-left text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5 font-semibold">Nombre</th>
                              <th className="px-4 py-2.5 font-semibold">Dirección</th>
                              <th className="px-4 py-2.5 font-semibold">Ciudad</th>
                              <th className="px-4 py-2.5 font-semibold">Teléfono</th>
                              <th className="px-4 py-2.5 font-semibold">Tipo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {currentSucursales.map((branch: any) => (
                              <tr key={branch.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-4 py-3 font-semibold text-slate-800">{branch.name}</td>
                                <td className="px-4 py-3 text-slate-650">{branch.address}</td>
                                <td className="px-4 py-3 text-slate-600">{branch.city}</td>
                                <td className="px-4 py-3 text-slate-600">{branch.phone}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold border ${branch.type === "Principal"
                                    ? "bg-blue-50 text-blue-600 border-blue-150"
                                    : branch.type === "Virtual"
                                      ? "bg-purple-50 text-purple-600 border-purple-150"
                                      : branch.type === "Depósito"
                                        ? "bg-amber-50 text-amber-600 border-amber-150"
                                        : "bg-emerald-50 text-emerald-600 border-emerald-150"
                                    }`}>
                                    {branch.type}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeDetailsTab === "colaboradores" && !isAdding && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center select-none">
                        <h3 className="text-sm font-bold text-slate-800">Colaboradores de la Empresa</h3>
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100 shadow-sm">
                          {companyCollaborators.length} {companyCollaborators.length === 1 ? "Colaborador" : "Colaboradores"}
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-slate-50 text-left text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5 font-semibold">Nombre</th>
                              <th className="px-4 py-2.5 font-semibold">Teléfono</th>
                              <th className="px-4 py-2.5 font-semibold">Ciudad</th>
                              <th className="px-4 py-2.5 font-semibold">Cargo</th>
                              <th className="px-4 py-2.5 font-semibold">Rol</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {companyCollaborators.map((user: any) => {
                              const fullName = `${user.name || ""} ${user.lastName || ""}`.trim() || user.username || "Colaborador sin nombre";
                              const cityMatch = citiesList.find((c) => c.code === user.cityCode);
                              const cityName = cityMatch ? cityMatch.name : (user.cityCode || "—");

                              const assignment = assignmentsList.find((a) => a.platform_user_id === user.idUserPk);
                              const role = assignment ? rolesList.find((r) => r.id === assignment.roleId) : null;

                              return (
                                <tr key={user.idUserPk} className="hover:bg-slate-50/50 transition">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      {user.avatar ? (
                                        <img src={user.avatar} alt={fullName} className="h-6 w-6 rounded-full object-cover border border-slate-200" />
                                      ) : (
                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 select-none uppercase">
                                          {fullName.slice(0, 2)}
                                        </div>
                                      )}
                                      <span className="font-semibold text-slate-800">{fullName}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-655">{user.phoneNumber || "—"}</td>
                                  <td className="px-4 py-3 text-slate-600">{cityName}</td>
                                  <td className="px-4 py-3 text-slate-600 font-medium">{user.position || "—"}</td>
                                  <td className="px-4 py-3">
                                    {role ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-100">
                                        {role.name}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic text-xs">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {companyCollaborators.length === 0 ? (
                              <tr key="empty-collaborators">
                                <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                                  No hay colaboradores registrados para esta compañía.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTTOM SAVE/CANCEL CONTROLS */}
                {isAdding || isEditing ? (
                  <div className="flex-shrink-0 mt-auto pt-4 border-t border-slate-100 flex justify-end gap-3 select-none">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition duration-150 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveItem}
                      className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition cursor-pointer"
                    >
                      {saving ? "Guardando..." : isAdding ? "Crear Compañía" : "Guardar Cambios"}
                    </button>
                  </div>
                ) : (
                  <div className="flex-shrink-0 mt-auto pt-4 border-t border-slate-100 flex justify-end gap-3 select-none">
                    {isSU && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition duration-150 cursor-pointer"
                      >
                        ver mas empresas
                      </button>
                    )}
                    {currentDetailsRow && canEditCompany(currentDetailsRow.id) && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition duration-150 cursor-pointer"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar compañía por nombre, nit, sector..."
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
                  <option value="ACTIVE">Activos</option>
                  <option value="SUSPENDED">Suspendidos</option>
                  <option value="TRIAL">Pruebas</option>
                  <option value="CANCELLED">Cancelados</option>
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
                {permissions.create && isSU ? (
                  <button
                    type="button"
                    onClick={openAddDrawer}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                  >
                    Agregar Compañía
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500 flex-shrink-0">
              <p>Total {filteredRows.length} compañías encontradas</p>
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

            {loading ? <p className="flex-shrink-0 mt-6 text-sm text-slate-500">Cargando compañías...</p> : null}

            {!loading ? (
              <>
                <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 min-h-0 bg-white">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500 font-medium sticky top-0 z-10 border-b border-slate-200 select-none">
                      <tr className="border-b border-slate-200">
                        {headerColumns.map((column) => (
                          <th key={column.key} className={`px-4 py-3 font-semibold text-slate-600 ${column.key === "actions" ? "text-center" : ""}`}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedRows.map((row, index) => (
                        <tr key={`${row?.id || "row"}-${index}`} className="hover:bg-slate-50/50 transition">
                          {headerColumns.map((column) => {
                            if (column.key === "id") {
                              return <td key={`id-${index}`} className="px-4 py-3 font-mono text-xs text-slate-400">{String(row?.id || "")}</td>;
                            }
                            if (column.key === "commercialName") {
                              const name = row.commercialName || "Compañía sin nombre";
                              const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                              return (
                                <td key={`comm-${index}`} className="px-4 py-3.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingDetailsRow(row);
                                      setIsEditing(false);
                                      setForm({
                                        commercialName: String(row?.commercialName || ""),
                                        legalName: String(row?.legalName || ""),
                                        taxId: String(row?.taxId || ""),
                                        sector: String(row?.sector || ""),
                                        country: String(row?.country || ""),
                                        city: String(row?.city || ""),
                                        zone: String(row?.zone || ""),
                                        address: String(row?.address || ""),
                                        phone: String(row?.phone || ""),
                                        whatsapp: String(row?.whatsapp || ""),
                                        email: String(row?.email || ""),
                                        website: String(row?.website || ""),
                                        status: String(row?.status || "TRIAL")
                                      });
                                      setActiveDetailsTab("principal");
                                    }}
                                    className="flex items-center gap-3 hover:opacity-80 text-left focus:outline-none transition group select-none"
                                  >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm uppercase">
                                      {initials}
                                    </div>
                                    <span className="font-semibold text-slate-800 truncate group-hover:text-blue-600 group-hover:underline">{name}</span>
                                  </button>
                                </td>
                              );
                            }
                            if (column.key === "legalName") {
                              return <td key={`legal-${index}`} className="px-4 py-3 text-slate-600">{row.legalName || "—"}</td>;
                            }
                            if (column.key === "taxId") {
                              return <td key={`tax-${index}`} className="px-4 py-3 text-slate-600 font-mono text-xs">{row.taxId || "—"}</td>;
                            }
                            if (column.key === "sector") {
                              return <td key={`sector-${index}`} className="px-4 py-3 text-slate-600">{row.sector || "—"}</td>;
                            }
                            if (column.key === "phone") {
                              return <td key={`phone-${index}`} className="px-4 py-3 text-slate-600">{row.phone || "—"}</td>;
                            }
                            if (column.key === "status") {
                              const statusVal = String(row?.status || "TRIAL");
                              return (
                                <td key={`status-${index}`} className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(statusVal)}`}>
                                    {getStatusLabel(statusVal)}
                                  </span>
                                </td>
                              );
                            }
                            if (column.key === "actions") {
                              const canEdit = canEditCompany(row.id);
                              const canDelete = canDeleteCompany(row.id);
                              return (
                                <td key={`actions-${index}`} className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Editar */}
                                    {canEdit ? (
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
                                          Editar
                                        </span>
                                      </div>
                                    ) : null}

                                    {/* Eliminar */}
                                    {canDelete ? (
                                      <div className="group relative">
                                        <button
                                          type="button"
                                          onClick={() => void deleteItem(row?.id)}
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
                                    ) : null}
                                  </div>
                                </td>
                              );
                            }
                            return <td key={`${column.key}-${index}`} className="px-4 py-3 text-slate-700">{String(row?.[column.key] || "")}</td>;
                          })}
                        </tr>
                      ))}
                      {pagedRows.length === 0 ? (
                        <tr key="empty-companies">
                          <td className="px-4 py-8 text-center text-slate-400" colSpan={headerColumns.length}>No se encontraron compañías que coincidan con los filtros.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row flex-shrink-0 pt-2 border-t border-slate-100">
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
          </>
        )}
      </div>

      {openDrawer ? (
        <div className="fixed inset-0 z-50">
          <div
            className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={closeDrawer}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-[500px] bg-white p-6 shadow-2xl transition-transform duration-250 ease-out overflow-y-auto ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 select-none">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Agregar Sucursal</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Registra una nueva sucursal física, virtual o depósito para la compañía actual.
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-2xl text-slate-400 hover:text-slate-655">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nombre de la Sucursal *</span>
                <input
                  value={sucursalForm.name}
                  onChange={(event) => setSucursalForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ej. Sucursal Norte / Centro de Distribución"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Dirección Física *</span>
                <input
                  value={sucursalForm.address}
                  onChange={(event) => setSucursalForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Ej. Avenida Principal #45-12"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Ciudad *</span>
                  <input
                    value={sucursalForm.city}
                    onChange={(event) => setSucursalForm((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="Ej. Bogotá"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Teléfono *</span>
                  <input
                    value={sucursalForm.phone}
                    onChange={(event) => setSucursalForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Ej. +573001234567"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Tipo de Sucursal *</span>
                <select
                  value={sucursalForm.type}
                  onChange={(event) => setSucursalForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition duration-200 font-semibold"
                >
                  <option value="Física">Física</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Depósito">Depósito</option>
                </select>
              </label>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-5 flex justify-end gap-3 select-none">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSucursal}
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition duration-150"
              >
                Agregar Sucursal
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {confirmModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-200" onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))} />
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
            <div className="mt-6 flex justify-end gap-3 select-none">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
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
            className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border transition-all duration-300 pointer-events-auto transform translate-y-0 ${toast.type === "success"
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

function getStatusLabel(status: string) {
  const clean = String(status || "").toUpperCase().trim();
  if (clean === "ACTIVE") return "Activo";
  if (clean === "SUSPENDED") return "Suspendido";
  if (clean === "TRIAL") return "Prueba";
  if (clean === "CANCELLED") return "Cancelado";
  return status;
}

export default DataManager;