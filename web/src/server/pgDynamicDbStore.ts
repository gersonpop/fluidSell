import {getPgPool} from "@/server/postgres";
import {access, mkdir, writeFile} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";
import {join} from "node:path";

export type ActorScope = "SU" | "cliente";

export type ActorContext = {
  actorId: string;
  role: ActorScope;
  companyId: string | null;
};

const TABLE_MAP = {
  modules: 'public.modules',
  users: 'public.users',
  oauth_sessions: 'public.oauth_sessions',
  roles: 'public.roles',
  role_assignments: 'public.role_assignments',
  audit_logs: 'public.audit_logs',
  st_multidata: 'public."st_Multidata"',
  st_country: 'public."st_Country"',
  st_state: 'public."st_State"',
  st_city: 'public."st_City"'
} as const;

type DynamicTableName = keyof typeof TABLE_MAP;

const COMPANY_SCOPED_TABLES = new Set<DynamicTableName>(["users", "oauth_sessions", "roles", "role_assignments"]);

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
  const result = await getPgPool().query<{value: string}>(
    'select "value" from public."st_Multidata" where lower("value")=lower($1) and lower(coalesce("type",\'\'))=\'modulestatus\' limit 1',
    [text]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("status must exist in st_Multidata catalog");
  return result.rows[0].value;
}

