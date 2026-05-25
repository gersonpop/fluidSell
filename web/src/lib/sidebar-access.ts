export type SidebarModuleId =
  | "home"
  | "scrum"
  | "account-config"
  | "orders"
  | "products"
  | "customers"
  | "invoices"
  | "analytics"
  | "campaigns"
  | "warehouse"
  | "support"
  | "teams"
  | "integrations"
  | "billing";

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  path: string;
};

export type DynamicModuleNav = {
  id: string;
  code: string;
  name: string;
  route: string | null;
  icon: string | null;
};

export type DbModuleRecord = Record<string, unknown>;

function isSidebarModuleId(value: string): value is SidebarModuleId {
  return Object.prototype.hasOwnProperty.call(moduleToPermission, value);
}

export const NAV_ITEMS: NavItem[] = [
  {id: "home", label: "Resumen", icon: "⌂", path: "/home"},
  {id: "scrum", label: "Scrum", icon: "☰", path: "/scrum"},
  {id: "account-config", label: "Settings", icon: "⚙", path: "/account-config"},
  {id: "orders", label: "Pedidos", icon: "▣", badge: "24", path: "/home"},
  {id: "products", label: "Catalogo", icon: "◫", path: "/home"},
  {id: "customers", label: "Clientes", icon: "◎", path: "/home"},
  {id: "invoices", label: "Facturas", icon: "◧", path: "/home"},
  {id: "analytics", label: "Analitica", icon: "◍", badge: "Nuevo", path: "/home"},
  {id: "campaigns", label: "Campanas", icon: "✦", path: "/home"},
  {id: "warehouse", label: "Inventario", icon: "◨", path: "/home"},
  {id: "support", label: "Soporte", icon: "?", path: "/home"},
  {id: "teams", label: "Equipos", icon: "◉", path: "/home"},
  {id: "integrations", label: "Integraciones", icon: "⛁", path: "/home"},
  {id: "billing", label: "Facturacion", icon: "$", path: "/home"}
];

const MINIMAL_MODULES: SidebarModuleId[] = ["home", "account-config"];

const moduleToPermission: Record<SidebarModuleId, string> = {
  home: "home:view",
  scrum: "scrum:view",
  "account-config": "home:view",
  orders: "orders:view",
  products: "products:view",
  customers: "customers:view",
  invoices: "invoices:view",
  analytics: "analytics:view",
  campaigns: "campaigns:view",
  warehouse: "warehouse:view",
  support: "support:view",
  teams: "teams:view",
  integrations: "integrations:view",
  billing: "billing:view"
};

export function filterNavItemsByPermissions(navItems: NavItem[], permissions: string[]) {
  if (permissions.length === 0) {
    return navItems.filter((item) => (isSidebarModuleId(item.id) ? MINIMAL_MODULES.includes(item.id) : false));
  }
  const allowed = new Set(permissions);
  return navItems.filter((item) => (isSidebarModuleId(item.id) ? allowed.has(moduleToPermission[item.id]) : true));
}

export function mergeDynamicModules(navItems: NavItem[], dynamicModules: DynamicModuleNav[]) {
  const existing = new Set(navItems.map((item) => item.path));
  const merged = [...navItems];
  for (const dynamicModule of dynamicModules) {
    if (!dynamicModule.route || existing.has(dynamicModule.route)) {
      continue;
    }
    merged.push({
      id: dynamicModule.code.toLowerCase(),
      label: dynamicModule.name,
      icon: dynamicModule.icon ?? "◦",
      path: dynamicModule.route
    });
    existing.add(dynamicModule.route);
  }
  return merged;
}

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
    .map((row) => {
      const id = toText(row.id);
      const code = toText(row.code || row.id);
      const name = toText(row.name);
      const route = toText(row.route);
      const icon = toText(row.icon);
      const parentId = toText(row.parentId ?? row.parent);
      const status = toText(row.status).toLowerCase();
      const sortOrder = toSortNumber(row.order ?? row.sort_order ?? row.sortOrder);
      return {id, code, name, route, icon, parentId, status, sortOrder};
    })
    .filter((item) => item.parentId === "/" && item.status === "active")
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });

  return normalized
    .filter((item) => item.name.length > 0 && item.route.length > 0)
    .map<DynamicModuleNav>((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      route: item.route,
      icon: item.icon.length > 0 ? item.icon : null
    }));
}
