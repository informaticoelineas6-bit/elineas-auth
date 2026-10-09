// Snippets de referencia para la página de documentación de integración
// (issue: nueva página "Documentación"). Son ejemplos ilustrativos, no código
// ejecutado por esta app: se muestran tal cual en <CodeBlock> (con resaltado
// de sintaxis vía prism-react-renderer). Mantenerlos alineados con el patrón
// real que implementa este mismo proyecto en `src/modules/auth/` (cookies.ts,
// jwt.ts, session.ts, services/auth.ts).

export const verifySnippet = {
	title: "verify-jwt.ts (cualquier backend Node/TypeScript)",
	language: "typescript",
	code: `import { createRemoteJWKSet, jwtVerify } from "jose";

// AUTH_API_URL: la URL base del Identity Server, p. ej. https://auth.elineas.com
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", process.env.AUTH_API_URL!));

// Verificación local, sin round-trip al IS: comprueba firma + expiración
// contra el JWKS público. jose cachea el JWKS en memoria automáticamente.
export async function verifyElineasToken(token: string) {
	try {
		const { payload } = await jwtVerify(token, jwks);
		// payload.sub = id de usuario en el IS. email/name reflejan el usuario,
		// pero NO uses un eventual payload.role para autorizar: no está
		// garantizado. Para permisos en TU sistema, consulta /api/user-roles/me
		// (con el session token, no con este JWT) — ver "Autorización" abajo.
		return payload as { sub: string; email?: string; name?: string; exp: number };
	} catch {
		return null; // firma inválida o token expirado (dura ~15 min)
	}
}`,
};

export const rolesSnippet = {
	title: "roles.ts",
	language: "typescript",
	code: `// Con el session token (no el JWT) obtenido en el login, de vida larga.
export async function getMyRoles(sessionToken: string, systemSlug: string) {
	const url = new URL("/api/user-roles/me", process.env.AUTH_API_URL);
	url.searchParams.set("systemSlug", systemSlug);

	const res = await fetch(url, {
		headers: { Authorization: \`Bearer \${sessionToken}\` },
	});
	if (!res.ok) return [];

	const { roles } = (await res.json()) as {
		roles: { id: string; name: string; description: string | null }[];
	};
	return roles;
}`,
};

export const tanstackMiddlewareSnippet = {
	title: "modules/auth/middlewares/auth.ts (TanStack Start: verificar, renovar, roles y cerrar sesión)",
	language: "typescript",
	code: `import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_API_URL = process.env.AUTH_API_URL!;
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", AUTH_API_URL));
const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

async function verify(jwt: string | undefined) {
	if (!jwt) return null;
	try {
		return (await jwtVerify(jwt, jwks)).payload; // payload.sub = id de usuario
	} catch {
		return null; // firma inválida o expirado (~15 min)
	}
}

// Middleware para tus server functions / rutas protegidas.
export const authMiddleware = createMiddleware().server(async ({ next }) => {
	let payload = await verify(getCookie("jwt"));

	if (!payload) {
		// JWT expirado: se renueva con el session token (larga duración).
		const sessionToken = getCookie("session");
		const res = sessionToken
			? await fetch(new URL("/api/auth/token", AUTH_API_URL), {
					headers: { Authorization: "Bearer " + sessionToken },
				})
			: null;
		if (!res?.ok) {
			deleteCookie("session", cookieOpts);
			deleteCookie("jwt", cookieOpts);
			throw redirect({ to: "/login" });
		}
		const { token } = (await res.json()) as { token: string };
		setCookie("jwt", token, cookieOpts);
		payload = await verify(token);
	}

	return next({ context: { userId: payload!.sub as string } });
});

// Autorización: el JWT prueba identidad, no permisos. Los roles se piden al IS
// con el session token.
export const getMyRolesFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		const url = new URL("/api/user-roles/me", AUTH_API_URL);
		url.searchParams.set("systemSlug", "mi-sistema");
		const res = await fetch(url, {
			headers: { Authorization: "Bearer " + getCookie("session") },
		});
		if (!res.ok) return [];
		return ((await res.json()) as { roles: { name: string }[] }).roles;
	});

// Cerrar sesión: revoca la sesión en el IS y limpia tus cookies.
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
	const sessionToken = getCookie("session");
	if (sessionToken) {
		await fetch(new URL("/api/auth/sign-out", AUTH_API_URL), {
			method: "POST",
			headers: { Authorization: "Bearer " + sessionToken },
		}).catch(() => {}); // un 401 = la sesión ya no existía: da igual
	}
	deleteCookie("session", cookieOpts);
	deleteCookie("jwt", cookieOpts);
});`,
};

