import { Eye, EyeOff, Key } from "lucide-react";
import * as React from "react";

import { Input } from "@/modules/common/components/ui/input.tsx";
import {
	checkStrength,
	cn,
	generateSecurePassword,
} from "@/modules/common/lib/utils.ts";
import type { PasswordInputProps } from "@/modules/common/shared/types";

function PasswordInput({
	className,
	showGenerator = false,
	showStrength = false,
	generatorLength = 16,
	onGenerate,
	value,
	onChange,
	...props
}: PasswordInputProps) {
	const [visible, setVisible] = React.useState(false);
	const [internalValue, setInternalValue] = React.useState("");

	// Soporte para controlled y uncontrolled
	const currentValue = value !== undefined ? String(value) : internalValue;
	const isControlled = value !== undefined;

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!isControlled) setInternalValue(e.target.value);
		onChange?.(e);
	};

	const handleGenerate = () => {
		const newPassword = generateSecurePassword(generatorLength);
		if (!isControlled) setInternalValue(newPassword);

		// Simular un evento de change para mantener compatibilidad
		const syntheticEvent = {
			target: { value: newPassword },
			currentTarget: { value: newPassword },
		} as React.ChangeEvent<HTMLInputElement>;

		onChange?.(syntheticEvent);
		onGenerate?.(newPassword);
	};

	const strength = checkStrength(currentValue);

	return (
		<div className="space-y-2">
			<div className="relative">
				<Input
					type={visible ? "text" : "password"}
					data-slot="password-input"
					className={cn(
						"pr-20", // espacio para ambos botones
						className,
					)}
					value={currentValue}
					onChange={handleChange}
					{...props}
				/>

				<div className="absolute inset-y-0 right-0 flex items-center">
					{/* Botón generar */}
					{showGenerator && (
						<button
							type="button"
							tabIndex={-1}
							onClick={handleGenerate}
							aria-label="Generar contraseña segura"
							title="Generar contraseña segura"
							className="h-full px-2 text-muted-foreground hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50"
						>
							<Key className="size-4" />
						</button>
					)}

					{/* Botón visibilidad */}
					<button
						type="button"
						tabIndex={-1}
						onClick={() => setVisible((v) => !v)}
						aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
						aria-pressed={visible}
						className="h-full px-3 text-muted-foreground hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50"
					>
						{visible ? (
							<EyeOff className="size-4" />
						) : (
							<Eye className="size-4" />
						)}
					</button>
				</div>
			</div>

			{/* Strength checker */}
			{showStrength && currentValue.length > 0 && (
				<div
					className="animate-in space-y-1 fade-in-0 slide-in-from-top-1 duration-200"
					aria-live="polite"
				>
					<div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full transition-all duration-300 ease-out",
								strength.color,
							)}
							style={{ width: strength.width }}
						/>
					</div>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span
							key={strength.label}
							className="animate-in font-medium text-foreground fade-in-0 slide-in-from-bottom-0.5 duration-200"
						>
							{strength.label}
						</span>
						<span>{currentValue.length} caracteres</span>
					</div>
				</div>
			)}
		</div>
	);
}

export { PasswordInput };
