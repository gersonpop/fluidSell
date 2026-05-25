import {NextResponse} from "next/server";
import {createStory} from "@/server/scrumFileStore";

type Params = {params: Promise<{epicId: string}>};

export async function POST(request: Request, {params}: Params) {
  const {epicId} = await params;
  const body = (await request.json()) as {
    title?: string;
    userStory?: string;
    app?: "WEB" | "API-CORE" | "MOBILE";
    module?: string;
    priority?: "P0" | "P1" | "P2";
    status?: "Backlog" | "Ready" | "InProgress" | "InReview" | "Done" | "Blocked";
    points?: number;
  };

  if (!body.title) {
    return NextResponse.json({message: "title es obligatorio"}, {status: 400});
  }

  const story = await createStory({
    epicId,
    title: body.title,
    userStory: body.userStory ?? `Como usuario quiero ${body.title.toLowerCase()}`,
    app: body.app ?? "WEB",
    module: body.module ?? "scrum",
    priority: body.priority ?? "P1",
    status: body.status ?? "Backlog",
    points: body.points ?? 3
  });

  return NextResponse.json({story}, {status: 201});
}
