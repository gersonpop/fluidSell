import {NextResponse} from "next/server";
import {getPgPool} from "@/server/postgres";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({message: "companyId is required"}, {status: 400});
    }

    const query = 'SELECT id, name, key, scope FROM public."Role" WHERE "companyId" = $1 AND scope != \'SU\' ORDER BY name ASC';
    const result = await getPgPool().query(query, [companyId]);

    return NextResponse.json({items: result.rows});
  } catch (error) {
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Request failed"},
      {status: 400}
    );
  }
}
