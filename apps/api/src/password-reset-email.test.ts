import { describe, expect, it, vi } from "vitest";

import {
  createPasswordResetEmailSender,
  PasswordResetEmailDeliveryError
} from "./password-reset-email.js";

describe("password reset email delivery", () => {
  it("retries transient failures with one idempotency key", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        error: { message: "Too many requests", name: "rate_limit_exceeded", statusCode: 429 }
      })
      .mockResolvedValueOnce({ error: null });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const sender = createPasswordResetEmailSender({
      apiKey: "re_test",
      client: { emails: { send } },
      from: "FieldOS <onboarding@resend.dev>",
      sleep
    });

    await expect(
      sender.send({
        idempotencyKey: "password-reset/token-hash",
        recipient: "founder@example.com",
        resetUrl: "https://fieldos.example/reset-password?token=secret"
      })
    ).resolves.toBe("SENT");

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: "password-reset/token-hash"
    });
    expect(send.mock.calls[1]?.[1]).toEqual({
      idempotencyKey: "password-reset/token-hash"
    });
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("does not retry permanent provider errors", async () => {
    const send = vi.fn().mockResolvedValue({
      error: { message: "Invalid sender", name: "invalid_from_address", statusCode: 400 }
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const sender = createPasswordResetEmailSender({
      apiKey: "re_test",
      client: { emails: { send } },
      from: "FieldOS <invalid@example.com>",
      sleep
    });

    await expect(
      sender.send({
        idempotencyKey: "password-reset/token-hash",
        recipient: "founder@example.com",
        resetUrl: "https://fieldos.example/reset-password?token=secret"
      })
    ).rejects.toEqual(new PasswordResetEmailDeliveryError("invalid_from_address", 400));

    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
