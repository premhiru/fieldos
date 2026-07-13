import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

export const AUTH_COOKIE_NAME = "fieldos_session";

export const sessionDurationSeconds = 60 * 60 * 24 * 7;
export const passwordResetDurationMs = 60 * 60 * 1000;

export const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"]
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
  token: z.string().min(32).max(256)
});

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  sessionVersion: number;
}

export interface AuthSession {
  user: AuthenticatedUser;
  expiresAt: Date;
}

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  requireSession(): Promise<AuthSession>;
}

export interface SessionTokenPayload {
  sub: string;
  email: string;
  name: string;
  sessionVersion: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signSessionToken(user: AuthenticatedUser, secret: string): string {
  return jwt.sign(
    {
      email: user.email,
      name: user.name,
      sessionVersion: user.sessionVersion
    },
    secret,
    {
      expiresIn: sessionDurationSeconds,
      subject: user.id
    }
  );
}

export function verifySessionToken(token: string, secret: string): SessionTokenPayload {
  const payload = jwt.verify(token, secret);

  if (!isSessionTokenPayload(payload)) {
    throw new Error("Invalid session token payload.");
  }

  return payload;
}

function isSessionTokenPayload(payload: unknown): payload is SessionTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "sub" in payload &&
    "email" in payload &&
    "name" in payload &&
    "sessionVersion" in payload &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    typeof payload.name === "string" &&
    typeof payload.sessionVersion === "number"
  );
}
