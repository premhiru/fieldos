"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { api, type ActionItem } from "../lib/api";
import { useMe } from "../lib/queries";

export function ActionItemAssigneeSelect({
  actionItem,
  inverted = false
}: Readonly<{
  actionItem: ActionItem;
  inverted?: boolean;
}>) {
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const effectiveProjectId = actionItem.suggestedProjectId ?? actionItem.projectId;
  const assigneesQuery = useQuery({
    queryFn: () => api.listActionItemAssignees(actionItem.organizationId, effectiveProjectId),
    queryKey: ["action-item-assignees", actionItem.organizationId, effectiveProjectId],
    retry: false
  });
  const [selectedUserId, setSelectedUserId] = React.useState(actionItem.assignedToUserId ?? "");

  React.useEffect(() => {
    setSelectedUserId(actionItem.assignedToUserId ?? "");
  }, [actionItem.assignedToUserId]);

  const assignMutation = useMutation({
    mutationFn: (userId: string | null) => api.assignActionItem(actionItem.id, userId),
    onError: () => setSelectedUserId(actionItem.assignedToUserId ?? ""),
    onSuccess: async ({ actionItem: updatedActionItem }) => {
      setSelectedUserId(updatedActionItem.assignedToUserId ?? "");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operations-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["project-action-items"] }),
        queryClient.invalidateQueries({
          queryKey: ["message-classification", actionItem.messageId]
        })
      ]);
    }
  });
  const assignees = assigneesQuery.data?.assignees ?? [];
  const currentAssigneeMissing =
    actionItem.assignedToUserId &&
    !assignees.some((assignee) => assignee.id === actionItem.assignedToUserId);
  const labelClass = inverted ? "text-slate-300" : "text-slate-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={`text-xs font-medium ${labelClass}`} htmlFor={`assignee-${actionItem.id}`}>
        Assignee
      </label>
      <select
        aria-label={`Assignee for ${actionItem.title}`}
        className="h-9 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-950 outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={assigneesQuery.isLoading || assigneesQuery.isError || assignMutation.isPending}
        id={`assignee-${actionItem.id}`}
        onChange={(event) => {
          const nextUserId = event.target.value;
          setSelectedUserId(nextUserId);
          assignMutation.mutate(nextUserId || null);
        }}
        value={selectedUserId}
      >
        <option value="">Unassigned</option>
        {currentAssigneeMissing && actionItem.assignedToUser ? (
          <option value={actionItem.assignedToUser.id}>{actionItem.assignedToUser.name}</option>
        ) : null}
        {assignees.map((assignee) => (
          <option key={assignee.id} value={assignee.id}>
            {assignee.name}
            {assignee.id === meQuery.data?.user.id ? " (me)" : ""}
          </option>
        ))}
      </select>
      {assignMutation.isError ? (
        <span className={inverted ? "text-xs text-red-300" : "text-xs text-red-700"}>
          Assignment failed
        </span>
      ) : null}
    </div>
  );
}
