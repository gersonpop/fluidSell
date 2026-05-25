import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {authOptions} from "@/lib/auth-options";
import {resolveLoginNavigation} from "@/server/loginAccess";
import {listActiveModulesForRole} from "@/server/pgDynamicDbStore";

type ProtectedHomePageProps = {
  params: Promise<{locale: string}>;
};

export default async function ProtectedHomePage({params}: ProtectedHomePageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${locale}`);
  }

  const provider = ((session.user as {provider?: "google" | "facebook" | "linkedin"}).provider ?? "google");
  const role = ((session.user as {role?: "SU" | "cliente"}).role ?? "SU") as "SU" | "cliente";
  const navigation = await resolveLoginNavigation(session.user.email, provider);
  if (navigation.flow === "FORM_REQUIRED") {
    redirect(`/${locale}/onboarding`);
  }
  if (navigation.flow === "PENDING_ONLY") {
    redirect(`/${locale}/pending-approval`);
  }
  if (navigation.flow === "PROVIDER_CONFLICT") {
    redirect(`/${locale}`);
  }

  const dynamicModules = await listActiveModulesForRole(role).catch(() => []);

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      permissions={["home:view", "scrum:view", "account-config:view"]}
      dynamicModules={dynamicModules}
    />
  );
}
