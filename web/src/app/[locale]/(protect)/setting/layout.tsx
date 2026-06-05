import {resolveLoginNavigation} from "@/server/loginAccess";
import {listRecords} from "@/server/pgDynamicDbStore";
import {selectSidebarModulesFromDbRows} from "@/lib/sidebar-access";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";
import {resolveUserContext} from "@/lib/server-session-helper";
import {redirect} from "next/navigation";

export type SettingModule = {
  id: string;
  code: string;
  name: string;
  description: string;
  route: string;
  icon: string | null;
  parent: string;
  status: string;
  pageContent: string | null;
  sortOrder: number;
};

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toSort(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export async function requireProtectedSettingContext(locale: string) {
  const {session, actor, companyName, userCargo, roleScope} = await resolveUserContext(locale);

  const provider = ((session.user as {provider?: "google" | "facebook" | "linkedin"}).provider ?? "google");
  const navigation = await resolveLoginNavigation(session.user.email, provider);
  if (navigation.flow === "FORM_REQUIRED") redirect(`/${locale}/onboarding`);

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const modules: SettingModule[] = rows.map((row) => ({
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
  })).sort((a, b) => a.sortOrder - b.sortOrder);

  const initialSidebarModules = selectSidebarModulesFromDbRows(rows);

  return {session, actor, companyName, userCargo, roleScope, modules, initialSidebarModules, rows};
}

type LayoutProps = {
  params: Promise<{locale: string}>;
  children: React.ReactNode;
};

export default async function DynamicEmbeddedLayout({params, children}: LayoutProps) {
  const {locale} = await params;
  const {session, actor, companyName, userCargo, roleScope, initialSidebarModules, rows} = await requireProtectedSettingContext(locale);

  const currentRoute = "/setting";
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
      title={currentModule ? toText(currentModule.name) : "setting"}
      description={currentModule ? toText(currentModule.description) : ""}
    >
      <EmbeddedPattern locale={locale} parentTitle={currentModule ? toText(currentModule.name) : "setting"} items={childrenModules}>
        {children}
      </EmbeddedPattern>
    </ProtectedSidebarLayout>
  );
}