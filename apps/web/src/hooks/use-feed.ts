"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getFeed } from "@/lib/api";
import type { FeedItem } from "@/lib/types";

export function useFeed() {
  const { address } = useAccount();

  return useQuery<FeedItem[]>({
    queryKey: ["feed", address],
    queryFn: () => {
      if (!address) return [];
      return getFeed(address);
    },
    enabled: !!address,
    retry: false,
    refetchInterval: 3000,
  });
}
