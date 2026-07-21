import { expect, test } from "@playwright/test";

test("renders the FieldOS login shell", async ({ page }) => {
  const response = await page.goto("/login");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Log in to FieldOS" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});
