"use client";

import { useActiveOrganizationStore } from "../store/active-organization-store";
import type { Organization } from "../lib/api";

interface OrganizationSelectorProps {
  organizations: Organization[];
}

export function OrganizationSelector({ organizations }: OrganizationSelectorProps) {
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();

  if (organizations.length === 0) {
    return null;
  }

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      Active organization
      <select
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        value={activeOrganizationId ?? organizations[0]?.id ?? ""}
        onChange={(event) => setActiveOrganizationId(event.target.value)}
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </label>
  );
}
