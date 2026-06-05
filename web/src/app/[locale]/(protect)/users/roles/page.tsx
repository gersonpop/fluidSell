import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth-options";
import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.roles";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  const session = await getServerSession(authOptions);
  const actorId = session?.user?.email ?? "anonymous";
  const actorRole = (session?.user as any)?.role ?? "cliente";
  const companyId = (session?.user as any)?.companyId ?? "";

  return (
    <NewPagePattern
      title="roles"
      description="roles"
      plain={true}
    >
      <DynamicComponent actorId={actorId} actorRole={actorRole} companyId={companyId} />
    </NewPagePattern>
  );
}