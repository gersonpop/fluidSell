import { getPgPool } from "@/server/postgres";
import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHmac, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { join } from "node:path";
import { invalidateCatalogCache } from "@/server/auth/onboarding";

// Store in-memory cache for static tables
type StaticCacheEntry = {
  data: any[];
  expiresAt: number;
};
const staticStoreCache: Record<string, StaticCacheEntry> = {};
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateStoreCache(tableParam?: string) {
  if (tableParam) {
    const table = tableParam.trim().toLowerCase();
    delete staticStoreCache[table];
  } else {
    for (const key of Object.keys(staticStoreCache)) {
      delete staticStoreCache[key];
    }
  }
  // Also invalidate the onboarding catalog cache
  try {
    invalidateCatalogCache();
  } catch {
    // Ignore any import or timing issues
  }
}

export type ActorScope = "SU" | "cliente";

export type ActorContext = {
  actorId: string;
  role: ActorScope;
  companyId: string | null;
};

const TABLE_MAP = {
  modules: 'public.\"Modules\"',
  users: 'public."PlatformUser"',
  oauth_sessions: 'public.oauth_sessions',
  roles: 'public."Role"',
  role_assignments: 'public."UserRole"',
  audit_logs: 'public."AuditLog"',
  st_multidata: 'public."st_Multidata"',
  st_country: 'public."st_Country"',
  st_state: 'public."st_State"',
  st_city: 'public."st_City"',
  companies: 'public."Company"',
  onboardings: 'public."Onboarding"'
} as const;

type DynamicTableName = keyof typeof TABLE_MAP;

const COMPANY_SCOPED_TABLES = new Set<DynamicTableName>(["users", "oauth_sessions", "roles", "role_assignments", "onboardings"]);

function normalizeTable(table: string): DynamicTableName {
  const normalized = table.trim().toLowerCase() as DynamicTableName;
  if (!(normalized in TABLE_MAP)) {
    throw new Error(`Table '${table}' is not allowed`);
  }
  return normalized;
}

function ensureSu(actor: ActorContext) {
  if (actor.role !== "SU") {
    throw new Error("Forbidden");
  }
}

function isCorsOriginAllowed(origin: string | null) {
  const allowlist = (process.env.CORS_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowlist.length === 0) {
    return true;
  }
  if (!origin) {
    return false;
  }
  return allowlist.includes(origin);
}

async function resolveCatalogStatus(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("status is required");
  const result = await getPgPool().query<{ value: string }>(
    'select "value" from public."st_Multidata" where lower("value")=lower($1) and lower(coalesce("type",\'\'))=\'modulestatus\' limit 1',
    [text]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("status must exist in st_Multidata catalog");
  return result.rows[0].value;
}

async function resolvePageContent(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("content is required");
  const result = await getPgPool().query<{ value: string }>(
    'select "value" from public."st_Multidata" where lower("value")=lower($1) and lower(coalesce("type",\'\'))=\'pagecontent\' limit 1',
    [text]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("content must exist in st_Multidata catalog");
  return result.rows[0].value;
}

function resolveIncomingContent(payload: Record<string, unknown>) {
  return payload.content ?? "newPage";
}

function normalizePageContentKind(value: string) {
  const v = value.trim().toLowerCase();
  if (v === "newpage" || v === "nueva pagina" || v === "nuevapagina") return "newpage";
  if (v === "embedded" || v === "embebido") return "embedded";
  if (v === "section" || v === "seccion" || v === "sección") return "section";
  return v;
}

async function validateRoleScope(scopeId: string) {
  const result = await getPgPool().query<{ type: string | null; typeUse: string | null; value: string | null; name: string | null }>(
    'select "type", "typeUse", "value", "name" from public."st_Multidata" where lower("Initials_PK")=lower($1) limit 1',
    [scopeId]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("scope_id not found in st_Multidata");
  const row = result.rows[0];
  const marker = `${row.type ?? ""} ${row.typeUse ?? ""} ${row.value ?? ""} ${row.name ?? ""}`.toLowerCase();
  if (!marker.includes("rolescope")) throw new Error("scope_id must belong to roleScope");
}

async function validateModuleParent(parent: string | null) {
  if (!parent || parent.trim().length === 0) {
    throw new Error("parent is required. Use '/' for root");
  }
  if (parent === "/") return;
  const result = await getPgPool().query("select id from public.\"Modules\" where id=$1 limit 1", [parent]);
  if ((result.rowCount ?? 0) === 0) throw new Error("parent module not found");
}

async function generateModuleCode(name: string) {
  const seed = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "MODULE";
  const existing = await getPgPool().query<{ code: string }>("select code from public.\"Modules\" where code like $1", [`${seed}%`]);
  if ((existing.rowCount ?? 0) === 0) return seed;
  const used = new Set(existing.rows.map((row) => row.code));
  let i = 2;
  while (used.has(`${seed}_${i}`)) i += 1;
  return `${seed}_${i}`;
}

function normalizeModuleRoutePath(route: string | null) {
  if (!route) return null;
  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) return null;
  const clean = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return null;
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (!/^[a-zA-Z0-9-_]+$/.test(segment)) return null;
  }
  return segments;
}

async function resolveParentAwareRoute(route: string | null, parentId: string | null) {
  const currentSegments = normalizeModuleRoutePath(route);
  if (!currentSegments) return route ? route.trim() : null;
  if (!parentId || parentId === "/") {
    return `/${currentSegments.join("/")}`;
  }

  const parentResult = await getPgPool().query<{ route: string | null; content: string | null }>(
    "select route, content from public.\"Modules\" where id=$1 limit 1",
    [parentId]
  );
  if ((parentResult.rowCount ?? 0) === 0) {
    throw new Error("parent module not found");
  }

  const parent = parentResult.rows[0];
  const parentContent = parent.content ? normalizePageContentKind(parent.content) : null;
  if (parentContent === "section") {
    // If the parent is a section visual divider, do not nest the route; treat it as a root-level sidebar item
    return `/${currentSegments.join("/")}`;
  }

  const parentRoute = parent.route;
  const parentSegments = normalizeModuleRoutePath(parentRoute);
  if (!parentSegments) {
    return `/${currentSegments.join("/")}`;
  }

  const isAlreadyNested = currentSegments.length >= parentSegments.length && parentSegments.every((segment, index) => currentSegments[index] === segment);
  if (isAlreadyNested) {
    return `/${currentSegments.join("/")}`;
  }

  const tailSegments = [...currentSegments];
  if (tailSegments.length === 1 && parentSegments.at(-1) === tailSegments[0]) {
    return `/${parentSegments.join("/")}`;
  }
  return `/${[...parentSegments, ...tailSegments].join("/")}`;
}

function getLeafTitle(segments: string[]) {
  return segments.at(-1)?.replace(/[-_]/g, " ") ?? "module";
}

async function ensureModuleRouteScaffold(route: string | null, pageContent: string) {
  const normalized = normalizePageContentKind(pageContent);
  if (normalized === "section") {
    return; // Avoid creating folders or layout/page files for category separators
  }
  const segments = normalizeModuleRoutePath(route);
  if (!segments) return;
  const routeDir = join(process.cwd(), "src", "app", "[locale]", "(protect)", ...segments);

  await mkdir(routeDir, { recursive: true });
  const pageTitle = getLeafTitle(segments);
  const baseName = segments[segments.length - 1].toLowerCase();

  if (normalized === "embedded") {
    const layoutFile = join(routeDir, "layout.tsx");
    const pageFile = join(routeDir, "page.tsx");

    const layoutContent = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";

type LayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function DynamicEmbeddedLayout({params, children}: LayoutProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .map(row => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description ?? ""),
      route: String(row.route),
      icon: String(row.icon || "") || null,
      parent: String(row.parent),
      status: String(row.status),
      pageContent: String(row.page_content || row.pageContent || row.content || ""),
      sortOrder: Number(row.sort_order ?? row.sortOrder ?? 100)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session?.user?.name ?? "Usuario"}
      userEmail={session?.user?.email ?? ""}
      userImage={session?.user?.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      initialModules={initialSidebarModules}
      title={currentModule?.name ?? "${pageTitle}"}
      description={currentModule?.description ?? ""}
    >
      <EmbeddedPattern locale={locale} parentTitle={currentModule?.name ?? "${pageTitle}"} items={childrenModules}>
        {children}
      </EmbeddedPattern>
    </ProtectedSidebarLayout>
  );
}`;

    const pageContentTemplate = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicEmbeddedPage({params}: PageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .sort((a, b) => Number(a.sort_order ?? a.sortOrder ?? 100) - Number(b.sort_order ?? b.sortOrder ?? 100));

  if (childrenModules.length > 0) {
    redirect("/" + locale + childrenModules[0].route);
  }

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 className="text-2xl font-semibold">{currentModule?.description || currentModule?.name || "${pageTitle}"}</h1>
      <p className="mt-2 text-sm text-slate-500">Módulo embebido. Agrega submódulos hijos para ver el contenido.</p>
    </section>
  );
}`;

    try {
      await access(layoutFile, fsConstants.F_OK);
    } catch {
      await writeFile(layoutFile, layoutContent, "utf8");
    }

    try {
      await access(pageFile, fsConstants.F_OK);
    } catch {
      await writeFile(pageFile, pageContentTemplate, "utf8");
    }
    return;
  }

  if (normalized === "newpage") {
    const pageFile = join(routeDir, "page.tsx");
    const componentFile = join(routeDir, `component.${baseName}.tsx`);

    const isRootModule = segments.length === 1;

    let pageTemplate = "";
    if (isRootModule) {
      pageTemplate = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.${baseName}";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session?.user?.name ?? "Usuario"}
      userEmail={session?.user?.email ?? ""}
      userImage={session?.user?.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      initialModules={initialSidebarModules}
      title={currentModule?.name ?? "${pageTitle}"}
      description={currentModule?.description ?? ""}
    >
      <NewPagePattern
        title={currentModule?.name ?? "${pageTitle}"}
        description={currentModule?.description ?? ""}
      >
        <DynamicComponent />
      </NewPagePattern>
    </ProtectedSidebarLayout>
  );
}`;
    } else {
      pageTemplate = `import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.${baseName}";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "${route}";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

  return (
    <NewPagePattern
      title={currentModule?.name ?? "${pageTitle}"}
      description={currentModule?.description ?? ""}
    >
      <DynamicComponent />
    </NewPagePattern>
  );
}`;
    }

    const componentTemplate = `"use client";

export function DynamicComponent() {
  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">Este módulo se ha creado dinámicamente con contenido básico.</p>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-800">Contenido básico</h2>
        <p className="mt-1 text-xs text-slate-500">Puedes editar este componente en \`component.${baseName}.tsx\` para agregar tu lógica de negocio.</p>
      </div>
    </section>
  );
}

export default DynamicComponent;`;

    try {
      await access(pageFile, fsConstants.F_OK);
    } catch {
      await writeFile(pageFile, pageTemplate, "utf8");
    }

    try {
      await access(componentFile, fsConstants.F_OK);
    } catch {
      await writeFile(componentFile, componentTemplate, "utf8");
    }
    return;
  }
}

