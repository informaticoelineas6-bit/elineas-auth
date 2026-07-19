import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { cn } from "@/modules/common/lib/utils.ts";

// Botón para copiar un texto corto (slug, id, etc.) al portapapeles. Muestra un
// check durante unos segundos como confirmación. Cae a un toast de error si el
// navegador no expone la Clipboard API (contexto no seguro).
export function CopyButton({
	value,
	label = "Copiar",
	className,
}: {
	value: string;
	label?: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("No se pudo copiar al portapapeles");
		}
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className={cn("text-muted-foreground", className)}
			aria-label={label}
			title={label}
			onClick={(e) => {
				// Evita disparar acciones del contenedor (p. ej. navegar la fila).
				e.stopPropagation();
				copy();
			}}
		>
			{copied ? <Check className="text-primary" /> : <Copy />}
		</Button>
	);
}
