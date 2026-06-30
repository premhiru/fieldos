"use client";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { api } from "../lib/api";
import { slugify } from "../lib/slug";
import { useActiveOrganizationStore } from "../store/active-organization-store";

export function OrganizationOnboarding() {
  const queryClient = useQueryClient();
  const setActiveOrganizationId = useActiveOrganizationStore(
    (state) => state.setActiveOrganizationId
  );
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);

  const mutation = useMutation({
    mutationFn: api.createOrganization,
    onSuccess: async ({ organization }) => {
      setActiveOrganizationId(organization.id);
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    }
  });

  function handleNameChange(value: string) {
    setName(value);

    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your first organization</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ name, slug });
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Organization name
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              required
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Slug
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              required
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
            />
          </label>
          {mutation.isError ? (
            <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
          ) : null}
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
