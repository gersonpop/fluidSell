import {listRecords} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";
import {resolveUserContext} from "@/lib/server-session-helper";

type LayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function DynamicEmbeddedLayout({params, children}: LayoutProps) {
  const {locale} = await params;
  const {session, actor, companyName, userCargo, roleScope} = await resolveUserContext(locale);

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  const currentRoute = "/companies";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .map(row => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description ?? ""),
      route: String(row.route),
      icon: String(row.icon || "") || null,
      parent: String(row.parent),
      status: String(row.status),
      pageContent: String(row.page_content || row.pageContent || row.content || ""),
      sortOrder: Number(row.sort_order ?? row.sortOrder ?? 100)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
      title={currentModule?.name ?? "companies"}
      description={currentModule?.description ?? ""}
    >
      <EmbeddedPattern locale={locale} parentTitle={currentModule?.name ?? "companies"} items={childrenModules}>
        {children}
      </EmbeddedPattern>
    </ProtectedSidebarLayout>
  );
}