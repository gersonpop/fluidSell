import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {authOptions} from "@/lib/auth-options";
import {listPendingApprovals} from "@/server/auth/onboarding";
import {listActiveModulesForRole} from "@/server/pgDynamicDbStore";
import {PendingUsersClient} from "./PendingUsersClient";

type PendingUsersPageProps = {
  params: Promise<{locale: string}>;
};

export default async function PendingUsersPage({params}: PendingUsersPageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}`);
  }

  const pending = await listPendingApprovals();
  const role = ((session.user as {role?: "SU" | "cliente"}).role ?? "SU") as "SU" | "cliente";
  const dynamicModules = await listActiveModulesForRole(role).catch(() => []);

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      permissions={["home:view", "scrum:view", "account-config:view"]}
      dynamicModules={dynamicModules}
      title="Pendientes de alta"
      description="Revision y aprobacion de usuarios registrados por redes sociales."
    >
      <PendingUsersClient initialPending={pending} />
    </ProtectedSidebarLayout>
  );
}
