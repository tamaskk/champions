import { APP_LINKS } from "@/content/app-links";

/** iOS Universal Links: served as JSON without a file extension. */
export function GET() {
  return Response.json({
    applinks: {
      details: [{ appIDs: [APP_LINKS.iosAppId], components: APP_LINKS.paths.map((path) => ({ "/": path })) }],
    },
  });
}
