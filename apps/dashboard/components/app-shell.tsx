"use client";

import { Button, PageContainer } from "@fieldos/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { api, type FeedbackType, type UserNotification } from "../lib/api";
import { useActiveOrganizationStore } from "../store/active-organization-store";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/inbox", label: "Inbox" },
  { href: "/action-items", label: "Action Items" },
  { href: "/search", label: "Search" },
  { href: "/admin/operations", label: "Operations" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { activeOrganizationId } = useActiveOrganizationStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 md:block">
        <div className="text-lg font-semibold text-slate-950">FieldOS Dashboard</div>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              }
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200"
          href="/logout"
        >
          Log out
        </Link>
      </aside>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold text-slate-950">FieldOS</div>
          <Link className="text-sm font-medium text-slate-600" href="/logout">
            Log out
          </Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "shrink-0 rounded-md bg-slate-950 px-3 py-2 text-xs font-medium text-white"
                  : "shrink-0 rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700"
              }
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="md:pl-64">
        <PageContainer>{children}</PageContainer>
      </div>
      {activeOrganizationId ? <PilotUtilities organizationId={activeOrganizationId} /> : null}
    </div>
  );
}

function PilotUtilities({ organizationId }: Readonly<{ organizationId: string }>) {
  const pathname = usePathname();
  const [panel, setPanel] = React.useState<"feedback" | "notifications" | null>(null);
  const [type, setType] = React.useState<FeedbackType>("BUG");
  const [message, setMessage] = React.useState("");
  const [notifications, setNotifications] = React.useState<UserNotification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = React.useState(false);
  const [isSendingFeedback, setIsSendingFeedback] = React.useState(false);
  const [feedbackError, setFeedbackError] = React.useState(false);
  const [isMarkingRead, setIsMarkingRead] = React.useState(false);

  const loadNotifications = React.useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const response = await api.listNotifications(organizationId);
      setNotifications(response.notifications);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  async function submitFeedback() {
    setFeedbackError(false);
    setIsSendingFeedback(true);
    try {
      await api.submitFeedback({
        message,
        organizationId,
        page: pathname,
        type
      });
      setMessage("");
      setPanel(null);
      await loadNotifications();
    } catch {
      setFeedbackError(true);
    } finally {
      setIsSendingFeedback(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    setIsMarkingRead(true);
    try {
      await api.markNotificationRead(notificationId);
      await loadNotifications();
    } finally {
      setIsMarkingRead(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {panel === "notifications" ? (
        <div className="w-80 max-w-full rounded-md border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">Notifications</div>
            <button
              className="text-xs font-medium text-slate-500"
              onClick={() => setPanel(null)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {isLoadingNotifications ? (
              <p className="text-sm text-slate-600">Loading updates...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-slate-600">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-md border border-slate-200 p-3 text-sm"
                >
                  <div className="font-medium text-slate-950">{notification.title}</div>
                  {notification.body ? (
                    <p className="mt-1 text-xs text-slate-600">{notification.body}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {notification.href ? (
                      <Link className="text-xs font-medium text-slate-950" href={notification.href}>
                        Open
                      </Link>
                    ) : (
                      <span />
                    )}
                    {!notification.readAt ? (
                      <button
                        className="text-xs font-medium text-slate-500"
                        disabled={isMarkingRead}
                        onClick={() => void markNotificationRead(notification.id)}
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {panel === "feedback" ? (
        <form
          className="w-80 max-w-full rounded-md border border-slate-200 bg-white p-4 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault();
            void submitFeedback();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">Send feedback</div>
            <button
              className="text-xs font-medium text-slate-500"
              onClick={() => setPanel(null)}
              type="button"
            >
              Close
            </button>
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Type
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as FeedbackType)}
            >
              <option value="BUG">Bug</option>
              <option value="FEATURE">Feature</option>
              <option value="GENERAL">General</option>
            </select>
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Message
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-slate-300 p-2 text-sm"
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          {feedbackError ? (
            <p className="mt-2 text-xs text-red-600">
              Feedback could not be sent. Please try again.
            </p>
          ) : null}
          <Button className="mt-3 w-full" disabled={isSendingFeedback} type="submit">
            {isSendingFeedback ? "Sending..." : "Send feedback"}
          </Button>
        </form>
      ) : null}

      <div className="flex gap-2">
        <button
          className="relative rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-sm ring-1 ring-slate-200"
          onClick={() => setPanel(panel === "notifications" ? null : "notifications")}
          type="button"
        >
          Notifications
          {unreadCount > 0 ? (
            <span className="ml-2 rounded-full bg-slate-950 px-2 py-0.5 text-xs text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm"
          onClick={() => setPanel(panel === "feedback" ? null : "feedback")}
          type="button"
        >
          Feedback
        </button>
      </div>
    </div>
  );
}