async function createModuleRecord(actor: ActorContext, payload: Record<string, unknown>) {
  ensureSu(actor);
  const name = String(payload.name ?? "").trim();
  const scopeId = String(payload.scope_id ?? "").trim();
  const sortOrder = Number(payload.sort_order ?? 100);
  if (!name || !scopeId || !Number.isFinite(sortOrder)) throw new Error("name, scope_id and sort_order are required");
  const status = await resolveCatalogStatus(payload.status);
  const pageContent = await resolvePageContent(resolveIncomingContent(payload));
  const parent = payload.parent !== undefined ? String(payload.parent).trim() : "";
  const destination = payload.destination ? String(payload.destination).trim() : null;
  await validateRoleScope(scopeId);
  await validateModuleParent(parent);
  const effectiveRoute = await resolveParentAwareRoute(payload.route ? String(payload.route) : null, parent);
  const code = await generateModuleCode(name);
  const actions = payload.actions ? JSON.stringify(payload.actions) : null;
  const result = await getPgPool().query(
    "insert into public.\"Modules\" (code,name,description,route,icon,sort_order,status,parent,scope_id,content,destination,actions) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *",
    [code, name, payload.description ? String(payload.description) : null, effectiveRoute, payload.icon ? String(payload.icon) : null, sortOrder, status, parent, scopeId, pageContent, destination, actions]
  );
  await ensureModuleRouteScaffold(effectiveRoute, pageContent);
  return result.rows[0];
}

async function updateModuleRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query<Record<string, unknown>>("select * from public.\"Modules\" where id=$1 limit 1", [id]);
  if ((current.rowCount ?? 0) === 0) throw new Error("Record not found");
  if (patch.code && String(patch.code).trim().toUpperCase() !== String(current.rows[0].code ?? "")) throw new Error("code is immutable");
  const next = {
    name: patch.name ? String(patch.name).trim() : String(current.rows[0].name ?? ""),
    description: patch.description !== undefined ? (patch.description ? String(patch.description) : null) : (current.rows[0].description as string | null),
    route: patch.route !== undefined ? (patch.route ? String(patch.route) : null) : (current.rows[0].route as string | null),
    icon: patch.icon !== undefined ? (patch.icon ? String(patch.icon) : null) : (current.rows[0].icon as string | null),
    sort_order: patch.sort_order !== undefined ? Number(patch.sort_order) : Number(current.rows[0].sort_order ?? 100),
    status: patch.status !== undefined ? await resolveCatalogStatus(patch.status) : await resolveCatalogStatus(current.rows[0].status),
    content:
      patch.content !== undefined
        ? await resolvePageContent(resolveIncomingContent(patch))
        : await resolvePageContent(current.rows[0].content ?? "newPage"),
    parent: patch.parent !== undefined ? String(patch.parent).trim() : String(current.rows[0].parent ?? "/"),
    scope_id: patch.scope_id !== undefined ? String(patch.scope_id) : String(current.rows[0].scope_id ?? ""),
    destination: patch.destination !== undefined ? (patch.destination ? String(patch.destination).trim() : null) : (current.rows[0].destination as string | null),
    actions: patch.actions !== undefined ? (patch.actions ? JSON.stringify(patch.actions) : null) : (current.rows[0].actions ? JSON.stringify(current.rows[0].actions) : null)
  };
  if (!Number.isFinite(next.sort_order)) throw new Error("sort_order must be numeric");
  await validateRoleScope(next.scope_id);
  await validateModuleParent(next.parent);
  const effectiveRoute = await resolveParentAwareRoute(next.route, next.parent);
  const updated = await getPgPool().query(
    "update public.\"Modules\" set name=$1, description=$2, route=$3, icon=$4, sort_order=$5, status=$6, parent=$7, scope_id=$8, content=$9, destination=$10, actions=$11, updated_at=now() where id=$12 returning *",
    [next.name, next.description, effectiveRoute, next.icon, next.sort_order, next.status, next.parent, next.scope_id, next.content, next.destination, next.actions, id]
  );
  await ensureModuleRouteScaffold(effectiveRoute, next.content);
  return updated.rows[0];
}

async function softDeleteModuleRecord(actor: ActorContext, id: string) {
  ensureSu(actor);
  const inactive = await resolveCatalogStatus("inactive");
  const updated = await getPgPool().query("update public.\"Modules\" set status=$1, updated_at=now() where id=$2 returning *", [inactive, id]);
  if ((updated.rowCount ?? 0) === 0) throw new Error("Record not found");
}

function sanitizeMultidataText(value: unknown) {
  return String(value ?? "").trim();
}

async function createStMultidataRecord(actor: ActorContext, payload: Record<string, unknown>) {
  ensureSu(actor);
  const initialsPk = sanitizeMultidataText(payload.Initials_PK);
  const name = sanitizeMultidataText(payload.name);
  const value = sanitizeMultidataText(payload.value);
  const type = sanitizeMultidataText(payload.type);
  const typeDescription = sanitizeMultidataText(payload.typeDescription) || null;
  const typeUse = sanitizeMultidataText(payload.typeUse) || null;

  if (!initialsPk || !name || !value || !type) {
    throw new Error("Initials_PK, name, value and type are required");
  }

  const result = await getPgPool().query(
    'insert into public."st_Multidata" ("Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at) values ($1,$2,$3,$4,$5,$6,now(),now()) returning "Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at',
    [initialsPk, name, value, type, typeDescription, typeUse]
  );

  return result.rows[0];
}

