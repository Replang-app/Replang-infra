/** Erreur applicative avec code HTTP — à mapper dans un error handler Fastify. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (m = "Bad request") => new AppError(400, m, "BAD_REQUEST");
export const unauthorized = (m = "Unauthorized") => new AppError(401, m, "UNAUTHORIZED");
export const forbidden = (m = "Forbidden") => new AppError(403, m, "FORBIDDEN");
export const notFound = (m = "Not found") => new AppError(404, m, "NOT_FOUND");
export const conflict = (m = "Conflict") => new AppError(409, m, "CONFLICT");
export const serviceUnavailable = (m = "Service unavailable") =>
  new AppError(503, m, "SERVICE_UNAVAILABLE");
