import {NextResponse} from "next/server";
import {updateApprovalStatus} from "@/server/auth/onboarding";

type RouteContext = {
  params: Promise<{userId: string}>;
};

export async function POST(request: Request, {params}: RouteContext) {
  try {
    const {userId} = await params;
    const actor = request.headers.get("x-actor-id") ?? "admin";
    const user = await updateApprovalStatus(userId, actor, "reject");
    return NextResponse.json({ok: true, user});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : "Request failed"}, {status: 400});
  }
}
