export async function api<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (data.code === "TEST_ACCESS_REQUIRED") {
    window.location.assign(
      "/access?next=" +
        encodeURIComponent(window.location.pathname) +
        window.location.hash,
    );
  }
  if (data.code === "ADMIN_SESSION_EXPIRED") {
    window.dispatchEvent(new Event("semc-admin-expired"));
  }
  if (!response.ok)
    throw new Error(data.error || "The request failed. Please try again.");
  return data as T;
}
