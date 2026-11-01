import { failureResponse } from "@/server/http";
import { closeSession } from "@/server/session";

export async function POST() {
  try {
    await closeSession();
    return Response.json({ ok: true });
  } catch (error) {
    return failureResponse(error);
  }
}
