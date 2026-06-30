"use client";

import { PageContainer } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { api } from "../../lib/api";

export default function LogoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.logout,
    onSettled: async () => {
      await queryClient.clear();
      router.replace("/login");
    }
  });

  React.useEffect(() => {
    mutation.mutate();
  }, []);

  return <PageContainer>Logging out...</PageContainer>;
}
