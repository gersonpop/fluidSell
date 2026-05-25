import {NextResponse} from "next/server";
import {getCatalogDepartments} from "@/server/auth/onboarding";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const countryCode = url.searchParams.get("countryCode") ?? "";
  const items = await getCatalogDepartments(countryCode);
  return NextResponse.json({items});
}
