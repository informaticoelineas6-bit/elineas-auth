// Parseo ligero del User-Agent para mostrar "navegador · sistema" de forma
// legible. No pretende ser exhaustivo (no merece una dependencia): cubre los
// navegadores y sistemas habituales y cae a "Desconocido" si no reconoce nada.
export type ParsedUserAgent = {
	browser: string;
	os: string;
	/** "navegador · sistema", o solo lo reconocido. */
	label: string;
};

function detectBrowser(ua: string): string {
	// El orden importa: Edge/Opera/Brave se identifican antes que Chrome porque
	// también incluyen "Chrome" en su cadena.
	if (/\bEdg(e|A|iOS)?\//.test(ua)) return "Edge";
	if (/\bOPR\/|\bOpera\//.test(ua)) return "Opera";
	if (/\bBrave\//.test(ua)) return "Brave";
	if (/\bFirefox\/|\bFxiOS\//.test(ua)) return "Firefox";
	if (/\bChrome\/|\bCriOS\//.test(ua)) return "Chrome";
	// Safari no incluye "Chrome" ni "Chromium".
	if (/\bSafari\//.test(ua) && !/\bChrom(e|ium)\//.test(ua)) return "Safari";
	return "";
}

function detectOs(ua: string): string {
	if (/\bWindows NT\b/.test(ua)) return "Windows";
	if (/\biPhone\b/.test(ua)) return "iPhone";
	if (/\biPad\b/.test(ua)) return "iPad";
	if (/\bAndroid\b/.test(ua)) return "Android";
	if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) return "macOS";
	if (/\bLinux\b/.test(ua)) return "Linux";
	return "";
}

export function parseUserAgent(
	userAgent: string | null | undefined,
): ParsedUserAgent {
	if (!userAgent) {
		return { browser: "", os: "", label: "Dispositivo desconocido" };
	}
	const browser = detectBrowser(userAgent);
	const os = detectOs(userAgent);
	const label = [browser, os].filter(Boolean).join(" · ");
	return { browser, os, label: label || "Dispositivo desconocido" };
}
