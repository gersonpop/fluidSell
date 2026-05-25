import {NextResponse} from "next/server";

export async function GET(request: Request) {
  void request;
  return NextResponse.json({message: "Endpoint deshabilitado: roles/permisos locales fueron retirados"}, {status: 410});
}

export async function POST(request: Request) {
  void request;
  return NextResponse.json({message: "Endpoint deshabilitado: roles/permisos locales fueron retirados"}, {status: 410});
}

export async function DELETE(request: Request) {
  void request;
  return NextResponse.json({message: "Endpoint deshabilitado: roles/permisos locales fueron retirados"}, {status: 410});
}
