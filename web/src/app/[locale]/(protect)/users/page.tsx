import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {listRecords, type ActorContext} from "@/server/pgDynamicDbStore";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicEmbeddedPage({params}: PageProps) {
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
  const currentRoute = "/users";
  const currentModule = rows.find(m => m.route === currentRoute && m.status === "active");
  const childrenModules = rows
    .filter(m => m.parent === currentModule?.id && m.status === "active")
    .sort((a, b) => Number(a.sort_order ?? a.sortOrder ?? 100) - Number(b.sort_order ?? b.sortOrder ?? 100));

  if (childrenModules.length > 0) {
    redirect("/" + locale + childrenModules[0].route);
  }

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 className="text-2xl font-semibold">{currentModule?.description || currentModule?.name || "users"}</h1>
      <p className="mt-2 text-sm text-slate-500">Módulo embebido. Agrega submódulos hijos para ver el contenido.</p>
    </section>
  );
}