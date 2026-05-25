import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {resolveSocialOnboarding} from "@/server/auth/onboarding";
import {OnboardingClient} from "./OnboardingClient";

type OnboardingPageProps = {
  params: Promise<{locale: string}>;
};

export default async function OnboardingPage({params}: OnboardingPageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect(`/${locale}`);
  }

  const provider = ((session.user as {provider?: "google" | "facebook" | "linkedin"}).provider ?? "google");
  const resolved = await resolveSocialOnboarding(session.user.email, provider);

  if (resolved.flow === "ACTIVE") {
    redirect(`/${locale}/home`);
  }

  if (resolved.flow === "PENDING_ONLY") {
    redirect(`/${locale}/pending-approval`);
  }

  return (
    <OnboardingClient
      locale={locale}
      email={session.user.email}
      provider={provider}
      defaultFullName={session.user.name ?? ""}
    />
  );
}
