import { useSettingsStore } from '../store/useSettingsStore';
import { translations, TranslationKey, ETHIOPIAN_MONTHS_EN, ETHIOPIAN_MONTHS_AM, WEEKDAYS_AM } from '../constants/translations';
import { format } from 'date-fns';
import { EthDateTime } from 'ethiopian-calendar-date-converter';

export function getEthiopianTime(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  let ethHour = (hours24 + 6) % 12;
  if (ethHour === 0) ethHour = 12;

  let period = '';
  if (hours24 >= 6 && hours24 < 12) {
    period = 'ጠዋት';
  } else if (hours24 === 12) {
    period = 'ቀትር';
  } else if (hours24 > 12 && hours24 < 18) {
    period = 'ከሰዓት';
  } else if (hours24 >= 18 && hours24 < 24) {
    period = 'ማታ';
  } else {
    period = 'ሌሊት';
  }

  return `${ethHour}:${minutes} ${period}`;
}

export function useTranslation() {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  const formatDateDual = (date: Date): { primaryDate: string; secondaryDate: string; time: string; compactHeader: string } => {
    const ethDate = EthDateTime.fromEuropeanDate(date);

    if (language === 'am') {
      const ethMonthAm = ETHIOPIAN_MONTHS_AM[ethDate.month - 1];
      const weekdayAm = WEEKDAYS_AM[date.getDay()];
      const ethStrAm = `${ethMonthAm} ${ethDate.date}፣ ${ethDate.year} ዓ.ም`;
      const fullDateAm = `${weekdayAm}፣ ${ethStrAm}`;
      const ethTime = getEthiopianTime(date);
      const compactHeader = `${ethStrAm} · ${ethTime}`;
      return {
        primaryDate: ethStrAm,
        secondaryDate: fullDateAm,
        time: ethTime,
        compactHeader,
      };
    } else {
      const gregStr = format(date, 'MMM d, yyyy');
      const gregFullStr = format(date, 'EEEE, MMM d, yyyy');
      const ethMonthEn = ETHIOPIAN_MONTHS_EN[ethDate.month - 1];
      const ethStrEn = `${ethMonthEn} ${ethDate.date}, ${ethDate.year}`;
      const time = format(date, 'h:mm a');
      const compactHeader = `${gregStr} · ${ethStrEn} · ${time}`;
      return {
        primaryDate: gregStr,
        secondaryDate: gregFullStr,
        time,
        compactHeader,
      };
    }
  };

  return {
    t,
    language,
    setLanguage,
    formatDateDual,
  };
}
