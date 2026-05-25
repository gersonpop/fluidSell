import {NextResponse} from "next/server";
import {submitSocialOnboarding} from "@/server/auth/onboarding";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      companyId: string;
      countryCode: string;
      country: string;
      department: string;
      city: string;
      dni: string;
      birthDate: string;
      gender: string;
      provider: "google" | "facebook" | "linkedin";
    };

    const user = await submitSocialOnboarding(body);
    return NextResponse.json({ok: true, user});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message.includes("already") || message.includes("Invalid") ? 409 : 400;
    return NextResponse.json({message}, {status});
  }
}
