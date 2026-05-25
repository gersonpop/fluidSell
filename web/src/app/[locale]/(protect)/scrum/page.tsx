import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {resolveLoginNavigation} from "@/server/loginAccess";
import {ScrumPageClient} from "./ScrumPageClient";

type ScrumPageProps = {
  params: Promise<{locale: string}>;
};

export default async function ScrumPage({params}: ScrumPageProps) {
  const {locale} = await params;
  if (process.env.NODE_ENV !== "development") {
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

  }

  return <ScrumPageClient />;
}
