import { z } from "zod";
import { apiError, json } from "@/lib/api";
import { missionAlert } from "@/lib/vesta/alert";

export const runtime = "nodejs";

const Body = z.object({ mission: z.string().max(40) });

/** Proactive alert when the mission changes. No AI call. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("body must be JSON");
  }
  const p = Body.safeParse(body);
  if (!p.success) return apiError("send { mission }");
  const alert = missionAlert(p.data.mission);
  if (!alert) return apiError("unknown mission", 404);
  return json(alert, { cache: false });
}
