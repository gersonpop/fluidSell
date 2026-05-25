import {NextResponse} from "next/server";
import {createEpic, getScrumEpicsWithStories} from "@/server/scrumFileStore";

export async function GET() {
  const epics = await getScrumEpicsWithStories();
  return NextResponse.json({epics});
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    priority?: "P0" | "P1" | "P2";
    status?: "Backlog" | "Ready" | "InProgress" | "InReview" | "Done" | "Blocked";
  };

  if (!body.title) {
    return NextResponse.json({message: "title es obligatorio"}, {status: 400});
  }

  const epic = await createEpic({
    title: body.title,
    description: body.description ?? "Nuevo epic Scrum",
    priority: body.priority ?? "P1",
    status: body.status ?? "Backlog"
  });

  return NextResponse.json({epic}, {status: 201});
}
