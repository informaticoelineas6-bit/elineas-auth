// `ogl` es una dependencia pesada y solo se usa en cliente (WebGL). Importamos
// únicamente sus tipos de forma estática (se borran al compilar, no entran al
// bundle) y cargamos el runtime con `import("ogl")` cuando el efecto arranca,
// así se parte en su propio chunk y no lastra el bundle inicial del login.
import type { Renderer } from "ogl";
import { useEffect, useRef, useState } from "react";

// Fondo puramente decorativo: DPR 1 basta (DPR 2 = 4× píxeles a sombrear) y
// 30fps es imperceptible en una animación ambiental lenta, con ~½ de coste.
const RENDER_DPR = 1;
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

type Origin =
	| "top-right"
	| "top-left"
	| "bottom-right"
	| "bottom-left"
	| "top-center"
	| "bottom-center";

// Cada "fuente" es un abanico de rayos (origen + inclinación). Varias fuentes se
// dibujan en UN solo contexto WebGL (un mesh por fuente, compuestos con
// alpha-blending), en vez de montar un <SideRays> —y por tanto un contexto GL y
// un bucle rAF— por cada abanico.
type RaySource = { origin?: Origin; tilt?: number };

interface SideRaysProps {
	speed?: number;
	rayColor1?: string;
	rayColor2?: string;
	intensity?: number;
	spread?: number;
	origin?: Origin;
	tilt?: number;
	// Varias fuentes en un único contexto. Si se omite, se usa una sola fuente a
	// partir de `origin`/`tilt` (comportamiento retrocompatible).
	sources?: RaySource[];
	saturation?: number;
	blend?: number;
	falloff?: number;
	opacity?: number;
	className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return m
		? [
				parseInt(m[1], 16) / 255,
				parseInt(m[2], 16) / 255,
				parseInt(m[3], 16) / 255,
			]
		: [1, 1, 1];
};

const QUARTER_PI = Math.PI / 4;
const HALF_PI = Math.PI / 2;

// Posición de la fuente (fracción de la resolución, en el espacio `coord` del
// shader donde y=0 es arriba) y ángulo base del abanico de rayos, en radianes.
// Las cuatro esquinas reproducen exactamente el comportamiento anterior basado
// en volteo (reflejar la escena top-right equivale a reflejar fuente y ángulo).
type OriginParams = { sourcePos: [number, number]; baseAngle: number };

const originToParams = (origin: Origin): OriginParams => {
	switch (origin) {
		case "top-left":
			return { sourcePos: [-0.1, -0.5], baseAngle: Math.PI - QUARTER_PI };
		case "bottom-right":
			return { sourcePos: [1.1, 1.5], baseAngle: -QUARTER_PI };
		case "bottom-left":
			return { sourcePos: [-0.1, 1.5], baseAngle: Math.PI + QUARTER_PI };
		case "top-center":
			return { sourcePos: [0.5, -0.5], baseAngle: HALF_PI };
		case "bottom-center":
			return { sourcePos: [0.5, 1.5], baseAngle: -HALF_PI };
		default:
			return { sourcePos: [1.1, -0.5], baseAngle: QUARTER_PI };
	}
};

type LayerUniforms = Record<string, { value: number | number[] }>;

