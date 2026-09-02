import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { buildDocsMarkdown } from "./docs-markdown.ts";

// Copia toda la documentación de integración en markdown (bloques de código
// incluidos) para pegársela a un LLM como contexto de cómo se usa el sistema.
export function CopyDocsButton() {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(buildDocsMarkdown());
			setCopied(true);
			toast.success("Documentación copiada en markdown");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("No se pudo copiar al portapapeles");
		}
	}

	return (
		<Button type="button" variant="outline" onClick={copy}>
			{copied ? <Check className="text-primary" /> : <ClipboardCopy />}
			{copied ? "Copiado" : "Copiar todo en markdown (para LLM)"}
		</Button>
	);
}
