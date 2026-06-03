import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.onboarding";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  let session = await getServerSession(authOptions);
  if (process.env.NODE_ENV === "development" && !session) {
    session = {
      user: {
        name: "Dev User",
        email: "gerson.pop@fluidsell.com",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
        role: "SU",
        companyId: "900000000",
        provider: "google"
      },
      expires: "2026-06-30T00:00:00.000Z"
    } as any;
  }
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "/users/onBoarding";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

  return (
    <NewPagePattern
      title={currentModule?.name ?? "onBoarding"}
      description={currentModule?.description ?? ""}
      plain={true}
    >
      <DynamicComponent
        currentUserEmail={session.user.email ?? undefined}
        currentUserImage={session.user.image ?? undefined}
        currentUserProvider={(session.user as any).provider ?? undefined}
        isSU={role === "SU"}
        currentUserCompanyId={(session.user as {companyId?: string | null}).companyId ?? undefined}
        currentUserRole={rawRole}
      />
    </NewPagePattern>
  );
}