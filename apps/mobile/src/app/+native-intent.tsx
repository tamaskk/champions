/**
 * Web links that open the app (Universal Links / App Links, see app.json): a shared squad page
 * https://<site>/s/<id> opens that squad on Ranks. Everything else goes through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const shared = /^(?:https?:\/\/[^/]+)?\/s\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(path);
    return shared ? `/ranks?squad=${shared[1]}` : path;
  } catch {
    return path;
  }
}
