import {redirect} from "next/navigation";
import {ProtectedSidebarLayout} from "@/components/protected-sidebar-layout";
import {EmbeddedPattern} from "@/components/module-patterns/EmbeddedPattern";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import {getSettingChildren, getSettingParent, requireProtectedSettingContext} from "./_lib";

type SettingsPageProps = {
  params: Promise<{locale: string}>;
};

export default async function SettingsPage({params}: SettingsPageProps) {
  const {locale} = await params;
  const {session, actor, modules} = await requireProtectedSettingContext(locale);
  const settingParent = getSettingParent(modules);

  if (!settingParent) {
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
        description="Modulo no configurado en tabla modules"
      >
        <NewPagePattern title="Configuracion" description="No existe un modulo raiz activo para /setting en la tabla modules." />
      </ProtectedSidebarLayout>
    );
  }

  const children = getSettingChildren(modules, settingParent);
  const contentMode = (settingParent.pageContent ?? "embedded").toLowerCase();

  if (contentMode === "embedded" && children.length > 0) {
    redirect(`/${locale}${children[0].route}`);
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
      title="Configuracion"
      description="Contenido basado en configuracion de modules"
    >
      {contentMode === "embedded" ? (
        <EmbeddedPattern locale={locale} parentTitle={settingParent.name} items={children} activeRoute="/setting" >
          <p className="text-sm text-slate-500">Selecciona un modulo hijo del panel izquierdo.</p>
        </EmbeddedPattern>
      ) : (
        <NewPagePattern title={settingParent.name} description="Pagina renderizada con patron newPage." />
      )}
    </ProtectedSidebarLayout>
  );
}
