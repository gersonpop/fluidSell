import {listRecords} from "@/server/pgDynamicDbStore";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.onboarding";
import {resolveUserContext} from "@/lib/server-session-helper";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  const {session, actor, companyName, userCargo, roleScope} = await resolveUserContext(locale);

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "/users/onBoarding";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

  return (
    <NewPagePattern
      title={currentModule?.name ?? "onBoarding"}
      description={currentModule?.description ?? ""}
      plain={true}
    >
      <DynamicComponent
        currentUserEmail={session.user.email ?? undefined}
        currentUserImage={session.user.image ?? undefined}
        currentUserProvider={(session.user as any).provider ?? undefined}
        isSU={actor.role === "SU"}
        currentUserCompanyId={actor.companyId ?? undefined}
        currentUserRole={actor.role}
      />
    </NewPagePattern>
  );
}