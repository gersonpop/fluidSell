import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import {getSettingChildren, getSettingParent, requireProtectedSettingContext} from "../_lib";

type SettingsModulesPageProps = {
  params: Promise<{locale: string}>;
};

export default async function SettingsModulesPage({params}: SettingsModulesPageProps) {
  const {locale} = await params;
  const {session, actor, modules} = await requireProtectedSettingContext(locale);
  const settingParent = getSettingParent(modules);
  const children = getSettingChildren(modules, settingParent);
  const current = modules.find((item) => item.route === "/setting/modules") ?? null;
  const mode = (settingParent?.pageContent ?? "embedded").toLowerCase();

  return (
    <ProtectedSidebarLayout
      locale={locale}
      userName={session.user.name ?? "Usuario"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? null}
      actorId={actor.actorId}
      actorRole={actor.role}
      companyId={actor.companyId}
      title="Configuracion"
      description="Contenido renderizado desde modules dentro de contentSidebar"
    >
      {mode === "embedded" ? (
        <EmbeddedPattern locale={locale} parentTitle={settingParent?.name ?? "Configuracion"} items={children} activeRoute="/setting/modules">
          <section className="h-full w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
            <h1 className="text-2xl font-semibold">{current?.name ?? "Modules"}</h1>
            <p className="mt-2 text-sm text-slate-500">Modelo embedded: menu de hijos a la izquierda y contenido activo a la derecha.</p>
          </section>
        </EmbeddedPattern>
      ) : (
        <NewPagePattern title={current?.name ?? "Modules"} description="Modelo newPage dentro de contentSidebar." />
      )}
    </ProtectedSidebarLayout>
  );
}
