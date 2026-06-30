"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Organization settings coming soon.</p>
          </CardContent>
        </Card>
      </AppShell>
    </AuthGuard>
  );
}
