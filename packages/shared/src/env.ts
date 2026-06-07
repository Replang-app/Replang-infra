import { z } from "zod";

/**
 * Valide `process.env` contre un schéma Zod et renvoie un objet typé.
 * En cas d'erreur, log lisible + arrêt du process (fail-fast au boot).
 */
export function loadEnv<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Variables d'environnement invalides :");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export { z };