async function updateStMultidataRecord(actor: ActorContext, valueId: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query(
    'select "Initials_PK", name, value, type, "typeDescription", "typeUse" from public."st_Multidata" where value=$1 limit 1',
    [valueId]
  );
  if ((current.rowCount ?? 0) === 0) throw new Error("Record not found");

  const row = current.rows[0] as Record<string, unknown>;
  const initialsPk = patch.Initials_PK !== undefined ? sanitizeMultidataText(patch.Initials_PK) : sanitizeMultidataText(row.Initials_PK);
  const name = patch.name !== undefined ? sanitizeMultidataText(patch.name) : sanitizeMultidataText(row.name);
  const value = patch.value !== undefined ? sanitizeMultidataText(patch.value) : sanitizeMultidataText(row.value);
  const type = patch.type !== undefined ? sanitizeMultidataText(patch.type) : sanitizeMultidataText(row.type);
  const typeDescription = patch.typeDescription !== undefined ? (sanitizeMultidataText(patch.typeDescription) || null) : (row.typeDescription ? String(row.typeDescription) : null);
  const typeUse = patch.typeUse !== undefined ? (sanitizeMultidataText(patch.typeUse) || null) : (row.typeUse ? String(row.typeUse) : null);

  if (!initialsPk || !name || !value || !type) {
    throw new Error("Initials_PK, name, value and type are required");
  }

  const result = await getPgPool().query(
    'update public."st_Multidata" set "Initials_PK"=$1, name=$2, value=$3, type=$4, "typeDescription"=$5, "typeUse"=$6, updated_at=now() where value=$7 returning "Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at',
    [initialsPk, name, value, type, typeDescription, typeUse, valueId]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("Record not found");
  return result.rows[0];
}

async function deleteStMultidataRecord(actor: ActorContext, valueId: string) {
  ensureSu(actor);
  const result = await getPgPool().query('delete from public."st_Multidata" where value=$1 returning value', [valueId]);
  if ((result.rowCount ?? 0) === 0) throw new Error("Record not found");
}

async function appendAuditDeny(actor: ActorContext, table: string, reason: string) {
  try {
    const auditId = `AUD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await getPgPool().query(
      `INSERT INTO "AuditLog" (id, "companyId", "platformUserId", "actorType", "actorId", action, entity, metadata, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        auditId,
        actor.companyId,
        actor.actorId,
        actor.role,
        actor.actorId,
        "deny",
        table,
        JSON.stringify({ reason })
      ]
    );
  } catch {
    return;
  }
}

export async function listActiveModulesForRole(role: ActorScope) {
  const rows = await getPgPool().query<{ id: string; code: string; name: string; route: string | null; icon: string | null; scope_value: string | null; scope_name: string | null }>(
    'select m.id, m.code, m.name, m.route, m.icon, lower(coalesce(s."value",\'\')) as scope_value, lower(coalesce(s."name",\'\')) as scope_name from public.\"Modules\" m join public."st_Multidata" s on lower(s."Initials_PK") = lower(m.scope_id) where lower(m.status)=\'active\' order by m.sort_order asc, m.name asc'
  );
  return rows.rows.filter((row) => {
    const marker = `${row.scope_value ?? ""} ${row.scope_name ?? ""}`;
    if (marker.includes("su") && !marker.includes("client")) return role === "SU";
    return true;
  }).map((row) => ({ id: row.id, code: row.code, name: row.name, route: row.route, icon: row.icon }));
}

const PK_MAP = {
  modules: 'id',
  users: 'id_user_pk',
  oauth_sessions: 'id',
  roles: 'id',
  role_assignments: 'id',
  audit_logs: 'id',
  st_multidata: 'value',
  st_country: 'iso',
  st_state: 'id_state',
  st_city: 'id_city',
  companies: 'id',
  onboardings: 'id'
} as const;

function hashPassword(password: string): string {
  return createHmac("sha256", "user-password-salt-98234").update(password).digest("hex");
}

async function createPlatformUserRecord(actor: ActorContext, payload: Record<string, unknown>) {
  ensureSu(actor);
  const email = String(payload.user_email || payload.email || "").trim().toLowerCase();
  const name = String(payload.name || payload.firstName || "").trim();
  const lastName = String(payload.last_name || payload.lastName || "").trim();
  const phone = String(payload.phone_number || payload.phone || "").trim();
  const companyId = payload.companyId ? String(payload.companyId).trim() : (actor.role !== "SU" ? actor.companyId : "900000000");
  const countryCode = String(payload.country_code || "+57").trim();
  const countryIso = String(payload.country_iso || "CO").trim();
  const status = String(payload.status || "active").trim();
  const provider = String(payload.provider || "google").trim();
  const passwordVal = payload.password ? hashPassword(String(payload.password)) : null;

  if (!email || !name) throw new Error("user_email and name are required");

  const id = `USR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const username = email;

  const result = await getPgPool().query(
    `INSERT INTO public."PlatformUser" (
      id_user_pk, user_email, username, name, last_name, phone_number, "companyId", 
      country_code, country_iso, dni, birth_date, gender, status, provider, avatar, position, password, department_code, city_code, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now()) returning *`,
    [
      id, email, username, name, lastName, phone, companyId,
      countryCode, countryIso, payload.dni ? String(payload.dni) : null,
      payload.birth_date ? new Date(String(payload.birth_date)) : null,
      payload.gender ? String(payload.gender) : null,
      status, provider, payload.avatar ? String(payload.avatar) : null,
      payload.position ? String(payload.position) : null,
      passwordVal,
      payload.department_code ? String(payload.department_code) : null,
      payload.city_code ? String(payload.city_code) : null
    ]
  );
  return result.rows[0];
}

async function updatePlatformUserRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query('SELECT * FROM public."PlatformUser" WHERE id_user_pk=$1 LIMIT 1', [id]);
  if ((current.rowCount ?? 0) === 0) throw new Error("User not found");

  const row = current.rows[0];
  const email = patch.user_email !== undefined ? String(patch.user_email).trim().toLowerCase() : row.user_email;
  const name = patch.name !== undefined ? String(patch.name).trim() : row.name;
  const lastName = patch.last_name !== undefined ? String(patch.last_name).trim() : row.last_name;
  const phone = patch.phone_number !== undefined ? String(patch.phone_number).trim() : row.phone_number;
  const companyId = patch.companyId !== undefined ? String(patch.companyId).trim() : row.companyId;
  const countryCode = patch.country_code !== undefined ? String(patch.country_code).trim() : row.country_code;
  const countryIso = patch.country_iso !== undefined ? String(patch.country_iso).trim() : row.country_iso;
  const status = patch.status !== undefined ? String(patch.status).trim() : row.status;
  const provider = patch.provider !== undefined ? String(patch.provider).trim() : row.provider;
  const dni = patch.dni !== undefined ? (patch.dni ? String(patch.dni) : null) : row.dni;
  const birthDate = patch.birth_date !== undefined ? (patch.birth_date ? new Date(String(patch.birth_date)) : null) : row.birth_date;
  const gender = patch.gender !== undefined ? (patch.gender ? String(patch.gender) : null) : row.gender;
  const avatar = patch.avatar !== undefined ? (patch.avatar ? String(patch.avatar) : null) : row.avatar;
  const position = patch.position !== undefined ? (patch.position ? String(patch.position) : null) : row.position;
  const departmentCode = patch.department_code !== undefined ? (patch.department_code ? String(patch.department_code) : null) : row.department_code;
  const cityCode = patch.city_code !== undefined ? (patch.city_code ? String(patch.city_code) : null) : row.city_code;

  // Manejo de cambio de contraseña con verificación de contraseña anterior
  if (patch.newPassword !== undefined) {
    const oldPassword = String(patch.oldPassword || "");
    const newPassword = String(patch.newPassword || "");
    const currentHashed = row.password;
    if (currentHashed) {
      const hashedOld = hashPassword(oldPassword);
      if (hashedOld !== currentHashed) {
        throw new Error("La contraseña anterior es incorrecta.");
      }
    }
    const hashedNew = hashPassword(newPassword);
    await getPgPool().query(
      'UPDATE public."PlatformUser" SET password=$1, updated_at=now() WHERE id_user_pk=$2',
      [hashedNew, id]
    );
  }

  const result = await getPgPool().query(
    `UPDATE public."PlatformUser" SET 
      user_email=$1, username=$2, name=$3, last_name=$4, phone_number=$5, "companyId"=$6, 
      country_code=$7, country_iso=$8, dni=$9, birth_date=$10, gender=$11, status=$12, 
      provider=$13, avatar=$14, position=$15, department_code=$16, city_code=$17, updated_at=now() 
     WHERE id_user_pk=$18 returning *`,
    [
      email, email, name, lastName, phone, companyId,
      countryCode, countryIso, dni, birthDate, gender, status,
      provider, avatar, position, departmentCode, cityCode, id
    ]
  );
  return result.rows[0];
}

async function deletePlatformUserRecord(actor: ActorContext, id: string) {
  ensureSu(actor);
  const result = await getPgPool().query('DELETE FROM public."PlatformUser" WHERE id_user_pk=$1 RETURNING id_user_pk', [id]);
  if ((result.rowCount ?? 0) === 0) throw new Error("User not found");
}

async function createOnboardingRecord(actor: ActorContext, payload: Record<string, unknown>) {
  if (actor.role !== "SU" && actor.companyId) {
    payload.companyId = actor.companyId; // Enforce company scope for client role
  }
  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("email is required");

  const id = `ONB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const status = String(payload.status ?? "pending_approval").trim();

  const result = await getPgPool().query(
    `INSERT INTO public."Onboarding" (
      id, email, name, last_name, phone_number, "companyId", 
      country_code, country_iso, department_code, city_code, dni, birth_date, gender, provider, avatar, status, metadata, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now()) returning *`,
    [
      id,
      email,
      payload.name ? String(payload.name).trim() : null,
      payload.lastName || payload.last_name ? String(payload.lastName || payload.last_name).trim() : null,
      payload.phoneNumber || payload.phone_number ? String(payload.phoneNumber || payload.phone_number).trim() : null,
      payload.companyId ? String(payload.companyId).trim() : null,
      payload.countryCode || payload.country_code ? String(payload.countryCode || payload.country_code).trim() : null,
      payload.countryIso || payload.country_iso ? String(payload.countryIso || payload.country_iso).trim() : null,
      payload.departmentCode || payload.department_code ? String(payload.departmentCode || payload.department_code).trim() : null,
      payload.cityCode || payload.city_code ? String(payload.cityCode || payload.city_code).trim() : null,
      payload.dni ? String(payload.dni).trim() : null,
      payload.birthDate || payload.birth_date ? new Date(String(payload.birthDate || payload.birth_date)) : null,
      payload.gender ? String(payload.gender).trim() : null,
      payload.provider ? String(payload.provider).trim() : null,
      payload.avatar ? String(payload.avatar).trim() : null,
      status,
      payload.metadata ? JSON.stringify(payload.metadata) : null
    ]
  );
  return result.rows[0];
}

