import {
	AsYouType,
	getCountryCallingCode,
	parsePhoneNumberFromString,
} from "libphonenumber-js";
import { CheckCircle2, XCircle } from "lucide-react";
import * as React from "react";

import { Input } from "@/modules/common/components/ui/input.tsx";
import { cn } from "@/modules/common/lib/utils.ts";
import type { PhoneInputProps } from "@/modules/common/shared/types";

// Input de teléfono con formateo en vivo (libphonenumber-js AsYouType) e icono
// de válido/inválido. Si el usuario empieza a escribir sin "+", se antepone el
// código internacional de `defaultCountry` para que se vea desde la primera
// tecla; si el usuario teclea su propio "+", se respeta ese país.
function PhoneInput({
	className,
	value,
	onChange,
	defaultCountry = "CU",
	...props
}: PhoneInputProps) {
	const [internalValue, setInternalValue] = React.useState(value ?? "");
	const isControlled = value !== undefined;
	const currentValue = isControlled ? (value ?? "") : internalValue;
	const callingCode = getCountryCallingCode(defaultCountry);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		let raw = e.target.value;
		if (raw && !raw.startsWith("+") && !currentValue) {
			raw = `+${callingCode}${raw}`;
		}
		const formatted = new AsYouType(defaultCountry).input(raw);
		if (!isControlled) setInternalValue(formatted);
		onChange?.(formatted);
	}

	const nationalDigits = currentValue
		.replace(/\D/g, "")
		.replace(new RegExp(`^${callingCode}`), "");
	const showStatus = nationalDigits.length > 0;
	const isValid = parsePhoneNumberFromString(currentValue)?.isValid() ?? false;

	return (
		<div className="relative">
			<Input
				type="tel"
				inputMode="tel"
				data-slot="phone-input"
				value={currentValue}
				onChange={handleChange}
				className={cn("pr-9", className)}
				{...props}
			/>
			{showStatus && (
				<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
					{isValid ? (
						<CheckCircle2
							className="size-4 text-emerald-600"
							aria-label="Número válido"
						/>
					) : (
						<XCircle
							className="size-4 text-destructive"
							aria-label="Número no válido"
						/>
					)}
				</div>
			)}
		</div>
	);
}

export { PhoneInput };
