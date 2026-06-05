"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { getSecureItem, setSecureItem } from "@/lib/secure-store";

// Claves de caché de cliente estandarizadas
const MODULES_CACHE_KEY = "roles_modules_cache";
const ROLES_CACHE_KEY = "roles_list_cache";

type Permission = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  status?: string;
  microroles?: Record<string, boolean>;
};

type RoleRecord = {
  id: string;
  key_id: string;
  name: string;
  description: string;
  scope: string;
  company_id: string | null;
  status: string;
  permissions?: Record<string, Permission>;
  permissions_count?: number;
  integrityStatus?: "completa" | "vulnerada";
};

// Solo se cargan los módulos existentes en la base de datos

function getModuleIcon(route: string, dbIcon?: string | null) {
  if (dbIcon && dbIcon.trim()) return dbIcon;
  const r = route.toLowerCase();
  if (r.includes("post")) return "📦";
  if (r.includes("bounch")) return "💐";
  if (r.includes("store")) return "❄️";
  if (r.includes("registry")) return "🩺";
  if (r === "/" || r === "/home") return "🏠";
  if (r.includes("dashboard")) return "👤";
  if (r.includes("farm") || r.includes("cultivo")) return "🏡";
  if (r.includes("human-talent") || r.includes("talent")) return "👥";
  if (r.includes("admin")) return "⚙️";
  if (r.includes("settings") || r.includes("config")) return "⚙️";
  return "🔗";
}

function isImageIcon(value: string | null) {
  if (!value) return false;
  const icon = value.trim().toLowerCase();
  return icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function renderModuleIcon(icon?: string | null) {
  if (!icon) return null;
  if (isImageIcon(icon)) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-400 p-1 shadow-sm shrink-0">
        <img
          src={icon}
          alt="icon"
          className="h-4 w-4 object-contain"
          style={{ filter: "drop-shadow(0px 0.5px 1px rgba(0,0,0,0.5))" }}
        />
      </div>
    );
  }
  return <span className="text-base">{icon}</span>;
}

