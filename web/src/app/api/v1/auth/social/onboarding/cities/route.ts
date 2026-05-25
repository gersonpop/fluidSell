import {NextResponse} from "next/server";
import {getCatalogCities} from "@/server/auth/onboarding";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const departmentCode = url.searchParams.get("departmentCode") ?? "";
  const countryCode = url.searchParams.get("countryCode") ?? "";
  const items = await getCatalogCities(departmentCode, countryCode);
  return NextResponse.json({items});
}
