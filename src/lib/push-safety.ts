const PUSH_HOST = /^(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const u = new URL(value);
    return value.length <= 4096 && u.protocol === "https:" && !u.username && !u.password && !u.port && !u.hash && PUSH_HOST.test(u.hostname) && u.pathname !== "/" && u.href === value;
  } catch { return false; }
}
export function safeNotificationPath(value: unknown): string {
  return typeof value === "string" && /^\/(app|pro)(?:\/[a-zA-Z0-9_/-]*)?$/.test(value) ? value : "/";
}