export function DynamicComponent({
  actorId,
  actorRole,
  companyId
}: {
  actorId: string;
  actorRole: string;
  companyId: string;
}) {

  const userPermissions = useMemo(() => {
    if (actorRole === "SU") {
      return { read: true, create: true, update: true, delete: true };
    }
    const cacheKey = `sidebar_modules_${actorId}_${companyId ?? ""}`;
    const modules = getSecureItem<any[]>(cacheKey, actorId);
    if (modules && Array.isArray(modules)) {
      const match = modules.find((m) => m.route === "/users/roles");
      if (match && match.permission) {
        return match.permission as { read: boolean; create: boolean; update: boolean; delete: boolean };
      }
    }
    return { read: true, create: false, update: false, delete: false };
  }, [actorId, actorRole, companyId]);

  const [dbModules, setDbModules] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [scopesList, setScopesList] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (successMessage) {
      showToast(successMessage, "success");
      setSuccessMessage(null);
    }
  }, [successMessage, showToast]);
  const [isEditing, setIsEditing] = useState(false);

  // Metadatos del Rol Seleccionado
  const [roleForm, setRoleForm] = useState({
    key_id: "",
    name: "",
    description: "",
    scope: "user",
    company_id: "900000000"
  });

  // Estado de permisos: { [moduleId]: { read, create, update, delete, microroles } }
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});

  // Microroles / Acciones específicas por módulo
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [newMicroNames, setNewMicroNames] = useState<Record<string, string>>({});
  const [customMicroRoles, setCustomMicroRoles] = useState<Record<string, Array<{ key: string; label: string }>>>({
    "m-postcosecha": [
      { key: "scan_post", label: "Escanear Postcosecha" },
      { key: "approve_lot", label: "Aprobar Lote" }
    ],
    "m-boncheo": [
      { key: "scan_bounch", label: "Escanear Boncheo" }
    ],
    "m-registrar-enf": [
      { key: "diagnose_plant", label: "Diagnosticar Planta" }
    ],
    "m-cultivo-asignaciones": [
      { key: "assign_task", label: "Asignar Tareas" }
    ],
    "m-admin-user": [
      { key: "approve_user", label: "Aprobar Usuario" },
      { key: "reject_user", label: "Rechazar Usuario" }
    ],
    "m-admin-roles": [
      { key: "clone_role", label: "Clonar Rol" }
    ]
  });

  // Estado para el modal personalizado (microroles)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit">("create");
  const [modalModuleId, setModalModuleId] = useState("");
  const [modalMicroKey, setModalMicroKey] = useState("");
  const [modalInputValue, setModalInputValue] = useState("");
  const [modalModuleName, setModalModuleName] = useState("");
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<keyof RoleRecord>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(["key_id", "name", "description", "scope", "permissions_count", "integrity", "actions"]));

  // Estado para el modal de reparación (integridad vulnerada)
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [repairRoleItem, setRepairRoleItem] = useState<RoleRecord | null>(null);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairError, setRepairError] = useState("");
  const [repairResult, setRepairResult] = useState<{ ok: boolean; report: string } | null>(null);

  // --- DRAWER DE CREACIÓN/EDICIÓN DE CARGO ---
  const defaultRoleForm = { key_id: "", name: "", description: "", scope: "user", company_id: "900000000" };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [drawerForm, setDrawerForm] = useState(defaultRoleForm);
  const [drawerErrors, setDrawerErrors] = useState<Partial<Record<keyof typeof defaultRoleForm, string>>>({});

  function openCreateDrawer() {
    setDrawerForm(defaultRoleForm);
    setEditingRoleId(null);
    setDrawerErrors({});
    setDrawerOpen(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  }

  function openEditDrawer(item: RoleRecord) {
    setDrawerForm({
      key_id: item.key_id,
      name: item.name,
      description: item.description || "",
      scope: item.scope || "user",
      company_id: item.company_id || "900000000"
    });
    setEditingRoleId(item.id);
    setDrawerErrors({});
    setDrawerOpen(true);
    window.setTimeout(() => setDrawerVisible(true), 10);
  }

  function closeDrawer() {
    setDrawerVisible(false);
    window.setTimeout(() => setDrawerOpen(false), 220);
  }

  const onSubmitRoleForm = async () => {
    const errors: Partial<Record<keyof typeof defaultRoleForm, string>> = {};
    if (!drawerForm.name.trim()) errors.name = "El nombre del cargo es obligatorio";
    if (!drawerForm.key_id.trim()) errors.key_id = "El ID Clave es obligatorio";
    if (drawerForm.key_id.trim().length > 5) errors.key_id = "Máximo 5 caracteres";
    if (!drawerForm.scope.trim()) errors.scope = "El alcance es obligatorio";
    if (Object.keys(errors).length > 0) { setDrawerErrors(errors); return; }

    setSaving(true);
    try {
      const payload = {
        name: drawerForm.name.trim(),
        key: drawerForm.key_id.trim().toUpperCase(),
        key_id: drawerForm.key_id.trim().toUpperCase(),
        description: drawerForm.description.trim() || null,
        scope: drawerForm.scope,
        company_id: drawerForm.company_id || "900000000",
        status: "active"
      };

      const method = editingRoleId ? "PATCH" : "POST";
      const body = editingRoleId ? { ...payload, id: editingRoleId } : payload;
      const response = await fetch("/api/v1/db/roles", {
        method,
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const resBody = await response.json();
      if (!response.ok) throw new Error(resBody.message ?? "No se pudo guardar el cargo");

      if (typeof window !== "undefined") localStorage.removeItem(ROLES_CACHE_KEY);
      setSuccessMessage(editingRoleId ? "Cargo actualizado correctamente" : "Cargo creado correctamente");
      window.setTimeout(() => setSuccessMessage(null), 3500);
      closeDrawer();

      const roleRes = await fetch("/api/v1/db/roles", { headers });
      const roleBody = await roleRes.json();
      const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
      setRoles(fetchedRoles);

      // Si se creó uno nuevo, abrir modal de permisos directamente
      if (!editingRoleId && resBody?.data?.id) {
        setSelectedRoleId(resBody.data.id);
        setIsEditing(true);
        setPermissionsModalOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el cargo");
    } finally {
      setSaving(false);
    }
  };

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

  const openCreateModal = (moduleId: string, moduleName: string) => {
    setModalType("create");
    setModalModuleId(moduleId);
    setModalModuleName(moduleName);
    setModalMicroKey("");
    setModalInputValue("");
    setModalOpen(true);
  };

  const openEditModal = (moduleId: string, microKey: string, currentLabel: string) => {
    setModalType("edit");
    setModalModuleId(moduleId);
    setModalMicroKey(microKey);
    setModalInputValue(currentLabel);
    setModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = modalInputValue.trim();
    if (!value) return;

    if (modalType === "create") {
      const key = value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      setCustomMicroRoles((prev) => {
        const list = prev[modalModuleId] || [];
        if (list.some((it) => it.key === key)) return prev;
        return {
          ...prev,
          [modalModuleId]: [...list, { key, label: value }]
        };
      });
    } else {
      setCustomMicroRoles((prev) => {
        const list = prev[modalModuleId] || [];
        return {
          ...prev,
          [modalModuleId]: list.map((it) => it.key === modalMicroKey ? { ...it, label: value } : it)
        };
      });
    }
    setModalOpen(false);
  };

  const setFormField = (fieldName: string, value: string) => {
    setRoleForm((prev) => ({ ...prev, [fieldName]: value }));
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

  // 1. Cargar Módulos y Roles con Stale-While-Revalidate (LOCAL_DB_CACHE_MANUAL)
  useEffect(() => {
    let hasLoadedModulesCache = false;
    let hasLoadedRolesCache = false;

    // A. Cargar desde LocalStorage inmediatamente
    if (typeof window !== "undefined") {
      const dataModules = getSecureItem<any[]>(MODULES_CACHE_KEY, actorId);
      if (dataModules && Array.isArray(dataModules)) {
        setDbModules(dataModules);
        hasLoadedModulesCache = true;
      }

      const dataRoles = getSecureItem<RoleRecord[]>(ROLES_CACHE_KEY, actorId);
      if (dataRoles && Array.isArray(dataRoles)) {
        setRoles(dataRoles);
        hasLoadedRolesCache = true;
        if (dataRoles.length > 0) {
          setSelectedRoleId(dataRoles[0].id);
        }
      }
    }

    if (!hasLoadedModulesCache || !hasLoadedRolesCache) {
      setLoading(true);
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        // Fetch Módulos, Roles y Catálogo de Scopes en paralelo
        const [modRes, roleRes, scopesRes] = await Promise.all([
          fetch("/api/v1/db/modules", { headers }),
          fetch("/api/v1/db/roles", { headers }),
          fetch("/api/v1/db/st_multidata", { headers }).catch(() => null)
        ]);

        const modBody = await modRes.json();
        const roleBody = await roleRes.json();
        const scopesBody = scopesRes ? await scopesRes.json().catch(() => null) : null;

        const fetchedModules = Array.isArray(modBody?.data) ? modBody.data : [];
        const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
        const fetchedScopes = scopesBody && Array.isArray(scopesBody?.data) ? scopesBody.data : [];

        if (cancelled) return;

        // Actualizar estados si difieren
        setDbModules((prev) => {
          const isSame = JSON.stringify(prev) === JSON.stringify(fetchedModules);
          return isSame ? prev : fetchedModules;
        });

        const rolesList = fetchedRoles.length > 0 ? fetchedRoles : [];
        setRoles((prev) => {
          const isSame = JSON.stringify(prev) === JSON.stringify(rolesList);
          return isSame ? prev : rolesList;
        });

        if (rolesList.length > 0) {
          setSelectedRoleId((prevId) => prevId || rolesList[0].id);
        }

        setScopesList(fetchedScopes);

        // Guardar en caché local
        if (typeof window !== "undefined") {
          setSecureItem(MODULES_CACHE_KEY, fetchedModules, actorId);
          setSecureItem(ROLES_CACHE_KEY, fetchedRoles, actorId);
        }

      } catch (err) {
        if (!hasLoadedRolesCache) {
          setError("Error al comunicar con la base de datos.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [headers]);

  // Click away listener for the column visibility menu
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
      if (sortBy === "permissions_count") {
        const countA = Object.values(a.permissions || {}).filter(p => (p.status ?? 'active') === 'active').length;
        const countB = Object.values(b.permissions || {}).filter(p => (p.status ?? 'active') === 'active').length;
        return sortDir === "asc" ? countA - countB : countB - countA;
      }

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
  }, [roles, search, scopeFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleRoles.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const pagedRoles = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return visibleRoles.slice(start, start + rowsPerPage);
  }, [safePage, visibleRoles, rowsPerPage]);

  const tableColumns = useMemo(() => {
    return [
      { key: "key_id", label: "ID Clave" },
      { key: "name", label: "Nombre" },
      { key: "description", label: "Descripción" },
      { key: "scope", label: "Alcance (Scope)" },
      { key: "permissions_count", label: "Cant. Permisos" },
      { key: "integrity", label: "Integridad" },
      { key: "actions", label: "Acciones" }
    ];
  }, []);

  const headerColumns = useMemo(() => tableColumns.filter((column) => visibleColumns.has(column.key)), [tableColumns, visibleColumns]);

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

  function setSort(column: keyof RoleRecord) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  const handleEditPermissions = (item: RoleRecord) => {
    setSelectedRoleId(item.id);
    setPermissionsModalOpen(true);
  };

  const handleRepairRole = (item: RoleRecord) => {
    setRepairRoleItem(item);
    setRepairResult(null);
    setRepairError("");
    setRepairModalOpen(true);
  };

  const handleExecuteRepair = async (repairAction: "restore" | "scratch") => {
    if (!repairRoleItem) return;
    setRepairLoading(true);
    setRepairError("");
    try {
      const response = await fetch("/api/v1/db/roles", {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          id: repairRoleItem.id,
          action: "repair",
          repairAction
        })
      });
      const resBody = await response.json();
      if (!response.ok) {
        throw new Error(resBody.message ?? "Ocurrió un error al reparar el cargo.");
      }

      const resData = resBody.data;
      if (resData?.ok) {
        setRepairResult({
          ok: true,
          report: resData.report || "Reparación completada sin discrepancias registradas."
        });

        // Actualizar la grilla de roles para ver los cambios y el estado de integridad corregido
        if (typeof window !== "undefined") {
          localStorage.removeItem(ROLES_CACHE_KEY);
        }
        const roleRes = await fetch("/api/v1/db/roles", { headers });
        const roleBody = await roleRes.json();
        const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
        setRoles(fetchedRoles);
      } else {
        throw new Error("La reparación no retornó confirmación de éxito.");
      }
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : "Error al procesar la reparación.");
    } finally {
      setRepairLoading(false);
    }
  };

  // Cargar metadatos y permisos del Rol seleccionado
  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  // Se listan exclusivamente los módulos existentes de acuerdo al alcance del cargo seleccionado
  const activeModules = useMemo(() => {
    const roleScope = String(selectedRole?.scope || "user").trim().toLowerCase();

    return dbModules
      .filter((dbMod) => {
        if (dbMod.status !== "active") return false;

        // Resolve scope value from catalog
        const scopeObj = scopesList.find(s => s.Initials_PK?.toLowerCase() === dbMod.scope_id?.toLowerCase() || s.value?.toLowerCase() === dbMod.scope_id?.toLowerCase());
        const modScopeVal = String(scopeObj?.value || dbMod.scope_id || "").trim().toLowerCase();

        if (roleScope === "user") {
          return modScopeVal === "user" || !modScopeVal;
        }
        if (roleScope === "admin" || roleScope === "administrator" || roleScope === "administrador") {
          return modScopeVal === "user" || modScopeVal === "admin" || !modScopeVal;
        }
        return true; // SU can configure everything
      })
      .map((dbMod) => {
        // Fallback robusto para destination si no está definido
        let dest = (dbMod.destination || "").trim();
        if (!dest) {
          if (dbMod.parent === "mobile-root") {
            dest = "mobile";
          } else {
            dest = "web";
          }
        }

        return {
          id: dbMod.id,
          name: dbMod.name,
          route: dbMod.route,
          parent: dbMod.parent || "/",
          destination: dest,
          content: dbMod.content || "",
          icon: getModuleIcon(dbMod.route, dbMod.icon),
          actions: dbMod.actions
        };
      });
  }, [dbModules, selectedRole, scopesList]);

  // Módulos clasificados por secciones
  const sections = useMemo(() => {
    const DESTINATION_MAP: Record<string, string> = {
      web: "Menú Principal",
      mobile: "Aplicación Móvil",
      desktop: "Aplicación de Escritorio",
      wearable: "Dispositivos Wearables"
    };

    // 1. Identificar todos los destinos específicos presentes en los módulos cargados
    const uniqueDestinations = new Set<string>(["web", "mobile"]);
    activeModules.forEach((m) => {
      if (m.destination && m.destination !== "AllApp") {
        uniqueDestinations.add(m.destination);
      }
    });

    const destinationOrder = Array.from(uniqueDestinations);

    // 2. Agrupar módulos
    return destinationOrder.map((destKey) => {
      const items = activeModules.filter(
        (m) => m.destination === destKey || m.destination === "AllApp"
      );

      // Ordenar jerárquicamente: padres primero, hijos inmediatamente debajo
      const ordered: any[] = [];
      const parents = items.filter((m) => m.parent === "/" || m.parent === "mobile-root");

      parents.forEach((parent) => {
        ordered.push(parent);
        const children = items.filter((m) => m.parent === parent.id);
        ordered.push(...children);
      });

      // Añadir huérfanos si existieran
      items.forEach((m) => {
        if (!ordered.some((o) => o.id === m.id)) {
          ordered.push(m);
        }
      });

      const categoryTitle = DESTINATION_MAP[destKey] || destKey.charAt(0).toUpperCase() + destKey.slice(1);

      return { category: categoryTitle, items: ordered };
    });
  }, [activeModules]);



  const syncContainerPermissions = (currentPerms: Record<string, Permission>) => {
    const nextPerms = { ...currentPerms };
    activeModules.forEach((item) => {
      const hasChildren = activeModules.some((m) => m.parent === item.id);
      if (hasChildren) {
        const children = activeModules.filter((m) => m.parent === item.id);
        const anyChildHasPerm = children.some((child) => {
          const childPerm = nextPerms[child.id];
          if (!childPerm) return false;
          const hasCrud = childPerm.read || childPerm.create || childPerm.update || childPerm.delete;
          const hasMicros = Object.values(childPerm.microroles || {}).some((v) => !!v);
          return hasCrud || hasMicros;
        });

        nextPerms[item.id] = {
          ...nextPerms[item.id],
          read: anyChildHasPerm,
          create: false,
          update: false,
          delete: false,
          microroles: {}
        };
      }
    });
    return nextPerms;
  };

  useEffect(() => {
    if (selectedRole) {
      setRoleForm({
        key_id: selectedRole.key_id || "",
        name: selectedRole.name || "",
        description: selectedRole.description || "",
        scope: selectedRole.scope || "user",
        company_id: selectedRole.company_id || "900000000"
      });

      // Inicializar matriz de permisos desde JSON o por defecto inactivos (sin permisos)
      const savedPerms = selectedRole.permissions || {};
      const newPerms: Record<string, Permission> = {};
      activeModules.forEach((m) => {
        newPerms[m.id] = savedPerms[m.id] || { read: false, create: false, update: false, delete: false, microroles: {} };
      });
      setPermissions(syncContainerPermissions(newPerms));
    }
  }, [selectedRole, activeModules]);

  const handleCheckboxChange = (moduleId: string, type: keyof Permission) => {
    if (!isEditing) return;

    const current = permissions[moduleId] || { read: false, create: false, update: false, delete: false, microroles: {} };

    // Si se está quitando el permiso de lectura y existen otros permisos activos
    if (type === "read" && current.read) {
      const hasOtherPermissions = current.create || current.update || current.delete || Object.values(current.microroles || {}).some(v => !!v);

      if (hasOtherPermissions) {
        const moduleName = activeModules.find((m) => m.id === moduleId)?.name || "este módulo";

        showConfirm(
          "¿Retirar todos los permisos?",
          `Al deshabilitar el permiso de lectura para "${moduleName}", también se desactivarán automáticamente todos los permisos de escritura (Crear, Actualizar, Borrar) y las acciones especiales configuradas. ¿Deseas continuar?`,
          () => {
            setPermissions((prev) => {
              const currentPerm = prev[moduleId] || { read: false, create: false, update: false, delete: false, microroles: {} };
              const clearedMicros: Record<string, boolean> = {};
              if (currentPerm.microroles) {
                Object.keys(currentPerm.microroles).forEach((key) => {
                  clearedMicros[key] = false;
                });
              }
              const updated = {
                ...prev,
                [moduleId]: {
                  ...currentPerm,
                  read: false,
                  create: false,
                  update: false,
                  delete: false,
                  microroles: clearedMicros
                }
              };
              return syncContainerPermissions(updated);
            });
          },
          "Desactivar todos",
          "warning"
        );
        return;
      }
    }

    setPermissions((prev) => {
      const currentPerm = prev[moduleId] || { read: false, create: false, update: false, delete: false, microroles: {} };
      const nextVal = !currentPerm[type as keyof Permission];

      // Auto-activar lectura si se otorga cualquier permiso del CRUD o permitir toggle manual
      let nextRead = currentPerm.read;
      if (type === "read") {
        nextRead = nextVal;
      } else if (nextVal) {
        nextRead = true;
      }

      const updated = {
        ...prev,
        [moduleId]: {
          ...currentPerm,
          [type]: nextVal,
          read: nextRead
        } as any
      };
      return syncContainerPermissions(updated);
    });
  };

  const handleMicroRoleToggle = (moduleId: string, microKey: string) => {
    if (!isEditing) return;
    setPermissions((prev) => {
      const modulePerm = prev[moduleId] || { read: false, create: false, update: false, delete: false, microroles: {} };
      const currentMicros = modulePerm.microroles || {};
      const nextMicroVal = !currentMicros[microKey];

      // Auto-activar lectura si se habilita un microrol
      let nextRead = modulePerm.read;
      if (nextMicroVal) {
        nextRead = true;
      }

      const updated = {
        ...prev,
        [moduleId]: {
          ...modulePerm,
          read: nextRead,
          microroles: {
            ...currentMicros,
            [microKey]: nextMicroVal
          }
        }
      };
      return syncContainerPermissions(updated);
    });
  };

  const toggleExpand = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const addCustomMicroRole = (moduleId: string) => {
    const name = (newMicroNames[moduleId] || "").trim();
    if (!name) return;

    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setCustomMicroRoles((prev) => {
      const list = prev[moduleId] || [];
      if (list.some((item) => item.key === key)) return prev;
      return {
        ...prev,
        [moduleId]: [...list, { key, label: name }]
      };
    });
    setNewMicroNames((prev) => ({ ...prev, [moduleId]: "" }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/v1/db/roles", {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ id: selectedRoleId, permissions })
      });

      if (!response.ok) throw new Error("No se pudo guardar la configuración de permisos");

      if (typeof window !== "undefined") {
        localStorage.removeItem(ROLES_CACHE_KEY);
      }
      setIsEditing(false);

      const roleRes = await fetch("/api/v1/db/roles", { headers });
      const roleBody = await roleRes.json();
      const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
      setRoles(fetchedRoles);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // handleAddRole ahora abre el drawer premium
  const handleAddRole = () => openCreateDrawer();

  const handleDeleteRole = async (item: RoleRecord) => {
    showConfirm(
      "¿Eliminar este cargo?",
      `Esta acción es irreversible y removerá todos los privilegios asociados al cargo "${item.name}". ¿Deseas continuar?`,
      async () => {
        setSaving(true);
        try {
          const response = await fetch("/api/v1/db/roles", {
            method: "DELETE",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ id: item.id })
          });
          if (!response.ok) throw new Error("No se pudo eliminar el cargo");

          if (typeof window !== "undefined") {
            localStorage.removeItem(ROLES_CACHE_KEY);
          }

          const roleRes = await fetch("/api/v1/db/roles", { headers });
          const roleBody = await roleRes.json();
          const fetchedRoles = Array.isArray(roleBody?.data) ? roleBody.data : [];
          setRoles(fetchedRoles);

          if (selectedRoleId === item.id && fetchedRoles.length > 0) {
            setSelectedRoleId(fetchedRoles[0].id);
          }
          setIsEditing(false);
        } catch {
          setError("No fue posible eliminar el cargo.");
        } finally {
          setSaving(false);
        }
      },
      "Eliminar",
      "danger"
    );
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 overflow-hidden text-slate-800 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">

        {/* ENCABEZADO */}
        <header className="flex-shrink-0">
          <h2 className="text-2xl font-semibold">Roles y Permisos del Sistema</h2>
          <p className="text-sm text-slate-500">Asigna privilegios de lectura, escritura y acciones específicas de negocio para cada cargo.</p>
        </header>



        {/* BARRA DE CONTROLES: BUSCADOR Y FILTROS */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
          <div className="grid w-full gap-2 md:grid-cols-[1fr_220px] lg:max-w-[62%]">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por ID Clave, nombre o descripción..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-purple-400 focus:bg-white"
            />
            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-purple-400 focus:bg-white"
            >
              <option value="all">Todos los Alcances</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="SU">Super Admin</option>
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
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Columnas
              </button>
              {showColumnsMenu ? (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                  {tableColumns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(column.key)}
                        onChange={() => toggleColumn(column.key)}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>


          </div>
        </div>

        {/* METADATOS DE PAGINACIÓN RÁPIDA */}
        <div className="flex items-center justify-between text-sm text-slate-500 flex-shrink-0 font-medium">
          <span>{visibleRoles.length} resultados</span>
          <label className="flex items-center gap-2">
            Filas por página:
            <select
              value={String(rowsPerPage)}
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 font-medium outline-none"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
        </div>

        {/* TABLA PRINCIPAL DE CARGOS */}
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 min-h-0 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/80 text-left text-slate-500 font-semibold sticky top-0 z-10 border-b border-slate-200 select-none">
              <tr>
                {headerColumns.map((column) => (
                  <th key={column.key} className={`px-4 py-3 ${column.key === "actions" ? "text-center" : ""}`}>
                    {column.key !== "actions" ? (
                      <button
                        type="button"
                        className="font-semibold text-slate-500 hover:text-slate-700 transition"
                        onClick={() => setSort(column.key as keyof RoleRecord)}
                      >
                        {column.label} {sortBy === column.key && (sortDir === "asc" ? " ▲" : " ▼")}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRoles.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition duration-150">
                  {headerColumns.map((column) => {
                    if (column.key === "key_id") {
                      return <td key={`${item.id}-key_id`} className="px-4 py-3.5 font-mono font-bold text-slate-600">{item.key_id}</td>;
                    }
                    if (column.key === "name") {
                      return <td key={`${item.id}-name`} className="px-4 py-3.5 font-semibold text-slate-700">{item.name}</td>;
                    }
                    if (column.key === "description") {
                      return <td key={`${item.id}-description`} className="px-4 py-3.5 max-w-[280px] truncate text-slate-500" title={item.description || ""}>{item.description ?? "-"}</td>;
                    }
                    if (column.key === "scope") {
                      return (
                        <td key={`${item.id}-scope`} className="px-4 py-3.5">
                          <span className="rounded-xl bg-purple-50 border border-purple-100 px-2.5 py-1 text-2xs font-bold text-[#9b5de5] uppercase tracking-wider">
                            {item.scope}
                          </span>
                        </td>
                      );
                    }
                    if (column.key === "permissions_count") {
                      const count = Object.values(item.permissions || {}).filter(p => (p.status ?? 'active') === 'active').length;
                      return (
                        <td key={`${item.id}-permissions_count`} className="px-4 py-3.5 font-medium text-slate-600">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                            {count} {count === 1 ? 'permiso' : 'permisos'}
                          </span>
                        </td>
                      );
                    }
                    if (column.key === "integrity") {
                      const isVulnerada = item.integrityStatus === "vulnerada";
                      return (
                        <td key={`${item.id}-integrity`} className="px-4 py-3.5 font-medium">
                          {isVulnerada ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 border border-rose-100 animate-pulse">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="h-3.5 w-3.5 shrink-0 text-rose-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                              </svg>
                              VULNERADA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="h-3.5 w-3.5 shrink-0 text-emerald-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              Completa
                            </span>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td key={`${item.id}-actions`} className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">

                          {/* Configurar Permisos o Reparar */}
                          {item.integrityStatus === "vulnerada" ? (
                            <button
                              type="button"
                              onClick={() => handleRepairRole(item)}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition duration-150 shadow-sm whitespace-nowrap animate-pulse"
                            >
                              🛠️ Reparar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEditPermissions(item)}
                              className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-semibold text-[#9b5de5] hover:bg-purple-100 hover:border-purple-300 transition duration-150 shadow-sm whitespace-nowrap"
                            >
                              Ver permisos
                            </button>
                          )}

                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {pagedRoles.length === 0 ? (
                <tr>
                  <td colSpan={headerColumns.length} className="px-4 py-8 text-center text-slate-400 italic">No hay cargos que coincidan con los filtros de búsqueda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* CONTROLADORES DE PAGINACIÓN */}
        <div className="flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center flex-shrink-0 pt-2">
          <p>Mostrando {pagedRoles.length} de {visibleRoles.length} cargos</p>
          <div className="flex items-center gap-2 select-none font-semibold">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="rounded-xl border border-slate-200 px-4 py-1.5 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Anterior
            </button>
            <span className="rounded-xl bg-[#9b5de5] px-3.5 py-1.5 text-white font-bold">{safePage}</span>
            <span>de {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="rounded-xl border border-slate-200 px-4 py-1.5 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Siguiente
            </button>
          </div>
        </div>

      </div>

      {/* DRAWER LATERAL DE CREACIÓN / EDICIÓN DE CARGO */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={closeDrawer}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto bg-white shadow-2xl transition-transform duration-220 ease-out flex flex-col ${drawerVisible ? "translate-x-0" : "translate-x-full"
              }`}
          >
            {/* HEADER DEL DRAWER */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b5de5] to-[#743eb3] text-white shadow-md shadow-purple-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">
                    {editingRoleId ? "Editar Cargo" : "Nuevo Cargo"}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {editingRoleId ? "Modifica los datos del cargo seleccionado" : "Crea un nuevo cargo con persistencia en la base de datos"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition mt-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* CUERPO DEL FORMULARIO */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

              {/* ID Clave */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  ID Clave <span className="text-rose-400">*</span>
                  <span className="ml-1 normal-case text-slate-400 font-normal">(máx. 5 caracteres, ej: VEN)</span>
                </label>
                <input
                  type="text"
                  value={drawerForm.key_id}
                  disabled={!!editingRoleId}
                  onChange={(e) => setDrawerForm((s) => ({ ...s, key_id: e.target.value.toUpperCase().slice(0, 5) }))}
                  placeholder="Ej: ADM"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:bg-white transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                {drawerErrors.key_id ? <p className="mt-1 text-xs text-rose-600">{drawerErrors.key_id}</p> : null}
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nombre del Cargo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={drawerForm.name}
                  onChange={(e) => setDrawerForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Ej: Vendedor de Mostrador"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:bg-white transition"
                  autoFocus={!editingRoleId}
                />
                {drawerErrors.name ? <p className="mt-1 text-xs text-rose-600">{drawerErrors.name}</p> : null}
              </div>

              {/* Alcance */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Alcance (Scope) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={drawerForm.scope}
                  onChange={(e) => setDrawerForm((s) => ({ ...s, scope: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:bg-white transition"
                >
                  <option value="User">User — Usuario estándar</option>
                  <option value="Admin">Admin — Administrador</option>
                  <option value="SU">SU — Super Admin</option>
                </select>
                {drawerErrors.scope ? <p className="mt-1 text-xs text-rose-600">{drawerErrors.scope}</p> : null}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Descripción
                  <span className="ml-1 normal-case text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={drawerForm.description}
                  onChange={(e) => setDrawerForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Describe brevemente las responsabilidades de este cargo..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:bg-white transition resize-none"
                />
              </div>

              {!editingRoleId && (
                <p className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-xs text-purple-700 font-medium leading-relaxed">
                  <strong>💡 Tip:</strong> Al crear el cargo, se abrirá automáticamente la matriz de permisos para que puedas configurarla de inmediato.
                </p>
              )}
            </div>

            {/* FOOTER DEL DRAWER */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/60 flex-shrink-0">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-600 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSubmitRoleForm()}
                className="rounded-xl bg-gradient-to-r from-[#9b5de5] to-[#743eb3] hover:from-[#864cc7] hover:to-[#632f9e] px-6 py-2.5 text-sm font-bold text-white transition shadow-md shadow-purple-100 hover:shadow-purple-200 disabled:opacity-50 active:scale-[0.98] transform"
              >
                {saving ? "Guardando..." : editingRoleId ? "Guardar Cambios" : "Crear Cargo"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MODAL DE MATRIZ DE PERMISOS */}
      {permissionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => { if (!saving) setPermissionsModalOpen(false); }} />

          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">

            {/* ENCABEZADO */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b5de5] to-[#743eb3] text-white shadow-md shadow-purple-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-3.81-.318-7.532-.902-9.136A11.959 11.959 0 0 1 12 2.714Z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold text-slate-800 leading-tight">
                    Matriz de Permisos: {roleForm.name || "Cargo"}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium mt-0.5 block">
                    {roleForm.description || "Sin descripción"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isEditing ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Modo Edición
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Modo Lectura
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setPermissionsModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                  title="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* CUERPO (CON SCROLL) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/30">
              {sections.map((sect) => (
                <div key={sect.category} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">

                  {/* HEADER DE LA CATEGORÍA */}
                  <div className="bg-slate-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    {sect.category}
                  </div>

                  {/* TABLA DE DETALLES */}
                  <table className="min-w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                        <th className="w-[45%] px-4 py-2 text-left font-semibold">MÓDULO / RUTA</th>
                        <th className="w-[11%] py-2 font-semibold">LEER</th>
                        <th className="w-[11%] py-2 font-semibold">CREAR</th>
                        <th className="w-[11%] py-2 font-semibold">ACTUALIZAR</th>
                        <th className="w-[11%] py-2 font-semibold">BORRAR</th>
                        <th className="w-[11%] py-2 font-semibold">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sect.items.map((item) => {
                        const isChild = item.parent !== "/" && item.parent !== "mobile-root";
                        const perm = permissions[item.id] || { read: false, create: false, update: false, delete: false, microroles: {} };
                        const isExpanded = !!expandedModules[item.id];
                        const moduleMicros = customMicroRoles[item.id] || [];
                        const hasChildren = activeModules.some((m) => m.parent === item.id);

                        if (item.content === "section") {
                          return (
                            <Fragment key={item.id}>
                              <tr className="bg-slate-100/70 border-y border-slate-200/50 transition duration-150">
                                <td colSpan={6} className="px-4 py-0.5 text-center select-none text-xs font-bold uppercase tracking-wider text-slate-500">
                                  {item.name}
                                </td>
                              </tr>
                            </Fragment>
                          );
                        }

                        return (
                          <Fragment key={item.id}>
                            <tr className="hover:bg-slate-50/50 transition duration-150">
                              <td className={`px-4 py-3 text-slate-700 flex items-center gap-2 ${isChild ? "pl-8 text-xs text-slate-500" : "font-semibold"}`}>
                                {!isChild && renderModuleIcon(item.icon)}
                                <span>{item.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({item.route})</span>
                              </td>

                              {/* CHECKBOXES DE PERMISOS */}
                              {(["read", "create", "update", "delete"] as Array<"read" | "create" | "update" | "delete">).map((type) => (
                                <td key={type} className="py-3 text-center">
                                  {hasChildren && type !== "read" ? (
                                    <span className="text-slate-300 font-medium select-none">—</span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!isEditing || (hasChildren && type === "read")}
                                      onClick={() => handleCheckboxChange(item.id, type)}
                                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border text-white transition focus:outline-none ${perm[type]
                                          ? "bg-[#9b5de5] border-[#9b5de5] shadow-sm shadow-purple-200"
                                          : "border-slate-200 hover:border-slate-300 bg-white"
                                        } ${(!isEditing || (hasChildren && type === "read")) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      {perm[type] && (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-3 w-3">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                </td>
                              ))}

                              {/* BOTÓN PARA DESPLEGAR ACCIONES */}
                              <td className="py-3 text-center">
                                {!hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(item.id)}
                                    className={`relative rounded-xl px-3 py-1 text-xs font-semibold border transition duration-150 ${isExpanded
                                        ? "bg-white text-purple-600 border-purple-600 font-bold shadow-sm shadow-purple-50"
                                        : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
                                      }`}
                                  >
                                    {isExpanded ? "Ocultar" : "Acciones"}
                                    {(() => {
                                      const rawActions = Array.isArray(item.actions) ? item.actions : [];
                                      const activeOrDepCount = rawActions.filter((act: any) => (act.status ?? 'active') === 'active' || act.status === 'deprecated').length;
                                      if (activeOrDepCount === 0) return null;
                                      return (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-600 px-1 text-[8px] font-bold text-white shadow-sm ring-2 ring-white">
                                          {activeOrDepCount}
                                        </span>
                                      );
                                    })()}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 font-medium" title="Módulo contenedor (embebido)">—</span>
                                )}
                              </td>
                            </tr>

                            {/* LISTADO DE ACCIONES DESPLEGABLE */}
                            {isExpanded && !hasChildren && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={6} className="px-6 py-4 border-t border-slate-100/60">
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                        <span>Acciones de {item.name.toUpperCase()}</span>
                                      </h4>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                                      {(() => {
                                        const rawActions = Array.isArray(item.actions) ? item.actions : [];
                                        const moduleMicros = rawActions.filter((act: any) => (act.status ?? 'active') === 'active' || act.status === 'deprecated');

                                        if (moduleMicros.length === 0) {
                                          return (
                                            <p className="text-xs text-slate-400 italic col-span-full">No hay acciones de negocio definidas.</p>
                                          );
                                        }

                                        return moduleMicros.map((micro: any) => {
                                          const key = micro.id || micro.key;
                                          const isGranted = !!(perm.microroles?.[key]);
                                          const isDeprecated = micro.status === "deprecated";

                                          return (
                                            <div
                                              key={key}
                                              className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium shadow-sm transition gap-2 group text-left ${isDeprecated
                                                  ? "border-amber-200 bg-amber-50/20 hover:bg-amber-50/30"
                                                  : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                                <input
                                                  type="checkbox"
                                                  disabled={!isEditing}
                                                  checked={isGranted}
                                                  onChange={() => handleMicroRoleToggle(item.id, key)}
                                                  className="h-4 w-4 rounded border-slate-300 text-[#9b5de5] focus:ring-[#9b5de5] cursor-pointer"
                                                />
                                                <span className="text-slate-700 truncate flex items-center gap-1.5">
                                                  {micro.label}
                                                  {isDeprecated && (
                                                    <span className="text-amber-500 font-bold" title="Acción Deprecada (Warning)">⚠️</span>
                                                  )}
                                                </span>
                                              </label>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* BOTONES DE ACCIÓN EN EL FOOTER DEL MODAL */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5 bg-slate-50/50 flex-shrink-0">
              {!isEditing ? (
                <>
                  {userPermissions.update ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-md"
                    >
                      Editar Permisos
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPermissionsModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-600 transition"
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-600 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      await handleSave();
                      setPermissionsModalOpen(false);
                    }}
                    className="rounded-xl bg-[#2ad072] px-6 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition shadow-md"
                  >
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE REPARACIÓN DE CARGO (INTEGRIDAD VULNERADA) */}
      {repairModalOpen && repairRoleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => { if (!repairLoading) setRepairModalOpen(false); }} />

          <div className="relative bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">

            {/* ENCABEZADO */}
            <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-rose-50/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6 animate-pulse">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-extrabold text-slate-800 leading-tight">
                    Reparar Integridad del Cargo
                  </h3>
                  <span className="text-xs text-rose-500 font-semibold mt-0.5 block">
                    Cargo: {repairRoleItem.name} ({repairRoleItem.key_id})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRepairModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                title="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* CONTENIDO DEL MODAL */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {headers["x-actor-role"] !== "SU" ? (
                /* BANNER PREMIUM DE ACCESO DENEGADO PARA NO-SU */
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-4 shadow-sm">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-8 w-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-red-800">Acceso Altamente Restringido</h4>
                  <p className="text-sm text-red-600 max-w-md mx-auto leading-relaxed">
                    Se ha detectado una alteración no autorizada de privilegios (Vulneración criptográfica). La reparación de firmas y consistencia de base de datos está restringida **exclusivamente a Super Usuarios (SU)** del sistema.
                  </p>
                  <p className="text-xs text-red-400 font-semibold">
                    Por favor, póngase en contacto con el administrador de seguridad informática.
                  </p>
                </div>
              ) : (
                /* ACCIONES PARA SUPER USUARIO (SU) */
                <div className="space-y-6">
                  {repairError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 font-medium">
                      ❌ {repairError}
                    </div>
                  )}

                  {!repairResult ? (
                    <>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 leading-relaxed space-y-2">
                        <h4 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                          ⚠️ Alerta de Seguridad del Sistema
                        </h4>
                        <p className="text-xs text-amber-700">
                          La firma criptográfica `hashPermission` de este cargo no coincide con el estado actual de los permisos en la base de datos. Esto indica que los registros han sido alterados directamente o de forma ajena a la plataforma.
                        </p>
                        <p className="text-xs text-amber-700 font-semibold">
                          Seleccione uno de los dos métodos oficiales de reparación provistos a continuación:
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* OP-1: RESTAURAR DESDE BACKUP CIFRADO */}
                        <button
                          type="button"
                          onClick={() => handleExecuteRepair("restore")}
                          disabled={repairLoading}
                          className="flex flex-col text-left p-5 rounded-2xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 transition group active:scale-[0.98] transform duration-150"
                        >
                          <div className="h-10 w-10 rounded-xl bg-purple-50 text-[#9b5de5] flex items-center justify-center font-bold mb-3 shadow-sm border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition duration-150">
                            🛡️
                          </div>
                          <span className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition">
                            Restaurar desde Backup
                          </span>
                          <span className="text-2xs text-slate-500 mt-1 leading-relaxed">
                            Recupera la copia de seguridad guardada y cifrada con AES-256-CBC, realiza un análisis de discrepancias, sobrescribe los permisos alterados y genera un reporte oficial de auditoría.
                          </span>
                        </button>

                        {/* OP-2: CONFIGURAR DESDE CERO */}
                        <button
                          type="button"
                          onClick={() => {
                            showConfirm(
                              "¿Configurar desde Cero?",
                              "Esta opción revocará y eliminará por completo todos los permisos activos y copias de seguridad de este cargo, restableciéndolo a un estado vacío. ¿Deseas proceder?",
                              () => handleExecuteRepair("scratch"),
                              "Restablecer a Cero",
                              "danger"
                            );
                          }}
                          disabled={repairLoading}
                          className="flex flex-col text-left p-5 rounded-2xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/20 transition group active:scale-[0.98] transform duration-150"
                        >
                          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold mb-3 shadow-sm border border-rose-100 group-hover:bg-rose-600 group-hover:text-white transition duration-150">
                            🧹
                          </div>
                          <span className="text-sm font-bold text-slate-800 group-hover:text-rose-700 transition">
                            Configurar desde Cero
                          </span>
                          <span className="text-2xs text-slate-500 mt-1 leading-relaxed">
                            Limpia y depura completamente cualquier configuración corrupta existente en la base de datos para este cargo, permitiendo la asignación manual y limpia desde el principio.
                          </span>
                        </button>
                      </div>

                      {repairLoading && (
                        <div className="flex flex-col items-center justify-center py-6 gap-3">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                          <span className="text-xs font-semibold text-purple-600 animate-pulse">
                            Ejecutando operaciones de recuperación y validación criptográfica...
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    /* REPORTE DE AUDITORÍA Y DISCREPANCIAS */
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          ✓
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-emerald-800">
                            Reparación Completada Exitosamente
                          </h4>
                          <p className="text-xs text-emerald-700 mt-1">
                            Se ha reestablecido la integridad de los permisos y se ha vuelto a firmar digitalmente el cargo en la base de datos.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Reporte de Discrepancias Neutralizadas
                        </span>
                        <div className="rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 p-4 font-mono text-xs leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                          {repairResult.report}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-2xs text-slate-500 leading-normal">
                        <strong>🛡️ Nota de Auditoría:</strong> El reporte completo de diferencias detectadas ha sido registrado permanentemente en la tabla `audit_logs` con la acción de auditoría `"repair_audit_report"`.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PIE DEL MODAL */}
            <div className="flex items-center justify-end border-t border-slate-100 p-5 bg-slate-50/50 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRepairModalOpen(false);
                  setRepairResult(null);
                  setRepairError("");
                }}
                disabled={repairLoading}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-600 transition"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO Y ESTILIZADO */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* BACKDROP BLUR (GLASSMORPHISM) */}
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />

          {/* CONTENEDOR DEL MODAL PREMIUM */}
          <form
            onSubmit={handleModalSubmit}
            className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 w-full max-w-[400px] flex flex-col gap-5 transform transition-all animate-in fade-in zoom-in-95 duration-200"
          >
            {/* ENCABEZADO CON ICONO Y BOTÓN CERRAR */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b5de5] to-[#743eb3] text-white shadow-md shadow-purple-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.831a1.125 1.125 0 0 1 .26 1.43l-1.297 2.247a1.125 1.125 0 0 1-1.37.491l-1.216-.456c-.356-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.83c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-base font-bold text-slate-800 leading-tight">
                  {modalType === "create" ? "Nueva Acción" : "Editar Acción"}
                </h3>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {modalType === "create" ? `Módulo: ${modalModuleName}` : "Actualizar acción"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition duration-150"
                title="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* CUERPO DEL FORMULARIO */}
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                {modalType === "create"
                  ? "Las acciones te permiten definir permisos ultra-específicos de negocio para este módulo de manera dinámica."
                  : "Modifica el nombre de la acción seleccionada. Los cambios se aplicarán de inmediato en la grilla de control."}
              </p>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Nombre descriptivo
                </span>
                <input
                  type="text"
                  required
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder="Ej: Aprobar Lote de Flores"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:bg-white transition duration-200"
                  autoFocus
                />
              </label>
            </div>

            {/* ACCIONES DEL PIE */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-600 transition duration-150 hover:border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-[#9b5de5] to-[#743eb3] hover:from-[#864cc7] hover:to-[#632f9e] px-6 py-2.5 text-sm font-bold text-white transition duration-200 shadow-md shadow-purple-100 hover:shadow-purple-200 active:scale-[0.98] transform"
              >
                {modalType === "create" ? "Crear Acción" : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
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
            <div className="mt-6 flex justify-end gap-3">
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

export default DynamicComponent;