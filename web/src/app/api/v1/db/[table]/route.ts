import {NextResponse} from "next/server";
import {
  auditDenied,
  createRecord,
  deleteRecord,
  isCorsOriginAllowed,
  listRecords,
  updateRecord,
  type ActorContext
} from "@/server/pgDynamicDbStore";

type Params = {params: Promise<{table: string}>};

type SearchFilter = {
  key: string;
  value: string;
  operator: "eq" | "neq" | "like" | "in" | "gt" | "lt" | "gte" | "lte";
};

function getActor(request: Request): ActorContext {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const role = (request.headers.get("x-actor-role") ?? "cliente") as "SU" | "cliente";
  const companyId = request.headers.get("x-company-id");
  return {actorId, role, companyId: companyId && companyId.length > 0 ? companyId : null};
}

function withCors(response: NextResponse, request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-actor-id, x-actor-role, x-company-id, x-oauth-session");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  return response;
}

async function authorize(request: Request, table: string) {
  const actor = getActor(request);
  const origin = request.headers.get("origin");
  if (!isCorsOriginAllowed(origin)) {
    await auditDenied(actor, table, "CORS origin blocked");
    return {error: withCors(NextResponse.json({message: "CORS origin blocked"}, {status: 403}), request)};
  }

  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    await auditDenied(actor, table, "Missing or invalid Authorization header");
    return {error: withCors(NextResponse.json({message: "Unauthorized"}, {status: 401}), request)};
  }

  const oauthSession = request.headers.get("x-oauth-session");
  if (oauthSession !== "active") {
    await auditDenied(actor, table, "OAuth session not active");
    return {error: withCors(NextResponse.json({message: "OAuth session invalid or expired"}, {status: 401}), request)};
  }

  if (actor.role !== "SU" && !actor.companyId) {
    await auditDenied(actor, table, "Missing companyId for non-SU actor");
    return {error: withCors(NextResponse.json({message: "Forbidden"}, {status: 403}), request)};
  }

  return {actor};
}

function buildFilters(searchParams: URLSearchParams) {
  const filters: SearchFilter[] = [];

  const directPairs: Array<[string, string, string]> = [
    ["key", "value", "op"],
    ["key2", "value2", "op2"],
    ["key3", "value3", "op3"],
    ["key4", "value4", "op4"],
    ["key5", "value5", "op5"]
  ];

  for (const [keyParam, valueParam, opParam] of directPairs) {
    const key = searchParams.get(keyParam);
    const value = searchParams.get(valueParam);
    const operator = normalizeOperator(searchParams.get(opParam));
    if (key && value !== null) {
      filters.push({key, value, operator});
    }
  }

  const orderedParams = Array.from(searchParams.entries())
    .filter(([name]) => /^parametro\d+$/i.test(name))
    .sort(([a], [b]) => {
      const indexA = Number(a.replace(/\D/g, ""));
      const indexB = Number(b.replace(/\D/g, ""));
      return indexA - indexB;
    })
    .map(([, value]) => value);

  for (let i = 0; i < orderedParams.length - 1; ) {
    const key = orderedParams[i]?.trim();
    const value = orderedParams[i + 1];
    const rawOp = orderedParams[i + 2];
    const operator = normalizeOperator(rawOp);
    if (key && value !== undefined) {
      if (rawOp && isOperator(rawOp)) {
        filters.push({key, value, operator});
        i += 3;
        continue;
      }
      filters.push({key, value, operator: "eq"});
    }
    i += 2;
  }

  const dedup = new Map<string, SearchFilter>();
  for (const filter of filters) {
    dedup.set(`${filter.key}::${filter.value}`, filter);
  }

  return Array.from(dedup.values());
}

function isOperator(operator: string) {
  const normalized = operator.trim().toLowerCase();
  return ["eq", "neq", "like", "in", "gt", "lt", "gte", "lte"].includes(normalized);
}

function normalizeOperator(operator: string | null) {
  if (!operator) return "eq";
  return isOperator(operator) ? (operator.trim().toLowerCase() as SearchFilter["operator"]) : "eq";
}

function isNumericLike(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return value.trim().length > 0 && Number.isFinite(Number(value));
}

function compareValues(left: unknown, right: string, operator: SearchFilter["operator"]) {
  const leftText = String(left);

  if (operator === "eq") return leftText === right;
  if (operator === "neq") return leftText !== right;
  if (operator === "like") return leftText.toLowerCase().includes(right.toLowerCase());
  if (operator === "in") {
    const values = right.split(",").map((item) => item.trim());
    return values.includes(leftText);
  }

  if (isNumericLike(left) && isNumericLike(right)) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (operator === "gt") return leftNumber > rightNumber;
    if (operator === "lt") return leftNumber < rightNumber;
    if (operator === "gte") return leftNumber >= rightNumber;
    if (operator === "lte") return leftNumber <= rightNumber;
  }

  const leftDate = new Date(leftText).getTime();
  const rightDate = new Date(right).getTime();
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    if (operator === "gt") return leftDate > rightDate;
    if (operator === "lt") return leftDate < rightDate;
    if (operator === "gte") return leftDate >= rightDate;
    if (operator === "lte") return leftDate <= rightDate;
  }

  return false;
}

function applyFilters(rows: Record<string, unknown>[], filters: SearchFilter[]) {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((filter) => {
      const currentValue = row[filter.key];
      if (currentValue === undefined || currentValue === null) {
        return false;
      }
      return compareValues(currentValue, filter.value, filter.operator);
    })
  );
}

export async function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, {status: 204}), request);
}

export async function GET(request: Request, {params}: Params) {
  const {table} = await params;
  const auth = await authorize(request, table);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const filters = buildFilters(url.searchParams);
    const rows = await listRecords(auth.actor, table, id);
    const filteredRows = applyFilters(rows as Record<string, unknown>[], filters);
    return withCors(NextResponse.json({table, count: filteredRows.length, data: filteredRows}), request);
  } catch (error) {
    return withCors(
      NextResponse.json({message: error instanceof Error ? error.message : "Request failed"}, {status: 400}),
      request
    );
  }
}

export async function POST(request: Request, {params}: Params) {
  const {table} = await params;
  const auth = await authorize(request, table);
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const row = await createRecord(auth.actor, table, body);
    return withCors(NextResponse.json({table, data: row}, {status: 201}), request);
  } catch (error) {
    return withCors(
      NextResponse.json({message: error instanceof Error ? error.message : "Request failed"}, {status: 400}),
      request
    );
  }
}

export async function PATCH(request: Request, {params}: Params) {
  const {table} = await params;
  const auth = await authorize(request, table);
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) {
      return withCors(NextResponse.json({message: "id is required"}, {status: 400}), request);
    }
    const patch = {...body};
    delete patch.id;
    const row = await updateRecord(auth.actor, table, id, patch);
    return withCors(NextResponse.json({table, data: row}), request);
  } catch (error) {
    return withCors(
      NextResponse.json({message: error instanceof Error ? error.message : "Request failed"}, {status: 400}),
      request
    );
  }
}

export async function DELETE(request: Request, {params}: Params) {
  const {table} = await params;
  const auth = await authorize(request, table);
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {id?: string};
    const id = body.id;
    if (!id) {
      return withCors(NextResponse.json({message: "id is required"}, {status: 400}), request);
    }
    await deleteRecord(auth.actor, table, id);
    return withCors(NextResponse.json({ok: true}), request);
  } catch (error) {
    return withCors(
      NextResponse.json({message: error instanceof Error ? error.message : "Request failed"}, {status: 400}),
      request
    );
  }
}
