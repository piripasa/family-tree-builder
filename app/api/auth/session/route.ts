import { failureResponse } from "@/server/http";
import { readSessionUser } from "@/server/session";

export async function GET() {
  try {
    const user = await readSessionUser();
    if (!user) return Response.json({ error: "Sign in to open your account." }, { status: 401 });
    return Response.json({ email: user.email });
  } catch (error) {
    return failureResponse(error);
  }
}
