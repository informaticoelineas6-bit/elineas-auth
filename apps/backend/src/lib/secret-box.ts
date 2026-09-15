import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@backend/config/env.ts";

// Cifrado simétrico autenticado para los secretos que el IS tiene que poder
// DEVOLVER en claro, no solo verificar: hoy, las credenciales de TKC (ver
// `tkc_key` en db/business-schema.ts).
//
// Nada que ver con las contraseñas del propio IS: esas se hashean con
// `hashPassword` de better-auth y jamás se recuperan. Aquí el requisito es el
// opuesto —el sistema externo necesita la contraseña literal—, así que un hash
// no sirve y la única protección posible es el cifrado con una clave que NO
// viva en la base de datos. El modelo de amenaza que cubre es el realista: un
// volcado de la BD (backup, réplica, acceso de solo lectura, fuga del fichero)
// no entrega ninguna credencial de TKC. No protege frente a alguien que ya
// controle el proceso del servidor, donde la clave está en memoria por
// definición.
//
// AES-256-GCM y no AES-CBC: GCM es cifrado AUTENTICADO (AEAD). Sin la etiqueta
// de autenticación, cualquiera con acceso de escritura a la BD podría manipular
// el texto cifrado y el servidor descifraría basura sin enterarse; con GCM, un
// texto alterado falla al descifrar en vez de colarse.
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
// 96 bits es el tamaño de IV recomendado para GCM: es el que el modo usa de
// forma nativa, sin la derivación extra (GHASH) que aplica a cualquier otra
// longitud.
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Prefijo de versión del formato. Va DENTRO del valor almacenado para que una
// futura rotación de algoritmo o de clave pueda convivir con las filas
// antiguas: el descifrado mira el prefijo y sabe cómo leerlas. Sin él, cambiar
// de esquema obligaría a migrar todas las filas de golpe.
const VERSION = "v1";

class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

// La clave se resuelve de forma PEREZOSA y se memoiza, no al importar el
// módulo. Así, un despliegue sin TKC_SECRET_KEY arranca y sirve todo lo demás
// con normalidad, y solo falla —con un mensaje que dice exactamente qué
// falta— quien intente usar credenciales TKC. Validarla en config/env.ts
// convertiría una función opcional en un requisito de arranque para todos.
let cachedKey: Buffer | null = null;

function secretKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = env.TKC_SECRET_KEY;
  if (!raw) {
    throw new SecretBoxError(
      "Falta TKC_SECRET_KEY en el entorno: sin ella no se pueden cifrar ni " +
        "descifrar las credenciales de TKC. Genera una con " +
        "`openssl rand -base64 32`.",
    );
  }

  // base64 (32 bytes = 44 caracteres) o hex (64 caracteres). Se acepta lo que
  // produzca `openssl rand -base64 32` o `-hex 32` sin más ceremonia.
  const key =
    raw.length === KEY_BYTES * 2 && /^[0-9a-f]+$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");

  if (key.length !== KEY_BYTES) {
    throw new SecretBoxError(
      `TKC_SECRET_KEY debe codificar ${KEY_BYTES} bytes (base64 o hex); ` +
        `la actual decodifica ${key.length}. Genera una con ` +
        "`openssl rand -base64 32`.",
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Cifra un secreto. Devuelve "v1.<iv>.<tag>.<ciphertext>" en base64url, listo
 * para guardarse en una columna `text`.
 *
 * El IV es aleatorio en CADA llamada: reutilizar un IV con la misma clave
 * rompe GCM por completo (revela el XOR de los textos y permite falsificar
 * etiquetas), así que nunca debe derivarse del dato ni de un contador.
 */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Descifra lo que produjo `sealSecret`. Lanza si el valor está manipulado, si
 * se cifró con otra clave o si el formato no se reconoce — nunca devuelve un
 * resultado dudoso.
 */
export function openSecret(sealed: string): string {
  const parts = sealed.split(".");
  const [version, ivPart, tagPart, ciphertextPart] = parts;
  if (
    parts.length !== 4 ||
    version !== VERSION ||
    ivPart === undefined ||
    tagPart === undefined ||
    ciphertextPart === undefined
  ) {
    throw new SecretBoxError(
      "El secreto almacenado no tiene un formato reconocible",
    );
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretBoxError(
      "El secreto almacenado no tiene un formato reconocible",
    );
  }

  const decipher = createDecipheriv(ALGORITHM, secretKey(), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // `final()` lanza cuando la etiqueta no cuadra: o el texto cifrado se
    // manipuló, o la clave no es la que lo cifró. No se distingue a propósito
    // (el mensaje no debe servir de oráculo) ni se incluye el error original,
    // que podría acabar en un log junto al valor.
    throw new SecretBoxError(
      "No se pudo descifrar el secreto: está alterado o cifrado con otra clave",
    );
  }
}

/** ¿Está TKC_SECRET_KEY configurada y es válida? Para el aviso de arranque. */
export function isSecretBoxConfigured(): boolean {
  try {
    secretKey();
    return true;
  } catch {
    return false;
  }
}

// Comparación en tiempo constante de dos cadenas cortas. La usa el servicio de
// TKC para decidir si una contraseña cambió realmente sin que el tiempo de
// respuesta filtre cuánto se parecen las dos.
export function secretsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