const SideRays = ({
	speed = 2.5,
	rayColor1 = "#EAB308",
	rayColor2 = "#96c8ff",
	intensity = 2,
	spread = 2,
	origin = "top-right",
	tilt = 0,
	sources,
	saturation = 1.5,
	blend = 0.75,
	falloff = 2.0,
	opacity = 1.0,
	className = "",
}: SideRaysProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	// Una entrada de uniforms por fuente (abanico). Todas comparten contexto GL.
	const uniformsListRef = useRef<LayerUniforms[] | null>(null);
	const rendererRef = useRef<Renderer | null>(null);
	const animationIdRef = useRef<number | null>(null);
	const sceneRef = useRef<{ setParent?: unknown } | null>(null);
	const cleanupFunctionRef = useRef<(() => void) | null>(null);
	const [isVisible, setIsVisible] = useState(false);
	const observerRef = useRef<IntersectionObserver | null>(null);

	// Lista efectiva de fuentes: la prop `sources`, o una única a partir de
	// origin/tilt. Se normaliza aquí para que init y el efecto de uniforms usen
	// la misma forma.
	const raySources: Required<RaySource>[] = (
		sources && sources.length > 0 ? sources : [{ origin, tilt }]
	).map((s) => ({ origin: s.origin ?? origin, tilt: s.tilt ?? tilt }));

	useEffect(() => {
		if (!containerRef.current) return;

		observerRef.current = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				setIsVisible(entry.isIntersecting);
			},
			{ threshold: 0.1 },
		);

		observerRef.current.observe(containerRef.current);

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
				observerRef.current = null;
			}
		};
	}, []);

	// Solo (re)inicializamos el contexto WebGL al cambiar la visibilidad o el
	// número de fuentes (que define cuántos meshes crear). Las props numéricas se
	// leen al arrancar y se actualizan en caliente en el efecto de más abajo, sin
	// destruir ni recrear el contexto GL en cada cambio de prop.
	// biome-ignore lint/correctness/useExhaustiveDependencies: init depende de isVisible y del nº de fuentes; el resto de props se sincroniza vía el efecto de uniforms.
	useEffect(() => {
		if (!isVisible || !containerRef.current) return;

		if (cleanupFunctionRef.current) {
			cleanupFunctionRef.current();
			cleanupFunctionRef.current = null;
		}

		const initializeWebGL = async () => {
			if (!containerRef.current) return;

			await new Promise<void>((resolve) => setTimeout(resolve, 10));

			if (!containerRef.current) return;

			// Carga diferida: el chunk de `ogl` solo se descarga al llegar aquí
			// (componente visible, en cliente), no en el bundle inicial.
			const { Mesh, Program, Renderer, Transform, Triangle } = await import(
				"ogl"
			);

			if (!containerRef.current) return;

			const renderer = new Renderer({
				dpr: RENDER_DPR,
				alpha: true,
			});
			rendererRef.current = renderer;

			const gl = renderer.gl;
			gl.canvas.style.width = "100%";
			gl.canvas.style.height = "100%";

			while (containerRef.current.firstChild) {
				containerRef.current.removeChild(containerRef.current.firstChild);
			}
			containerRef.current.appendChild(gl.canvas);

			const vert = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

			const frag = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform vec2 iSourcePos;
uniform float iBaseAngle;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = iSourcePos * iResolution;

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(iBaseAngle + halfSpread), sin(iBaseAngle + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(iBaseAngle - halfSpread), sin(iBaseAngle - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

			// Escena con un mesh por fuente. `transparent: true` activa el
			// alpha-blending source-over de ogl, así que apilar los meshes en el
			// mismo canvas equivale a apilar los canvas translúcidos de antes.
			const scene = new Transform();
			const geometry = new Triangle(gl);
			const uniformsList: LayerUniforms[] = [];

			for (const src of raySources) {
				const { sourcePos, baseAngle } = originToParams(src.origin);
				const uniforms: LayerUniforms = {
					iTime: { value: 0 },
					iResolution: { value: [1, 1] as number[] },
					iSpeed: { value: speed },
					iRayColor1: { value: hexToRgb(rayColor1) as number[] },
					iRayColor2: { value: hexToRgb(rayColor2) as number[] },
					iIntensity: { value: intensity },
					iSpread: { value: spread },
					iSourcePos: { value: sourcePos as number[] },
					iBaseAngle: { value: baseAngle },
					iTilt: { value: src.tilt },
					iSaturation: { value: saturation },
					iBlend: { value: blend },
					iFalloff: { value: falloff },
					iOpacity: { value: opacity },
				};
				uniformsList.push(uniforms);

				const program = new Program(gl, {
					vertex: vert,
					fragment: frag,
					uniforms,
					transparent: true,
				});
				const mesh = new Mesh(gl, { geometry, program });
				mesh.setParent(scene);
			}

			uniformsListRef.current = uniformsList;
			sceneRef.current = scene as unknown as { setParent?: unknown };

			const updateSize = () => {
				if (!containerRef.current || !renderer) return;
				renderer.dpr = RENDER_DPR;
				const { clientWidth: w, clientHeight: h } = containerRef.current;
				renderer.setSize(w, h);
				const resolution = [w * renderer.dpr, h * renderer.dpr];
				for (const u of uniformsList) u.iResolution.value = resolution;
			};

			// El resize llega en ráfagas al arrastrar la ventana; se coalesce en un
			// único recálculo por frame con requestAnimationFrame.
			let resizeRaf: number | null = null;
			const onResize = () => {
				if (resizeRaf !== null) return;
				resizeRaf = requestAnimationFrame(() => {
					resizeRaf = null;
					updateSize();
				});
			};

			const renderFrame = (timeSeconds: number) => {
				for (const u of uniformsList) u.iTime.value = timeSeconds;
				// sort: false → los meshes se dibujan en orden de inserción (la fuente
				// 0 debajo, la última encima), reproduciendo el apilado de los canvas.
				renderer.render({ scene, sort: false });
			};

			// Respeta prefers-reduced-motion: un solo frame estático, sin bucle.
			const prefersReducedMotion =
				typeof window.matchMedia === "function" &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches;

			let lastFrameMs = -Infinity;
			const loop = (t: number) => {
				if (!rendererRef.current || !uniformsListRef.current) return;
				// Throttle a TARGET_FPS: solo renderizamos cuando pasó el intervalo.
				if (t - lastFrameMs >= FRAME_INTERVAL_MS) {
					lastFrameMs = t;
					try {
						renderFrame(t * 0.001);
					} catch {
						return;
					}
				}
				animationIdRef.current = requestAnimationFrame(loop);
			};

			window.addEventListener("resize", onResize);
			updateSize();
			if (prefersReducedMotion) {
				renderFrame(0);
			} else {
				animationIdRef.current = requestAnimationFrame(loop);
			}

			cleanupFunctionRef.current = () => {
				if (animationIdRef.current) {
					cancelAnimationFrame(animationIdRef.current);
					animationIdRef.current = null;
				}
				if (resizeRaf !== null) {
					cancelAnimationFrame(resizeRaf);
					resizeRaf = null;
				}
				window.removeEventListener("resize", onResize);
				if (renderer) {
					try {
						const loseCtx = renderer.gl.getExtension("WEBGL_lose_context");
						if (loseCtx) loseCtx.loseContext();
						const canvas = renderer.gl.canvas;
						if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
					} catch {}
				}
				rendererRef.current = null;
				uniformsListRef.current = null;
				sceneRef.current = null;
			};
		};

		initializeWebGL();

		return () => {
			if (cleanupFunctionRef.current) {
				cleanupFunctionRef.current();
				cleanupFunctionRef.current = null;
			}
		};
	}, [isVisible, raySources.length]);

	useEffect(() => {
		if (!uniformsListRef.current) return;
		for (let i = 0; i < uniformsListRef.current.length; i++) {
			const u = uniformsListRef.current[i];
			const src = raySources[i] ?? raySources[0];
			u.iSpeed.value = speed;
			u.iRayColor1.value = hexToRgb(rayColor1);
			u.iRayColor2.value = hexToRgb(rayColor2);
			u.iIntensity.value = intensity;
			u.iSpread.value = spread;
			const { sourcePos, baseAngle } = originToParams(src.origin);
			u.iSourcePos.value = sourcePos;
			u.iBaseAngle.value = baseAngle;
			u.iTilt.value = src.tilt;
			u.iSaturation.value = saturation;
			u.iBlend.value = blend;
			u.iFalloff.value = falloff;
			u.iOpacity.value = opacity;
		}
	}, [
		speed,
		rayColor1,
		rayColor2,
		intensity,
		spread,
		raySources,
		saturation,
		blend,
		falloff,
		opacity,
	]);

	return (
		<div
			ref={containerRef}
			className={`relative w-full h-full overflow-hidden pointer-events-none z-3 ${className}`.trim()}
		/>
	);
};

export default SideRays;
