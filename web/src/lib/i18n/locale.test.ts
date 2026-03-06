import { describe, it, expect, beforeEach } from "vitest";
import { getStoredLocale, setStoredLocale, SUPPORTED_LOCALES } from "./locale";

const STORAGE_KEY = "kyarafit-locale";

describe("locale helpers", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  });

  describe("getStoredLocale", () => {
    it("returns en when localStorage is empty", () => {
      expect(getStoredLocale()).toBe("en");
    });

    it("returns en when stored value is not in allowlist", () => {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "fr");
      expect(getStoredLocale()).toBe("en");
    });

    it("returns stored value when it is a supported locale", () => {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "es");
      expect(getStoredLocale()).toBe("es");
    });

    it("returns each supported locale when stored", () => {
      for (const loc of SUPPORTED_LOCALES) {
        if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, loc);
        expect(getStoredLocale()).toBe(loc);
      }
    });
  });

  describe("setStoredLocale", () => {
    it("writes to localStorage and getStoredLocale returns it", () => {
      setStoredLocale("es");
      expect(getStoredLocale()).toBe("es");
    });

    it("writes en when given en", () => {
      setStoredLocale("en");
      expect(getStoredLocale()).toBe("en");
    });
  });
});
