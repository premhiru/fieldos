"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle, PageContainer } from "@fieldos/ui";

import { useStatusStore } from "../store/status-store";

const statuses = [
  { key: "api", label: "API Status" },
  { key: "database", label: "Database Status" },
  { key: "worker", label: "Worker Status" }
] as const;

export default function HomePage() {
  const serviceStatus = useStatusStore();

  return (
    <PageContainer className="min-h-screen">
      <section className="flex flex-col gap-8">
        <div className="space-y-3">
          <Badge variant="muted">Engineering Foundation</Badge>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950">FieldOS</h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">Engineering Foundation</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {statuses.map((item) => (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle>{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="warning">{serviceStatus[item.key]}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
