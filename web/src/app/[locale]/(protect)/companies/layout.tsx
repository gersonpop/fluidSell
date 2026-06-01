import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";

type LayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function DynamicEmbeddedLayout({params, children}: LayoutProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

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