import { m } from "@tartan/i18n";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError(401, "unauthorized", m.errors.unauthorized);
export const forbidden = () => new AppError(403, "forbidden", m.errors.forbidden);
export const notFound = () => new AppError(404, "not_found", m.errors.notFound);
export const invalid = (message: string = m.errors.invalid) => new AppError(400, "invalid", message);
export const consentRequired = () => new AppError(409, "consent_required", m.errors.consentRequired);
