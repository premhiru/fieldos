import { expect, test } from "@playwright/test";

test("renders the Caladrona login shell", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Log in to Caladrona" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("renders WhatsApp recommendation settings and the project People directory", async ({
  page
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/auth/me"
        ? { user: { email: "owner@example.com", id: "user-1", name: "Project Owner" } }
        : path === "/api/organizations"
          ? {
              organizations: [
                {
                  id: "org-1",
                  membershipId: "membership-1",
                  name: "Caladrona Test",
                  role: "OWNER",
                  slug: "fieldos-test"
                }
              ]
            }
          : path === "/api/projects/project-1"
            ? {
                project: {
                  code: "TEST-01",
                  id: "project-1",
                  name: "Test Project",
                  organizationId: "org-1",
                  status: "ACTIVE",
                  timezone: "Asia/Singapore"
                }
              }
            : path === "/api/projects/project-1/whatsapp-recommendation-settings"
              ? { setting: null }
              : path === "/api/projects/project-1/people"
                ? {
                    people: [
                      {
                        id: "participant-1",
                        lastSeenAt: "2026-08-07T00:00:00.000Z",
                        participantStatus: "ACTIVE",
                        person: {
                          company: null,
                          displayName: "Site Supervisor",
                          id: "person-1",
                          identities: [
                            {
                              displayName: null,
                              groupParticipants: [
                                { isGroupAdmin: false, participantStatus: "ACTIVE" }
                              ],
                              id: "identity-1",
                              lastSeenAt: "2026-08-07T00:00:00.000Z",
                              phoneNumber: "6590000000",
                              pushName: "Site Supervisor",
                              verificationStatus: "OBSERVED"
                            }
                          ],
                          identityReviews: [
                            {
                              id: "review-1",
                              personIdentityId: "identity-1",
                              reason: "MANUAL_REVIEW",
                              status: "PENDING"
                            }
                          ],
                          phoneNumber: "6590000000",
                          roleTitle: null,
                          status: "ACTIVE",
                          type: "UNKNOWN",
                          userId: null,
                          whatsAppInvitations: []
                        },
                        role: null
                      }
                    ]
                  }
                : path === "/api/notifications"
                  ? { notifications: [] }
                  : {};
    await route.fulfill({ body: JSON.stringify(body), contentType: "application/json" });
  });

  const response = await page.goto("/projects/project-1/people", {
    waitUntil: "domcontentloaded"
  });
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: / People$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "WhatsApp recommendations" })).toBeVisible();
  await expect(page.getByLabel("Enable delivery")).toBeVisible();
  await expect(page.getByLabel("Routing mode")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
  await expect(page.getByText("+6590000000")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm identity" })).toBeVisible();
});
