import { describe, it, expect } from "vitest";
import { statusForTab, buildListArgs, type SortBy, type SortOrder } from "@/lib/buildsListArgs";

describe("buildsListArgs", () => {
  describe("statusForTab", () => {
    it("maps all tab to undefined", () => {
      expect(statusForTab("all")).toBeUndefined();
    });
    it("maps current tab to wip", () => {
      expect(statusForTab("current")).toBe("wip");
    });
    it("maps planning tab to idea", () => {
      expect(statusForTab("planning")).toBe("idea");
    });
    it("maps completed tab to ready", () => {
      expect(statusForTab("completed")).toBe("ready");
    });
    it("maps archived tab to archived", () => {
      expect(statusForTab("archived")).toBe("archived");
    });
  });

  describe("buildListArgs", () => {
    it("returns skip when userId is null", () => {
      expect(
        buildListArgs({
          userId: null,
          activeTab: "current",
          search: "",
          sortBy: "name",
          order: "asc",
        })
      ).toBe("skip");
    });

    it("returns object with userId and status when userId is set", () => {
      const args = buildListArgs({
        userId: "user-1",
        activeTab: "current",
        search: "",
        sortBy: "name",
        order: "asc",
      });
      expect(args).not.toBe("skip");
      if (args !== "skip") {
        expect(args.userId).toBe("user-1");
        expect(args.status).toBe("wip");
        expect(args.sortBy).toBe("name");
        expect(args.order).toBe("asc");
      }
    });

    it("omits search when search is empty or whitespace", () => {
      const args = buildListArgs({
        userId: "user-1",
        activeTab: "current",
        search: "   ",
        sortBy: "name",
        order: "asc",
      });
      expect(args).not.toBe("skip");
      if (args !== "skip") {
        expect(args.search).toBeUndefined();
      }
    });

    it("includes search when search has content", () => {
      const args = buildListArgs({
        userId: "user-1",
        activeTab: "archived",
        search: "  Cosplay  ",
        sortBy: "progress",
        order: "desc",
      });
      expect(args).not.toBe("skip");
      if (args !== "skip") {
        expect(args.search).toBe("Cosplay");
        expect(args.status).toBe("archived");
        expect(args.sortBy).toBe("progress");
        expect(args.order).toBe("desc");
      }
    });

    it("omits status when tab is all", () => {
      const args = buildListArgs({
        userId: "user-1",
        activeTab: "all",
        search: "",
        sortBy: "name",
        order: "asc",
      });
      expect(args).not.toBe("skip");
      if (args !== "skip") {
        expect(args.status).toBeUndefined();
      }
    });

    it("passes through sortBy and order", () => {
      const sortOptions: SortBy[] = ["name", "progress", "targetDate", "budget"];
      const orders: SortOrder[] = ["asc", "desc"];
      for (const sortBy of sortOptions) {
        for (const order of orders) {
          const args = buildListArgs({
            userId: "user-1",
            activeTab: "planning",
            search: "",
            sortBy,
            order,
          });
          expect(args).not.toBe("skip");
          if (args !== "skip") {
            expect(args.sortBy).toBe(sortBy);
            expect(args.order).toBe(order);
          }
        }
      }
    });
  });
});
