"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {getSecureItem} from "@/lib/secure-store";

const DEFAULT_COLUMNS = ["name", "assigned_role", "phone_number", "status", "actions"];

export function DataManager({ currentUserEmail, currentUserImage, currentUserProvider, isSU, currentUserCompanyId, currentUserRole }: { currentUserEmail?: string; currentUserImage?: string; currentUserProvider?: string; isSU?: boolean; currentUserCompanyId?: string; currentUserRole?: string }) {
  const permissions = useMemo(() => {
    if (isSU) {
      return { read: true, create: true, update: true, delete: true };
    }
    const cacheKey = `sidebar_modules_${currentUserEmail}_${currentUserCompanyId ?? ""}`;
    const modules = getSecureItem<any[]>(cacheKey, currentUserEmail);
    if (modules && Array.isArray(modules)) {
      const match = modules.find((m) => m.route === "/users/manager");
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

  // Nuevos estados para la gestión relacional de roles y carga de avatar
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"personal" | "system">("personal");
  const [statesList, setStatesList] = useState<any[]>([]);
  const [citiesList, setCitiesList] = useState<any[]>([]);

  // Estados para la gestión de cambio de contraseña
  const [showChangePasswordPanel, setShowChangePasswordPanel] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

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
  
  // Form State
  const [form, setForm] = useState({
    user_email: "",
    name: "",
    last_name: "",
    phone_number: "",
    dni: "",
    gender: "male",
    status: "active",
    provider: "manual",
    companyId: "900000000",
    country_code: "+57",
    country_iso: "CO",
    avatar: "",
    position: "Staff",
    password: "",
    confirmPassword: "",
    department_code: "",
    city_code: "",
    birth_date: ""
  });

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
          "x-company-id": headers["x-company-id"]
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
      "x-actor-id": currentUserEmail ?? "users-manager-ui",
      "x-actor-role": isSU ? "SU" : (currentUserRole || "cliente"),
      "x-company-id": currentUserCompanyId ?? ""
    }),
    [currentUserEmail, isSU, currentUserRole, currentUserCompanyId]
  );

  const allColumns = useMemo(
    () => {
      const cols = [
        {key: "id_user_pk", label: "ID Usuario"},
        {key: "name", label: "Usuario"},
        {key: "assigned_role", label: "Rol Asignado"},
        {key: "phone_number", label: "Teléfono"},
        {key: "dni", label: "DNI / Cédula"},
        {key: "status", label: "Estado"},
        {key: "provider", label: "Proveedor"},
        {key: "companyId", label: "Compañía ID"}
      ];
      if (permissions.update || permissions.delete) {
        cols.push({key: "actions", label: "Acciones"});
      }
      return cols;
    },
    [permissions]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, assignmentsRes, countriesRes, companiesRes, statesRes, citiesRes] = await Promise.all([
        fetch("/api/v1/db/users", { headers }),
        fetch("/api/v1/db/roles", { headers }),
        fetch("/api/v1/db/role_assignments", { headers }),
        fetch("/api/v1/db/st_country", { headers }).catch(() => null),
        isSU ? fetch("/api/v1/db/companies", { headers }).catch(() => null) : null,
        fetch("/api/v1/db/st_state", { headers }).catch(() => null),
        fetch("/api/v1/db/st_city", { headers }).catch(() => null)
      ]);

      const [usersBody, rolesBody, assignmentsBody, countriesBody, companiesBody, statesBody, citiesBody] = await Promise.all([
        usersRes.json(),
        rolesRes.json(),
        assignmentsRes.json(),
        countriesRes ? countriesRes.json().catch(() => null) : null,
        companiesRes ? companiesRes.json().catch(() => null) : null,
        statesRes ? statesRes.json().catch(() => null) : null,
        citiesRes ? citiesRes.json().catch(() => null) : null
      ]);

      if (!usersRes.ok) throw new Error(usersBody?.message || "No se pudo cargar la lista de usuarios");
      
      const usersData = Array.isArray(usersBody?.data) ? usersBody.data : [];
      const rolesData = Array.isArray(rolesBody?.data) ? rolesBody.data : [];
      const assignmentsData = Array.isArray(assignmentsBody?.data) ? assignmentsBody.data : [];
      const companiesData = companiesBody && Array.isArray(companiesBody?.data) ? companiesBody.data : [];
      const statesData = statesBody && Array.isArray(statesBody?.data) ? statesBody.data : [];
      const citiesData = citiesBody && Array.isArray(citiesBody?.data) ? citiesBody.data : [];
      
      let countriesData = countriesBody && Array.isArray(countriesBody?.data) ? countriesBody.data : [];
      if (countriesData.length === 0) {
        countriesData = [
          { prefix_area: "+57", iso: "CO", nombre: "Colombia" },
          { prefix_area: "+54", iso: "AR", nombre: "Argentina" },
          { prefix_area: "+56", iso: "CL", nombre: "Chile" },
          { prefix_area: "+52", iso: "MX", nombre: "México" },
          { prefix_area: "+51", iso: "PE", nombre: "Perú" },
          { prefix_area: "+1", iso: "US", nombre: "Estados Unidos" },
          { prefix_area: "+34", iso: "ES", nombre: "España" }
        ];
      }

      setRows(usersData);
      setRolesList(rolesData);
      setAssignmentsList(assignmentsData);
      setCountriesList(countriesData);
      setCompaniesList(companiesData);
      setStatesList(statesData);
      setCitiesList(citiesData);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al cargar datos", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, showToast, isSU]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // No-op window listener (menu removed)
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
    setForm((prev) => {
      const updated = { ...prev, [fieldName]: value };
      if (fieldName === "dni" && actionMode === "add" && (!prev.password || prev.password === `${prev.dni}**`)) {
        updated.password = `${value}**`;
        updated.confirmPassword = `${value}**`;
      }
      return updated;
    });
  };

  const openAddDrawer = () => {
    setActionMode("add");
    setSelectedRow(null);
    const defaultCompany = isSU ? (companiesList[0]?.id || "900000000") : (currentUserCompanyId || "900000000");
    setForm({
      user_email: "",
      name: "",
      last_name: "",
      phone_number: "",
      dni: "",
      gender: "male",
      status: "active",
      provider: "manual",
      companyId: defaultCompany,
      country_code: "+57",
      country_iso: "CO",
      avatar: "",
      position: "Staff",
      password: "",
      confirmPassword: "",
      department_code: "",
      city_code: "",
      birth_date: ""
    });
    setSelectedRoleId("");
    setActiveDrawerTab("personal");
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const openEditDrawer = (row: any) => {
    setActionMode("edit");
    setSelectedRow(row);
    
    let initialAvatar = String(row?.avatar || "").trim();
    if (!initialAvatar && currentUserEmail && String(row?.user_email || "").trim().toLowerCase() === currentUserEmail.toLowerCase()) {
      initialAvatar = currentUserImage || "";
    }

    const activeCompany = isSU ? String(row?.companyId || "900000000") : (currentUserCompanyId || "900000000");
    setForm({
      user_email: String(row?.user_email || ""),
      name: String(row?.name || ""),
      last_name: String(row?.last_name || ""),
      phone_number: String(row?.phone_number || ""),
      dni: String(row?.dni || ""),
      gender: String(row?.gender || "male"),
      status: String(row?.status || "active"),
      provider: String(row?.provider || "manual"),
      companyId: activeCompany,
      country_code: String(row?.country_code || "+57"),
      country_iso: String(row?.country_iso || "CO"),
      avatar: initialAvatar,
      position: String(row?.position || "Staff"),
      password: "",
      confirmPassword: "",
      department_code: String(row?.department_code || row?.departmentCode || ""),
      city_code: String(row?.city_code || row?.cityCode || ""),
      birth_date: row?.birth_date || row?.birthDate ? String(row.birth_date || row.birthDate).slice(0, 10) : ""
    });

    const currentAssignment = assignmentsList.find((a) => a.platform_user_id === row?.id_user_pk);
    setSelectedRoleId(currentAssignment ? currentAssignment.roleId : "");
    setActiveDrawerTab("personal");
    setOpenDrawer(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setShowChangePasswordPanel(false);
    setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setActiveDrawerTab("personal");
    window.setTimeout(() => setOpenDrawer(false), 220);
  };

  const handleChangePassword = async () => {
    if (!pwdForm.newPassword) {
      showToast("Ingresa la nueva contraseña.", "warning");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast("Las contraseñas nuevas no coinciden.", "warning");
      return;
    }
    
    try {
      const response = await fetch("/api/v1/db/users", {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          id: String(selectedRow?.id_user_pk || ""),
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || "No se pudo actualizar la contraseña");
      }
      
      showToast("Contraseña actualizada exitosamente.", "success");
      setShowChangePasswordPanel(false);
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al cambiar la contraseña", "error");
    }
  };

  const saveItem = async () => {
    const required = [form.user_email, form.name, form.last_name].every((item) => String(item).trim().length > 0);
    if (!required) {
      showToast("Completa Correo Electrónico, Nombre y Apellidos.", "warning");
      return;
    }
    if (actionMode === "add" && form.provider === "manual") {
      if (!form.password) {
        showToast("Ingresa una contraseña para el acceso manual.", "warning");
        return;
      }
      if (form.password !== form.confirmPassword) {
        showToast("Las contraseñas no coinciden.", "warning");
        return;
      }
    }
    setSaving(true);
    try {
      const selectedRoleName = selectedRoleId ? rolesList.find(r => r.id === selectedRoleId)?.name || "Staff" : "Staff";
      const updatedForm = { ...form, position: selectedRoleName };

      let savedUser: any = null;

      if (actionMode === "edit" && selectedRow) {
        const userId = String(selectedRow?.id_user_pk || "");
        const response = await fetch("/api/v1/db/users", {
          method: "PATCH",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify({id: userId, ...updatedForm})
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo actualizar el perfil del usuario");
        
        savedUser = { id_user_pk: userId };
      } else {
        const response = await fetch("/api/v1/db/users", {
          method: "POST",
          headers: {...headers, "content-type": "application/json"},
          body: JSON.stringify(updatedForm)
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "No se pudo crear el usuario");
        
        savedUser = body.data;
      }

      if (savedUser && savedUser.id_user_pk) {
        const userId = savedUser.id_user_pk;
        const currentAssignment = assignmentsList.find(a => a.platform_user_id === userId);

        if (selectedRoleId) {
          if (!currentAssignment) {
            const postRes = await fetch("/api/v1/db/role_assignments", {
              method: "POST",
              headers: { ...headers, "content-type": "application/json" },
              body: JSON.stringify({
                platform_user_id: userId,
                roleId: selectedRoleId,
                companyId: form.companyId
              })
            });
            if (!postRes.ok) {
              const errBody = await postRes.json();
              throw new Error(errBody.message || "Error al crear la asignación de rol");
            }
          } else if (currentAssignment.roleId !== selectedRoleId) {
            const patchRes = await fetch("/api/v1/db/role_assignments", {
              method: "PATCH",
              headers: { ...headers, "content-type": "application/json" },
              body: JSON.stringify({
                id: currentAssignment.id,
                roleId: selectedRoleId,
                platform_user_id: userId,
                companyId: form.companyId
              })
            });
            if (!patchRes.ok) {
              const errBody = await patchRes.json();
              throw new Error(errBody.message || "Error al actualizar la asignación de rol");
            }
          }
        } else if (currentAssignment) {
          const deleteRes = await fetch("/api/v1/db/role_assignments", {
            method: "DELETE",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({
              id: currentAssignment.id
            })
          });
          if (!deleteRes.ok) {
            const errBody = await deleteRes.json();
            throw new Error(errBody.message || "Error al remover la asignación de rol");
          }
        }
      }

      showToast(actionMode === "add" ? "Usuario creado exitosamente." : "Usuario actualizado exitosamente.", "success");
      closeDrawer();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (rowId: any) => {
    showConfirm(
      "¿Eliminar este usuario?",
      "Esta acción es irreversible y removerá permanentemente al usuario de la plataforma. ¿Deseas continuar?",
      async () => {
        try {
          const response = await fetch("/api/v1/db/users", {
            method: "DELETE",
            headers: {...headers, "content-type": "application/json"},
            body: JSON.stringify({id: String(rowId || "")})
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body?.message || "No se pudo eliminar");
          showToast("Usuario eliminado exitosamente.", "success");
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
    const clean = String(status || "").toLowerCase().trim();
    if (clean === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (clean === "pending_approval") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  const providerOptions = useMemo(() => {
    const options = [{ value: "manual", label: "Manual" }];
    const activeProv = String(currentUserProvider || "").toLowerCase().trim();
    
    if (activeProv && activeProv !== "manual" && activeProv !== "credentials") {
      const label = activeProv.charAt(0).toUpperCase() + activeProv.slice(1);
      if (!options.some(o => o.value === activeProv)) {
        options.push({ value: activeProv, label });
      }
    }
    
    if (actionMode === "edit") {
      const currentProv = String(form.provider || "manual").toLowerCase().trim();
      if (currentProv && currentProv !== "manual" && currentProv !== "credentials") {
        const label = currentProv.charAt(0).toUpperCase() + currentProv.slice(1);
        if (!options.some(o => o.value === currentProv)) {
          options.push({ value: currentProv, label });
        }
      }
    }
    return options;
  }, [currentUserProvider, form.provider, actionMode]);

  const filteredRolesList = useMemo(() => {
    const actRole = String(currentUserRole || "user").trim().toLowerCase();
    return rolesList.filter((role) => {
      const roleScope = String(role.scope || "user").trim().toLowerCase();
      if (actRole === "su") {
        return true;
      }
      if (actRole === "admin" || actRole === "administrator" || actRole === "administrador") {
        return roleScope === "user" || roleScope === "admin";
      }
      return roleScope === "user";
    });
  }, [rolesList, currentUserRole]);

  const filteredStates = useMemo(() => {
    return statesList.filter(
      (s) => String(s.iso_country || s.isoCountry || s.iso || "").toLowerCase() === String(form.country_iso || "").toLowerCase()
    );
  }, [statesList, form.country_iso]);

  const filteredCities = useMemo(() => {
    return citiesList.filter(
      (c) => String(c.state_id || c.stateId || "") === String(form.department_code || "")
    );
  }, [citiesList, form.department_code]);


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
             {permissions.create ? (
               <button
                 type="button"
                 onClick={openAddDrawer}
                 className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
               >
                 Agregar Usuario
               </button>
             ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500 flex-shrink-0">
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

      {loading ? <p className="flex-shrink-0 mt-6 text-sm text-slate-500">Cargando usuarios...</p> : null}

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
                  <tr key={`${row?.id_user_pk || "row"}-${index}`} className="hover:bg-slate-50/50 transition">
                    {headerColumns.map((column) => {
                      if (column.key === "id_user_pk") {
                        return <td key={`id-${index}`} className="px-4 py-3 font-mono text-xs text-slate-400">{String(row?.id_user_pk || "").slice(0, 14)}...</td>;
                      }
                      if (column.key === "name") {
                        const avatarUrl = row?.avatar;
                        let finalAvatarUrl = avatarUrl;
                        if (!finalAvatarUrl && currentUserEmail && String(row?.user_email || "").trim().toLowerCase() === currentUserEmail.toLowerCase()) {
                          finalAvatarUrl = currentUserImage;
                        }
                        const fullName = `${row?.name || ""} ${row?.last_name || ""}`.trim() || "Usuario sin nombre";
                        const email = row?.user_email || "Sin correo electrónico";
                        const initials = fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                        const hasImage = finalAvatarUrl && (finalAvatarUrl.startsWith("http://") || finalAvatarUrl.startsWith("https://") || finalAvatarUrl.startsWith("/"));

                        return (
                          <td key={`name-${index}`} className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {hasImage ? (
                                <img
                                  src={finalAvatarUrl}
                                  alt={fullName}
                                  className="h-9 w-9 rounded-full object-cover border border-slate-100 shadow-sm shrink-0"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm shadow-blue-100 uppercase">
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
                      if (column.key === "assigned_role") {
                        const assignment = assignmentsList.find((a) => a.platform_user_id === row.id_user_pk);
                        const role = assignment ? rolesList.find((r) => r.id === assignment.roleId) : null;
                        
                        return (
                          <td key={`role-${index}`} className="px-4 py-3.5">
                            {role ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-100 shadow-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                                {role.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs font-medium">—</span>
                            )}
                          </td>
                        );
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
                          <td key={`actions-${index}`} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Editar (Lápiz Azul) */}
                              {permissions.update ? (
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

                              {/* Eliminar (Basura Roja) */}
                              {permissions.delete ? (
                                <div className="group relative">
                                  <button
                                    type="button"
                                    onClick={() => void deleteItem(row?.id_user_pk)}
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
                  <tr key="empty-users">
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={headerColumns.length}>No se encontraron usuarios que coincidan con los filtros.</td>
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
                <h2 className="text-2xl font-bold text-slate-800">{actionMode === "edit" ? "Editar Usuario" : "Agregar Nuevo Usuario"}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {actionMode === "edit" ? "Edita la información del usuario de la plataforma." : "Crea una nueva cuenta de usuario y asígnale su estado base."}
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
              
              {/* TOP HEADER SECTION: 5/12 Avatar | 7/12 DNI & Email */}
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Left Side: Avatar (5/12) */}
                <div className="col-span-5 flex flex-col items-center justify-center py-2 select-none">
                  <div 
                    onClick={() => document.getElementById("avatar-file-input")?.click()}
                    className="h-24 w-24 rounded-full border-2 border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer bg-slate-50 flex items-center justify-center transition hover:border-blue-400"
                  >
                    {form.avatar && (form.avatar.startsWith("http://") || form.avatar.startsWith("https://") || form.avatar.startsWith("/")) ? (
                      <img
                        src={form.avatar}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white uppercase">
                        {`${form.name || "?"}${form.last_name || "?"}`.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center text-white p-1 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mb-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                      </svg>
                      <span className="text-[8px] font-extrabold uppercase tracking-wide">Subir Foto</span>
                    </div>

                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                  </div>

                  <input 
                    id="avatar-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <span className="text-[9px] text-slate-400 font-semibold mt-2 text-center leading-tight">
                    {form.avatar ? "Imagen cargada" : "Haz clic para subir"}
                  </span>

                  {currentUserImage && form.user_email && form.user_email.toLowerCase() === currentUserEmail?.toLowerCase() && form.avatar !== currentUserImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, avatar: currentUserImage }));
                        showToast("Se restauró el avatar de tu proveedor.", "info");
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-[8px] font-normal text-slate-500 hover:text-slate-700 bg-slate-100/60 hover:bg-slate-200/40 border border-slate-200/40 px-2 py-0.5 rounded-full transition select-none cursor-pointer shadow-3xs"
                    >
                      {form.provider === "google" && (
                        <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      )}
                      <span>Restaurar</span>
                    </button>
                  )}
                </div>

                {/* Right Side: DNI & Email (7/12) */}
                <div className="col-span-7 space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">DNI / Documento *</span>
                    <input
                      value={form.dni}
                      disabled={actionMode === "edit"}
                      onChange={(event) => setFormField("dni", event.target.value)}
                      placeholder="DNI o Cédula"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white disabled:opacity-50 transition"
                    />
                  </label>

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
                <div className="space-y-4 animate-fade-in">
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

                  <div className="grid grid-cols-12 gap-3">
                    {/* Selector de País (col-span-5) */}
                    <label className="col-span-5 block">
                      <span className="text-xs font-semibold text-slate-500">País / Prefijo</span>
                      <select
                        value={form.country_iso}
                        onChange={(event) => {
                          const selectedIso = event.target.value;
                          const country = countriesList.find((c) => c.iso === selectedIso);
                          if (country) {
                            setForm((prev) => ({
                              ...prev,
                              country_iso: country.iso,
                              country_code: country.prefix_area || country.prefix || "",
                              department_code: "",
                              city_code: ""
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

                    {/* Teléfono sin prefijo (col-span-7) */}
                    <label className="col-span-7 block">
                      <span className="text-xs font-semibold text-slate-500">Teléfono *</span>
                      <div className="mt-1 flex rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:border-blue-400 transition">
                        <span className="flex items-center bg-slate-100/80 px-3 text-xs font-semibold text-slate-500 border-r border-slate-200 select-none">
                          {form.country_code || "+57"}
                        </span>
                        <input
                          value={form.phone_number}
                          onChange={(event) => setFormField("phone_number", event.target.value)}
                          placeholder="3001234567"
                          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Departamento / Estado</span>
                      <select
                        value={form.department_code}
                        onChange={(event) => {
                          const selectedStateId = event.target.value;
                          setForm((prev) => ({
                            ...prev,
                            department_code: selectedStateId,
                            city_code: ""
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
                        value={form.city_code}
                        disabled={!form.department_code}
                        onChange={(event) => setFormField("city_code", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-50 transition"
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
                        type="date"
                        value={form.birth_date}
                        onChange={(event) => setFormField("birth_date", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Compañía *</span>
                      <select
                        value={form.companyId}
                        disabled={!isSU}
                        onChange={(event) => setFormField("companyId", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-50 transition"
                      >
                        {isSU ? (
                          <>
                            <option value="">-- Seleccionar Empresa --</option>
                            {companiesList.map((comp) => (
                              <option key={comp.id} value={comp.id}>
                                {comp.commercialName || comp.legalName || comp.id}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value={form.companyId || currentUserCompanyId || "900000000"}>
                            {form.companyId || currentUserCompanyId || "Empresa Activa"}
                          </option>
                        )}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Asignar Cargo / Rol *</span>
                      <select
                        value={selectedRoleId}
                        onChange={(event) => setSelectedRoleId(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        <option value="">Ninguno (Sin Rol)</option>
                        {filteredRolesList.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name} ({role.scope})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                      <span className="text-xs font-semibold text-slate-500">Proveedor</span>
                      <select
                        value={form.provider}
                        onChange={(event) => setFormField("provider", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      >
                        {providerOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* CONTRASEÑA EN MODO CREACIÓN (MANUAL) */}
                  {actionMode === "add" && form.provider === "manual" && (
                    <div className="grid grid-cols-2 gap-3 mt-4 animate-slide-in">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Contraseña de acceso *</span>
                        <input
                          type="password"
                          value={form.password}
                          onChange={(event) => setFormField("password", event.target.value)}
                          placeholder="Por defecto: DNI**"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Confirmar Contraseña *</span>
                        <input
                          type="password"
                          value={form.confirmPassword}
                          onChange={(event) => setFormField("confirmPassword", event.target.value)}
                          placeholder="Repite la contraseña"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                        />
                      </label>
                    </div>
                  )}

                  {/* GESTIÓN DE CONTRASEÑA EN MODO EDICIÓN (MANUAL) */}
                  {actionMode === "edit" && form.provider === "manual" && (
                    <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide select-none">Gestionar Contraseña</h4>
                      
                      {!showChangePasswordPanel ? (
                        <button
                          type="button"
                          onClick={() => setShowChangePasswordPanel(true)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition cursor-pointer select-none"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0V10.5m-2.25 13.5h13.5c1.242 0 2.25-1.008 2.25-2.25V12c0-1.242-1.008-2.25-2.25-2.25H5.25C4.008 9.75 3 10.758 3 12v9.75c0 1.242 1.008 2.25 2.25 2.25Z" />
                          </svg>
                          Cambiar Contraseña de Acceso
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
                          <label className="block">
                            <span className="text-[11px] font-semibold text-slate-500">Contraseña Anterior *</span>
                            <input
                              type="password"
                              value={pwdForm.oldPassword}
                              onChange={(e) => setPwdForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                              placeholder="Ingresa contraseña actual"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs outline-none focus:border-blue-400 transition"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold text-slate-500">Nueva Contraseña *</span>
                            <input
                              type="password"
                              value={pwdForm.newPassword}
                              onChange={(e) => setPwdForm(prev => ({ ...prev, newPassword: e.target.value }))}
                              placeholder="Nueva contraseña"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs outline-none focus:border-blue-400 transition"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold text-slate-500">Confirmar Nueva Contraseña *</span>
                            <input
                              type="password"
                              value={pwdForm.confirmPassword}
                              onChange={(e) => setPwdForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              placeholder="Confirma nueva contraseña"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs outline-none focus:border-blue-400 transition"
                            />
                          </label>
                          <div className="flex justify-end gap-2 pt-1 select-none">
                            <button
                              type="button"
                              onClick={() => {
                                setShowChangePasswordPanel(false);
                                setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
                              }}
                              className="rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleChangePassword}
                              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-[11px] font-bold text-white transition shadow-sm cursor-pointer"
                            >
                              Actualizar Contraseña
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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

function getStatusLabel(status: string) {
  const clean = String(status || "").toLowerCase().trim();
  if (clean === "active") return "Activo";
  if (clean === "pending_approval") return "Pendiente";
  return "Inactivo";
}

export default DataManager;