async function resolvePageContent(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("content is required");
  const result = await getPgPool().query<{value: string}>(
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
  return v;
}

async function validateRoleScope(scopeId: string) {
  const result = await getPgPool().query<{type: string | null; typeUse: string | null; value: string | null; name: string | null}>(
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
  const result = await getPgPool().query("select id from public.modules where id=$1 limit 1", [parent]);
  if ((result.rowCount ?? 0) === 0) throw new Error("parent module not found");
}

async function generateModuleCode(name: string) {
  const seed = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "MODULE";
  const existing = await getPgPool().query<{code: string}>("select code from public.modules where code like $1", [`${seed}%`]);
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
  if (!parentId) {
    return `/${currentSegments.join("/")}`;
  }

  const parentResult = await getPgPool().query<{route: string | null}>("select route from public.modules where id=$1 limit 1", [parentId]);
  if ((parentResult.rowCount ?? 0) === 0) {
    throw new Error("parent module not found");
  }

  const parentRoute = parentResult.rows[0].route;
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

function buildLeafPageContent(pageTitle: string) {
  return `export default function DynamicModulePage() {\n  return (\n    <section className=\"rounded-2xl border border-slate-200 bg-white p-5 text-slate-700\">\n      <h1 className=\"text-2xl font-semibold capitalize\">${pageTitle}</h1>\n      <p className=\"mt-2 text-sm text-slate-500\">This module page was scaffolded automatically from module configuration.</p>\n    </section>\n  );\n}\n`;
}

function buildEmbeddedPageContent(pageTitle: string, route: string) {
  const safeRoute = route.replace(/'/g, "\\'");
  return `import Link from \"next/link\";\nimport {getPgPool} from \"@/server/postgres\";\n\nexport default async function EmbeddedModulePage({params}: {params: Promise<{locale: string}>}) {\n  const {locale} = await params;\n  const pool = getPgPool();\n  const current = await pool.query<{id: string; name: string}>('select id, name from public.modules where route=$1 limit 1', ['${safeRoute}']);\n  const moduleId = current.rows[0]?.id ?? null;\n  const children = moduleId\n    ? (await pool.query<{id: string; name: string; route: string | null; sort_order: number; content: string | null}>(\n        'select id, name, route, sort_order, content from public.modules where parent=$1 and lower(status)=\\'active\\' order by sort_order asc, name asc',\n        [moduleId]\n      )).rows\n    : [];\n\n  return (\n    <section className=\"grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]\">\n      <aside className=\"rounded-2xl border border-slate-200 bg-slate-50 p-4\">\n        <h1 className=\"text-xl font-semibold capitalize\">${pageTitle}</h1>\n        <p className=\"mt-1 text-xs text-slate-500\">Embedded module navigation</p>\n        <ul className=\"mt-3 space-y-2\">\n          {children.map((item) => (\n            <li key={item.id}>\n              <Link\n                href={item.route ? \\`/\\${locale}\\${item.route}\\` : \\`/\\${locale}${safeRoute}\\`}\n                className=\"block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300 hover:bg-sky-50\"\n              >\n                {item.name}\n              </Link>\n            </li>\n          ))}\n          {children.length === 0 ? <li className=\"text-xs text-slate-500\">No children configured.</li> : null}\n        </ul>\n      </aside>\n\n      <article className=\"rounded-2xl border border-slate-200 bg-white p-5 text-slate-700\">\n        <h2 className=\"text-lg font-semibold\">Content panel</h2>\n        <p className=\"mt-2 text-sm text-slate-500\">Select a child from the left panel. New-page children open via route. Embedded children can reuse this layout.</p>\n        <div className=\"mt-4 grid gap-2 sm:grid-cols-2\">\n          {children\n            .filter((item) => (item.content ?? '').toLowerCase() === 'newpage' && item.route)\n            .map((item) => (\n              <Link\n                key={item.id}\n                href={\\`/\\${locale}\\${item.route}\\`}\n                className=\"inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50\"\n              >\n                Open {item.name}\n              </Link>\n            ))}\n        </div>\n      </article>\n    </section>\n  );\n}\n`;
}

async function ensureModuleRouteScaffold(route: string | null, pageContent: string) {
  const segments = normalizeModuleRoutePath(route);
  if (!segments) return;
  const routeDir = join(process.cwd(), "src", "app", "[locale]", "(protect)", ...segments);
  const pageFile = join(routeDir, "page.tsx");

  await mkdir(routeDir, {recursive: true});
  const pageTitle = getLeafTitle(segments);
  const normalized = normalizePageContentKind(pageContent);
  if (normalized === "embedded") {
    await writeFile(pageFile, buildEmbeddedPageContent(pageTitle, route ?? `/${segments.join("/")}`), "utf8");
    return;
  }
  if (normalized === "newpage") {
    try {
      await access(pageFile, fsConstants.F_OK);
      return;
    } catch {
      await writeFile(pageFile, buildLeafPageContent(pageTitle), "utf8");
      return;
    }
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
  await validateRoleScope(scopeId);
  await validateModuleParent(parent);
  const effectiveRoute = await resolveParentAwareRoute(payload.route ? String(payload.route) : null, parent);
  const code = await generateModuleCode(name);
  const result = await getPgPool().query(
    "insert into public.modules (code,name,description,route,icon,sort_order,status,parent,scope_id,content) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *",
    [code, name, payload.description ? String(payload.description) : null, effectiveRoute, payload.icon ? String(payload.icon) : null, sortOrder, status, parent, scopeId, pageContent]
  );
  await ensureModuleRouteScaffold(effectiveRoute, pageContent);
  return result.rows[0];
}

async function updateModuleRecord(actor: ActorContext, id: string, patch: Record<string, unknown>) {
  ensureSu(actor);
  const current = await getPgPool().query<Record<string, unknown>>("select * from public.modules where id=$1 limit 1", [id]);
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
    scope_id: patch.scope_id !== undefined ? String(patch.scope_id) : String(current.rows[0].scope_id ?? "")
  };
  if (!Number.isFinite(next.sort_order)) throw new Error("sort_order must be numeric");
  await validateRoleScope(next.scope_id);
  await validateModuleParent(next.parent);
  const effectiveRoute = await resolveParentAwareRoute(next.route, next.parent);
  const updated = await getPgPool().query(
    "update public.modules set name=$1, description=$2, route=$3, icon=$4, sort_order=$5, status=$6, parent=$7, scope_id=$8, content=$9, updated_at=now() where id=$10 returning *",
    [next.name, next.description, effectiveRoute, next.icon, next.sort_order, next.status, next.parent, next.scope_id, next.content, id]
  );
  await ensureModuleRouteScaffold(effectiveRoute, next.content);
  return updated.rows[0];
}

async function softDeleteModuleRecord(actor: ActorContext, id: string) {
  ensureSu(actor);
  const inactive = await resolveCatalogStatus("inactive");
  const updated = await getPgPool().query("update public.modules set status=$1, updated_at=now() where id=$2 returning *", [inactive, id]);
  if ((updated.rowCount ?? 0) === 0) throw new Error("Record not found");
}

async function appendAuditDeny(actor: ActorContext, table: string, reason: string) {
  try {
    await getPgPool().query(
      "insert into public.audit_logs (actor_id, actor_role, table_name, action, reason, company_id, created_at) values ($1,$2,$3,$4,$5,$6,now())",
      [actor.actorId, actor.role, table, "deny", reason, actor.companyId]
    );
  } catch {
    return;
  }
}

export async function listActiveModulesForRole(role: ActorScope) {
  const rows = await getPgPool().query<{id: string; code: string; name: string; route: string | null; icon: string | null; scope_value: string | null; scope_name: string | null}>(
    'select m.id, m.code, m.name, m.route, m.icon, lower(coalesce(s."value",\'\')) as scope_value, lower(coalesce(s."name",\'\')) as scope_name from public.modules m join public."st_Multidata" s on lower(s."Initials_PK") = lower(m.scope_id) where lower(m.status)=\'active\' order by m.sort_order asc, m.name asc'
  );
  return rows.rows.filter((row) => {
    const marker = `${row.scope_value ?? ""} ${row.scope_name ?? ""}`;
    if (marker.includes("su") && !marker.includes("client")) return role === "SU";
    return true;
  }).map((row) => ({id: row.id, code: row.code, name: row.name, route: row.route, icon: row.icon}));
}

export async function listRecords(actor: ActorContext, tableParam: string, id: string | null) {
  const table = normalizeTable(tableParam);
  if (table === "modules") {
    if (id) {
      const one = await getPgPool().query("select * from public.modules where id=$1", [id]);
      return one.rows;
    }
    const all = await getPgPool().query("select * from public.modules order by sort_order asc, name asc");
    return all.rows;
  }
  if (table === "st_multidata") {
    const all = await getPgPool().query('select "Initials_PK" as "Initials_PK", "name", "value", "type", "typeDescription", "typeUse", "created_at", "updated_at" from public."st_Multidata"');
    return all.rows;
  }

  const dbTable = TABLE_MAP[table];
  let query = `select * from ${dbTable}`;
  const values: string[] = [];
  if (id) {
    query += " where id=$1";
    values.push(id);
  }
  if (actor.role !== "SU" && COMPANY_SCOPED_TABLES.has(table)) {
    if (!actor.companyId) throw new Error("companyId is required for non-SU actors");
    query += id ? " and companyid=$2" : " where companyid=$1";
    values.push(actor.companyId);
  }
  const result = await getPgPool().query(query, values);
  return result.rows;
}

export async function createRecord(actor: ActorContext, tableParam: string, payload: Record<string, unknown>) {
  const table = normalizeTable(tableParam);
  if (table === "modules") return createModuleRecord(actor, payload);
  ensureSu(actor);
  throw new Error(`Create is not enabled for table '${table}'`);
}

export async function updateRecord(actor: ActorContext, tableParam: string, id: string, patch: Record<string, unknown>) {
  const table = normalizeTable(tableParam);
  if (table === "modules") return updateModuleRecord(actor, id, patch);
  ensureSu(actor);
  throw new Error(`Update is not enabled for table '${table}'`);
}

export async function deleteRecord(actor: ActorContext, tableParam: string, id: string) {
  const table = normalizeTable(tableParam);
  if (table === "modules") {
    await softDeleteModuleRecord(actor, id);
    return;
  }
  ensureSu(actor);
  throw new Error(`Delete is not enabled for table '${table}'`);
}

export {isCorsOriginAllowed};

export async function auditDenied(actor: ActorContext, table: string, reason: string) {
  await appendAuditDeny(actor, table, reason);
}
