import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth-options";
import { getPgPool } from "@/server/postgres";
import type { ActorContext } from "@/server/pgDynamicDbStore";
import { redirect } from "next/navigation";

export interface ResolvedUserContext {
  session: any;
  actor: ActorContext;
  companyName: string;
  userCargo: string;
  roleScope: string;
  locale: string;
}

export async function resolveUserContext(locale: string): Promise<ResolvedUserContext> {
  let session = await getServerSession(authOptions);
  
  if (process.env.NODE_ENV === "development" && !session) {
    session = {
      user: {
        name: "Dev User",
        email: "gerson.pop@fluidsell.com",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
        role: "SU",
        roleScope: "SU",
        companyId: "900000000",
        companyName: "FluidSell Dev",
        userCargo: "Super Administrador",
        provider: "google"
      },
      expires: "2026-06-30T00:00:00.000Z"
    } as any;
  }

  if (!session?.user) {
    redirect("/" + locale);
  }

  const rawRole = String((session.user as { role?: string }).role ?? "cliente").trim().toLowerCase();
  const role: "SU" | "cliente" = rawRole === "su" ? "SU" : "cliente";
  const roleScope = String((session.user as any).roleScope ?? "User");
  
  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value;
  
  const finalCompanyId = (role === "SU" && activeCompanyId) 
    ? activeCompanyId 
    : ((session.user as { companyId?: string | null }).companyId ?? null);

  const actor: ActorContext = {
    actorId: session.user.email ?? session.user.name ?? "anonymous",
    role,
    companyId: finalCompanyId
  };

  let companyName = (session.user as any).companyName ?? "";
  let userCargo = (session.user as any).userCargo ?? "Miembro";

  // If SU switched active company, fetch that company's name
  if (role === "SU" && activeCompanyId) {
    try {
      const pool = getPgPool();
      const res = await pool.query('SELECT "commercialName" FROM public."Company" WHERE id = $1 LIMIT 1', [activeCompanyId]);
      if (res.rows.length > 0) {
        companyName = res.rows[0].commercialName;
      } else {
        companyName = `Company ID: ${activeCompanyId}`;
      }
    } catch (e) {
      console.error("Error fetching active company name:", e);
    }
  }

  return {
    session,
    actor,
    companyName,
    userCargo,
    roleScope,
    locale
  };
}
