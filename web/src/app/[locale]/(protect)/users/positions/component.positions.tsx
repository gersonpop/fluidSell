"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {getSecureItem, setSecureItem} from "@/lib/secure-store";

type RoleItem = {
  id: string;
  key_id: string; // mapped from key
  name: string;
  description: string | null;
  scope: string; // "user" | "admin" | "SU" | "CLIENT" etc.
  company_id: string | null;
  status?: string;
  updated_at?: string | null;
  permissions?: Record<string, {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    status: string;
    microroles: any;
  }>;
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

  const permissions = useMemo(() => {
    if (actorRole === "SU") {
      return { read: true, create: true, update: true, delete: true };
    }
    const cacheKey = `sidebar_modules_${actorId}_${companyId ?? ""}`;
    const modules = getSecureItem<any[]>(cacheKey, actorId);
    if (modules && Array.isArray(modules)) {
      const match = modules.find((m) => m.route === "/users/positions");
      if (match && match.permission) {
        return match.permission as { read: boolean; create: boolean; update: boolean; delete: boolean };
      }
    }
    return { read: true, create: false, update: false, delete: false };
  }, [actorId, actorRole, companyId]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>(companyId ?? "");
  const [copyModalRole, setCopyModalRole] = useState<RoleItem | null>(null);
  const [modulesList, setModulesList] = useState<any[]>([]);
  const sortedCompanies = useMemo(() => {
    const list = [...companies];
    const idx = list.findIndex(c => String(c.commercialName || "").toLowerCase().includes("fluidsell"));
    if (idx > -1) {
      const [fs] = list.splice(idx, 1);
      list.unshift(fs!);
    }
    return list;
  }, [companies]);

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
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setError(null);
    }
  }, [error, showToast]);

  useEffect(() => {
    if (success) {
      showToast(success, "success");
      setSuccess(null);
    }
  }, [success, showToast]);
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
      "content-type": "application/json",
      ...(actorRole === "SU" ? { "x-show-all-companies": "true" } : {})
    }),
    [actorId, actorRole, companyId]
  );

  // Load static scopes from localStorage immediately on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const parsed = getSecureItem<ScopeItem[]>(SCOPES_CACHE_KEY, actorId);
      if (parsed && Array.isArray(parsed)) {
        setScopes(parsed);
      }
    }
  }, [actorId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setProgress(0);
    setLoadingMessage("Iniciando conexión con la base de datos...");
    try {
      // 1. Modules
      setLoadingMessage("Cargando catálogo de módulos del sistema...");
      setProgress(10);
      const modulesRes = await fetch("/api/v1/db/modules", {headers});
      setProgress(25);
      const modulesBody = await modulesRes.json();
      if (modulesRes.ok) {
        setModulesList(modulesBody.data ?? []);
      }

      // 2. Multidata (Scopes)
      setLoadingMessage("Cargando alcances de seguridad del sistema...");
      setProgress(40);
      const scopesRes = await fetch("/api/v1/db/st_multidata", {headers});
      setProgress(55);
      const scopesBody = await scopesRes.json();
      if (!scopesRes.ok) throw new Error(scopesBody.message ?? "No se pudieron cargar los scopes");
      const rawScopes = (scopesBody.data ?? []) as ScopeCatalogItem[];
      const roleScopes = rawScopes.filter(isRoleScope).map(normalizeScopeItem).filter((item): item is ScopeItem => item !== null);
      setScopes(roleScopes);
      if (typeof window !== "undefined") {
        setSecureItem(SCOPES_CACHE_KEY, roleScopes, actorId);
      }

      // 3. Roles
      setLoadingMessage("Cargando cargos de las empresas...");
      setProgress(70);
      const rolesRes = await fetch("/api/v1/db/roles", {headers});
      setProgress(85);
      const rolesBody = await rolesRes.json();
      if (!rolesRes.ok) throw new Error(rolesBody.message ?? "No se pudieron cargar los cargos");
      setRoles((rolesBody.data ?? []) as RoleItem[]);

      // 4. Companies (for SU)
      if (actorRole === "SU") {
        setLoadingMessage("Cargando listado de empresas registradas...");
        setProgress(90);
        const companiesRes = await fetch("/api/v1/db/companies", {headers});
        setProgress(98);
        if (companiesRes.ok) {
          const companiesBody = await companiesRes.json();
          setCompanies((companiesBody.data ?? []) as CompanyItem[]);
        }
      }

      setProgress(100);
      setLoadingMessage("Datos cargados correctamente.");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar datos");
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 400);
    }
  }, [headers, actorRole, actorId]);

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
      const companyMatch = actorRole !== "SU" || !selectedCompanyFilter || item.company_id === selectedCompanyFilter;
      return textMatch && scopeMatch && companyMatch;
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
  }, [roles, search, scopeFilter, sortBy, sortDir, actorRole, selectedCompanyFilter]);

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
      if (permissions.update || permissions.delete) {
        cols.push({key: "actions", label: "Acciones"});
      }
      return cols;
    },
    [actorRole, permissions]
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

  const getModuleName = (mId: string) => {
    const found = modulesList.find(m => m.id === mId);
    return found ? found.name : mId;
  };

  const generateAsciiPermissions = (rolePerms: any) => {
    if (!rolePerms || Object.keys(rolePerms).length === 0) {
      return "No hay permisos configurados.";
    }

    // 1. Gather all active modules (those with active permissions)
    const activeModIds = new Set<string>();
    const modPermMap = new Map<string, any>();

    Object.entries(rolePerms).forEach(([mId, perm]: [string, any]) => {
      const hasCrud = perm.read || perm.create || perm.update || perm.delete;
      const activeMicros = Object.entries(perm.microroles || {}).filter(([_, val]) => !!val);
      
      if (hasCrud || activeMicros.length > 0) {
        activeModIds.add(mId);
        modPermMap.set(mId, {
          crud: perm,
          activeMicros: activeMicros.map(([key]) => key)
        });
      }
    });

    // 2. Identify and include parent sections if they have active children
    const finalNodes = new Map<string, any>();
    activeModIds.forEach((mId) => {
      const mod = modulesList.find((m) => m.id === mId);
      if (!mod) return;

      finalNodes.set(mId, {
        id: mId,
        name: mod.name,
        parent: mod.parent || "/",
        isSection: mod.content === "section" || mod.pageContent === "section",
        content: mod.content || mod.pageContent || "newPage",
        actions: mod.actions || [],
        perm: modPermMap.get(mId)
      });

      // Trace parent
      if (mod.parent && mod.parent !== "/" && mod.parent !== "mobile-root") {
        const parentMod = modulesList.find((m) => m.id === mod.parent);
        if (parentMod && !finalNodes.has(parentMod.id)) {
          finalNodes.set(parentMod.id, {
            id: parentMod.id,
            name: parentMod.name,
            parent: parentMod.parent || "/",
            isSection: true,
            content: parentMod.content || parentMod.pageContent || "section",
            actions: parentMod.actions || [],
            perm: null
          });
        }
      }
    });

    const nodeList = Array.from(finalNodes.values());
    if (nodeList.length === 0) {
      return "No tiene permisos activos.";
    }

    // 3. Build hierarchical tree: group children by parent and sort by DB order
    const getModuleIndex = (mId: string) => {
      return modulesList.findIndex((m) => m.id === mId);
    };

    const roots = nodeList
      .filter((n) => n.parent === "/" || n.parent === "mobile-root" || !nodeList.some(p => p.id === n.parent))
      .sort((a, b) => getModuleIndex(a.id) - getModuleIndex(b.id));

    const tree: any[] = [];
    roots.forEach((root) => {
      const children = nodeList
        .filter((n) => n.parent === root.id)
        .sort((a, b) => getModuleIndex(a.id) - getModuleIndex(b.id));
      tree.push({
        ...root,
        children
      });
    });

    // Helper to determine icon, name and CRUD string for a node
    const getNodeRepresentation = (node: any) => {
      const contentType = node.content || "newPage";
      const hasChildrenNode = nodeList.some(n => n.parent === node.id);

      let icon = "📄";
      let showCrud = true;

      if (contentType === "section") {
        icon = hasChildrenNode ? "📂" : "📌";
        showCrud = false; // Sections don't have CRUD permissions displayed
      } else if (contentType === "embedded") {
        icon = "📂";
      } else if (contentType === "newPage") {
        icon = "📄";
      }

      const crudArr: string[] = [];
      if (showCrud && node.perm?.crud) {
        if (node.perm.crud.read) crudArr.push("L");
        if (node.perm.crud.create) crudArr.push("C");
        if (node.perm.crud.update) crudArr.push("A");
        if (node.perm.crud.delete) crudArr.push("E");
      }
      const crudStr = crudArr.length > 0 ? `  (${crudArr.join(", ")})` : "";

      return `${icon} ${node.name}${crudStr}`;
    };

    // 4. Render tree using lines
    const lines: string[] = [];
    lines.push(`📁 ${copyModalRole?.name || "Cargo"}`);

    tree.forEach((rootNode, rootIdx) => {
      const isLastRoot = rootIdx === tree.length - 1;
      const rootConnector = isLastRoot ? "└── " : "├── ";

      const hasChildren = rootNode.children && rootNode.children.length > 0;
      const rootLabel = getNodeRepresentation(rootNode);
      lines.push(`${rootConnector}${rootLabel}`);

      if (hasChildren) {
        const childPrefix = isLastRoot ? "    " : "│   ";
        rootNode.children.forEach((child: any, childIdx: any) => {
          const isLastChild = childIdx === rootNode.children.length - 1;
          const childConnector = isLastChild ? "└── " : "├── ";

          const childLabel = getNodeRepresentation(child);
          lines.push(`${childPrefix}${childConnector}${childLabel}`);

          // Render Child Module Actions
          const actionPrefix = childPrefix + (isLastChild ? "        " : "│       ");
          const activeMicros = child.perm?.activeMicros || [];
          activeMicros.forEach((microKey: string, actIdx: number) => {
            const isLastAct = actIdx === activeMicros.length - 1;
            const actConnector = isLastAct ? "└── " : "├── ";
            
            const rawActions = Array.isArray(child.actions) ? child.actions : [];
            const actionDef = rawActions.find((a: any) => (a.id || a.key) === microKey);
            const actionLabel = actionDef ? (actionDef.label || actionDef.name) : microKey;
            
            lines.push(`${actionPrefix}${actConnector}📄 Acción: ${actionLabel}`);
          });
        });
      } else {
        // Root-level module actions
        const actionPrefix = isLastRoot ? "            " : "  │         ";
        const activeMicros = rootNode.perm?.activeMicros || [];
        activeMicros.forEach((microKey: string, actIdx: number) => {
          const isLastAct = actIdx === activeMicros.length - 1;
          const actConnector = isLastAct ? "└── " : "├── ";
          
          const rawActions = Array.isArray(rootNode.actions) ? rootNode.actions : [];
          const actionDef = rawActions.find((a: any) => (a.id || a.key) === microKey);
          const actionLabel = actionDef ? (actionDef.label || actionDef.name) : microKey;
          
          lines.push(`${actionPrefix}${actConnector}📄 Acción: ${actionLabel}`);
        });
      }
    });

    return lines.join("\n");
  };

  const handleConfirmCopy = async () => {
    if (!copyModalRole) return;
    setSaving(true);
    setLoading(true);
    setProgress(0);
    setLoadingMessage("Estableciendo conexión y copiando estructura del cargo...");
    try {
      setProgress(20);
      const response = await fetch("/api/v1/db/roles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          copyFromRoleId: copyModalRole.id,
          name: `${copyModalRole.name} (Copia)`,
          company_id: companyId
        })
      });
      setProgress(60);
      setLoadingMessage("Replicando permisos y configuraciones en la base de datos...");
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "No se pudo copiar el cargo");
      
      setSuccess("Cargo copiado con éxito");
      setCopyModalRole(null);
      
      setProgress(80);
      setLoadingMessage("Sincronizando información de cargos actualizados...");
      await loadData();
      setProgress(100);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al copiar");
      setLoading(false);
    } finally {
      setSaving(false);
    }
  };

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



  return (
    <section className="flex-1 flex flex-col min-h-0 overflow-hidden text-slate-700 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <article className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        <header className="flex-shrink-0">
          {actorRole === "SU" ? (
            <div className="flex flex-col gap-1.5 max-w-sm mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por Empresa</label>
              <select
                value={selectedCompanyFilter}
                onChange={(e) => {
                  setSelectedCompanyFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 focus:border-cyan-500 focus:outline-none"
              >
                <option value="">-- Todas las Empresas --</option>
                {sortedCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.commercialName} {c.id === companyId ? " (Mi Empresa)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold">Administración de Cargos</h2>
              <p className="text-sm text-slate-550">Crea y administra los cargos (roles) del sistema desde BD usando API dinámica.</p>
            </>
          )}
        </header>

        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
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
              {permissions.create ? (
                <button onClick={openCreateForm} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Agregar Cargo</button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500 flex-shrink-0">
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

          <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 min-h-0 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-500 sticky top-0 z-10 border-b border-slate-200 select-none">
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
              <tbody className="divide-y divide-slate-100">
                {pagedRoles.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition duration-150">
                    {headerColumns.map((column) => {
                      if (column.key === "id") return <td key={`${item.id}-id`} className="px-4 py-3 font-mono text-xs">{item.id}</td>;
                      if (column.key === "key_id") return <td key={`${item.id}-key_id`} className="px-4 py-3 font-mono font-medium">{item.key_id}</td>;
                      if (column.key === "name") return <td key={`${item.id}-name`} className="px-4 py-3 font-semibold">{item.name}</td>;
                      if (column.key === "description") return <td key={`${item.id}-description`} className="px-4 py-3 max-w-[240px] truncate" title={item.description || ""}>{item.description ?? "-"}</td>;
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
                        <td key={`${item.id}-actions`} className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.company_id !== companyId ? (
                              <div className="group relative">
                                <button
                                  type="button"
                                  onClick={() => setCopyModalRole(item)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-600 shadow-sm hover:bg-cyan-100 hover:border-cyan-300 hover:text-cyan-700 transition duration-150 text-xs font-semibold"
                                  title="Copiar Cargo a mi Empresa"
                                >
                                  📋
                                </button>
                                <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                  Copiar
                                </span>
                              </div>
                            ) : (
                              <>
                                {/* Editar (Lápiz Azul) */}
                                {permissions.update ? (
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
                                ) : null}

                                {/* Eliminar (Basura Roja) */}
                                {permissions.delete ? (
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
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {pagedRoles.length === 0 ? (
                  <tr key="empty-positions">
                    <td colSpan={headerColumns.length} className="px-3 py-6 text-center text-slate-500">No hay cargos registrados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center flex-shrink-0 pt-2">
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

      {copyModalRole ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-200" onClick={() => setCopyModalRole(null)} />
          <div className="relative z-10 w-full max-w-lg transform rounded-2xl bg-white p-6 shadow-2xl transition-all duration-200 scale-100 opacity-100 border border-slate-100">
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span>📋 Copiar Cargo del Sistema</span>
                </h3>
                <button type="button" onClick={() => setCopyModalRole(null)} className="text-xl font-bold text-slate-400 hover:text-slate-700">×</button>
              </div>

              <div className="mt-4">
                <p className="text-sm text-slate-650">
                  ¿Deseas copiar el cargo <strong className="text-slate-800">{copyModalRole.name}</strong> a tu empresa?
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Se creará un nuevo cargo en tu organización con la misma estructura y asignación de permisos.
                </p>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Alcance y Permisos del Cargo</h4>
                  <div className="text-xs text-slate-705 space-y-1 mb-3">
                    <div><span className="font-semibold">Alcance (Scope):</span> <span className="rounded-md bg-blue-50 text-blue-600 px-1.5 py-0.5 font-bold uppercase">{scopes.find(s => s.id === copyModalRole.scope)?.value ?? copyModalRole.scope}</span></div>
                    {copyModalRole.description && (
                      <div><span className="font-semibold">Descripción:</span> {copyModalRole.description}</div>
                    )}
                  </div>

                  <pre className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] leading-relaxed select-all">
                    {generateAsciiPermissions(copyModalRole.permissions)}
                  </pre>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setCopyModalRole(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCopy}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Copiando..." : "Confirmar Copia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100/80 flex flex-col items-center text-center">
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm animate-pulse">
              <svg className="h-7 w-7 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            
            <h3 className="text-base font-bold text-slate-800">Cargando datos del sistema</h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">Por favor, espera un momento. Esto puede tardar...</p>
            
            <p className="mt-4 text-xs font-semibold text-blue-650 tracking-wide animate-pulse">{loadingMessage}</p>
            
            <div className="mt-4 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <span className="mt-2 text-2xs font-bold text-slate-400">{progress}% completado</span>
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

export default PositionsConfigClient;