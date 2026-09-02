import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			preset: "bun",
			rollupConfig: { external: [/^@sentry\//] },
			// Cabecera anti-indexado en TODAS las respuestas (HTML, assets, server
			// fns). Complementa el robots.txt (Disallow) y el <meta name="robots">
			// del head: X-Robots-Tag es la señal más fuerte y la respetan los
			// crawlers aunque no rendericen el HTML.
			routeRules: {
				"/**": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
			},
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
