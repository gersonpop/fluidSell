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
      pageContent: toText(row.page_content || row.pageContent || "") || null,
      sortOrder: toSortNumber(row.sort_order ?? row.sortOrder ?? row.order)
    }))
    .filter((item) => item.status === "active");

  return normalized
    .filter((item) => item.parent === "/")
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    })
    .filter((item) => item.name.length > 0 && item.route.length > 0)
    .map<DynamicModuleNav>((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      route: item.route,
      icon: item.icon.length > 0 ? item.icon : null,
      parent: item.parent,
      status: item.status,
      pageContent: item.pageContent,
      sortOrder: item.sortOrder
    }));
}
