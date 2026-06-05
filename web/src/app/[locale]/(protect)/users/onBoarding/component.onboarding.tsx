"use client";

import {useCallback, useEffect, useMemo, useState} from "react";

const DEFAULT_COLUMNS = ["name", "email", "phoneNumber", "status", "actions"];

export function OnboardingManager({ currentUserEmail, currentUserImage, currentUserProvider, isSU, currentUserCompanyId, currentUserRole }: { currentUserEmail?: string; currentUserImage?: string; currentUserProvider?: string; isSU?: boolean; currentUserCompanyId?: string; currentUserRole?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCompanies, setShowAllCompanies] = useState(false);
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

  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [statesList, setStatesList] = useState<any[]>([]);
  const [citiesList, setCitiesList] = useState<any[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"personal" | "system">("personal");

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

  const defaultForm = {
    email: "",
    name: "",
    lastName: "",
    phoneNumber: "",
    dni: "",
    gender: "male",
    status: "pending_approval",
    provider: "manual",
    companyId: currentUserCompanyId || "",
    countryCode: "+57",
    countryIso: "CO",
    avatar: "",
    departmentCode: "",
    cityCode: "",
    birthDate: "",
    metadata: ""
  };

  const [form, setForm] = useState(defaultForm);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/v1/upload", {
        method: "POST",
        headers: {
          Authorization: headers.Authorization,
          "x-oauth-session": headers["x-oauth-session"],
          "x-actor-id": headers["x-actor-id"],
          "x-actor-role": headers["x-actor-role"],
          "x-company-id": headers["x-company-id"],
          ...(showAllCompanies ? { "x-show-all-companies": "true" } : {})
        },
        body: formData
      });

      const resBody = await response.json();
      if (!response.ok) {
        throw new Error(resBody.message || "Error al subir la imagen");
      }

      setForm((prev) => ({ ...prev, avatar: resBody.url }));
      showToast("Imagen de avatar subida exitosamente.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al subir el archivo", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const headers = useMemo(
    () => ({
      Authorization: "Bearer local-dev-token",
      "x-oauth-session": "active",
      "x-actor-id": currentUserEmail ?? "onboarding-manager-ui",
      "x-actor-role": isSU ? "SU" : "cliente",
      "x-company-id": currentUserCompanyId || "",
      ...(showAllCompanies ? { "x-show-all-companies": "true" } : {})
    }),
    [currentUserEmail, isSU, currentUserCompanyId, showAllCompanies]
  );

  const allColumns = useMemo(
    () => [
      {key: "id", label: "ID"},
      {key: "name", label: "Nombre Completo"},
      {key: "email", label: "Email / Usuario"},
      {key: "phoneNumber", label: "Teléfono"},
      {key: "dni", label: "DNI / Cédula"},
      {key: "status", label: "Estado"},
      {key: "provider", label: "Proveedor"},
      {key: "companyId", label: "Compañía"},
      {key: "actions", label: "Acciones"}
    ],
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [onbRes, countriesRes, companiesRes, statesRes, citiesRes] = await Promise.all([
        fetch("/api/v1/db/onboardings", { headers }),
        fetch("/api/v1/db/st_country", { headers }).catch(() => null),
        fetch("/api/v1/db/companies", { headers }).catch(() => null),
        fetch("/api/v1/db/st_state", { headers }).catch(() => null),
        fetch("/api/v1/db/st_city", { headers }).catch(() => null)
      ]);

      const [onbBody, countriesBody, companiesBody, statesBody, citiesBody] = await Promise.all([
        onbRes.json(),
        countriesRes ? countriesRes.json().catch(() => null) : null,
        companiesRes ? companiesRes.json().catch(() => null) : null,
        statesRes ? statesRes.json().catch(() => null) : null,
        citiesRes ? citiesRes.json().catch(() => null) : null
      ]);

      if (!onbRes.ok) throw new Error(onbBody?.message || "No se pudo cargar la lista de solicitudes");
      
      setRows(Array.isArray(onbBody?.data) ? onbBody.data : []);
      setCountriesList(Array.isArray(countriesBody?.data) ? countriesBody.data : []);
      setCompaniesList(Array.isArray(companiesBody?.data) ? companiesBody.data : []);
      setStatesList(Array.isArray(statesBody?.data) ? statesBody.data : []);
      setCitiesList(Array.isArray(citiesBody?.data) ? citiesBody.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const headerColumns = useMemo(
    () => allColumns.filter((col) => visibleColumns.has(col.key)),
    [allColumns, visibleColumns]
  );

  const getCompanyCommercialName = (id: string) => {
    if (!id) return "—";
    const found = companiesList.find((c) => c.id === id);
    return found ? found.commercialName || found.name || id : id;
  };

  const getStatusLabel = (val: string) => {
    if (val === "pending_approval") return "Pendiente Aprobación";
    if (val === "active") return "Aprobado";
    if (val === "inactive") return "Rechazado";
    if (val === "failed") return "Fallido";
    return val;
  };

  const getStatusBadgeClass = (val: string) => {
    if (val === "pending_approval") return "bg-amber-50 text-amber-700 border-amber-200";
    if (val === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (val === "inactive") return "bg-rose-50 text-rose-700 border-rose-200";
    if (val === "failed") return "bg-slate-50 text-slate-600 border-slate-200";
    return "bg-slate-50 text-slate-500 border-slate-200";
  };

  const setFormField = (field: keyof typeof defaultForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openAddDrawer = () => {
    setActionMode("add");
    setSelectedRow(null);
    setForm({
      ...defaultForm,
      companyId: currentUserCompanyId || (companiesList[0]?.id ?? "")
    });
    setFormErrors({});
    setOpenDrawer(true);
    setTimeout(() => setDrawerVisible(true), 25);
  };

  const openEditDrawer = (row: any) => {
    setActionMode("edit");
    setSelectedRow(row);
    let birthDateStr = "";
    if (row.birth_date || row.birthDate) {
      const dt = new Date(row.birth_date || row.birthDate);
      if (!Number.isNaN(dt.getTime())) {
        birthDateStr = dt.toISOString().split("T")[0];
      }
    }

    setForm({
      email: row.email || "",
      name: row.name || "",
      lastName: row.last_name || row.lastName || "",
      phoneNumber: row.phone_number || row.phoneNumber || "",
      dni: row.dni || "",
      gender: row.gender || "male",
      status: row.status || "pending_approval",
      provider: row.provider || "manual",
      companyId: row.companyId || currentUserCompanyId || "",
      countryCode: row.country_code || "+57",
      countryIso: row.country_iso || "CO",
      avatar: row.avatar || "",
      departmentCode: String(row.department_code || row.departmentCode || ""),
      cityCode: String(row.city_code || row.cityCode || ""),
      birthDate: birthDateStr,
      metadata: row.metadata ? JSON.stringify(row.metadata, null, 2) : ""
    });
    setFormErrors({});
    setActiveDrawerTab("personal");
    setOpenDrawer(true);
    setTimeout(() => setDrawerVisible(true), 25);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setActiveDrawerTab("personal");
    setTimeout(() => {
      setOpenDrawer(false);
      setSelectedRow(null);
    }, 200);
  };

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof defaultForm, string>>>({});

  const validate = () => {
    const errs: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.email.trim()) errs.email = "El correo electrónico es requerido";
    if (!form.name.trim()) errs.name = "El nombre es requerido";
    if (!form.lastName.trim()) errs.lastName = "El apellido es requerido";
    if (!form.dni.trim()) errs.dni = "El DNI/Cédula es requerido";
    if (!form.phoneNumber.trim()) errs.phoneNumber = "El número telefónico es requerido";
    
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let metadataObj = null;
      if (form.metadata.trim()) {
        try {
          metadataObj = JSON.parse(form.metadata);
        } catch {
          setFormErrors((prev) => ({ ...prev, metadata: "JSON de metadata inválido" }));
          setSaving(false);
          return;
        }
      }

      const payload = {
        email: form.email,
        name: form.name,
        lastName: form.lastName,
        phoneNumber: form.phoneNumber,
        dni: form.dni,
        gender: form.gender,
        status: form.status,
        provider: form.provider,
        companyId: form.companyId || null,
        countryCode: form.countryCode,
        countryIso: form.countryIso,
        departmentCode: form.departmentCode || null,
        cityCode: form.cityCode || null,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
        avatar: form.avatar || null,
        metadata: metadataObj
      };

      const isEdit = actionMode === "edit" && selectedRow;
      const url = isEdit ? `/api/v1/db/onboardings` : `/api/v1/db/onboardings`;
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit ? { id: selectedRow.id, ...payload } : payload;

      const response = await fetch(url, {
        method,
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const resBody = await response.json();
      if (!response.ok) {
        throw new Error(resBody.message || "Error al guardar el registro");
      }

      showToast(`Solicitud guardada con éxito.`, "success");
      closeDrawer();
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al guardar los datos", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = (row: any) => {
    showConfirm(
      "Aprobar Solicitud de Onboarding",
      `¿Estás seguro de que deseas aprobar el onboarding de ${row.name || row.email}? Esto creará automáticamente una cuenta activa de PlatformUser para el usuario.`,
      async () => {
        try {
          const response = await fetch(`/api/v1/admin/users/${row.id}/approve`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
          const resBody = await response.json();
          if (!response.ok) {
            throw new Error(resBody.message || "Error al aprobar la solicitud");
          }
          showToast(`Onboarding aprobado y usuario activado correctamente.`, "success");
          void load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "No se pudo aprobar la solicitud", "error");
        }
      },
      "Aprobar y Activar",
      "warning"
    );
  };

  const handleReject = (row: any) => {
    showConfirm(
      "Rechazar Solicitud de Onboarding",
      `¿Estás seguro de que deseas rechazar el onboarding de ${row.name || row.email}? La solicitud se marcará como inactiva.`,
      async () => {
        try {
          const response = await fetch(`/api/v1/admin/users/${row.id}/reject`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
          const resBody = await response.json();
          if (!response.ok) {
            throw new Error(resBody.message || "Error al rechazar la solicitud");
          }
          showToast(`Onboarding rechazado correctamente.`, "success");
          void load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "No se pudo rechazar la solicitud", "error");
        }
      },
      "Rechazar Solicitud",
      "danger"
    );
  };

  const deleteItem = (id: string) => {
    const item = rows.find((r) => r.id === id);
    if (!item) return;

    showConfirm(
      "Eliminar Solicitud de Onboarding",
      `¿Estás seguro de que deseas eliminar definitivamente la solicitud de ${item.name || item.email}? Esta acción no se puede deshacer y eliminará permanentemente el registro en base de datos.`,
      async () => {
        try {
          const response = await fetch(`/api/v1/db/onboardings`, {
            method: "DELETE",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ id })
          });
          const resBody = await response.json();
          if (!response.ok) {
            throw new Error(resBody.message || "Error al eliminar");
          }
          showToast(`Registro eliminado definitivamente.`, "success");
          void load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "No se pudo eliminar el registro", "error");
        }
      }
    );
  };

  // Filtrado y Búsqueda
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const textMatch =
        term.length === 0 ||
        [
          row.email,
          row.name,
          row.last_name,
          row.lastName,
          row.dni,
          row.phone_number,
          row.phoneNumber
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const statusMatch = statusFilter === "all" || row.status === statusFilter;
      return textMatch && statusMatch;
    });
  }, [rows, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [safePage, filteredRows, rowsPerPage]);

  const filteredStates = useMemo(() => {
    return statesList.filter((s) => s.iso_country === form.countryIso || s.isoCountry === form.countryIso);
  }, [statesList, form.countryIso]);

  const filteredCities = useMemo(() => {
    return citiesList.filter((c) => String(c.state_id || c.stateId) === String(form.departmentCode));
  }, [citiesList, form.departmentCode]);

  return (
    <section className="flex-1 flex flex-col min-h-0 overflow-hidden text-slate-700 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, correo, dni, teléfono..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white lg:max-w-[44%]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {isSU && (
              <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-cyan-200 bg-cyan-50/50 px-4 py-2 text-sm text-cyan-850 transition hover:bg-cyan-100/75">
                <input
                  type="checkbox"
                  checked={showAllCompanies}
                  onChange={(e) => {
                    setShowAllCompanies(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                />
                <span className="font-bold text-cyan-900">Ver todas las compañías</span>
              </label>
            )}
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 transition"
            >
              <option value="all">Todos los estados</option>
              <option value="pending_approval">Pendientes Aprobación</option>
              <option value="active">Aprobados</option>
              <option value="inactive">Rechazados</option>
              <option value="failed">Fallidos</option>
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
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500 flex-shrink-0">
          <p>Total {filteredRows.length} solicitudes encontradas</p>
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

        {loading ? <p className="flex-shrink-0 mt-6 text-sm text-slate-500">Cargando solicitudes...</p> : null}
        {error ? <p className="flex-shrink-0 mt-6 text-sm text-rose-500">{error}</p> : null}

        {!loading && !error ? (
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
                          return <td key={`id-${index}`} className="px-4 py-3 font-mono text-xs text-slate-400">{String(row?.id || "").slice(0, 14)}...</td>;
                        }
                        if (column.key === "name") {
                          const fullName = `${row?.name || ""} ${row?.last_name || row?.lastName || ""}`.trim() || "Sin nombre";
                          const email = row?.email || "Sin correo";
                          const initials = fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                          const avatarUrl = row?.avatar;
                          const hasImage = avatarUrl && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://") || avatarUrl.startsWith("/"));

                          return (
                            <td key={`name-${index}`} className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                {hasImage ? (
                                  <img
                                    src={avatarUrl}
                                    alt={fullName}
                                    className="h-9 w-9 rounded-full object-cover border border-slate-100 shadow-sm shrink-0"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm shadow-indigo-100 uppercase">
                                    {initials}
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-slate-800 leading-tight truncate">{fullName}</span>
                                  <span className="text-2xs text-slate-400 mt-0.5 truncate">{email}</span>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (column.key === "email") {
                          return <td key={`email-${index}`} className="px-4 py-3 text-slate-600 font-medium">{row.email}</td>;
                        }
                        if (column.key === "phoneNumber") {
                          const prefix = row.country_code || row.countryCode || "";
                          const rawPhone = row.phone_number || row.phoneNumber || "";
                          return <td key={`phone-${index}`} className="px-4 py-3 text-slate-600">{prefix ? `${prefix} ` : ""}{rawPhone || "—"}</td>;
                        }
                        if (column.key === "dni") {
                          return <td key={`dni-${index}`} className="px-4 py-3 text-slate-600 font-mono text-xs">{row.dni || "—"}</td>;
                        }
                        if (column.key === "status") {
                          const statusVal = String(row?.status || "pending_approval");
                          return (
                            <td key={`status-${index}`} className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-3xs ${getStatusBadgeClass(statusVal)}`}>
                                {getStatusLabel(statusVal)}
                              </span>
                            </td>
                          );
                        }
                        if (column.key === "provider") {
                          return (
                            <td key={`provider-${index}`} className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-700 border border-slate-200 capitalize">
                                {row.provider || "manual"}
                              </span>
                            </td>
                          );
                        }
                        if (column.key === "companyId") {
                          return (
                            <td key={`company-${index}`} className="px-4 py-3 text-slate-600 font-medium">
                              {getCompanyCommercialName(row.companyId)}
                            </td>
                          );
                        }
                        if (column.key === "actions") {
                          const isPending = row?.status === "pending_approval";
                          return (
                            <td key={`actions-${index}`} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isPending ? (
                                  <>
                                    {/* Aprobar (Checkmark verde) */}
                                    <div className="group relative">
                                      <button
                                        type="button"
                                        onClick={() => handleApprove(row)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-700 transition duration-150"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                        </svg>
                                      </button>
                                      <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                        Aprobar Onboarding
                                      </span>
                                    </div>

                                    {/* Rechazar (Cruz roja) */}
                                    <div className="group relative">
                                      <button
                                        type="button"
                                        onClick={() => handleReject(row)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 transition duration-150"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                      <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                        Rechazar Onboarding
                                      </span>
                                    </div>
                                  </>
                                ) : null}

                                {/* Editar (Lápiz Azul) */}
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
                                    Editar Datos
                                  </span>
                                </div>

                                {/* Eliminar (Basura Rosa) */}
                                <div className="group relative">
                                  <button
                                    type="button"
                                    onClick={() => deleteItem(row.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 transition duration-150"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4.5 w-4.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                  </button>
                                  <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                    Eliminar Registro
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        return <td key={`${column.key}-${index}`} className="px-4 py-3 text-slate-700">{String(row?.[column.key] || "")}</td>;
                      })}
                    </tr>
                  ))}
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400" colSpan={headerColumns.length}>No se encontraron solicitudes que coincidan con los filtros.</td>
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
      </div>

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
                <h2 className="text-2xl font-bold text-slate-800">Editar Solicitud</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Edita la información de la solicitud de onboarding.
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Left Side: Avatar (5/12) */}
                <div className="col-span-5 flex flex-col items-center justify-center py-2 select-none">
                  <div 
                    onClick={() => document.getElementById("avatar-file-input-onb")?.click()}
                    className="h-24 w-24 rounded-full border-2 border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer bg-slate-50 flex items-center justify-center transition hover:border-blue-400"
                  >
                    {form.avatar && (form.avatar.startsWith("http://") || form.avatar.startsWith("https://") || form.avatar.startsWith("/")) ? (
                      <img
                        src={form.avatar}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white uppercase animate-pulse">
                        {`${form.name || "?"}${form.lastName || "?"}`.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center text-white p-1 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mb-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Subir Foto</span>
                    </div>
                  </div>
                  <input
                    id="avatar-file-input-onb"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  {uploadingAvatar ? <p className="text-[10px] text-slate-400 mt-1 select-none animate-pulse">Subiendo archivo...</p> : null}
                </div>

                {/* Right Side: DNI & Email (7/12) */}
                <div className="col-span-7 space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">DNI / Cédula *</span>
                    <input
                      value={form.dni}
                      onChange={(event) => setFormField("dni", event.target.value)}
                      placeholder="DNI / Cédula"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                    />
                    {formErrors.dni ? <p className="mt-1 text-2xs text-rose-500">{formErrors.dni}</p> : null}
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">Correo Electrónico *</span>
                    <input
                      value={form.email}
                      onChange={(event) => setFormField("email", event.target.value)}
                      placeholder="ejemplo@correo.com"
                      type="email"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                    />
                    {formErrors.email ? <p className="mt-1 text-2xs text-rose-500">{formErrors.email}</p> : null}
                  </label>
                </div>
              </div>

              {/* SELECTOR DE PESTAÑAS (TABS) */}
              <div className="flex border-b border-slate-100 mt-5 select-none">
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab("personal")}
                  className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition duration-200 cursor-pointer ${
                    activeDrawerTab === "personal"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Información Personal
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab("system")}
                  className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition duration-200 cursor-pointer ${
                    activeDrawerTab === "system"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Acceso y Sistema
                </button>
              </div>

              {/* CONTENIDO DE PESTAÑAS */}
              {activeDrawerTab === "personal" ? (
                <div className="space-y-4 animate-fade-in mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Nombre *</span>
                      <input
                        value={form.name}
                        onChange={(event) => setFormField("name", event.target.value)}
                        placeholder="Ej. Gerson"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                      />
                      {formErrors.name ? <p className="mt-1 text-2xs text-rose-500">{formErrors.name}</p> : null}
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Apellido *</span>
                      <input
                        value={form.lastName}
                        onChange={(event) => setFormField("lastName", event.target.value)}
                        placeholder="Ej. Porras"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                      />
                      {formErrors.lastName ? <p className="mt-1 text-2xs text-rose-500">{formErrors.lastName}</p> : null}
                    </label>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    {/* Selector de País */}
                    <label className="col-span-5 block">
                      <span className="text-xs font-semibold text-slate-500">País / Prefijo</span>
                      <select
                        value={form.countryIso}
                        onChange={(event) => {
                          const selectedIso = event.target.value;
                          const country = countriesList.find((c) => c.iso === selectedIso);
                          if (country) {
                            setForm((prev) => ({
                              ...prev,
                              countryIso: country.iso,
                              countryCode: country.prefix_area || country.prefix || "",
                              departmentCode: "",
                              cityCode: ""
                            }));
                          }
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        {countriesList.map((c) => (
                          <option key={c.iso} value={c.iso}>
                            {c.nombre} ({c.prefix_area || c.prefix || c.iso})
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Teléfono */}
                    <label className="col-span-7 block">
                      <span className="text-xs font-semibold text-slate-500">Teléfono *</span>
                      <div className="mt-1 flex rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:border-blue-400 transition">
                        <span className="flex items-center bg-slate-100/80 px-3 text-xs font-semibold text-slate-500 border-r border-slate-200 select-none">
                          {form.countryCode || "+57"}
                        </span>
                        <input
                          value={form.phoneNumber}
                          onChange={(event) => setFormField("phoneNumber", event.target.value)}
                          placeholder="3001234567"
                          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      {formErrors.phoneNumber ? <p className="mt-1 text-2xs text-rose-500">{formErrors.phoneNumber}</p> : null}
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Departamento / Estado</span>
                      <select
                        value={form.departmentCode}
                        onChange={(event) => {
                          const selectedStateId = event.target.value;
                          setForm((prev) => ({
                            ...prev,
                            departmentCode: selectedStateId,
                            cityCode: ""
                          }));
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        <option value="">-- Seleccionar --</option>
                        {filteredStates.map((s) => (
                          <option key={s.id_state || s.idState || s.id} value={s.id_state || s.idState || s.id}>
                            {s.state}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Ciudad</span>
                      <select
                        value={form.cityCode}
                        onChange={(event) => setFormField("cityCode", event.target.value)}
                        disabled={!form.departmentCode}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition disabled:opacity-50"
                      >
                        <option value="">-- Seleccionar --</option>
                        {filteredCities.map((c) => (
                          <option key={c.id_city || c.idCity || c.id} value={c.id_city || c.idCity || c.id}>
                            {c.city}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                      <span className="text-xs font-semibold text-slate-500">Fecha de Nacimiento</span>
                      <input
                        value={form.birthDate}
                        onChange={(event) => setFormField("birthDate", event.target.value)}
                        type="date"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Compañía *</span>
                      <select
                        value={form.companyId}
                        onChange={(event) => setFormField("companyId", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        {isSU ? <option value="">Ninguna</option> : null}
                        {companiesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.commercialName || c.name || c.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Proveedor de Identidad</span>
                      <select
                        value={form.provider}
                        onChange={(event) => setFormField("provider", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        <option value="manual">Manual / Registro Interno</option>
                        <option value="google">Google</option>
                        <option value="facebook">Facebook</option>
                        <option value="linkedin">LinkedIn</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Estado de Solicitud</span>
                      <select
                        value={form.status}
                        onChange={(event) => setFormField("status", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        <option value="pending_approval">Pendiente Aprobación</option>
                        <option value="active">Aprobado</option>
                        <option value="inactive">Rechazado</option>
                        <option value="failed">Fallido</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">Metadata (JSON format)</span>
                    <textarea
                      value={form.metadata}
                      onChange={(event) => setFormField("metadata", event.target.value)}
                      placeholder='{ "source": "referido", "notes": "" }'
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono outline-none focus:border-blue-400 transition"
                    />
                    {formErrors.metadata ? <p className="mt-1 text-2xs text-rose-500">{formErrors.metadata}</p> : null}
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>

            </div>
          </aside>
        </div>
      ) : null}

      {/* Modal de Confirmación Genérico */}
      {confirmModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setConfirmModal((prev) => ({...prev, isOpen: false}))} />
          <div className="relative z-10 w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all duration-200 border border-slate-100">
            <div className="flex flex-col items-center text-center select-none">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${confirmModal.confirmVariant === "danger" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"} mb-4`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">{confirmModal.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({...prev, isOpen: false}))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmModal.onConfirm();
                }}
                className={`rounded-xl ${confirmModal.confirmVariant === "danger" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"} px-5 py-2.5 text-sm font-semibold transition shadow-sm`}
              >
                {confirmModal.confirmLabel || "Confirmar"}
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

export default OnboardingManager;