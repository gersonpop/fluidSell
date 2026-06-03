import type {NextAuthOptions} from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";

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
      }
      return session;
    }
  },
  session: {
    strategy: "jwt"
  }
};
