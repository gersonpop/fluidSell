import {listRecords} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.dashboard";
import {resolveUserContext} from "@/lib/server-session-helper";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  const {session, actor, companyName, userCargo, roleScope} = await resolveUserContext(locale);

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  const currentRoute = "/dashboard";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session?.user?.name ?? "Usuario"}
      userEmail={session?.user?.email ?? ""}
      userImage={session?.user?.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      companyName={companyName}
      userCargo={userCargo}
      roleScope={roleScope}
      initialModules={initialSidebarModules}
      title={currentModule?.name ?? "dashboard"}
      description={currentModule?.description ?? ""}
    >
      <NewPagePattern
        title={currentModule?.name ?? "dashboard"}
        description={currentModule?.description ?? ""}
      >
        <DynamicComponent />
      </NewPagePattern>
    </ProtectedSidebarLayout>
  );
}