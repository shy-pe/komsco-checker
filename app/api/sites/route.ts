import { getSites } from "@/lib/site-repository";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    source: "data/sites.json",
    sites: getSites()
  });
}
