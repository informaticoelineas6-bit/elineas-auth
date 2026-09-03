import { readJson } from "#/modules/auth/lib/api.ts";
import { readSessionToken } from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";

export function buildQuery(params: Record<string, unknown>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		search.set(key, String(value));
	}
	const qs = search.toString();
	return qs ? `?${qs}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const token = readSessionToken();
	const hasBody = init?.body != null;
	const response = await fetch(new URL(path, env.AUTH_API_URL), {
		...init,
		headers: {
			...(hasBody ? { "Content-Type": "application/json" } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...init?.headers,
		},
	});
	return (await readJson(response)) as T;
}

export const isApi = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body: unknown) =>
		request<T>(path, { method: "POST", body: JSON.stringify(body) }),
	patch: <T>(path: string, body: unknown) =>
		request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
	delete: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "DELETE",
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		}),
};
