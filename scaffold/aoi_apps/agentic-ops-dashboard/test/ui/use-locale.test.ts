import { beforeEach, describe, expect, it } from "vitest";

import { localeStorageKey } from "../../app/utils/locales";
import {
  resetLocaleStateForTests,
  useLocale,
} from "../../app/composables/useLocale";

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("useLocale", () => {
  beforeEach(() => {
    resetLocaleStateForTests();
  });

  it("defaults to english when no stored locale exists", () => {
    const localeState = useLocale(createStorage());

    expect(localeState.locale.value).toBe("en");
    expect(localeState.isEnglish.value).toBe(true);
    expect(localeState.messages.value.common.language).toBe("Language");
  });

  it("restores a stored locale and persists later changes", () => {
    const storage = createStorage({
      [localeStorageKey]: "es",
    });

    const localeState = useLocale(storage);

    expect(localeState.locale.value).toBe("es");
    expect(localeState.isSpanish.value).toBe(true);

    localeState.toggleLocale();

    expect(localeState.locale.value).toBe("en");
    expect(storage.getItem(localeStorageKey)).toBe("en");
  });

  it("falls back safely when the stored locale is invalid", () => {
    const localeState = useLocale(
      createStorage({
        [localeStorageKey]: "fr",
      }),
    );

    expect(localeState.locale.value).toBe("en");

    localeState.setLocale("es");

    expect(localeState.messages.value.common.language).toBe("Idioma");
  });
});