export type FrameworkExample = {
	id: string;
	label: string;
	blocks: { title: string; language: string; code: string }[];
};

export const frameworkExamples: FrameworkExample[] = [
	{
		id: "react",
		label: "React",
		blocks: [
			{
				title: "server/login.ts (tu backend, p. ej. Express)",
				language: "typescript",
				code: `app.post("/api/login", async (req, res) => {
	const { email, password } = req.body;

	const r = await fetch(new URL("/api/auth/sign-in", process.env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password, systemSlug: "mi-sistema" }),
	});
	if (!r.ok) return res.status(401).json({ error: "Credenciales inválidas" });

	const { user, token } = await r.json();
	// El session token (largo plazo) viaja en esta cabecera, no en el body.
	const sessionToken = r.headers.get("set-auth-token")!;

	// httpOnly: el JS del navegador nunca ve estos valores (mitiga XSS).
	res.cookie("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	res.cookie("jwt", token, { httpOnly: true, secure: true, sameSite: "lax" });
	res.json({ user });
});`,
			},
			{
				title: "useAuth.tsx (React)",
				language: "tsx",
				code: `import { createContext, useContext, useState, type ReactNode } from "react";

type User = { id: string; name: string; email: string };
type Ctx = { user: User | null; signIn: (email: string, password: string) => Promise<void> };

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);

	async function signIn(email: string, password: string) {
		// Llama a TU backend, no directo al IS: así la cookie httpOnly la fija
		// tu propio servidor (ver server/login.ts).
		const res = await fetch("/api/login", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		if (!res.ok) throw new Error("Credenciales inválidas");
		setUser((await res.json()).user);
	}

	return <AuthContext.Provider value={{ user, signIn }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext)!;`,
			},
		],
	},
	{
		id: "nextjs",
		label: "Next.js",
		blocks: [
			{
				title: "app/api/login/route.ts",
				language: "typescript",
				code: `import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const { email, password } = await req.json();

	const r = await fetch(new URL("/api/auth/sign-in", process.env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password, systemSlug: "mi-sistema" }),
	});
	if (!r.ok) {
		return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
	}

	const { user, token } = await r.json();
	const sessionToken = r.headers.get("set-auth-token")!;

	const response = NextResponse.json({ user });
	response.cookies.set("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	response.cookies.set("jwt", token, { httpOnly: true, secure: true, sameSite: "lax" });
	return response;
}`,
			},
			{
				title: "middleware.ts",
				language: "typescript",
				code: `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Verificación en el edge: sin round-trip al IS en cada petición protegida.
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", process.env.AUTH_API_URL!));

export async function middleware(req: NextRequest) {
	const jwt = req.cookies.get("jwt")?.value;
	if (!jwt) return NextResponse.redirect(new URL("/login", req.url));

	try {
		await jwtVerify(jwt, jwks);
		return NextResponse.next();
	} catch {
		// Expiró (~15 min): redirige a una ruta que pida /api/auth/token con el
		// session token para renovarlo, igual que hace este proyecto.
		return NextResponse.redirect(new URL("/login", req.url));
	}
}

export const config = { matcher: ["/dashboard/:path*"] };`,
			},
		],
	},
	{
		id: "tanstack-start",
		label: "TanStack Start",
		blocks: [
			{
				title: "modules/auth/actions/auth.ts",
				language: "typescript",
				code: `import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie } from "@tanstack/react-start/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_API_URL = process.env.AUTH_API_URL!;
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", AUTH_API_URL));
const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" } as const;

export const signInFn = createServerFn({ method: "POST" })
	.validator((d: { email: string; password: string }) => d)
	.handler(async ({ data }) => {
		const res = await fetch(new URL("/api/auth/sign-in", AUTH_API_URL), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...data, systemSlug: "mi-sistema" }),
		});
		if (!res.ok) throw new Error("Credenciales inválidas");

		const { user, token } = await res.json();
		setCookie("session", res.headers.get("set-auth-token")!, cookieOpts);
		setCookie("jwt", token, cookieOpts);
		return { user };
	});

// Este mismo patrón (cookies + verificación JWT + refresco) es el que usa
// este proyecto en src/modules/auth/lib/{cookies,jwt,session}.ts.
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
	const jwt = getCookie("jwt");
	if (!jwt) return null;
	try {
		const { payload } = await jwtVerify(jwt, jwks);
		return { userId: payload.sub as string };
	} catch {
		return null; // expiró: renovar con GET /api/auth/token + el session token
	}
});`,
			},
		],
	},
	{
		id: "vue",
		label: "Vue",
		blocks: [
			{
				title: "server/login.ts (tu backend, p. ej. Fastify)",
				language: "typescript",
				code: `import type { FastifyInstance } from "fastify";

export async function registerLogin(app: FastifyInstance) {
	app.post("/api/login", async (request, reply) => {
		const { email, password } = request.body as { email: string; password: string };

		const r = await fetch(new URL("/api/auth/sign-in", process.env.AUTH_API_URL), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password, systemSlug: "mi-sistema" }),
		});
		if (!r.ok) return reply.code(401).send({ error: "Credenciales inválidas" });

		const { user, token } = await r.json();
		// El session token (largo plazo) viaja en esta cabecera, no en el body.
		const sessionToken = r.headers.get("set-auth-token")!;

		// httpOnly: el JS del navegador nunca ve estos valores (mitiga XSS).
		reply
			.setCookie("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/" })
			.setCookie("jwt", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" })
			.send({ user });
	});
}`,
			},
			{
				title: "composables/useAuth.ts (Vue 3)",
				language: "typescript",
				code: `import { ref, readonly } from "vue";

type User = { id: string; name: string; email: string };
const user = ref<User | null>(null);

export function useAuth() {
	async function signIn(email: string, password: string) {
		// Llama a tu backend (no directo al IS), que fija las cookies httpOnly.
		const res = await fetch("/api/login", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		if (!res.ok) throw new Error("Credenciales inválidas");
		user.value = (await res.json()).user;
	}

	return { user: readonly(user), signIn };
}`,
			},
		],
	},
	{
		id: "nuxt",
		label: "Nuxt",
		blocks: [
			{
				title: "server/api/login.post.ts (Nuxt 3/4)",
				language: "typescript",
				code: `export default defineEventHandler(async (event) => {
	const { email, password } = await readBody(event);
	const authApiUrl = useRuntimeConfig().authApiUrl;

	const res = await $fetch.raw(\`\${authApiUrl}/api/auth/sign-in\`, {
		method: "POST",
		body: { email, password, systemSlug: "mi-sistema" },
	}).catch(() => null);

	if (!res) {
		throw createError({ statusCode: 401, statusMessage: "Credenciales inválidas" });
	}

	const sessionToken = res.headers.get("set-auth-token")!;
	setCookie(event, "session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	setCookie(event, "jwt", (res._data as any).token, { httpOnly: true, secure: true, sameSite: "lax" });
	return { user: (res._data as any).user };
});`,
			},
			{
				title: "composables/useAuth.ts (Nuxt)",
				language: "typescript",
				code: `export function useAuth() {
	const user = useState<{ id: string; name: string; email: string } | null>(
		"user",
		() => null,
	);

	async function signIn(email: string, password: string) {
		const { user: u } = await $fetch<{ user: typeof user.value }>("/api/login", {
			method: "POST",
			body: { email, password },
		});
		user.value = u;
	}

	return { user, signIn };
}`,
			},
		],
	},
];

