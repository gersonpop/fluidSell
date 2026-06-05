export type DynamicModuleNav = {
  id: string;
  code: string;
  name: string;
  route: string | null;
  icon: string | null;
  parent: string;
  status: string;
  pageContent: string | null;
  sortOrder: number;
  badge?: string;
};

export type DbModuleRecord = Record<string, unknown>;

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toSortNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.POSITIVE_INFINITY;
}

export function selectSidebarModulesFromDbRows(rows: DbModuleRecord[]) {
  const normalized = rows
    .map((row) => ({
      id: toText(row.id),
      code: toText(row.code || row.id),
      name: toText(row.name),
      route: toText(row.route),
      icon: toText(row.icon),
      parent: toText(row.parent ?? row.parentId),
      status: toText(row.status).toLowerCase(),
      pageContent: toText(row.page_content || row.pageContent || row.content || "") || null,
      sortOrder: toSortNumber(row.sort_order ?? row.sortOrder ?? row.order)
    }));

  // Filter active and readable items
  const activeNormalized = normalized.filter((item) => {
    if (item.status !== "active") return false;
    
    // Check if permission read is explicitly false
    const origRow = rows.find((r) => String(r.id || "") === item.id);
    if (origRow && origRow.permission) {
      const perm = origRow.permission as any;
      if (item.pageContent !== "section" && item.pageContent !== "embedded") {
        if (perm.read === false) {
          return false;
        }
      }
    }
    return true;
  });

  // Prune empty sections/embedded containers
  let filtered = activeNormalized;
  let changed = true;
  while (changed) {
    changed = false;
    const currentIds = new Set(filtered.map((m) => m.id));

    filtered = filtered.filter((m) => {
      const isContainer = m.pageContent === "section" || m.pageContent === "embedded";
      if (!isContainer) return true;

      const hasChildren = filtered.some((c) => c.parent === m.id);
      if (!hasChildren) {
        changed = true;
        return false;
      }
      return true;
    });
  }

  const finalSections = filtered.filter((item) => item.pageContent === "section");
  const sectionIds = new Set(finalSections.map((item) => item.id));

  // Render parent === "/" or child of an active section
  return filtered
    .filter((item) => item.parent === "/" || sectionIds.has(item.parent))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    })
    .filter((item) => item.name.length > 0 && (item.route.length > 0 || item.pageContent === "section"))
    .map<DynamicModuleNav>((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      route: item.route.length > 0 ? item.route : null,
      icon: item.icon.length > 0 ? item.icon : null,
      parent: item.parent,
      status: item.status,
      pageContent: item.pageContent,
      sortOrder: item.sortOrder
    }));
}
