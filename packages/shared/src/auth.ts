import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Étend le type de requête Fastify avec l'utilisateur authentifié.
declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string };
  }
}

export interface AuthVerifierOptions {
  /** URL JWKS exposée par le service Auth (plugin JWT de Better-Auth), ex: http://auth:3001/api/auth/jwks */
  jwksUrl: string;
  issuer?: string;
  audience?: string;
}

/**
 * Crée un preHandler Fastify qui exige un JWT Bearer valide.
 * Le JWT est émis par le service Auth (Better-Auth) et vérifié ici via JWKS,
 * sans appel synchrone au service Auth (les services restent stateless).
 * Injecte `req.user = { id }` à partir du `sub` du token.
 */
export function createAuthVerifier(opts: AuthVerifierOptions) {
  const JWKS = createRemoteJWKSet(new URL(opts.jwksUrl));

  return async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return reply
        .code(401)
        .send({ error: "UNAUTHORIZED", message: "Missing bearer token" });
    }

    const token = header.slice("Bearer ".length);
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: opts.issuer,
        audience: opts.audience,
      });
      if (!payload.sub) {
        return reply
          .code(401)
          .send({ error: "UNAUTHORIZED", message: "Token without subject" });
      }
      req.user = { id: payload.sub };
    } catch {
      return reply
        .code(401)
        .send({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
    }
  };
}