async function updateOnboardingRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  const current = await getPgPool().query('SELECT * FROM public."Onboarding" WHERE id=$1 LIMIT 1', [id]);
  if ((current.rowCount ?? 0) === 0) throw new Error("Onboarding record not found");
  const row = current.rows[0];

  if (actor.role !== "SU" && actor.companyId && String(row.companyId) !== actor.companyId) {
    throw new Error("Forbidden");
  }

  const next = {
    email: patch.email !== undefined ? String(patch.email).trim().toLowerCase() : row.email,
    name: patch.name !== undefined ? (patch.name ? String(patch.name).trim() : null) : row.name,
    lastName: patch.lastName !== undefined ? (patch.lastName ? String(patch.lastName).trim() : null) : (patch.last_name !== undefined ? (patch.last_name ? String(patch.last_name).trim() : null) : row.last_name),
    phoneNumber: patch.phoneNumber !== undefined ? (patch.phoneNumber ? String(patch.phoneNumber).trim() : null) : (patch.phone_number !== undefined ? (patch.phone_number ? String(patch.phone_number).trim() : null) : row.phone_number),
    companyId: patch.companyId !== undefined ? (patch.companyId ? String(patch.companyId).trim() : null) : row.companyId,
    countryCode: patch.countryCode !== undefined ? (patch.countryCode ? String(patch.countryCode).trim() : null) : (patch.country_code !== undefined ? (patch.country_code ? String(patch.country_code).trim() : null) : row.country_code),
    countryIso: patch.countryIso !== undefined ? (patch.countryIso ? String(patch.countryIso).trim() : null) : (patch.country_iso !== undefined ? (patch.country_iso ? String(patch.country_iso).trim() : null) : row.country_iso),
    departmentCode: patch.departmentCode !== undefined ? (patch.departmentCode ? String(patch.departmentCode).trim() : null) : (patch.department_code !== undefined ? (patch.department_code ? String(patch.department_code).trim() : null) : row.department_code),
    cityCode: patch.cityCode !== undefined ? (patch.cityCode ? String(patch.cityCode).trim() : null) : (patch.city_code !== undefined ? (patch.city_code ? String(patch.city_code).trim() : null) : row.city_code),
    dni: patch.dni !== undefined ? (patch.dni ? String(patch.dni).trim() : null) : row.dni,
    birthDate: patch.birthDate !== undefined ? (patch.birthDate ? new Date(String(patch.birthDate)) : null) : (patch.birth_date !== undefined ? (patch.birth_date ? new Date(String(patch.birth_date)) : null) : row.birth_date),
    gender: patch.gender !== undefined ? (patch.gender ? String(patch.gender).trim() : null) : row.gender,
    provider: patch.provider !== undefined ? (patch.provider ? String(patch.provider).trim() : null) : row.provider,
    avatar: patch.avatar !== undefined ? (patch.avatar ? String(patch.avatar).trim() : null) : row.avatar,
    status: patch.status !== undefined ? String(patch.status).trim() : row.status,
    metadata: patch.metadata !== undefined ? (patch.metadata ? JSON.stringify(patch.metadata) : null) : (row.metadata ? JSON.stringify(row.metadata) : null)
  };

  if (!next.email) throw new Error("email is required");

  const result = await getPgPool().query(
    `UPDATE public."Onboarding" SET 
      email=$1, name=$2, last_name=$3, phone_number=$4, "companyId"=$5, 
      country_code=$6, country_iso=$7, department_code=$8, city_code=$9, dni=$10, 
      birth_date=$11, gender=$12, provider=$13, avatar=$14, status=$15, metadata=$16, updated_at=now() 
     WHERE id=$17 returning *`,
    [
      next.email, next.name, next.lastName, next.phoneNumber, next.companyId,
      next.countryCode, next.countryIso, next.departmentCode, next.cityCode, next.dni,
      next.birthDate, next.gender, next.provider, next.avatar, next.status, next.metadata, id
    ]
  );
  return result.rows[0];
}

async function deleteOnboardingRecord(actor: ActorContext, id: string) {
  const current = await getPgPool().query('SELECT * FROM public."Onboarding" WHERE id=$1 LIMIT 1', [id]);
  if ((current.rowCount ?? 0) === 0) throw new Error("Onboarding record not found");
  if (actor.role !== "SU" && actor.companyId && String(current.rows[0].companyId) !== actor.companyId) {
    throw new Error("Forbidden");
  }
  const result = await getPgPool().query('DELETE FROM public."Onboarding" WHERE id=$1 RETURNING id', [id]);
  if ((result.rowCount ?? 0) === 0) throw new Error("Record not found");
}

/** Normaliza cualquier valor de scope al enum exacto de PostgreSQL: SU | Admin | User */
function normalizeRoleScope(raw: string): string {
  const map: Record<string, string> = {
    // SU
    "su": "SU",
    // Admin variants
    "admin": "Admin",
    "adm": "Admin",
    "administrator": "Admin",
    "administrador": "Admin",
    // User variants
    "user": "User",
    "usr": "User",
    "client": "User",
    "client ": "User",
    "cliente": "User",
    "usr ": "User",
    // Multicompany
    "multicompany": "Multicompany",
    "multicompania": "Multicompany",
    "multicompañía": "Multicompany"
  };
  const normalized = map[raw.trim().toLowerCase()];
  if (normalized) return normalized;
  // Si ya es un valor válido del enum, lo devuelve tal cual
  if (["SU", "Admin", "User", "Multicompany"].includes(raw.trim())) return raw.trim();
  // Fallback seguro
  return "User";
}

