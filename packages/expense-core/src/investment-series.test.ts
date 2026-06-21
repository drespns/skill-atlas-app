import { describe, expect, it } from "vitest";
import { defaultExpenseTrackerState } from "./state";
import { investmentInitialAmount, monthlyInvestmentOutflowSeries } from "./investment-series";

describe("monthlyInvestmentOutflowSeries", () => {
  it("places initial investment on acquiredOn month", () => {
    const state = {
      ...defaultExpenseTrackerState(),
      investments: [
        {
          id: "i1",
          name: "XRP",
          type: "crypto" as const,
          platform: "TR",
          avgBuyPrice: 1,
          quantity: 100,
          totalInvested: 500,
          gainLossPct: 0,
          acquiredOn: "2026-07-10",
        },
      ],
    };
    const ser = monthlyInvestmentOutflowSeries(state, ["2026-06", "2026-07", "2026-08"]);
    expect(ser[0]).toBe(0);
    expect(ser[1]).toBe(500);
    expect(ser[2]).toBe(0);
  });

  it("adds partial purchases on their dates", () => {
    const state = {
      ...defaultExpenseTrackerState(),
      investments: [
        {
          id: "i1",
          name: "Apple",
          type: "stocks" as const,
          platform: "TR",
          avgBuyPrice: 10,
          quantity: 20,
          totalInvested: 300,
          gainLossPct: 0,
          acquiredOn: "2026-06-01",
          purchases: [{ id: "p1", date: "2026-08-15", amount: 100 }],
        },
      ],
    };
    expect(investmentInitialAmount(state.investments[0]!)).toBe(200);
    const ser = monthlyInvestmentOutflowSeries(state, ["2026-06", "2026-07", "2026-08"]);
    expect(ser[0]).toBe(200);
    expect(ser[2]).toBe(100);
  });

  it("skips initial block when acquiredOn is missing", () => {
    const state = {
      ...defaultExpenseTrackerState(),
      investments: [
        {
          id: "i1",
          name: "BTC",
          type: "crypto" as const,
          platform: "TR",
          avgBuyPrice: 1,
          quantity: 1,
          totalInvested: 9000,
          gainLossPct: 0,
        },
      ],
    };
    const ser = monthlyInvestmentOutflowSeries(state, ["2026-06", "2026-07"]);
    expect(ser[0]).toBe(0);
    expect(ser[1]).toBe(0);
  });

  it("only counts dated purchases when no acquiredOn", () => {
    const state = {
      ...defaultExpenseTrackerState(),
      investments: [
        {
          id: "i1",
          name: "ETH",
          type: "crypto" as const,
          platform: "TR",
          avgBuyPrice: 1,
          quantity: 10,
          totalInvested: 1000,
          gainLossPct: 0,
          purchases: [
            { id: "p1", date: "2026-03-10", amount: 200 },
            { id: "p2", date: "2026-05-15", amount: 300 },
          ],
        },
      ],
    };
    const ser = monthlyInvestmentOutflowSeries(state, ["2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(ser[0]).toBe(200);
    expect(ser[1]).toBe(0);
    expect(ser[2]).toBe(300);
    expect(ser[3]).toBe(0);
  });
});
