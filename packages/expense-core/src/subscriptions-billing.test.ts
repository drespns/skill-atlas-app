import { describe, expect, it } from "vitest";
import { subscriptionBillingSnapshot, isSubscriptionInTrial } from "./subscriptions-billing";
import { subscriptionToMonthlyAmount, subscriptionNextChargeIso } from "./state";
import type { SubscriptionRow } from "./state";

const spotifyLike = (): SubscriptionRow => ({
  id: "s1",
  name: "Spotify Premium",
  amount: 11.99,
  currency: "EUR",
  cycle: "monthly",
  categoryId: "c1",
  nextBilling: "",
  billingStartDate: "2026-06-21",
  trialAmount: 0,
  trialEndsOn: "2026-09-21",
  active: true,
  notes: "",
  tags: [],
});

describe("subscription trial billing", () => {
  it("detects trial phase before trialEndsOn", () => {
    expect(isSubscriptionInTrial(spotifyLike(), "2026-07-01")).toBe(true);
    expect(isSubscriptionInTrial(spotifyLike(), "2026-09-21")).toBe(false);
  });

  it("uses trial amount for monthly burn during trial", () => {
    expect(subscriptionToMonthlyAmount(spotifyLike(), "2026-07-01")).toBe(0);
    expect(subscriptionToMonthlyAmount(spotifyLike(), "2026-10-01")).toBe(11.99);
  });

  it("next charge during trial is trial end date", () => {
    expect(subscriptionNextChargeIso(spotifyLike(), "2026-07-01")).toBe("2026-09-21");
  });

  it("snapshot describes trial then regular price", () => {
    const snap = subscriptionBillingSnapshot(spotifyLike(), "2026-07-01");
    expect(snap.phase).toBe("trial");
    expect(snap.cycleAmount).toBe(0);
    expect(snap.regularStartsOn).toBe("2026-09-21");
  });
});

describe("resolveSubscriptionBrandKey", () => {
  it("matches spotify from name", async () => {
    const { resolveSubscriptionBrandKey } = await import("./subscription-brands");
    expect(resolveSubscriptionBrandKey("Spotify Premium Individual")).toBe("spotify");
    expect(resolveSubscriptionBrandKey("Movistar+")).toBe("movistar-plus");
  });
});
