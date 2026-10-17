// Sérialisation figée et identité par hash — copie de graduis-wizard `src/core/json.ts` (décision du 17/10, A-2).
import { createHash } from "node:crypto";

/** `JSON.stringify(obj, null, 2) + "\n"` ≡ `json.dumps(obj, ensure_ascii=False, indent=2) + "\n"` (entiers seuls). */
export function stringify2(obj: unknown): string {
  return JSON.stringify(obj, null, 2) + "\n";
}

export function sha256(octets: Uint8Array | string): string {
  return "sha256:" + createHash("sha256").update(octets).digest("hex");
}