async function createRoleRecord(actor: ActorContext, payload: Record<string, unknown>) {
  const name = String(payload.name || "").trim();
  const key = String(payload.key_id || payload.key || "").trim().toUpperCase().slice(0, 5);
  const description = String(payload.description || "").trim();
  const scope = normalizeRoleScope(String(payload.scope || "User").trim());
  const companyId = actor.role !== "SU" ? actor.companyId : String(payload.company_id || payload.companyId || "900000000").trim();

  if (!name || !key) throw new Error("name and key_id are required");

  const id = `ROL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const emptyHash = await calculateRolePermissionsHash(id);

  await getPgPool().query(
    'insert into public."Role" (id, "companyId", name, key, description, scope, "hashPermission", "createdAt", "updatedAt") values ($1, $2, $3, $4, $5, $6, $7, now(), now())',
    [id, companyId, name, key, description, scope, emptyHash]
  );

  return {
    id,
    key_id: key,
    name,
    description,
    scope,
    company_id: companyId,
    status: "active",
    permissions: {}
  };
}

async function calculateRolePermissionsHash(roleId: string): Promise<string> {
  const permRows = await getPgPool().query<{
    moduleId: string;
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    actions: any;
  }>(
    'select "moduleId", "canRead", "canCreate", "canUpdate", "canDelete", actions from public."RolePermission" where "roleId"=$1 and "status"=\'active\' order by "moduleId" asc',
    [roleId]
  );

  const segments = permRows.rows.map((p) => {
    let actions: Record<string, boolean> = {};
    if (p.actions) {
      if (typeof p.actions === "string") {
        try {
          actions = JSON.parse(p.actions);
        } catch {
          actions = {};
        }
      } else {
        actions = p.actions as Record<string, boolean>;
      }
    }
    const activeActions = Object.keys(actions)
      .filter((k) => !!actions[k])
      .sort();

    return `${p.moduleId}:${p.canRead}:${p.canCreate}:${p.canUpdate}:${p.canDelete}:${activeActions.join(",")}`;
  });

  const payload = `${roleId}||${segments.join("|")}`;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "role-permission-default-salt-39824";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function encryptBackup(dataStr: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "backup-secret-key-salt-39824";
  const key = scryptSync(secret, "salt", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(dataStr, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptBackup(encryptedStr: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "backup-secret-key-salt-39824";
  const key = scryptSync(secret, "salt", 32);
  const [ivHex, encryptedHex] = encryptedStr.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function updateRoleRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  const name = patch.name !== undefined ? String(patch.name).trim() : null;
  const description = patch.description !== undefined ? String(patch.description).trim() : null;
  const scope = patch.scope !== undefined ? normalizeRoleScope(String(patch.scope).trim()) : null;

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (name !== null) {
    updates.push(`name=$${idx++}`);
    values.push(name);
  }
  if (description !== null) {
    updates.push(`description=$${idx++}`);
    values.push(description);
  }
  if (scope !== null) {
    updates.push(`scope=$${idx++}`);
    values.push(scope);
  }

  if (updates.length > 0) {
    values.push(id);
    await getPgPool().query(
      `update public."Role" set ${updates.join(", ")}, "updatedAt"=now() where id=$${idx}`,
      values
    );
  }

  const permissions = patch.permissions as Record<string, any> | undefined;
  if (permissions) {
    for (const [moduleId, perm] of Object.entries(permissions)) {
      const canRead = !!perm.read;
      const canCreate = !!perm.create;
      const canUpdate = !!perm.update;
      const canDelete = !!perm.delete;
      const actions = perm.microroles || {};

      // Check if incoming has any permission (any true permission or checked microroles)
      const incomingHasAnyPermission = canRead || canCreate || canUpdate || canDelete || Object.values(actions).some(v => !!v);

      // Check if there is currently an ACTIVE RolePermission record
      const existingActiveRes = await getPgPool().query(
        'select id from public."RolePermission" where "roleId"=$1 and "moduleId"=$2 and "status"=\'active\' limit 1',
        [id, moduleId]
      );
      const hasActive = existingActiveRes.rows.length > 0;
      const activeId = hasActive ? existingActiveRes.rows[0].id : null;

      if (hasActive) {
        if (!incomingHasAnyPermission) {
          // If it had permissions (active record exists) and is saved with NO permissions:
          // it must pass to "deprecated"
          await getPgPool().query(
            'update public."RolePermission" set "canRead"=$1, "canCreate"=$2, "canUpdate"=$3, "canDelete"=$4, actions=$5, "status"=\'deprecated\' where id=$6',
            [false, false, false, false, JSON.stringify({}), activeId]
          );
        } else {
          // If it has permissions, we update it normally and keep it "active"
          await getPgPool().query(
            'update public."RolePermission" set "canRead"=$1, "canCreate"=$2, "canUpdate"=$3, "canDelete"=$4, actions=$5, "status"=\'active\' where id=$6',
            [canRead, canCreate, canUpdate, canDelete, JSON.stringify(actions), activeId]
          );
        }
      } else {
        // If there is no active record, but incoming HAS permissions:
        // We create a new "active" one (we do NOT reactivate any deprecated ones)
        if (incomingHasAnyPermission) {
          const permId = `RPM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          await getPgPool().query(
            'insert into public."RolePermission" (id, "roleId", "moduleId", "canRead", "canCreate", "canUpdate", "canDelete", actions, "status") values ($1, $2, $3, $4, $5, $6, $7, $8, \'active\')',
            [permId, id, moduleId, canRead, canCreate, canUpdate, canDelete, JSON.stringify(actions)]
          );
        }
        // If there is no active record, and incoming has NO permissions, we do nothing
      }
    }

    const newHash = await calculateRolePermissionsHash(id);
    await getPgPool().query(
      'update public."Role" set "hashPermission"=$1 where id=$2',
      [newHash, id]
    );

    // Guardar el respaldo cifrado en RolePermissionSecurity
    const activePermsRes = await getPgPool().query(
      'select "moduleId", "canRead", "canCreate", "canUpdate", "canDelete", actions from public."RolePermission" where "roleId"=$1 and "status"=\'active\'',
      [id]
    );
    const backupJson = JSON.stringify(activePermsRes.rows);
    const encryptedBackup = encryptBackup(backupJson);

    const existingBackup = await getPgPool().query(
      'select id from public."RolePermissionSecurity" where "roleId"=$1',
      [id]
    );
    if (existingBackup.rows.length > 0) {
      await getPgPool().query(
        'update public."RolePermissionSecurity" set backup=$1, "updatedAt"=now() where "roleId"=$2',
        [encryptedBackup, id]
      );
    } else {
      const backupId = `RPS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await getPgPool().query(
        'insert into public."RolePermissionSecurity" (id, "roleId", backup, "createdAt", "updatedAt") values ($1, $2, $3, now(), now())',
        [backupId, id, encryptedBackup]
      );
    }
  }

  return { id, ok: true };
}

async function deleteRoleRecord(actor: ActorContext, id: string) {
  const assigned = await getPgPool().query(
    'select id from public."UserRole" where "roleId"=$1 limit 1',
    [id]
  );
  if (assigned.rows.length > 0) {
    throw new Error("No se puede eliminar el rol porque tiene usuarios asignados.");
  }
  await getPgPool().query('delete from public."RolePermission" where "roleId"=$1', [id]);
  await getPgPool().query('delete from public."Role" where id=$1', [id]);
}

export async function listRecords(actor: ActorContext, tableParam: string, id: string | null) {
  const table = normalizeTable(tableParam);

  const isStaticTable = ["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table);
  if (isStaticTable && !id) {
    const cached = staticStoreCache[table];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  if (table === "roles") {
    let query = 'select * from public."Role"';
    const values: string[] = [];
    if (id) {
      query += ' where id=$1';
      values.push(id);
      if (actor.companyId) {
        query += ' and "companyId"=$2';
        values.push(actor.companyId);
      }
    } else if (actor.companyId) {
      query += ' where "companyId"=$1';
      values.push(actor.companyId);
    }
    query += ' order by name asc';
    const roleRows = await getPgPool().query(query, values);

    const rolesList = [];
    for (const r of roleRows.rows) {
      // Only read active role permissions (status = 'active')
      const permRows = await getPgPool().query('select * from public."RolePermission" where "roleId"=$1 and "status"=\'active\'', [r.id]);

      let permissionsMap: Record<string, any> = {};
      const recalculatedHash = await calculateRolePermissionsHash(r.id);
      const savedHash = r.hashPermission || "";
      let integrityStatus = "completa";

      if (savedHash) {
        if (recalculatedHash !== savedHash) {
          console.error(`[SECURITY ALERT] Permissions integrity violation detected for Role ${r.id} (${r.name}). Recalculated: ${recalculatedHash}, Saved: ${savedHash}. Clearing permissions.`);
          await appendAuditDeny(actor, "RolePermission", `Integrity breach: recalculated hash (${recalculatedHash}) does not match saved hash (${savedHash})`);
          permissionsMap = {};
          integrityStatus = "vulnerada";
        } else {
          for (const p of permRows.rows) {
            permissionsMap[p.moduleId] = {
              read: p.canRead,
              create: p.canCreate,
              update: p.canUpdate,
              delete: p.canDelete,
              status: p.status || "active",
              microroles: p.actions || {}
            };
          }
        }
      } else {
        // Retroactive lock: save the recalculated hash to secure it from now on!
        await getPgPool().query(
          'update public."Role" set "hashPermission"=$1 where id=$2',
          [recalculatedHash, r.id]
        );
        for (const p of permRows.rows) {
          permissionsMap[p.moduleId] = {
            read: p.canRead,
            create: p.canCreate,
            update: p.canUpdate,
            delete: p.canDelete,
            status: p.status || "active",
            microroles: p.actions || {}
          };
        }
      }

      rolesList.push({
        id: r.id,
        key_id: r.key,
        name: r.name,
        description: r.description,
        scope: r.scope,
        company_id: r.companyId,
        status: "active",
        permissions: permissionsMap,
        integrityStatus
      });
    }
    return rolesList;
  }

  if (table === "modules") {
    let rawModules;
    if (id) {
      const one = await getPgPool().query("select * from public.\"Modules\" where id=$1", [id]);
      rawModules = one.rows;
    } else {
      const all = await getPgPool().query("select * from public.\"Modules\" order by sort_order asc, name asc");
      rawModules = all.rows;
    }

    let actRole = "user";
    if (actor.role === "SU") {
      actRole = "su";
    } else {
      const userRoleScopeRes = await getPgPool().query<{ scope: string }>(
        `select r.scope 
         from public."UserRole" ur 
         join public."Role" r on r.id = ur."roleId" 
         where ur.platform_user_id = $1 
         limit 1`,
        [actor.actorId]
      );
      if (userRoleScopeRes.rows.length > 0) {
        actRole = String(userRoleScopeRes.rows[0].scope || "user").trim().toLowerCase();
      }
    }

    const multidataRes = await getPgPool().query<{ Initials_PK: string; value: string }>(
      'select "Initials_PK", "value" from public."st_Multidata"'
    );
    const scopeMap = new Map<string, string>();
    for (const mData of multidataRes.rows) {
      scopeMap.set(String(mData.Initials_PK).toLowerCase(), String(mData.value).trim().toLowerCase());
    }

    const filtered = rawModules.filter((m) => {
      const scopeId = String(m.scope_id || "").trim().toLowerCase();
      const scopeVal = scopeMap.get(scopeId) || "";

      if (actRole === "su") {
        return true;
      }
      if (actRole === "admin" || actRole === "administrator" || actRole === "administrador") {
        return scopeVal === "user" || scopeVal === "admin" || !scopeVal;
      }
      return scopeVal === "user" || !scopeVal;
    });

    if (!id) {
      staticStoreCache["modules"] = {
        data: filtered,
        expiresAt: Date.now() + STATIC_CACHE_TTL_MS
      };
    }
    return filtered;
  }
  if (table === "st_multidata") {
    if (id) {
      const one = await getPgPool().query('select "Initials_PK" as "Initials_PK", "name", "value", "type", "typeDescription", "typeUse", "created_at", "updated_at" from public."st_Multidata" where value=$1', [id]);
      return one.rows;
    }
    const all = await getPgPool().query('select "Initials_PK" as "Initials_PK", "name", "value", "type", "typeDescription", "typeUse", "created_at", "updated_at" from public."st_Multidata"');
    staticStoreCache["st_multidata"] = {
      data: all.rows,
      expiresAt: Date.now() + STATIC_CACHE_TTL_MS
    };
    return all.rows;
  }

  if (table === "role_assignments") {
    let query = 'select ur.* from public."UserRole" ur';
    const values: string[] = [];
    if (id) {
      query += ' where ur.id=$1';
      values.push(id);
      if (actor.companyId) {
        query += ' and ur.company_id=$2';
        values.push(actor.companyId);
      }
    } else if (actor.companyId) {
      query += ' where ur.company_id=$1';
      values.push(actor.companyId);
    }
    const result = await getPgPool().query(query, values);
    
    // Validar la firma criptográfica de integridad de cada asignación
    const validatedRows = [];
    for (const ur of result.rows) {
      const isValid = await validateRoleAssignmentSecurityHash(ur.platform_user_id, ur.hash_permission, ur.roleId, ur.company_id);
      if (!isValid) {
        await appendAuditDeny(
          actor,
          "UserRole",
          `Integrity breach: Assignment validation failed for ID ${ur.id} (user: ${ur.platform_user_id}, role: ${ur.roleId}). Tampering suspected.`
        );
        validatedRows.push({
          ...ur,
          roleId: null,
          compromised: true
        });
      } else {
        validatedRows.push(ur);
      }
    }
    return validatedRows;
  }

  const dbTable = TABLE_MAP[table];
  let query = `select * from ${dbTable}`;
  const values: string[] = [];
  const pkColumn = PK_MAP[table] || 'id';

  if (id) {
    query += ` where "${pkColumn}"=$1`;
    values.push(id);
  }
  if (actor.role !== "SU" && COMPANY_SCOPED_TABLES.has(table)) {
    if (!actor.companyId) throw new Error("companyId is required for non-SU actors");
    const companyCol = (table === "users" || table === "onboardings") ? '"companyId"' : 'companyid';
    query += id ? ` and ${companyCol}=$2` : ` where ${companyCol}=$1`;
    values.push(actor.companyId);
  }
  const result = await getPgPool().query(query, values);

  if (isStaticTable && !id) {
    staticStoreCache[table] = {
      data: result.rows,
      expiresAt: Date.now() + STATIC_CACHE_TTL_MS
    };
  }
  return result.rows;
}

export async function createRecord(actor: ActorContext, tableParam: string, payload: Record<string, unknown>) {
  const table = normalizeTable(tableParam);
  if (["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table)) {
    invalidateStoreCache(table);
  }
  if (table === "modules") return createModuleRecord(actor, payload);
  if (table === "st_multidata") return createStMultidataRecord(actor, payload);
  if (table === "users") return createPlatformUserRecord(actor, payload);
  if (table === "roles") return createRoleRecord(actor, payload);
  if (table === "role_assignments") return createRoleAssignmentRecord(actor, payload);
  if (table === "onboardings") return createOnboardingRecord(actor, payload);
  ensureSu(actor);
  throw new Error(`Create is not enabled for table '${table}'`);
}

export async function updateRecord(actor: ActorContext, tableParam: string, id: string, patch: Record<string, unknown>) {
  const table = normalizeTable(tableParam);
  if (["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table)) {
    invalidateStoreCache(table);
  }
  if (table === "modules") return updateModuleRecord(actor, id, patch);
  if (table === "st_multidata") return updateStMultidataRecord(actor, id, patch);
  if (table === "users") return updatePlatformUserRecord(actor, id, patch);
  if (table === "roles") return updateRoleRecord(actor, id, patch);
  if (table === "role_assignments") return updateRoleAssignmentRecord(actor, id, patch);
  if (table === "onboardings") return updateOnboardingRecord(actor, id, patch);
  ensureSu(actor);
  throw new Error(`Update is not enabled for table '${table}'`);
}

export async function deleteRecord(actor: ActorContext, tableParam: string, id: string) {
  const table = normalizeTable(tableParam);
  if (["modules", "st_multidata", "st_country", "st_state", "st_city"].includes(table)) {
    invalidateStoreCache(table);
  }
  if (table === "modules") {
    await softDeleteModuleRecord(actor, id);
    return;
  }
  if (table === "st_multidata") {
    await deleteStMultidataRecord(actor, id);
    return;
  }
  if (table === "users") {
    await deletePlatformUserRecord(actor, id);
    return;
  }
  if (table === "roles") {
    await deleteRoleRecord(actor, id);
    return;
  }
  if (table === "role_assignments") {
    await deleteRoleAssignmentRecord(actor, id);
    return;
  }
  if (table === "onboardings") {
    await deleteOnboardingRecord(actor, id);
    return;
  }
  ensureSu(actor);
  throw new Error(`Delete is not enabled for table '${table}'`);
}

export async function repairRoleRecord(
  actor: ActorContext,
  roleId: string,
  repairAction: "restore" | "scratch"
) {
  if (actor.role !== "SU") {
    throw new Error("Forbidden: Solo el Super Usuario (SU) está autorizado para reparar la integridad de un cargo.");
  }

  const roleRes = await getPgPool().query<{ name: string; hashPermission: string }>(
    'select name, "hashPermission" from public."Role" where id=$1 limit 1',
    [roleId]
  );
  if (roleRes.rows.length === 0) throw new Error("Role not found");
  const role = roleRes.rows[0];

  if (repairAction === "scratch") {
    await getPgPool().query(
      'update public."RolePermission" set "status"=\'deprecated\' where "roleId"=$1 and "status"=\'active\'',
      [roleId]
    );

    const emptyHash = await calculateRolePermissionsHash(roleId);
    await getPgPool().query(
      'update public."Role" set "hashPermission"=$1 where id=$2',
      [emptyHash, roleId]
    );

    await getPgPool().query(
      'delete from public."RolePermissionSecurity" where "roleId"=$1',
      [roleId]
    );

    await appendAuditDeny(actor, "RolePermission", `Cargo "${role.name}" configurado desde cero por SU.`);
    return { ok: true, report: `El cargo "${role.name}" fue configurado desde cero con éxito. Todos los permisos antiguos fueron revocados.` };
  }

  if (repairAction === "restore") {
    const backupRes = await getPgPool().query<{ backup: string }>(
      'select backup from public."RolePermissionSecurity" where "roleId"=$1 limit 1',
      [roleId]
    );
    if (backupRes.rows.length === 0) {
      throw new Error("No existe copia de seguridad guardada para este cargo. Por favor, configúrelo desde cero.");
    }

    const decryptedBackup = decryptBackup(backupRes.rows[0].backup);
    const backupPermissions: Array<{
      moduleId: string;
      canRead: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
      actions: any;
    }> = JSON.parse(decryptedBackup);

    const currentActiveRes = await getPgPool().query<{
      id: string;
      moduleId: string;
      canRead: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
      actions: any;
    }>(
      'select id, "moduleId", "canRead", "canCreate", "canUpdate", "canDelete", actions from public."RolePermission" where "roleId"=$1 and "status"=\'active\'',
      [roleId]
    );
    const currentActive = currentActiveRes.rows;

    const differences: string[] = [];
    const currentMap = new Map(currentActive.map((p) => [p.moduleId, p]));
    const backupMap = new Map(backupPermissions.map((p) => [p.moduleId, p]));

    for (const [moduleId, bp] of backupMap.entries()) {
      const cp = currentMap.get(moduleId);
      const modNameRes = await getPgPool().query<{ name: string }>(
        'select name from public."Modules" where id=$1 limit 1',
        [moduleId]
      );
      const modName = modNameRes.rows[0]?.name || moduleId;

      if (!cp) {
        differences.push(`Módulo "${modName}": Permiso legítimo ELIMINADO en base de datos.`);
      } else {
        if (bp.canRead !== cp.canRead) {
          differences.push(`Módulo "${modName}" -> Leer: Modificado de ${bp.canRead} a ${cp.canRead}.`);
        }
        if (bp.canCreate !== cp.canCreate) {
          differences.push(`Módulo "${modName}" -> Crear: Modificado de ${bp.canCreate} a ${cp.canCreate}.`);
        }
        if (bp.canUpdate !== cp.canUpdate) {
          differences.push(`Módulo "${modName}" -> Actualizar: Modificado de ${bp.canUpdate} a ${cp.canUpdate}.`);
        }
        if (bp.canDelete !== cp.canDelete) {
          differences.push(`Módulo "${modName}" -> Borrar: Modificado de ${bp.canDelete} a ${cp.canDelete}.`);
        }

        const bpActions = typeof bp.actions === 'string' ? JSON.parse(bp.actions) : (bp.actions || {});
        const cpActions = typeof cp.actions === 'string' ? JSON.parse(cp.actions) : (cp.actions || {});
        
        const allActionKeys = new Set([...Object.keys(bpActions), ...Object.keys(cpActions)]);
        for (const actKey of allActionKeys) {
          const bpVal = !!bpActions[actKey];
          const cpVal = !!cpActions[actKey];
          if (bpVal !== cpVal) {
            differences.push(`Módulo "${modName}" -> Acción "${actKey}": Modificada de ${bpVal} a ${cpVal}.`);
          }
        }
      }
    }

    for (const [moduleId, cp] of currentMap.entries()) {
      if (!backupMap.has(moduleId)) {
        const modNameRes = await getPgPool().query<{ name: string }>(
          'select name from public."Modules" where id=$1 limit 1',
          [moduleId]
        );
        const modName = modNameRes.rows[0]?.name || moduleId;
        differences.push(`Módulo "${modName}": Permisos ILEGALES añadidos por fuera de la aplicación.`);
      }
    }

    const reportText = differences.length > 0
      ? `Se detectaron las siguientes discrepancias en base de datos:\n${differences.map((d, i) => `${i + 1}. ${d}`).join("\n")}`
      : `No se encontraron diferencias en permisos individuales, pero la firma de seguridad fue vulnerada.`;

    await getPgPool().query(
      'update public."RolePermission" set "status"=\'deprecated\' where "roleId"=$1 and "status"=\'active\'',
      [roleId]
    );

    for (const bp of backupPermissions) {
      const permId = `RPM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await getPgPool().query(
        'insert into public."RolePermission" (id, "roleId", "moduleId", "canRead", "canCreate", "canUpdate", "canDelete", actions, "status") values ($1, $2, $3, $4, $5, $6, $7, $8, \'active\')',
        [permId, roleId, bp.moduleId, bp.canRead, bp.canCreate, bp.canUpdate, bp.canDelete, typeof bp.actions === 'string' ? bp.actions : JSON.stringify(bp.actions)]
      );
    }

    const restoredHash = await calculateRolePermissionsHash(roleId);
    await getPgPool().query(
      'update public."Role" set "hashPermission"=$1 where id=$2',
      [restoredHash, roleId]
    );

    const auditId = `AUD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await getPgPool().query(
      `INSERT INTO "AuditLog" (id, "companyId", "platformUserId", "actorType", "actorId", action, entity, "entityId", metadata, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())`,
      [
        auditId,
        actor.companyId,
        actor.actorId,
        actor.role,
        actor.actorId,
        "repair_audit_report",
        "RolePermission",
        roleId,
        JSON.stringify({ report: reportText })
      ]
    );

    return { ok: true, report: reportText };
  }

  throw new Error("Acción de reparación no válida");
}

export { isCorsOriginAllowed };

export async function auditDenied(actor: ActorContext, table: string, reason: string) {
  await appendAuditDeny(actor, table, reason);
}

// ==========================================
// CAPA DE SEGURIDAD CRIPTOGRÁFICA Y CRUD PARA ASIGNACIÓN DE ROLES
// ==========================================

export function encryptWithKey(text: string, keyMaterial: string): string {
  const key = scryptSync(keyMaterial, "role-assignment-salt", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptWithKey(encryptedText: string, keyMaterial: string): string {
  const key = scryptSync(keyMaterial, "role-assignment-salt", 32);
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  const [ivHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedHex!, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function calculateRoleAssignmentSecurityHash(
  platformUserId: string,
  roleId: string,
  companyIdParam?: string | null
): Promise<string> {
  const roleRes = await getPgPool().query<{ id: string; scope: string; key: string; companyId: string }>(
    'select id, scope, key, "companyId" from public."Role" where id=$1 limit 1',
    [roleId]
  );
  if (roleRes.rows.length === 0) {
    throw new Error(`Role ${roleId} not found`);
  }
  const role = roleRes.rows[0]!;

  const effectiveCompanyId = companyIdParam || role.companyId;
  const positionIdCiphered = encryptWithKey(role.id, String(effectiveCompanyId));

  const payload = {
    scope: role.scope,
    positionName: role.key,
    positionId: positionIdCiphered,
    companyId: Number(effectiveCompanyId)
  };

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "default-outer-salt-2849";
  const outerKeyMaterial = `${platformUserId}-${secret}`;

  return encryptWithKey(JSON.stringify(payload), outerKeyMaterial);
}

export async function validateRoleAssignmentSecurityHash(
  platformUserId: string,
  hashPermission: string | null,
  roleId: string,
  companyIdParam?: string | null
): Promise<boolean> {
  if (!hashPermission) return false;

  try {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "default-outer-salt-2849";
    const outerKeyMaterial = `${platformUserId}-${secret}`;

    const decryptedJson = decryptWithKey(hashPermission, outerKeyMaterial);
    const payload = JSON.parse(decryptedJson) as {
      scope: string;
      positionName: string;
      positionId: string;
      companyId: number;
    };

    const companyIdStr = companyIdParam || String(payload.companyId);
    const decryptedRoleId = decryptWithKey(payload.positionId, companyIdStr);

    if (decryptedRoleId !== roleId) {
      return false;
    }

    const roleRes = await getPgPool().query<{ scope: string; key: string; companyId: string }>(
      'select scope, key, "companyId" from public."Role" where id=$1 limit 1',
      [roleId]
    );
    if (roleRes.rows.length === 0) return false;
    const role = roleRes.rows[0]!;

    if (
      role.scope !== payload.scope ||
      role.key !== payload.positionName ||
      String(effectiveCompanyIdOrRoleCompanyId(companyIdParam, role.companyId)) !== String(payload.companyId)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function effectiveCompanyIdOrRoleCompanyId(param: string | null | undefined, roleCompanyId: string) {
  if (param) return param;
  return roleCompanyId;
}

async function createRoleAssignmentRecord(actor: ActorContext, payload: Record<string, unknown>) {
  const userId = String(payload.platform_user_id || payload.platformUserId || "").trim();
  const roleId = String(payload.roleId || payload.role_id || "").trim();
  const companyId = payload.companyId ? String(payload.companyId).trim() : null;

  if (!userId || !roleId) {
    throw new Error("platform_user_id and roleId are required");
  }

  let effectiveCompanyId = companyId;
  if (!effectiveCompanyId) {
    const roleRes = await getPgPool().query<{ companyId: string }>('select "companyId" from public."Role" where id=$1 limit 1', [roleId]);
    if (roleRes.rows.length > 0) {
      effectiveCompanyId = roleRes.rows[0].companyId;
    }
  }

  // Validaciones de multitenancy
  if (actor.role !== "SU") {
    if (!actor.companyId) throw new Error("companyId is required for non-SU actors");
    const userRes = await getPgPool().query<{ companyId: string }>(
      'select "companyId" from public."PlatformUser" where id_user_pk=$1 limit 1',
      [userId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    if (String(userRes.rows[0]!.companyId) !== String(actor.companyId)) {
      throw new Error("Forbidden: cannot assign roles to users of other companies");
    }

    const roleRes = await getPgPool().query<{ companyId: string }>(
      'select "companyId" from public."Role" where id=$1 limit 1',
      [roleId]
    );
    if (roleRes.rows.length === 0) throw new Error("Role not found");
    if (String(roleRes.rows[0]!.companyId) !== String(actor.companyId)) {
      throw new Error("Forbidden: cannot assign roles belonging to other companies");
    }
    effectiveCompanyId = actor.companyId;
  }

  const hashPermission = await calculateRoleAssignmentSecurityHash(userId, roleId, effectiveCompanyId);
  const id = `UR-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await getPgPool().query(
    'insert into public."UserRole" (id, platform_user_id, "roleId", hash_permission, company_id, "createdAt") values ($1, $2, $3, $4, $5, now())',
    [id, userId, roleId, hashPermission, effectiveCompanyId]
  );

  return { id, platform_user_id: userId, roleId, hash_permission: hashPermission, companyId: effectiveCompanyId };
}

