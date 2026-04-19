"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getFeed } from "@/lib/api";
import { subscribeMockStore } from "@/mocks/mock-store";
import { USE_MOCKS } from "@/lib/constants";
import type { FeedItem } from "@/lib/types";

export function useFeed() {
  const { address } = useAccount();
  const qc = useQueryClient();

  useEffect(() => {
    if (!USE_MOCKS) return;
    return subscribeMockStore(() => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feed-review"] });
      qc.invalidateQueries({ queryKey: ["receipt"] });
      qc.invalidateQueries({ queryKey: ["challenge"] });
    });
  }, [qc]);

  return useQuery<FeedItem[]>({
    queryKey: ["feed", address],
    queryFn: () => {
      if (!address) return [];
      return getFeed(address);
    },
    enabled: !!address,
    retry: false,
    refetchInterval: USE_MOCKS ? 4000 : 3000,
  });
}
