import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {authOptions} from "@/lib/auth-options";
import {resolveLoginNavigation} from "@/server/loginAccess";

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
  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
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

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      actorId={session.user.email ?? session.user.name ?? "anonymous"}
      actorRole={role}
      companyId={(session.user as {companyId?: string | null}).companyId ?? null}
    />
  );
}
