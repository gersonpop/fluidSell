import type {NextAuthOptions} from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";
import { decryptWithKey } from "@/server/pgDynamicDbStore";
import { getPgPool } from "@/server/postgres";

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture
        };
      }
    })
  );
}

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET
    })
  );
}

if (process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET) {
  providers.push(
    LinkedInProvider({
      clientId: process.env.AUTH_LINKEDIN_ID,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET,
      authorization: {
        params: { scope: "openid profile email" },
      },
      wellKnown: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
      userinfo: {
        url: "https://api.linkedin.com/v2/userinfo",
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture
        };
      }
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({token, profile, user, account}) {
      let profilePicture: string | undefined = undefined;
      if (profile) {
        if (typeof (profile as any).picture === "string") {
          profilePicture = (profile as any).picture;
        } else if (typeof (profile as any).picture?.data?.url === "string") {
          profilePicture = (profile as any).picture.data.url;
        }
      }
      const userImage = (user as {image?: string | null} | undefined)?.image ?? undefined;
      const tokenPicture = typeof token.picture === "string" ? token.picture : undefined;
      const tokenImage = typeof token.image === "string" ? token.image : undefined;
      const resolvedPicture = profilePicture ?? userImage ?? tokenPicture ?? tokenImage;

      if (resolvedPicture) {
        token.picture = resolvedPicture;
        token.image = resolvedPicture;
      }
      if (account?.provider) {
        token.provider = account.provider;
      }

      // Query database to resolve role scope securely from the encrypted UserRole
      if (token.email) {
        try {
          const pool = getPgPool();
          const userRes = await pool.query(
            'SELECT id_user_pk, username, "companyId", position, avatar FROM public."PlatformUser" WHERE user_email = $1 LIMIT 1',
            [token.email]
          );
          if (userRes.rows.length > 0) {
            const platformUser = userRes.rows[0];
            const userId = platformUser.id_user_pk;
            let companyId = platformUser.companyId;

            token.userId = userId;
            token.username = platformUser.username;
            token.userCargo = platformUser.position || "Miembro";
            if (platformUser.avatar) {
              token.picture = platformUser.avatar;
              token.image = platformUser.avatar;
            }

            const userRoleRes = await pool.query(
              'SELECT ur."roleId", ur.hash_permission, ur.company_id, r.name as role_name ' +
              'FROM public."UserRole" ur ' +
              'LEFT JOIN public."Role" r ON ur."roleId" = r.id ' +
              'WHERE ur.platform_user_id = $1 LIMIT 1',
              [userId]
            );

            let isSU = false;
            if (userRoleRes.rows.length > 0) {
              const userRole = userRoleRes.rows[0];
              const hashPermission = userRole.hash_permission;
              if (userRole.role_name) {
                token.userCargo = userRole.role_name;
              }

              if (hashPermission) {
                const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "default-outer-salt-2849";
                const outerKeyMaterial = `${userId}-${secret}`;
                try {
                  const decryptedJson = decryptWithKey(hashPermission, outerKeyMaterial);
                  const payload = JSON.parse(decryptedJson);
                  if (payload && payload.scope) {
                    token.roleScope = payload.scope;
                    token.role = payload.scope === "SU" ? "SU" : "cliente";
                    if (payload.scope === "SU") {
                      isSU = true;
                    }
                  }
                } catch (decryptErr) {
                  console.error("[SECURITY] Failed to decrypt user role signature for user:", userId, decryptErr);
                }
              }
            }

            if (isSU) {
              try {
                const { cookies } = await import("next/headers");
                const cookieStore = await cookies();
                const activeCompanyId = cookieStore.get("active_company_id")?.value;
                if (activeCompanyId) {
                  companyId = activeCompanyId;
                }
              } catch (cookieErr) {
                console.error("Error reading active_company_id cookie in auth-options:", cookieErr);
              }
            }

            token.companyId = companyId;

            if (companyId) {
              const compRes = await pool.query(
                'SELECT "commercialName" FROM public."Company" WHERE id = $1 LIMIT 1',
                [companyId]
              );
              if (compRes.rows.length > 0) {
                token.companyName = compRes.rows[0].commercialName;
              } else {
                token.companyName = `Company ID: ${companyId}`;
              }
            }
          }
        } catch (dbErr) {
          console.error("Error loading user role in auth-options:", dbErr);
        }
      }

      if (!token.roleScope) {
        token.roleScope = "User";
      }
      if (!token.role) {
        token.role = token.roleScope === "SU" ? "SU" : "cliente";
      }

      return token;
    },
    async session({session, token}) {
      if (session.user) {
        const tokenPicture = typeof token.picture === "string" ? token.picture : undefined;
        const tokenImage = typeof token.image === "string" ? token.image : undefined;
        session.user.image = tokenPicture ?? tokenImage ?? session.user.image ?? null;
        const tokenProvider = typeof token.provider === "string" ? token.provider : undefined;
        if (tokenProvider) {
          (session.user as {provider?: string}).provider = tokenProvider;
        }
        if (token.roleScope) {
          (session.user as any).roleScope = token.roleScope;
        }
        if (token.role) {
          (session.user as any).role = token.role;
        }
        if (token.companyId) {
          (session.user as any).companyId = token.companyId;
        }
        if (token.companyName) {
          (session.user as any).companyName = token.companyName;
        }
        if (token.userCargo) {
          (session.user as any).userCargo = token.userCargo;
        }
        if (token.userId) {
          (session.user as any).userId = token.userId;
        }
        if (token.username) {
          (session.user as any).username = token.username;
        }
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 72 * 60 * 60 // 72 hours
  }
};
