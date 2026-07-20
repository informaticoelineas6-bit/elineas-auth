import { getRouteApi } from "@tanstack/react-router";
import { Highlight, themes } from "prism-react-renderer";

// Renderizado del código con resaltado de sintaxis. Vive en su propio módulo
// para que `prism-react-renderer` (~125 KB) se cargue con import() dinámico
// (ver CodeBlock, React.lazy) y NO entre en el bundle inicial de /docs: la
// página muestra el código en texto plano y el resaltado llega después.
const rootRoute = getRouteApi("__root__");

export default function HighlightedCode({
	code,
	language,
}: {
	code: string;
	language: string;
}) {
	// Mismo criterio que __root.tsx: todo lo que no sea "light" (incluido
	// "system") se trata como oscuro hasta que el media query lo corrija.
	const appTheme = rootRoute.useLoaderData();
	const theme = appTheme === "light" ? themes.oneLight : themes.oneDark;

	return (
		<Highlight theme={theme} code={code.trimEnd()} language={language}>
			{({ className, style, tokens, getLineProps, getTokenProps }) => (
				<pre
					className={`${className} overflow-x-auto p-4 text-xs leading-relaxed`}
					style={{ ...style, background: "transparent" }}
				>
					{tokens.map((line, i) => {
						const { key: _lineKey, ...lineProps } = getLineProps({ line });
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: las líneas de un snippet estático no se reordenan.
							<div key={i} {...lineProps}>
								{line.map((token, tokenIndex) => {
									const { key: _tokenKey, ...tokenProps } = getTokenProps({
										token,
									});
									return (
										// biome-ignore lint/suspicious/noArrayIndexKey: los tokens de una línea estática no se reordenan.
										<span key={tokenIndex} {...tokenProps} />
									);
								})}
							</div>
						);
					})}
				</pre>
			)}
		</Highlight>
	);
}
