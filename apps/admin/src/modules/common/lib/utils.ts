import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StrengthResult } from "../shared/types";
import { passwordSchema } from "./validation";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function checkStrength(password: string): StrengthResult {
	const parse = passwordSchema.safeParse(password);

	const errors = parse.success ? [] : parse.error.issues.map((i) => i.message);

	let score = 0;

	// Puntuación basada en criterios del esquema
	if (password.length >= 12) score++;
	if (password.length >= 20) score++; // bonus por longitud extra
	if (/[A-Z]/.test(password)) score++;
	if (/[a-z]/.test(password)) score++;
	if (/[^A-Za-z0-9]/.test(password)) score++;

	// Normalizar a 0–4
	score = Math.min(4, Math.floor((score * 4) / 5));

	const levels: Record<
		number,
		{ label: string; color: string; width: string }
	> = {
		0: { label: "Muy débil", color: "bg-red-500", width: "20%" },
		1: { label: "Débil", color: "bg-orange-500", width: "40%" },
		2: { label: "Regular", color: "bg-yellow-500", width: "60%" },
		3: { label: "Fuerte", color: "bg-emerald-500", width: "80%" },
		4: { label: "Muy fuerte", color: "bg-green-600", width: "100%" },
	};

	return {
		valid: parse.success,
		score,
		...levels[score],
		errors,
	};
}

// ─── Generador que cumple el esquema ────────────────────────────────

export function generateSecurePassword(length = 16): string {
	// Clamp entre 12 y 128
	const clampedLength = Math.max(12, Math.min(128, length));

	const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const lower = "abcdefghijklmnopqrstuvwxyz";
	const numbers = "0123456789";
	const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
	const all = upper + lower + numbers + symbols;

	let password = "";
	// Garantizar al menos uno de cada tipo requerido por el esquema
	password += upper[Math.floor(Math.random() * upper.length)];
	password += lower[Math.floor(Math.random() * lower.length)];
	password += symbols[Math.floor(Math.random() * symbols.length)];

	// Rellenar el resto con cualquier carácter permitido
	for (let i = 3; i < clampedLength; i++) {
		password += all[Math.floor(Math.random() * all.length)];
	}

	// Mezclar para que los caracteres obligatorios no estén siempre al inicio
	return password
		.split("")
		.sort(() => Math.random() - 0.5)
		.join("");
}

// ─── Validación directa (helper) ────────────────────────────────────

export function isValidPassword(password: string): boolean {
	return passwordSchema.safeParse(password).success;
}
