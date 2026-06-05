import {listRecords} from "@/server/pgDynamicDbStore";
import {resolveUserContext} from "@/lib/server-session-helper";
import {CompanyManager} from "./component.companies";
import {redirect} from "next/navigation";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicEmbeddedPage({params}: PageProps) {
  const {locale} = await params;
  const {session, actor, companyName, userCargo, roleScope} = await resolveUserContext(locale);

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "/companies";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .sort((a, b) => Number(a.sort_order ?? a.sortOrder ?? 100) - Number(b.sort_order ?? b.sortOrder ?? 100));

  if (childrenModules.length > 0) {
    redirect("/" + locale + childrenModules[0].route);
  }

  return (
    <CompanyManager
      currentUserEmail={session.user.email ?? undefined}
      isSU={actor.role === "SU"}
      currentUserCompanyId={actor.companyId ?? undefined}
    />
  );
}