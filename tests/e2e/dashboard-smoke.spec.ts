import { expect, test } from "@playwright/test";

test("renders the FieldOS login shell", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Log in to FieldOS" })).toBeVisible();
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
                  name: "FieldOS Test",
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
                ? { people: [] }
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
});
