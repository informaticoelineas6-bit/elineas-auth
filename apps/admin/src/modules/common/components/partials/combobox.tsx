import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/modules/common/components/ui/popover.tsx";
import { cn } from "@/modules/common/lib/utils.ts";

export type ComboboxOption = {
	value: string;
	label: string;
	/** Texto secundario mostrado bajo la etiqueta y también buscable. */
	description?: string;
};

// Select buscable genérico (no hay primitivo tipo cmdk en el proyecto): compone
// Popover + Input + una lista filtrada en cliente. Sirve tanto para filtros
// (con `allowClear` para volver a "todos") como para campos de formulario.
export function Combobox({
	value,
	onChange,
	options,
	placeholder = "Selecciona…",
	searchPlaceholder = "Buscar…",
	emptyText = "Sin resultados",
	disabled = false,
	allowClear = false,
	clearLabel = "Todos",
	id,
	ariaInvalid = false,
	className,
}: {
	value: string | undefined;
	onChange: (value: string | undefined) => void;
	options: ComboboxOption[];
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string;
	disabled?: boolean;
	allowClear?: boolean;
	clearLabel?: string;
	id?: string;
	ariaInvalid?: boolean;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const selected = options.find((option) => option.value === value);
	const needle = query.trim().toLowerCase();
	const filtered = needle
		? options.filter(
				(option) =>
					option.label.toLowerCase().includes(needle) ||
					option.description?.toLowerCase().includes(needle),
			)
		: options;

	function select(next: string | undefined) {
		onChange(next);
		setOpen(false);
		setQuery("");
	}

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-invalid={ariaInvalid}
					id={id}
					disabled={disabled}
					className={cn(
						"w-full justify-between font-normal",
						!selected && "text-muted-foreground",
						className,
					)}
				>
					<span className="truncate">
						{selected ? selected.label : placeholder}
					</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-(--radix-popover-trigger-width) p-0"
				align="start"
			>
				<div className="border-b p-2">
					<Input
						autoFocus
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={searchPlaceholder}
						className="h-8"
					/>
				</div>
				<div className="max-h-64 overflow-y-auto p-1">
					{allowClear && (
						<OptionRow selected={!value} onClick={() => select(undefined)}>
							<span className="text-muted-foreground">{clearLabel}</span>
						</OptionRow>
					)}
					{filtered.length === 0 ? (
						<p className="px-2 py-6 text-center text-sm text-muted-foreground">
							{emptyText}
						</p>
					) : (
						filtered.map((option) => (
							<OptionRow
								key={option.value}
								selected={option.value === value}
								onClick={() => select(option.value)}
							>
								<span className="min-w-0 flex-1">
									<span className="block truncate">{option.label}</span>
									{option.description && (
										<span className="block truncate text-xs text-muted-foreground">
											{option.description}
										</span>
									)}
								</span>
								{option.value === value && (
									<Check className="size-4 shrink-0 text-primary" />
								)}
							</OptionRow>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function OptionRow({
	selected,
	onClick,
	children,
}: {
	selected: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent focus-visible:bg-accent",
				selected && "bg-accent/50",
			)}
		>
			{children}
		</button>
	);
}
