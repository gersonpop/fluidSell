import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth-options";
import {BackToStartButton} from "./BackToStartButton";

type PendingApprovalPageProps = {
  params: Promise<{locale: string}>;
};

export default async function PendingApprovalPage({params}: PendingApprovalPageProps) {
  const {locale} = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}`);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <section className="max-w-lg rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
        <h1 className="text-2xl font-semibold">Solicitud en revision</h1>
        <p className="mt-2 text-sm text-white/80">Tu cuenta fue registrada y se encuentra pendiente de alta administrativa.</p>
        <p className="mt-1 text-sm text-white/70">Por seguridad, no puedes ingresar aun a la plataforma.</p>
        <BackToStartButton locale={locale} />
      </section>
    </main>
  );
}
