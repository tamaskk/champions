import { APP_LINKS, androidFingerprints } from "@/content/app-links";

/** Android App Links: verified only once ANDROID_CERT_SHA256 is set (empty list until then). */
export function GET() {
  const fingerprints = androidFingerprints();
  return Response.json(
    fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: APP_LINKS.androidPackage, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : [],
  );
}