// Login con Google por redirect. Mismo patrón que frameworkExamples pero para el
// flujo start -> callback -> exchange. Sin template literals en el código de
// ejemplo para no tener que escaparlos dentro de estos template strings.
export const googleExamples: FrameworkExample[] = [
	{
		id: "express",
		label: "Node / Express",
		blocks: [
			{
				title: "server/google-login.ts — paso 1: iniciar (GET /login/google)",
				language: "typescript",
				code: `import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";

// URL del IS tal como la ve el NAVEGADOR (puede diferir de AUTH_API_URL si tu
// servidor lo alcanza por una dirección interna).
const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL!;
const APP_URL = process.env.APP_URL!; // origen de TU app, p. ej. https://pos.midominio.com

// El botón "Continuar con Google" de tu login es un simple <a href="/login/google">.
export function startGoogleLogin(_req: Request, res: Response) {
	const verifier = randomBytes(32).toString("base64url"); // PKCE
	const state = randomBytes(16).toString("hex"); // anti-CSRF

	// httpOnly + vida corta: el verifier nunca debe llegar al JS del navegador.
	res.cookie("google_flow", JSON.stringify({ verifier, state }), {
		httpOnly: true,
		secure: true,
		sameSite: "lax", // viaja en la navegación de vuelta desde el IS
		maxAge: 10 * 60 * 1000,
	});

	const url = new URL("/api/auth/google/start", AUTH_PUBLIC_URL);
	url.searchParams.set("redirect_to", new URL("/auth/callback", APP_URL).toString());
	url.searchParams.set(
		"code_challenge",
		createHash("sha256").update(verifier).digest("base64url"),
	);
	url.searchParams.set("state", state);
	url.searchParams.set("systemSlug", "mi-sistema"); // opcional
	res.redirect(url.toString());
}`,
			},
			{
				title: "server/google-login.ts — paso 2: la vuelta y el canje (GET /auth/callback)",
				language: "typescript",
				code: `// Requiere cookie-parser (req.cookies).
export async function googleCallback(req: Request, res: Response) {
	const flow = req.cookies.google_flow
		? (JSON.parse(req.cookies.google_flow) as { verifier: string; state: string })
		: null;
	res.clearCookie("google_flow"); // de un solo uso, pase lo que pase

	const { code, state, error } = req.query as Record<string, string | undefined>;
	const fail = (e: string) => res.redirect("/login?error=" + encodeURIComponent(e));

	// El IS devuelve ?error=ACCOUNT_NOT_FOUND | NO_ROLES_IN_SYSTEM | ...
	if (error) return fail(error);
	if (!flow || !code || state !== flow.state) return fail("STATE_INVALID");

	// Servidor a servidor: aquí viaja el code_verifier, que solo conoce tu backend.
	const r = await fetch(new URL("/api/auth/google/exchange", process.env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code, code_verifier: flow.verifier }),
	});
	if (!r.ok) return fail(((await r.json()) as { code?: string }).code ?? "GOOGLE_AUTH_FAILED");

	// Misma respuesta que /api/auth/sign-in.
	const { token } = (await r.json()) as { token: string | null };
	const sessionToken = r.headers.get("set-auth-token")!;

	res.cookie("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	if (token) res.cookie("jwt", token, { httpOnly: true, secure: true, sameSite: "lax" });
	res.redirect("/");
}

// app.get("/login/google", startGoogleLogin);
// app.get("/auth/callback", googleCallback);`,
			},
		],
	},
	{
		id: "nextjs",
		label: "Next.js",
		blocks: [
			{
				title: "app/login/google/route.ts — paso 1: iniciar",
				language: "typescript",
				code: `import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// El botón "Continuar con Google" es un <a href="/login/google">.
export async function GET() {
	const verifier = randomBytes(32).toString("base64url"); // PKCE
	const state = randomBytes(16).toString("hex"); // anti-CSRF

	(await cookies()).set("google_flow", JSON.stringify({ verifier, state }), {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		maxAge: 10 * 60,
	});

	// AUTH_PUBLIC_URL: URL del IS tal como la ve el NAVEGADOR.
	const url = new URL("/api/auth/google/start", process.env.AUTH_PUBLIC_URL);
	url.searchParams.set(
		"redirect_to",
		new URL("/auth/callback", process.env.APP_URL).toString(),
	);
	url.searchParams.set(
		"code_challenge",
		createHash("sha256").update(verifier).digest("base64url"),
	);
	url.searchParams.set("state", state);
	url.searchParams.set("systemSlug", "mi-sistema"); // opcional
	return NextResponse.redirect(url);
}`,
			},
			{
				title: "app/auth/callback/route.ts — paso 2: la vuelta y el canje",
				language: "typescript",
				code: `import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
	const jar = await cookies();
	const raw = jar.get("google_flow")?.value;
	const flow = raw ? (JSON.parse(raw) as { verifier: string; state: string }) : null;
	jar.delete("google_flow"); // de un solo uso

	const params = new URL(req.url).searchParams;
	const code = params.get("code");
	const fail = (e: string) =>
		NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(e), process.env.APP_URL));

	// El IS devuelve ?error=ACCOUNT_NOT_FOUND | NO_ROLES_IN_SYSTEM | ...
	const error = params.get("error");
	if (error) return fail(error);
	if (!flow || !code || params.get("state") !== flow.state) return fail("STATE_INVALID");

	// Servidor a servidor: aquí viaja el code_verifier.
	const r = await fetch(new URL("/api/auth/google/exchange", process.env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code, code_verifier: flow.verifier }),
	});
	if (!r.ok) return fail(((await r.json()) as { code?: string }).code ?? "GOOGLE_AUTH_FAILED");

	const { token } = (await r.json()) as { token: string | null };
	const sessionToken = r.headers.get("set-auth-token")!;

	const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
	jar.set("session", sessionToken, opts);
	if (token) jar.set("jwt", token, opts);
	return NextResponse.redirect(new URL("/", process.env.APP_URL));
}`,
			},
		],
	},
	{
		id: "tanstack-start",
		label: "TanStack Start",
		blocks: [
			{
				title: "modules/auth/actions/google.ts — server functions (inicio y canje)",
				language: "typescript",
				code: `import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

// AUTH_API_URL: el IS alcanzable desde tu servidor (puede ser interna).
// AUTH_PUBLIC_URL: el IS tal como lo ve el NAVEGADOR. APP_URL: origen de tu app.
const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

// Paso 1: genera PKCE + state, los guarda en una cookie httpOnly y devuelve la
// URL del IS a la que debe ir el navegador.
export const startGoogleLoginFn = createServerFn({ method: "POST" }).handler(async () => {
	const verifier = randomBytes(32).toString("base64url");
	const state = randomBytes(16).toString("hex");
	setCookie("google_flow", JSON.stringify({ verifier, state }), {
		...cookieOpts,
		maxAge: 10 * 60,
	});

	const url = new URL("/api/auth/google/start", process.env.AUTH_PUBLIC_URL);
	url.searchParams.set(
		"redirect_to",
		new URL("/auth/google/callback", process.env.APP_URL).toString(),
	);
	url.searchParams.set(
		"code_challenge",
		createHash("sha256").update(verifier).digest("base64url"),
	);
	url.searchParams.set("state", state);
	url.searchParams.set("systemSlug", "mi-sistema"); // opcional
	return { url: url.toString() };
});

// Paso 2: el IS devolvió al usuario con ?code&state (o ?error). Se valida el
// state, se canjea el código con el verifier y se abre la sesión.
export const completeGoogleLoginFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			code: z.string().optional(),
			state: z.string().optional(),
			error: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const raw = getCookie("google_flow");
		const flow = raw ? (JSON.parse(raw) as { verifier: string; state: string }) : null;
		deleteCookie("google_flow", cookieOpts); // de un solo uso

		// ACCOUNT_NOT_FOUND | NO_ROLES_IN_SYSTEM | GOOGLE_ACCESS_DENIED | ...
		if (data.error) return { ok: false, error: data.error } as const;
		if (!flow || !data.code || data.state !== flow.state) {
			return { ok: false, error: "STATE_INVALID" } as const;
		}

		// Servidor a servidor: aquí viaja el code_verifier.
		const r = await fetch(new URL("/api/auth/google/exchange", process.env.AUTH_API_URL), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: data.code, code_verifier: flow.verifier }),
		});
		if (!r.ok) {
			const { code } = (await r.json()) as { code?: string };
			return { ok: false, error: code ?? "GOOGLE_AUTH_FAILED" } as const;
		}

		// Misma respuesta que /api/auth/sign-in.
		const { token } = (await r.json()) as { token: string | null };
		setCookie("session", r.headers.get("set-auth-token")!, {
			...cookieOpts,
			maxAge: 60 * 60 * 24 * 7,
		});
		if (token) setCookie("jwt", token, cookieOpts);
		return { ok: true } as const;
	});`,
			},
			{
				title: "routes/login.tsx — el botón",
				language: "tsx",
				code: `import { useServerFn } from "@tanstack/react-start";
import { startGoogleLoginFn } from "#/modules/auth/actions/google.ts";

export function GoogleButton() {
	const start = useServerFn(startGoogleLoginFn);
	return (
		<button
			type="button"
			onClick={async () => {
				const { url } = await start();
				// Navegación completa (no fetch): el IS responde con redirects a Google.
				window.location.assign(url);
			}}
		>
			Continuar con Google
		</button>
	);
}`,
			},
			{
				title: "routes/auth.google.callback.tsx — la vuelta",
				language: "tsx",
				code: `import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { completeGoogleLoginFn } from "#/modules/auth/actions/google.ts";

// Ruta PÚBLICA (aún no hay sesión). El loader canjea el código en el servidor y,
// si va bien, redirige; solo se renderiza la página si hubo un error.
export const Route = createFileRoute("/auth/google/callback")({
	validateSearch: z.object({
		code: z.string().optional(),
		state: z.string().optional(),
		error: z.string().optional(),
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const result = await completeGoogleLoginFn({ data: deps });
		if (result.ok) throw redirect({ to: "/" });
		return { error: result.error };
	},
	component: function Callback() {
		const { error } = Route.useLoaderData();
		return <p>No se pudo iniciar sesión con Google ({error}).</p>;
	},
});`,
			},
		],
	},
];
