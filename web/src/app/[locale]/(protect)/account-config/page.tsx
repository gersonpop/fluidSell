import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {authOptions} from "@/lib/auth-options";
import {resolveLoginNavigation} from "@/server/loginAccess";
import {ModulesConfigClient} from "./ModulesConfigClient";

type AccountConfigPageProps = {
  params: Promise<{locale: string}>;
};

export default async function AccountConfigPage({params}: AccountConfigPageProps) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "AccountConfig"});
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}`);
  }

  const provider = ((session.user as {provider?: "google" | "facebook" | "linkedin"}).provider ?? "google");
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

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actorId = session.user.email ?? session.user.name ?? "anonymous";
  const companyId = (session.user as {companyId?: string | null}).companyId ?? null;
  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      actorId={actorId}
      actorRole={role}
      companyId={companyId}
      title={t("layoutTitle")}
      description={t("layoutDescription")}
    >
      {role !== "SU" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          {t("forbiddenOnlySu")}
        </section>
      ) : (
        <ModulesConfigClient actorId={actorId} actorRole={role} companyId={companyId} />
      )}
    </ProtectedSidebarLayout>
  );
}
