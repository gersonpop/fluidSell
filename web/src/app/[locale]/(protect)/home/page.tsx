import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {resolveLoginNavigation} from "@/server/loginAccess";
import {resolveUserContext} from "@/lib/server-session-helper";
import {redirect} from "next/navigation";

type ProtectedHomePageProps = {
  params: Promise<{locale: string}>;
};

export default async function ProtectedHomePage({params}: ProtectedHomePageProps) {
  const {locale} = await params;
  const {session, actor, companyName, userCargo, roleScope} = await resolveUserContext(locale);

  const provider = ((session.user as {provider?: "google" | "facebook" | "linkedin"}).provider ?? "google");
  const navigation = await resolveLoginNavigation(session.user.email, provider);
  if (navigation.flow === "FORM_REQUIRED") {
    redirect(`/${locale}/onboarding`);
  }
  if (navigation.flow === "PENDING_ONLY") {
    redirect(`/${locale}/pending-approval`);
  }
  if (navigation.flow === "PROVIDER_CONFLICT") {
    redirect(`/${locale}/onboarding`);
  }

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      companyName={companyName}
      userCargo={userCargo}
      roleScope={roleScope}
    />
  );
}
