"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";

type ModuleAction = {
  id: string;
  label: string;
  status?: "active" | "inactive" | "deprecated";
};

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
  destination?: string | null;
  actions?: ModuleAction[] | any;
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
  actorRole: "SU" | "Adm" | "user";
  companyId: string | null;
};

const DEFAULT_VISIBLE_COLUMNS = ["code", "name", "route", "status", "updated_at", "actions"] as const;

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
  content: "newPage",
  destination: ""
};

export function ModulesConfigClient({actorId, actorRole, companyId}: Props) {
  const t = useTranslations("AccountConfig");
  const router = useRouter();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [pageContents, setPageContents] = useState<PageContentItem[]>([]);
  const [destinations, setDestinations] = useState<{value: string; label: string}[]>([]);

  // Modal de gestión de acciones/microroles
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [moduleActions, setModuleActions] = useState<ModuleAction[]>([]);
  const [newActionId, setNewActionId] = useState("");
  const [newActionLabel, setNewActionLabel] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [embeddedFilter, setEmbeddedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<keyof ModuleItem>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDrawerVisible, setFormDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "structure">("table");

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
  const [iconPreview, setIconPreview] = useState<string | null>(null);
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
      
      // Load modulesDest catalog options
      const destinationOptions = rawScopes
        .filter((item) => String(item.type ?? "").toLowerCase() === "modulesdest")
        .map((item) => ({
          value: String(item.value ?? "").trim(),
          label: String(item.name ?? item.value ?? "").trim()
        }))
        .filter((item) => item.value.length > 0);
      const dedupDestinations = Array.from(new Map(destinationOptions.map((item) => [item.value.toLowerCase(), item])).values());
      setDestinations(dedupDestinations);

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

  useEffect(() => {
    const closeMenu = () => {
      setOpenRowMenu(null);
      setShowColumnsMenu(false);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const visibleModules = useMemo(() => {
    const term = search.trim().toLowerCase();
    
    // Obtener el módulo embebido seleccionado si aplica
    const selectedEmbed = embeddedFilter !== "all" ? modules.find(m => m.id === embeddedFilter) : null;
    
    // Obtener descendientes del embebido seleccionado de forma recursiva
    const embedDescendants = (() => {
      if (!selectedEmbed) return new Set<string>();
      const descendants = new Set<string>();
      const queue = [selectedEmbed.id];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const children = modules.filter(m => m.parent === currId);
        for (const child of children) {
          if (!descendants.has(child.id)) {
            descendants.add(child.id);
            queue.push(child.id);
          }
        }
      }
      return descendants;
    })();

    const filtered = modules.filter((item) => {
      const textMatch =
        term.length === 0 ||
        [item.code, item.name, item.route ?? "", item.description ?? ""].join(" ").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const scopeMatch = scopeFilter === "all" || item.scope_id === scopeFilter;

      let embedMatch = true;
      if (selectedEmbed) {
        const isSelf = item.id === selectedEmbed.id;
        const isDescendant = embedDescendants.has(item.id);
        const isRouteMatch = !!(selectedEmbed.route && item.route && (
          item.route.startsWith(selectedEmbed.route) || 
          item.route.includes(selectedEmbed.route)
        ));
        embedMatch = isSelf || isDescendant || isRouteMatch;
      }

      return textMatch && statusMatch && scopeMatch && embedMatch;
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
  }, [modules, search, statusFilter, scopeFilter, embeddedFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleModules.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedModules = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleModules.slice(start, start + pageSize);
  }, [safePage, visibleModules, pageSize]);

  const tableColumns = useMemo(
    () => [
      {key: "id", label: t("table.id")},
      {key: "code", label: t("table.code")},
      {key: "name", label: t("table.name")},
      {key: "description", label: t("table.description")},
      {key: "route", label: t("table.route")},
      {key: "icon", label: t("table.icon")},
      {key: "sort_order", label: t("table.sort_order")},
      {key: "status", label: t("table.status")},
      {key: "parent", label: t("table.parent")},
      {key: "scope_id", label: t("table.scope_id")},
      {key: "content", label: t("table.content")},
      {key: "updated_at", label: t("table.updatedAt")},
      {key: "destination", label: t("table.destination")},
      {key: "actions", label: t("table.actions")}
    ],
    [t]
  );
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
    window.setTimeout(() => setFormDrawerVisible(true), 10);
  }

  function openCreateFormWithPreset(presetParent: string, presetDestination: string, presetContent: string = "newPage") {
    clearFormState();
    setForm((current) => ({
      ...current,
      parent: presetParent,
      destination: presetDestination,
      content: presetContent
    }));
    setIsFormOpen(true);
    window.setTimeout(() => setFormDrawerVisible(true), 10);
  }

  function onEdit(item: ModuleItem) {
    setIsFormOpen(true);
    window.setTimeout(() => setFormDrawerVisible(true), 10);
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
      content: item.content ?? "newPage",
      destination: item.destination ?? ""
    });
    setIconPreview(item.icon ?? null);
    setFormErrors({});
  }

  function closeFormDrawer() {
    setFormDrawerVisible(false);
    window.setTimeout(() => setIsFormOpen(false), 220);
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
    const cleanSortOrder = form.sort_order.replace(",", ".");
    if (!form.sort_order.trim() || Number.isNaN(Number(cleanSortOrder))) {
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
        sort_order: Number(cleanSortOrder),
        parent: form.parent,
        description: form.description || null,
        route: form.route || null,
        icon: form.icon || null,
        destination: form.destination || null
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
      closeFormDrawer();
      await loadData();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("errors.save"));
    } finally {
      setSaving(false);
    }
  }

  async function onChangeStatus(item: ModuleItem, nextStatus: "active" | "inactive") {
    const title = nextStatus === "inactive" ? t("actions.deactivate") : t("actions.reactivate");
    const message = nextStatus === "inactive"
      ? t("confirm.deactivate", {name: item.name})
      : t("confirm.reactivate", {name: item.name});

    showConfirm(
      title,
      message,
      async () => {
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
      },
      nextStatus === "inactive" ? "Desactivar" : "Reactivar",
      nextStatus === "inactive" ? "danger" : "warning"
    );
  }

  function setSort(column: keyof ModuleItem) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  const handleOpenActionsModal = (item: ModuleItem) => {
    setSelectedModule(item);
    const parsedActions = Array.isArray(item.actions) ? item.actions : [];
    setModuleActions(parsedActions);
    setNewActionId("");
    setNewActionLabel("");
    setActionError("");
    setActionsModalOpen(true);
  };

  const handleAddAction = () => {
    setActionError("");
    const alabel = newActionLabel.trim();
    if (!alabel) {
      setActionError("La etiqueta de la acción es obligatoria.");
      return;
    }
    // Generar un ID único corto tipo uuid/cuid (ej: act_x7f2a9)
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const aid = `act_${randomSuffix}`;
    setModuleActions((prev) => [...prev, { id: aid, label: alabel, status: "active" }]);
    setNewActionLabel("");
  };

  const handleDeleteAction = (aid: string) => {
    setModuleActions((prev) =>
      prev.map((act) => (act.id === aid ? { ...act, status: "inactive" } : act))
    );
  };

  const handleUpdateActionStatus = (aid: string, newStatus: "active" | "inactive" | "deprecated") => {
    setModuleActions((prev) =>
      prev.map((act) => (act.id === aid ? { ...act, status: newStatus } : act))
    );
  };

  const handleSaveActions = async () => {
    if (!selectedModule) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/db/modules", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: selectedModule.id, actions: moduleActions })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "No se pudieron guardar las acciones.");
      setSuccess("Acciones actualizadas correctamente");
      setActionsModalOpen(false);
      await loadData();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al guardar acciones");
    } finally {
      setSaving(false);
    }
  };

  const getChildren = useCallback((parentId: string) => {
    return [...modules]
      .filter((m) => m.parent === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [modules]);

  const getApplicationRootModules = useCallback((dest: string) => {
    return [...modules]
      .filter((m) => m.destination === dest && (m.parent === "/" || !m.parent))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [modules]);

  const activeDestinations = useMemo(() => {
    if (destinations.length > 0) return destinations;
    return [
      { value: "web", label: "Web" },
      { value: "mobile", label: "Mobile" }
    ];
  }, [destinations]);

  const renderLeftNode = (module: ModuleItem, visited = new Set<string>()): React.ReactNode => {
    const nodeKey = module.id;
    if (visited.has(nodeKey)) return null;

    const nextVisited = new Set(visited);
    nextVisited.add(nodeKey);

    const children = getChildren(module.id);
    const content = module.content || "";
    const isSection = content === "section";
    const isEmbedded = content === "embedded";
    const canAddPage = isSection || isEmbedded;
    const moduleName = module.name;

    let cardStyle = "bg-white border-slate-200 text-slate-700";
    if (isSection) {
      cardStyle = "bg-purple-50/40 border-purple-100 text-purple-900";
    } else if (isEmbedded) {
      cardStyle = "bg-emerald-50/40 border-emerald-100 text-emerald-900";
    }

    if (canAddPage && children.length > 0) {
      return (
        <div
          key={`left-${module.id}`}
          className={`cursor-pointer rounded-xl border p-2.5 shadow-sm transition hover:shadow-md ${cardStyle}`}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(module);
          }}
        >
          <div className="flex min-h-8 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {module.icon ? (
                <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200/60 p-1 shrink-0">
                  <Image src={module.icon} alt="Icon" width={16} height={16} className="h-full w-full object-contain" unoptimized />
                </div>
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded bg-slate-200/50 text-[10px] font-bold text-slate-500 shrink-0">
                  {moduleName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <p className="truncate text-xs font-bold uppercase tracking-wider">{moduleName}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
                title="Agregar submódulo"
                onClick={() => {
                  openCreateFormWithPreset(module.id, module.destination || "");
                }}
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2 border-l-2 border-slate-200/60 pl-3.5">
            {children.map((child) => renderLeftNode(child, nextVisited))}
          </div>
        </div>
      );
    }

    if (canAddPage) {
      return (
        <div
          key={`left-${module.id}`}
          className={`flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-xl border p-2 shadow-sm transition hover:shadow-md ${cardStyle}`}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(module);
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {module.icon ? (
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200/60 p-1 shrink-0">
                <Image src={module.icon} alt="Icon" width={16} height={16} className="h-full w-full object-contain" unoptimized />
              </div>
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded bg-slate-200/50 text-[10px] font-bold text-slate-500 shrink-0">
                {moduleName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <p className="truncate text-xs font-medium text-slate-500">{moduleName} (Vacío)</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
              title="Agregar submódulo"
              onClick={() => {
                openCreateFormWithPreset(module.id, module.destination || "");
              }}
            >
              +
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={`left-${module.id}`}
        className="flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2 shadow-2xs hover:bg-slate-50 transition"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(module);
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {module.icon ? (
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200/60 p-1 shrink-0">
              <Image src={module.icon} alt="Icon" width={16} height={16} className="h-full w-full object-contain" unoptimized />
            </div>
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded bg-slate-200/50 text-[10px] font-bold text-slate-500 shrink-0">
              {moduleName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <p className="truncate text-xs font-semibold text-slate-700">{moduleName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition"
            title="Gestionar Acciones"
            onClick={() => handleOpenActionsModal(module)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderMetaRow = (module: ModuleItem) => {
    const contentLabel = pageContents.find(p => p.value === module.content)?.label ?? module.content ?? "-";
    const statusLabel = module.status === "active" ? "Activo" : "Inactivo";
    
    return (
      <div 
        key={`metarow-${module.id}`} 
        className="grid min-h-9 grid-cols-5 items-center border border-slate-100 rounded-full bg-slate-50/50 text-center text-xs text-slate-500 font-medium px-2 py-1 hover:bg-slate-100/50 transition cursor-pointer select-none"
        onClick={() => onEdit(module)}
      >
        <span className="truncate">{contentLabel}</span>
        <span className="font-mono text-2xs truncate" title={module.parent || "/"}>{module.parent || "/"}</span>
        <span className="truncate font-mono text-2xs" title={module.route || "-"}>{module.route || "-"}</span>
        <span>{module.sort_order}</span>
        <span className={module.status === "active" ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
          {statusLabel}
        </span>
      </div>
    );
  };

  const renderMetaRows = (module: ModuleItem, visited = new Set<string>()): React.ReactNode => {
    const nodeKey = module.id;
    if (visited.has(nodeKey)) return null;

    const nextVisited = new Set(visited);
    nextVisited.add(nodeKey);

    const children = getChildren(module.id);

    return (
      <div key={`meta-group-${module.id}`} className="space-y-2">
        {renderMetaRow(module)}
        {children.map((child) => renderMetaRows(child, nextVisited))}
      </div>
    );
  };

  const renderMetaHeader = () => (
    <div className="grid min-h-10 grid-cols-5 items-center rounded-full bg-slate-100 text-center text-xs font-bold text-slate-500 px-4 py-2 shrink-0 border border-slate-200 select-none">
      <span>TIPO</span>
      <span>PADRE (ID)</span>
      <span>RUTA</span>
      <span>ORDEN</span>
      <span>ESTADO</span>
    </div>
  );

  const renderStructureNode = (module: ModuleItem) => {
    const content = module.content || "";
    const isEmbedded = content === "embedded";
    const children = isEmbedded ? getChildren(module.id) : [];

    if (isEmbedded && children.length > 0) {
      return (
        <div key={`aligned-${module.id}`} className="grid gap-4 lg:grid-cols-[280px_1fr] border border-slate-100/85 rounded-xl bg-slate-50/30 p-2.5">
          <div 
            className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 hover:bg-emerald-50/50 transition cursor-pointer shadow-2xs"
            onClick={(event) => { 
              event.stopPropagation(); 
              onEdit(module); 
            }}
          >
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-emerald-100/50">
              <div className="flex items-center gap-1.5 min-w-0">
                {module.icon ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-200/50 p-1 shrink-0">
                    <Image src={module.icon} alt="Icon" width={14} height={14} className="h-full w-full object-contain" unoptimized />
                  </div>
                ) : (
                  <span className="grid h-5 w-5 place-items-center rounded bg-slate-200/40 text-[9px] font-bold text-slate-500 shrink-0">
                    {module.name.slice(0,1).toUpperCase()}
                  </span>
                )}
                <p className="truncate text-xs font-bold uppercase tracking-wider text-emerald-950">{module.name}</p>
              </div>
              <button
                type="button"
                className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white hover:bg-blue-700 transition"
                title="Agregar submódulo"
                onClick={(e) => {
                  e.stopPropagation();
                  openCreateFormWithPreset(module.id, module.destination || "");
                }}
              >
                +
              </button>
            </div>
            
            <div className="space-y-1.5 pl-1">
              {children.map((child) => {
                return (
                  <div
                    key={`menu-${child.id}`}
                    className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs hover:bg-black/5 text-emerald-900/80 hover:text-emerald-950 font-medium transition"
                    onClick={(event) => { 
                      event.stopPropagation(); 
                      onEdit(child); 
                    }}
                  >
                    {child.icon ? (
                      <div className="flex h-4.5 w-4.5 items-center justify-center rounded bg-slate-200/50 p-0.5 shrink-0">
                        <Image src={child.icon} alt="Icon" width={12} height={12} className="h-full w-full object-contain" unoptimized />
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold shrink-0">◦</span>
                    )}
                    <span className="truncate">{child.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            {renderMetaRows(module)}
          </div>
        </div>
      );
    }

    return (
      <div key={`aligned-${module.id}`} className="grid gap-4 lg:grid-cols-[280px_1fr] border border-slate-100/85 rounded-xl bg-slate-50/30 p-2.5">
        <div className="space-y-2">
          {renderLeftNode(module)}
        </div>
        <div className="space-y-2">
          {renderMetaRows(module)}
        </div>
      </div>
    );
  };

  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">{t("loadingModules")}</section>;
  }

  return (
    <section className="h-full flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 sm:p-5">
      <article className="h-full flex flex-col overflow-hidden space-y-4">
        <header className="shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t("title")}</h2>
            <p className="text-sm text-slate-500">{t("description")}</p>
          </div>
          
          {/* Selector de pestañas */}
          <div className="flex border border-slate-200 bg-slate-50 p-1 rounded-xl shrink-0 select-none">
            <button
              type="button"
              onClick={() => setActiveTab("table")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition duration-150 ${
                activeTab === "table"
                  ? "bg-white text-slate-800 shadow-3xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Vista de Tabla
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("structure")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition duration-150 ${
                activeTab === "structure"
                  ? "bg-white text-slate-800 shadow-3xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Vista de Estructura
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {activeTab === "table" ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shrink-0">
            <div className="grid w-full gap-2 md:grid-cols-[1fr_130px_160px_195px] lg:max-w-[76%]">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("controls.searchPlaceholder")}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive");
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
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
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
              >
                <option value="all">{t("controls.allScopes")}</option>
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.value ?? scope.name ?? scope.id}</option>
                ))}
              </select>
              <select
                value={embeddedFilter}
                onChange={(e) => {
                  setEmbeddedFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm"
              >
                <option value="all">Todos los Contenidos</option>
                {modules
                  .filter((m) => m.content === "embedded")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.route || "/"})
                    </option>
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
              <button onClick={openCreateForm} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">{t("controls.addModule")}</button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500 shrink-0">
            <span>{t("table.results", {count: visibleModules.length})}</span>
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

          <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-500">
                <tr>
                  {headerColumns.map((column) => (
                    <th key={column.key} className={`px-4 py-3 ${column.key === "actions" ? "text-center" : ""}`}>
                      {column.key !== "actions" && column.key !== "icon" ? (
                        <button className="font-medium" onClick={() => setSort(column.key as keyof ModuleItem)}>{column.label}</button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedModules.map((item, rowIndex) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    {headerColumns.map((column) => {
                      if (column.key === "id") return <td key={`${item.id}-id`} className="px-4 py-3 font-mono text-xs">{item.id}</td>;
                      if (column.key === "code") return <td key={`${item.id}-code`} className="px-4 py-3 font-medium">{item.code}</td>;
                      if (column.key === "name") return <td key={`${item.id}-name`} className="px-4 py-3">{item.name}</td>;
                      if (column.key === "description") return <td key={`${item.id}-description`} className="px-4 py-3 max-w-[200px] truncate">{item.description ?? "-"}</td>;
                      if (column.key === "route") return <td key={`${item.id}-route`} className="px-4 py-3">{item.route ?? "-"}</td>;
                      if (column.key === "icon") {
                        return (
                          <td key={`${item.id}-icon`} className="px-4 py-3">
                            {item.icon ? (
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300 p-1">
                                <Image src={item.icon} alt="Icon" width={24} height={24} className="h-full w-full object-contain" unoptimized />
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      }
                      if (column.key === "sort_order") return <td key={`${item.id}-order`} className="px-4 py-3">{item.sort_order}</td>;
                      if (column.key === "status") return <td key={`${item.id}-status`} className="px-4 py-3">{item.status}</td>;
                      if (column.key === "parent") return <td key={`${item.id}-parent`} className="px-4 py-3 font-mono text-xs">{item.parent ?? "-"}</td>;
                      if (column.key === "scope_id") {
                        const scopeValue = scopes.find(s => s.id === item.scope_id)?.value ?? item.scope_id;
                        return <td key={`${item.id}-scope`} className="px-4 py-3">{scopeValue}</td>;
                      }
                      if (column.key === "content") {
                        const contentLabel = pageContents.find(p => p.value === item.content)?.label ?? item.content ?? "-";
                        return <td key={`${item.id}-content`} className="px-4 py-3">{contentLabel}</td>;
                      }
                      if (column.key === "updated_at") return <td key={`${item.id}-updated`} className="px-4 py-3">{item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}</td>;
                      if (column.key === "destination") {
                        const destLabel = destinations.find(d => d.value === item.destination)?.label ?? item.destination ?? "-";
                        return <td key={`${item.id}-destination`} className="px-4 py-3">{destLabel}</td>;
                      }
                      return (
                        <td key={`${item.id}-actions`} className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Gestionar Acciones (Escudo/Llave Morado) */}
                            {item.content === "newPage" ? (
                              <div className="group relative">
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionsModal(item)}
                                  className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 shadow-sm hover:bg-purple-100 hover:border-purple-300 hover:text-purple-700 transition duration-150"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4.5 w-4.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                                  </svg>
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
                                <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                  Acciones
                                </span>
                              </div>
                            ) : (
                              <div className="w-8 h-8" />
                            )}

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
                                {t("actions.edit")}
                              </span>
                            </div>

                            {/* Desactivar / Reactivar (Basura / Check) */}
                            <div className="group relative">
                              {item.status === "active" ? (
                                <button
                                  type="button"
                                  onClick={() => void onChangeStatus(item, "inactive")}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 transition duration-150"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4.5 w-4.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void onChangeStatus(item, "active")}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-700 transition duration-150"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4.5 w-4.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                  </svg>
                                </button>
                              )}
                              <span className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition duration-200 rounded border border-slate-200/60 bg-white/85 backdrop-blur px-2.5 py-1 text-2xs font-semibold text-slate-700 shadow-md whitespace-nowrap">
                                {item.status === "active" ? t("actions.deactivate") : t("actions.reactivate")}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {pagedModules.length === 0 ? (
                  <tr>
                    <td colSpan={headerColumns.length} className="px-3 py-6 text-center text-slate-500">{t("table.empty")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center shrink-0 pt-2">
            <p>Mostrando {pagedModules.length} de {visibleModules.length} módulos</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 transition hover:bg-slate-50"
              >
                {t("pagination.previous")}
              </button>
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-white font-semibold">{safePage}</span>
              <span>de {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 transition hover:bg-slate-50"
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>

            </>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 py-2 scrollbar-thin">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/25 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Vista Previa de la Jerarquía</h3>
                    <p className="text-xs text-slate-500">Módulos organizados según la estructura real del Sidebar de la aplicación.</p>
                  </div>
                  <button
                    onClick={openCreateForm}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                  >
                    {t("controls.addModule")}
                  </button>
                </div>

                <div className="space-y-6">
                  {modules.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      No hay módulos configurados en el sistema.
                    </p>
                  ) : (
                    activeDestinations.map((dest) => {
                      const rootModules = getApplicationRootModules(dest.value);
                      if (rootModules.length === 0) return null;

                      return (
                        <div key={`preview-group-${dest.value}`} className="space-y-3">
                          <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-center">
                            <div className="flex min-h-10 items-center justify-between rounded-full bg-sky-50 border border-sky-100 px-4 py-1.5 shrink-0 shadow-3xs">
                              <p className="text-xs font-extrabold text-sky-950 uppercase tracking-wider">
                                Aplicación {dest.label}
                              </p>
                              <button
                                type="button"
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
                                title="Agregar módulo raíz"
                                onClick={() => {
                                  openCreateFormWithPreset("/", dest.value);
                                }}
                              >
                                +
                              </button>
                            </div>
                            {renderMetaHeader()}
                          </div>

                          <div className="space-y-4 pl-1">
                            {rootModules.map((module) => renderStructureNode(module))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </article>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50">
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${formDrawerVisible ? "opacity-100" : "opacity-0"}`} onClick={closeFormDrawer} />
          <aside className={`absolute right-0 top-0 h-full w-full max-w-[720px] overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-200 ease-out ${formDrawerVisible ? "translate-x-0" : "translate-x-full"}`}>
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-semibold">{editingId ? t("form.edit") : t("form.create")}</h3>
                <p className="text-sm text-slate-500">Configura el modulo con la misma experiencia visual del panel lateral.</p>
              </div>
              <button type="button" onClick={closeFormDrawer} className="text-2xl text-slate-400 hover:text-slate-700">×</button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.code")}</label>
                  <input
                    value={form.code}
                    disabled
                    placeholder={editingId ? t("form.immutableCode") : t("form.autoCode")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.name")}</label>
                  <input value={form.name} onChange={(e) => setForm((s) => ({...s, name: e.target.value}))} placeholder={t("form.name")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                  {formErrors.name ? <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.route")}</label>
                  <input value={form.route} onChange={(e) => setForm((s) => ({...s, route: e.target.value}))} placeholder={t("form.route")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.pageContent")}</label>
                  <select
                    value={form.content}
                    onChange={(e) => setForm((s) => ({...s, content: e.target.value}))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                  >
                    {pageContents.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.order")}</label>
                  <input value={form.sort_order} onChange={(e) => setForm((s) => ({...s, sort_order: e.target.value}))} placeholder={t("form.order")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                  {formErrors.sort_order ? <p className="mt-1 text-xs text-rose-600">{formErrors.sort_order}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">{t("form.status")}</label>
                    <select value={form.status} onChange={(e) => setForm((s) => ({...s, status: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm">
                      {statuses.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                    {formErrors.status ? <p className="mt-1 text-xs text-rose-600">{formErrors.status}</p> : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Destination</label>
                    <select value={form.destination} onChange={(e) => setForm((s) => ({...s, destination: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm">
                      <option value="">Ninguno</option>
                      {destinations.map((dest) => (
                        <option key={dest.value} value={dest.value}>{dest.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t("form.scope")}</label>
                  <select value={form.scope_id} onChange={(e) => setForm((s) => ({...s, scope_id: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm">
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:row-span-2">
                  <label className="mb-2 block text-xs text-slate-500">{t("form.icon")}</label>
                  <input type="file" accept="image/*" onChange={(e) => void onIconFile(e.target.files?.[0] ?? null)} className="text-xs" />
                  {iconPreview ? (
                    <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-400 p-1.5">
                      <Image src={iconPreview} alt="Preview" width={36} height={36} className="h-full w-full object-contain" unoptimized />
                    </div>
                  ) : null}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">{t("form.descriptionField")}</label>
                  <input value={form.description} onChange={(e) => setForm((s) => ({...s, description: e.target.value}))} placeholder={t("form.descriptionField")} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
                </div>
              </div>
            <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    clearFormState();
                    closeFormDrawer();
                  }}
                  className="rounded-xl px-4 py-2 text-sm text-rose-600"
                >
                  {t("form.cancel")}
                </button>
                <button disabled={saving} onClick={() => void onSubmit()} className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? t("form.saving") : editingId ? t("form.saveChanges") : t("form.createModule")}</button>
              </div>
          </aside>
        </div>
      ) : null}

      {actionsModalOpen && selectedModule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-200" onClick={() => setActionsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg transform rounded-2xl bg-white p-6 shadow-2xl transition-all duration-200 scale-100 opacity-100 border border-slate-100 flex flex-col max-h-[85vh]">
            
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="rounded-lg bg-purple-50 p-1 text-purple-600 text-sm">🛡️</span>
                  Gestionar Acciones: {selectedModule.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedModule.route || '/'}</p>
              </div>
              <button type="button" onClick={() => setActionsModalOpen(false)} className="text-2xl font-bold text-slate-400 hover:text-slate-600 transition">×</button>
            </div>

            {actionError ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{actionError}</p>
            ) : null}

            {/* FORMULARIO DE AGREGAR ACCIÓN */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Agregar nueva acción</h4>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Etiqueta descriptiva</label>
                <input
                  type="text"
                  value={newActionLabel}
                  onChange={(e) => setNewActionLabel(e.target.value)}
                  placeholder="ej: Escanear Postcosecha"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 font-medium"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddAction}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Añadir
                </button>
              </div>
            </div>

            {/* LISTADO DE ACCIONES EXISTENTES */}
            <div className="mt-4 flex-1 overflow-y-auto min-h-[160px] max-h-[300px] border border-slate-100 rounded-xl bg-white p-1">
              <div className="divide-y divide-slate-50">
                {moduleActions.map((act) => {
                  const status = act.status || "active";
                  return (
                    <div key={act.id} className={`flex items-center justify-between p-2.5 rounded-lg transition duration-150 ${status === "inactive" ? "bg-slate-50 opacity-60" : status === "deprecated" ? "bg-amber-50/40 opacity-80" : "hover:bg-slate-50/50"}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold ${status === "inactive" ? "text-slate-400 line-through" : "text-slate-700"}`}>
                            {act.label}
                          </p>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            status === "active" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                              : status === "deprecated" 
                                ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            {status === "active" ? "Activo" : status === "deprecated" ? "Deprecado" : "Inactivo"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">id: {act.id}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Botón de Activar (si está inactivo o deprecado) */}
                        {status !== "active" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateActionStatus(act.id, "active")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 transition duration-150"
                            title="Activar acción"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                          </button>
                        )}

                        {/* Botón de alternar Deprecado (si está activo o inactivo) */}
                        {status !== "deprecated" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateActionStatus(act.id, "deprecated")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-300 transition duration-150"
                            title="Marcar como Deprecado"
                          >
                            ⚠️
                          </button>
                        )}

                        {/* Botón de Desactivar (si está activo o deprecado) */}
                        {status !== "inactive" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateActionStatus(act.id, "inactive")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition duration-150"
                            title="Desactivar acción"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {moduleActions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">No hay acciones de negocio definidas para este módulo.</p>
                ) : null}
              </div>
            </div>

            {/* BOTONES DE PIE */}
            <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActionsModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveActions}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 text-xs font-semibold transition shadow-sm"
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>

          </div>
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
