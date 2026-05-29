import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {getTranslations} from "next-intl/server";
import {type ActorContext} from "@/server/pgDynamicDbStore";
import {PositionsConfigClient} from "./component.positions";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function PositionsPage({params}: PageProps) {
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

  const t = await getTranslations({locale, namespace: "AccountConfig"});

  return (
    <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
      <h1 id="titleNewPage" className="text-2xl font-semibold">Configuración de Cargos</h1>
      <p className="mt-2 text-sm text-slate-500">Crea y administra los cargos de la aplicación desde BD usando API dinámica.</p>
      <div className="mt-4">
        <PositionsConfigClient actorId={actor.actorId} actorRole={actor.role} companyId={actor.companyId} />
      </div>
    </section>
  );
}