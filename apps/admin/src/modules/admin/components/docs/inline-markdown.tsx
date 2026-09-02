// Renderiza el subconjunto de markdown que usan los textos de docs-content.ts
// (**negrita** y `código`). Así esos textos se escriben una sola vez y sirven
// tanto a la página como al markdown que se copia para un LLM.
const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

type Segment = { key: string; kind: "text" | "strong" | "code"; value: string };

function parse(text: string): Segment[] {
	return text.split(INLINE_TOKEN).map((part, index) => {
		if (part.startsWith("**")) {
			return { key: `s${index}`, kind: "strong", value: part.slice(2, -2) };
		}
		if (part.startsWith("`")) {
			return { key: `c${index}`, kind: "code", value: part.slice(1, -1) };
		}
		return { key: `t${index}`, kind: "text", value: part };
	});
}

export function InlineMarkdown({ text }: { text: string }) {
	return (
		<>
			{parse(text).map((segment) => {
				if (segment.kind === "strong") {
					return <strong key={segment.key}>{segment.value}</strong>;
				}
				if (segment.kind === "code") {
					return (
						<code
							key={segment.key}
							className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
						>
							{segment.value}
						</code>
					);
				}
				return <span key={segment.key}>{segment.value}</span>;
			})}
		</>
	);
}
