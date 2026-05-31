import { NextResponse } from "next/server";
import { ImageStorageService } from "@/server/storage";
import { isCorsOriginAllowed, auditDenied } from "@/server/pgDynamicDbStore";

type ActorContext = {
  actorId: string;
  role: "SU" | "cliente";
  companyId: string | null;
};

function getActor(request: Request): ActorContext {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const role = (request.headers.get("x-actor-role") ?? "cliente") as "SU" | "cliente";
  const companyId = request.headers.get("x-company-id");
  return { actorId, role, companyId: companyId && companyId.length > 0 ? companyId : null };
}

function withCors(response: NextResponse, request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-actor-id, x-actor-role, x-company-id, x-oauth-session");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return response;
}

async function authorize(request: Request) {
  const actor = getActor(request);
  const origin = request.headers.get("origin");
  if (!isCorsOriginAllowed(origin)) {
    await auditDenied(actor, "upload", "CORS origin blocked");
    return { error: withCors(NextResponse.json({ message: "CORS origin blocked" }, { status: 403 }), request) };
  }

  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    await auditDenied(actor, "upload", "Missing or invalid Authorization header");
    return { error: withCors(NextResponse.json({ message: "Unauthorized" }, { status: 401 }), request) };
  }

  const oauthSession = request.headers.get("x-oauth-session");
  if (oauthSession !== "active") {
    await auditDenied(actor, "upload", "OAuth session not active");
    return { error: withCors(NextResponse.json({ message: "OAuth session invalid or expired" }, { status: 401 }), request) };
  }

  return { actor };
}

export async function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return withCors(
        NextResponse.json({ message: "No se proporcionó ningún archivo válido en el campo 'file'" }, { status: 400 }),
        request
      );
    }

    const file = fileEntry as File;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return withCors(
        NextResponse.json({ message: "Formato no permitido. Permita únicamente imágenes (JPEG, PNG, WEBP, GIF)" }, { status: 400 }),
        request
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageUrl = await ImageStorageService.uploadImage(buffer, file.name, file.type);

    return withCors(
      NextResponse.json({ ok: true, url: imageUrl }),
      request
    );
  } catch (error) {
    return withCors(
      NextResponse.json({ message: error instanceof Error ? error.message : "Error al procesar la carga de archivo" }, { status: 500 }),
      request
    );
  }
}
