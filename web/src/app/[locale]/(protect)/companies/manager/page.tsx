import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.manager";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/" + locale);

  const rawRole = String((session.user as {role?: string}).role ?? "SU").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: (session.user as {companyId?: string | null}).companyId ?? null
  };

  const rows = (await listRecords(actor, "modules", null)) as Array<Record<string, any>>;
  const currentRoute = "/companies/manager";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");

  return (
    <NewPagePattern
      title={currentModule?.name ?? "manager"}
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