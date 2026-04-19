"use client";

import { useQuery } from "@tanstack/react-query";
import { getDemoRuntimeConfig } from "@/lib/api";
import { USE_MOCKS } from "@/lib/constants";
import type { DemoRuntimeConfig } from "@/lib/types";

export function useDemoRuntimeConfig() {
  return useQuery<DemoRuntimeConfig | null>({
    queryKey: ["demo-runtime-config"],
    queryFn: getDemoRuntimeConfig,
    enabled: !USE_MOCKS,
    staleTime: 30_000,
    retry: false,
  });
}
