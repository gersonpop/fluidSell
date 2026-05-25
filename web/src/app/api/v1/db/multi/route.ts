import {NextResponse} from "next/server";
import {auditDenied, isCorsOriginAllowed, listRecords, type ActorContext} from "@/server/pgDynamicDbStore";

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
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return response;
}

async function authorize(request: Request) {
  const actor = getActor(request);
  const origin = request.headers.get("origin");
  if (!isCorsOriginAllowed(origin)) {
    await auditDenied(actor, "audit_logs", "CORS origin blocked");
    return {error: withCors(NextResponse.json({message: "CORS origin blocked"}, {status: 403}), request)};
  }

  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    await auditDenied(actor, "audit_logs", "Missing or invalid Authorization header");
    return {error: withCors(NextResponse.json({message: "Unauthorized"}, {status: 401}), request)};
  }

  const oauthSession = request.headers.get("x-oauth-session");
  if (oauthSession !== "active") {
    await auditDenied(actor, "audit_logs", "OAuth session not active");
    return {error: withCors(NextResponse.json({message: "OAuth session invalid or expired"}, {status: 401}), request)};
  }

  if (actor.role !== "SU" && !actor.companyId) {
    await auditDenied(actor, "audit_logs", "Missing companyId for non-SU actor");
    return {error: withCors(NextResponse.json({message: "Forbidden"}, {status: 403}), request)};
  }

  return {actor};
}

export async function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, {status: 204}), request);
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const tables = Array.from(url.searchParams.values()).filter((value) => value.trim().length > 0);

    if (tables.length === 0) {
      return withCors(NextResponse.json({message: "request without tables"}, {status: 400}), request);
    }

    const data: Record<string, unknown> = {};
    await Promise.all(
      tables.map(async (tableName) => {
        data[tableName] = await listRecords(auth.actor, tableName, null);
      })
    );

    return withCors(NextResponse.json(data), request);
  } catch (error) {
    return withCors(
      NextResponse.json({message: error instanceof Error ? error.message : "Request failed"}, {status: 400}),
      request
    );
  }
}
