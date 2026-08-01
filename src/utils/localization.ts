import * as Localization from 'expo-localization';

export type Language = 'en' | 'am';

export function getDefaultLanguage(): Language {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const languageCode = locales[0].languageCode?.toLowerCase();
      if (languageCode === 'am') {
        return 'am';
      }
    }
  } catch (e) {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
        if (locale.startsWith('am')) {
          return 'am';
        }
      }
    } catch (err) {
      // Fallback to English on error
    }
  }
  return 'en';
}
