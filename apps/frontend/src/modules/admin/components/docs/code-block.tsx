import { lazy, Suspense } from "react";
import { CopyButton } from "@/modules/common/components/partials/copy-button.tsx";

// El resaltado (prism-react-renderer, ~125 KB) se carga bajo demanda: no entra
// en el bundle inicial de /docs. Mientras llega, se muestra el código en texto
// plano (mismo layout), así que la página es utilizable de inmediato.
const HighlightedCode = lazy(() => import("./highlighted-code.tsx"));

// Fallback (y estado sin resaltar): el mismo <pre> con el código crudo.
function PlainCode({ code }: { code: string }) {
	return (
		<pre className="overflow-x-auto p-4 text-xs leading-relaxed">
			<code className="font-mono">{code.trimEnd()}</code>
		</pre>
	);
}

// Bloque de código con botón de copiar. `title` identifica el snippet dentro
// de una pestaña (p. ej. el nombre de archivo sugerido); `language` es el id de
// lenguaje de Prism ("tsx", "ts", "bash"…).
export function CodeBlock({
	code,
	title,
	language = "tsx",
}: {
	code: string;
	title?: string;
	language?: string;
}) {
	return (
		<div className="overflow-hidden rounded-lg border bg-muted/40">
			{title && (
				<div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5">
					<span className="font-mono text-xs text-muted-foreground">
						{title}
					</span>
					<CopyButton value={code} label={`Copiar ${title}`} />
				</div>
			)}
			<div className="relative">
				{!title && (
					<CopyButton
						value={code}
						label="Copiar código"
						className="absolute top-2 right-2"
					/>
				)}
				<Suspense fallback={<PlainCode code={code} />}>
					<HighlightedCode code={code} language={language} />
				</Suspense>
			</div>
		</div>
	);
}
