"use client";

import { BrandLockup, Button, PageContainer, Skeleton } from "@fieldos/ui";
import {
  Bell,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { api, type FeedbackType, type UserNotification } from "../lib/api";
import { useActiveOrganizationStore } from "../store/active-organization-store";

interface NavigationItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

const primaryNavigation: NavigationItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/reports", icon: FileText, label: "Reports" }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeOrganizationId } = useActiveOrganizationStore();

  React.useEffect(() => {
    function openSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/search");
      }
    }

    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[var(--border-default)] bg-[var(--surface)] px-4 py-5 md:flex md:flex-col">
        <Link
          className="rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          href="/"
        >
          <BrandLockup />
        </Link>
        <nav aria-label="Primary navigation" className="mt-8 flex flex-col gap-1">
          {primaryNavigation.map((item) => (
            <NavigationLink item={item} key={item.href} pathname={pathname} />
          ))}
        </nav>
        <div className="mt-7 border-t border-slate-200 pt-5">
          <div className="px-3 text-xs font-semibold uppercase text-slate-400">Settings</div>
          <nav aria-label="Settings navigation" className="mt-2 flex flex-col gap-1">
            <NavigationLink
              item={{ href: "/settings", icon: Settings, label: "Workspace settings" }}
              pathname={pathname}
            />
            <NavigationLink
              item={{ href: "/settings#team", icon: Users, label: "Team & access" }}
              pathname={pathname}
            />
          </nav>
        </div>
        <Link
          className="mt-auto flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          href="/logout"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Log out
        </Link>
      </aside>
      <header className="sticky top-0 z-20 border-b border-[var(--border-default)] bg-[var(--surface)] px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            href="/"
          >
            <BrandLockup compact />
          </Link>
          <Link
            aria-label="Open settings"
            className="flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            href="/settings"
            title="Settings"
          >
            <Settings aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </header>
      <div className="md:pl-60">
        <PageContainer>{children}</PageContainer>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border-default)] bg-[var(--surface)] px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
      >
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium text-[var(--text-primary)]"
                  : "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium text-[var(--text-tertiary)]"
              }
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" className={active ? "size-5" : "size-5"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {activeOrganizationId ? <PilotUtilities organizationId={activeOrganizationId} /> : null}
    </div>
  );
}

function NavigationLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex h-10 items-center gap-3 rounded-md bg-[var(--surface-muted)] px-3 text-sm font-medium text-[var(--text-primary)]"
          : "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
      }
      href={item.href}
    >
      <Icon aria-hidden="true" className="size-4" />
      {item.label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  const path = href.split("#")[0] ?? href;
  return pathname === path || (path !== "/" && pathname.startsWith(path));
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
    <div className="fixed right-14 top-2 z-30 flex max-w-[calc(100vw-4.5rem)] flex-col-reverse items-end gap-2 md:bottom-4 md:right-4 md:top-auto md:max-w-[calc(100vw-2rem)] md:flex-col">
      {panel === "notifications" ? (
        <div className="w-80 max-w-full rounded-md border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">Notifications</div>
            <button
              aria-label="Close notifications"
              className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              onClick={() => setPanel(null)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {isLoadingNotifications ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
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
              aria-label="Close feedback"
              className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              onClick={() => setPanel(null)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
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
          aria-label="Open notifications"
          className="relative flex size-10 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={() => setPanel(panel === "notifications" ? null : "notifications")}
          title="Notifications"
          type="button"
        >
          <Bell aria-hidden="true" className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs leading-5 text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <button
          aria-label="Send feedback"
          className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm hover:bg-slate-800"
          onClick={() => setPanel(panel === "feedback" ? null : "feedback")}
          title="Feedback"
          type="button"
        >
          <MessageSquarePlus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
