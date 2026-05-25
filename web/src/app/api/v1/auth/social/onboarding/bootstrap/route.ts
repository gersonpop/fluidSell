import {NextResponse} from "next/server";
import {
  getCatalogCompanies,
  getCatalogCountries,
  getCatalogMultidata
} from "@/server/auth/onboarding";

export async function GET() {
  const [companies, countries, countryCodesFromMultidata, genders] = await Promise.all([
    getCatalogCompanies(),
    getCatalogCountries(),
    getCatalogMultidata("countryCode"),
    getCatalogMultidata("gender")
  ]);

  const countryCodesFromCountry = countries
    .filter((item: {prefixArea?: string | null}) => item.prefixArea && item.prefixArea.length > 0)
    .map((item: {prefixArea?: string | null}) => ({value: item.prefixArea ?? "", label: item.prefixArea ?? ""}));

  const seen = new Set<string>();
  const countryCodes = [...countryCodesFromCountry, ...countryCodesFromMultidata].filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });

  return NextResponse.json({
    companies,
    countries,
    countryCodes,
    genders
  });
}
