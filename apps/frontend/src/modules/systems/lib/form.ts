import { useForm } from "@tanstack/react-form";
import type { z } from "zod";
import type {
	CreateSystemInput,
	System,
	UpdateSystemInput,
} from "../shared/types.ts";
import { systemFormSchema } from "./validation.ts";

// Forma de los formularios de sistema (creación y edición). Todos los campos
// están siempre presentes en el form (los opcionales arrancan vacíos y se
// depuran antes de enviar), así que ambos se validan con `systemFormSchema`.
export type SystemFormValues = z.infer<typeof systemFormSchema>;

export const systemFormDefaults: SystemFormValues = {
	name: "",
	slug: "",
	description: "",
	active: true,
};

// Deriva un slug válido (minúsculas, números y guiones) a partir de un texto
// libre: quita acentos, pasa a minúsculas, sustituye lo no permitido por
// guiones y colapsa/recorta los guiones sobrantes. Mismo alfabeto que valida el
// IS (/^[a-z0-9-]+$/).
export function slugify(value: string): string {
	return (
		value
			.normalize("NFD")
			// Elimina los diacríticos combinantes (U+0300–U+036F) que NFD separa de
			// su letra base, para que "señor" → "senor" y no "sen-or".
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.replace(/-{2,}/g, "-")
	);
}

// Hook del formulario de creación: defaults vacíos + validación cliente.
export function useCreateSystemForm(
	onSubmit: (value: SystemFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues: systemFormDefaults,
		validators: {
			onSubmit: systemFormSchema,
			onChange: systemFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

// Valores iniciales de la edición a partir del sistema del IS (null → "").
export function systemToFormValues(system: System): SystemFormValues {
	return {
		name: system.name,
		slug: system.slug,
		description: system.description ?? "",
		active: system.active,
	};
}

// Hook del formulario de edición: misma forma y validación que la creación,
// pero partiendo de los valores actuales del sistema.
export function useEditSystemForm(
	defaultValues: SystemFormValues,
	onSubmit: (value: SystemFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues,
		validators: {
			onSubmit: systemFormSchema,
			onChange: systemFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type CreateSystemFormApi = ReturnType<typeof useCreateSystemForm>;
export type EditSystemFormApi = ReturnType<typeof useEditSystemForm>;
export type SystemFormApi = CreateSystemFormApi | EditSystemFormApi;

// Cuerpo del POST/PATCH: omite la descripción vacía para no persistir "" y deja
// el resto de campos tal cual (name/slug obligatorios, active siempre presente).
export function toSystemPayload(
	value: SystemFormValues,
): CreateSystemInput & UpdateSystemInput {
	const { name, slug, description, active } = value;
	return {
		name,
		slug,
		active,
		...(description ? { description } : {}),
	};
}
