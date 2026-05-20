import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {authOptions} from "@/lib/auth-options";

type ProtectedHomePageProps = {
  params: Promise<{locale: string}>;
};

export default async function ProtectedHomePage({params}: ProtectedHomePageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${locale}`);
  }

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
    />
  );
}
