import {resolveSocialOnboarding} from "@/server/auth/onboarding";

export async function resolveLoginNavigation(email: string | null | undefined, provider: "google" | "facebook" | "linkedin") {
  if (!email) {
    return {flow: "FORM_REQUIRED" as const};
  }
  return resolveSocialOnboarding(email, provider);
}
