import { afterEach, describe, expect, it, vi } from "vitest";

import { queueProjectCoordinatorJobs } from "./background-processing.js";

const now = new Date("2026-07-16T08:00:00.000Z");

describe("project coordinator job queueing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces lightweight and milestone jobs independently", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const recentLightweightJob = createJob("PROJECT_COORDINATOR");
    const prisma = {
      processingJob: {
        findFirst: vi
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(where.type === "PROJECT_COORDINATOR" ? recentLightweightJob : null)
          ),
        upsert: vi.fn().mockResolvedValue(createJob("PROJECT_COORDINATOR_MILESTONE"))
      }
    };

    const queued = await queueProjectCoordinatorJobs(prisma as never, {
      organizationId: "org_1",
      projectId: "project_1",
      sourceId: "project_1"
    });

    expect(queued).toBe(1);
    expect(prisma.processingJob.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.processingJob.upsert).toHaveBeenCalledOnce();
    expect(prisma.processingJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ type: "PROJECT_COORDINATOR_MILESTONE" })
      })
    );
  });

  it("queues both coordinator job types when the debounce window is clear", async () => {
    const prisma = {
      processingJob: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(createJob(create.type)))
      }
    };

    const queued = await queueProjectCoordinatorJobs(prisma as never, {
      organizationId: "org_1",
      projectId: "project_1",
      sourceId: "project_1"
    });

    expect(queued).toBe(2);
    expect(prisma.processingJob.upsert).toHaveBeenCalledTimes(2);
  });

  it("debounces a requeued job whose original creation time is outside the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const requeuedJob = {
      ...createJob("PROJECT_COORDINATOR"),
      createdAt: new Date("2026-07-15T08:00:00.000Z"),
      updatedAt: new Date("2026-07-16T07:55:00.000Z")
    };
    const prisma = {
      processingJob: {
        findFirst: vi.fn().mockResolvedValue(requeuedJob),
        upsert: vi.fn()
      }
    };

    await queueProjectCoordinatorJobs(prisma as never, {
      organizationId: "org_1",
      projectId: "project_1",
      sourceId: "project_1"
    });

    expect(prisma.processingJob.upsert).not.toHaveBeenCalled();
  });
});

function createJob(type: "PROJECT_COORDINATOR" | "PROJECT_COORDINATOR_MILESTONE") {
  return {
    attempts: 0,
    completedAt: null,
    correlationId: "correlation_1",
    createdAt: now,
    errorMessage: null,
    failedAt: null,
    id: `job_${type}`,
    maxAttempts: 3,
    nextRunAt: null,
    organizationId: "org_1",
    projectId: "project_1",
    sourceId: "project_1",
    sourceType: "PROJECT",
    startedAt: null,
    status: "PENDING",
    type,
    updatedAt: now
  };
}
