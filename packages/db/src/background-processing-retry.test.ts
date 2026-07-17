import { describe, expect, it, vi } from "vitest";

import {
  queueProcessingJob,
  retryFailedProcessingJobs,
  retryProcessingJob
} from "./background-processing.js";

describe("processing job retries", () => {
  it("resets attempts when an existing job is explicitly queued again", async () => {
    const prisma = {
      processingJob: {
        upsert: vi.fn().mockResolvedValue({ id: "job_1" })
      }
    };

    await queueProcessingJob(prisma as never, {
      organizationId: "org_1",
      sourceId: "classification_1",
      sourceType: "AI_MESSAGE_CLASSIFICATION",
      type: "AI_CLASSIFICATION"
    });

    expect(prisma.processingJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          attempts: 0,
          startedAt: null,
          status: "PENDING"
        })
      })
    );
  });

  it("resets attempts when retrying one failed job", async () => {
    const prisma = {
      processingJob: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "job_1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    await retryProcessingJob(prisma as never, "job_1");

    expect(prisma.processingJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: 0, status: "PENDING" })
      })
    );
  });

  it("resets attempts when retrying an organization's failed jobs", async () => {
    const prisma = {
      processingJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 })
      }
    };

    await expect(retryFailedProcessingJobs(prisma as never, "org_1")).resolves.toBe(3);
    expect(prisma.processingJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: 0, status: "PENDING" })
      })
    );
  });
});
