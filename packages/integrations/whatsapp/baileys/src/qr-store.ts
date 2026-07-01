import { Redis } from "ioredis";

export interface WhatsAppQrStore {
  get(accountId: string): Promise<string | null>;
  remove(accountId: string): Promise<void>;
  set(accountId: string, qrCode: string): Promise<void>;
}

export class RedisWhatsAppQrStore implements WhatsAppQrStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 180
  ) {}

  async get(accountId: string): Promise<string | null> {
    return this.redis.get(getQrKey(accountId));
  }

  async remove(accountId: string): Promise<void> {
    await this.redis.del(getQrKey(accountId));
  }

  async set(accountId: string, qrCode: string): Promise<void> {
    await this.redis.set(getQrKey(accountId), qrCode, "EX", this.ttlSeconds);
  }
}

export function getQrKey(accountId: string): string {
  return `fieldos:whatsapp:qr:${accountId}`;
}