async function updateRoleAssignmentRecord(
  actor: ActorContext,
  id: string,
  patch: Record<string, unknown>
) {
  const currentRes = await getPgPool().query<{ id: string; platform_user_id: string; roleId: string; company_id: string | null }>(
    'select id, platform_user_id, "roleId", company_id from public."UserRole" where id=$1 limit 1',
    [id]
  );
  if (currentRes.rows.length === 0) {
    throw new Error("Role assignment not found");
  }
  const current = currentRes.rows[0]!;

  const userId = current.platform_user_id;
  const roleId = patch.roleId !== undefined ? String(patch.roleId).trim() : current.roleId;
  const companyId = patch.companyId !== undefined ? (patch.companyId ? String(patch.companyId).trim() : null) : current.company_id;

  let effectiveCompanyId = companyId;

  // Validaciones de multitenancy
  if (actor.role !== "SU") {
    if (!actor.companyId) throw new Error("companyId is required for non-SU actors");
    const userRes = await getPgPool().query<{ companyId: string }>(
      'select "companyId" from public."PlatformUser" where id_user_pk=$1 limit 1',
      [userId]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    if (String(userRes.rows[0]!.companyId) !== String(actor.companyId)) {
      throw new Error("Forbidden: cannot assign roles to users of other companies");
    }

    const roleRes = await getPgPool().query<{ companyId: string }>(
      'select "companyId" from public."Role" where id=$1 limit 1',
      [roleId]
    );
    if (roleRes.rows.length === 0) throw new Error("Role not found");
    if (String(roleRes.rows[0]!.companyId) !== String(actor.companyId)) {
      throw new Error("Forbidden: cannot assign roles belonging to other companies");
    }
    effectiveCompanyId = actor.companyId;
  }

  const hashPermission = await calculateRoleAssignmentSecurityHash(userId, roleId, effectiveCompanyId);

  await getPgPool().query(
    'update public."UserRole" set "roleId"=$1, hash_permission=$2, company_id=$3 where id=$4',
    [roleId, hashPermission, effectiveCompanyId, id]
  );

  return { id, platform_user_id: userId, roleId, hash_permission: hashPermission, companyId: effectiveCompanyId };
}

async function deleteRoleAssignmentRecord(actor: ActorContext, id: string) {
  const currentRes = await getPgPool().query<{ id: string; platform_user_id: string; roleId: string }>(
    'select id, platform_user_id, "roleId" from public."UserRole" where id=$1 limit 1',
    [id]
  );
  if (currentRes.rows.length === 0) {
    throw new Error("Role assignment not found");
  }
  const current = currentRes.rows[0]!;

  // Validaciones de multitenancy
  if (actor.role !== "SU") {
    if (!actor.companyId) throw new Error("companyId is required for non-SU actors");
    const userRes = await getPgPool().query<{ companyId: string }>(
      'select "companyId" from public."PlatformUser" where id_user_pk=$1 limit 1',
      [current.platform_user_id]
    );
    if (userRes.rows.length === 0) throw new Error("User not found");
    if (String(userRes.rows[0]!.companyId) !== String(actor.companyId)) {
      throw new Error("Forbidden: cannot modify roles of other companies");
    }
  }

  await getPgPool().query('delete from public."UserRole" where id=$1', [id]);
}
