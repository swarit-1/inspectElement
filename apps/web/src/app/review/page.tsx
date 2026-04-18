"use client";

import { useState } from "react";
import { Shell } from "@/components/ui/shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatUsdc, truncateAddress } from "@/lib/constants";

interface ReviewItem {
  challengeId: string;
  receiptId: string;
  challenger: string;
  amount: string;
  challengeType: string;
  status: "PENDING" | "UPHELD" | "REJECTED";
}

const MOCK_REVIEWS: ReviewItem[] = [
  {
    challengeId: "1",
    receiptId: "0x0000000000000000000000000000000000000000000000000000000000000002",
    challenger: "0xaBcD00000000000000000000000000000000dEaD",
    amount: "15000000",
    challengeType: "AmountViolation",
    status: "PENDING",
  },
];

export default function ReviewPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>(MOCK_REVIEWS);

  function handleDecision(challengeId: string, uphold: boolean) {
    setReviews((prev) =>
      prev.map((r) =>
        r.challengeId === challengeId
          ? { ...r, status: uphold ? "UPHELD" : "REJECTED" }
          : r
      )
    );
  }

  return (
    <Shell>
      <Section
        title="Reviewer Console"
        subtitle="Review filed challenges and submit decisions (stub — not wired to live contracts)"
      >
        <div className="flex flex-col gap-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-text-tertiary py-8 text-center">
              No pending challenges to review
            </p>
          ) : (
            reviews.map((item) => (
              <div
                key={item.challengeId}
                className="bg-bg-surface border border-border rounded-[--radius-lg] p-5 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-text-primary">
                      Challenge #{item.challengeId}
                    </span>
                    <span className="text-xs text-text-tertiary ml-2">
                      {item.challengeType}
                    </span>
                  </div>
                  <StatusBadge
                    variant={
                      item.status === "UPHELD"
                        ? "success"
                        : item.status === "REJECTED"
                          ? "danger"
                          : "info"
                    }
                  >
                    {item.status}
                  </StatusBadge>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text-tertiary uppercase tracking-wider">
                      Amount
                    </span>
                    <span className="text-text-secondary font-mono">
                      {formatUsdc(item.amount)} USDC
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text-tertiary uppercase tracking-wider">
                      Challenger
                    </span>
                    <span className="text-text-secondary font-mono">
                      {truncateAddress(item.challenger)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text-tertiary uppercase tracking-wider">
                      Receipt
                    </span>
                    <span className="text-text-secondary font-mono">
                      {truncateAddress(item.receiptId)}
                    </span>
                  </div>
                </div>

                {item.status === "PENDING" && (
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleDecision(item.challengeId, true)}
                    >
                      Uphold
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDecision(item.challengeId, false)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Section>
    </Shell>
  );
}
