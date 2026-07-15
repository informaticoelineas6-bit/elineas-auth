import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Input } from "#/components/ui/input.tsx";
import { cn } from "#/lib/utils.ts";

function PasswordInput({
	className,
	...props
}: Omit<React.ComponentProps<"input">, "type">) {
	const [visible, setVisible] = React.useState(false);

	return (
		<div className="relative">
			<Input
				type={visible ? "text" : "password"}
				data-slot="password-input"
				className={cn("pr-9", className)}
				{...props}
			/>
			<button
				type="button"
				tabIndex={-1}
				onClick={() => setVisible((v) => !v)}
				aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
				aria-pressed={visible}
				className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50"
			>
				{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
			</button>
		</div>
	);
}

export { PasswordInput };
