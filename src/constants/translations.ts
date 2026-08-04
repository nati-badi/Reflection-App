import { Language } from '../store/useSettingsStore';

export const ETHIOPIAN_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit', 
  'Magabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];

export const ETHIOPIAN_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ሕዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

export const WEEKDAYS_AM = [
  'እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'
];

export const translations = {
  en: {
    // Navigation & Titles
    appTitle: 'Reflection',
    settings: 'Settings',
    search: 'Search',
    searchPlaceholder: 'Search reflections...',
    history: 'History',
    today: 'Today',
    calendarView: 'Calendar',
    listView: 'List',

    // Feed & Timeline
    dayStreak: 'Day Streak',
    currentStreak: 'Current Streak',
    bestStreak: 'Best Streak',
    days: 'days',
    noReflections: 'No reflections yet.',
    noReflectionsSub: 'Tap the + button to write your first entry.',
    noPastEntries: 'No past reflections found.',
    noSearchResults: 'No matching entries found.',

    // Weekly & Monthly Summary
    weeklySummary: 'Weekly Summary',
    monthlySummary: 'Monthly Summary',
    daysWritten: 'Days Written',
    totalEntries: 'Total Entries',
    moodBreakdown: 'Mood Breakdown',
    endOfWeekStreak: 'Streak at End of Week',
    longestStreakInMonth: 'Longest Streak in Month',
    previousWeek: 'Previous Week',
    viewSummaries: 'View Summaries',
    viewMonthlySummaries: 'View Monthly Summaries',
    close: 'Close',

    // Entry Editor
    newEntry: 'New Entry',
    editEntry: 'Edit Entry',
    placeholderContent: "What's on your mind today?",
    emojiTab: 'Emoji',
    symbolTab: 'Symbol',
    save: 'Save',
    saving: 'Saving...',
    loadError: 'Failed to load entry',
    saveError: 'Failed to save entry',

    // Settings & Security & Backup
    language: 'Language',
    languageEn: 'English',
    languageAm: 'አማርኛ',
    reflectionStats: 'Reflection Stats',
    dataAndBackup: 'Data & Backup',
    exportData: 'Export My Data',
    exportSub: 'Export all reflections as a Markdown file',
    exportingData: 'Exporting data...',
    exportSuccess: 'Export ready',
    exportError: 'Failed to export data',
    security: 'Security',
    appLock: 'App Lock',
    appLockDesc: 'Require passcode / biometrics to open app',
    lockTimeout: 'Lock Timeout',
    lockTimeoutDesc: 'Time away before app locks automatically',
    minutesUnit: 'min',
    notifications: 'Notifications',
    dailyReminder: 'Daily Reminder',
    dailyReminderDesc: 'Time to receive daily push notification',
    selectReminderTime: 'Select Reminder Time',
    cancel: 'Cancel',
    reminderTitle: 'Time to Reflect',
    reminderBody: "Don't break your streak — write your daily entry!",
    webModeNotice: 'Push notifications are only supported on native mobile apps.',
    permissionRequired: 'Permission Required',
    enableNotificationsMsg: 'Please enable notifications in device settings.',
    reminderSetMsg: 'Daily reminder set for ',
    signOut: 'Sign Out',
    signOutError: 'Failed to sign out',

    // Auth & Lock Screen
    welcomeBack: 'Welcome Back',
    passcodePrompt: 'Enter passcode to unlock',
    login: 'Log In',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    biometricError: 'Authentication failed',
  },
  am: {
    // Navigation & Titles
    appTitle: 'ማስታወሻ',
    settings: 'ማስተካከያዎች',
    search: 'ፈልግ',
    searchPlaceholder: 'ማስታወሻዎችን ፈልግ...',
    history: 'ታሪክ',
    today: 'ዛሬ',
    calendarView: 'ካላንደር',
    listView: 'ዝርዝር',

    // Feed & Timeline
    dayStreak: 'የቀናት ተከታታይነት',
    currentStreak: 'የአሁኑ ተከታታይነት',
    bestStreak: 'ምርጥ ተከታታይነት',
    days: 'ቀናት',
    noReflections: 'ምንም የጽሁፍ ማስታወሻ የለም።',
    noReflectionsSub: 'የመጀመሪያ ማስታወሻዎን ለመጻፍ የ + ቁልፉን ይጫኑ።',
    noPastEntries: 'ምንም ያለፉ ማስታወሻዎች አልተገኙም።',
    noSearchResults: 'ተዛማጅ ማስታወሻ አልተገኘም።',

    // Weekly & Monthly Summary
    weeklySummary: 'የሳምንት ማጠቃለያ',
    monthlySummary: 'የወር ማጠቃለያ',
    daysWritten: 'የተጻፉባቸው ቀናት',
    totalEntries: 'ጠቅላላ ማስታወሻዎች',
    moodBreakdown: 'የስሜት ስታቲስቲክስ',
    endOfWeekStreak: 'የሳምንቱ መጨረሻ ተከታታይነት',
    longestStreakInMonth: 'በወሩ ውስጥ ረጅሙ ተከታታይነት',
    previousWeek: 'ያለፈው ሳምንት',
    viewSummaries: 'ማጠቃለያዎችን ተመልከት',
    viewMonthlySummaries: 'የወር ማጠቃለያዎችን ተመልከት',
    close: 'ዝጋ',

    // Entry Editor
    newEntry: 'አዲስ ማስታወሻ',
    editEntry: 'ማስታወሻ አርም',
    placeholderContent: 'ዛሬ በሐሳብዎ ውስጥ ያለው ምንድን ነው?',
    emojiTab: 'ኢሞጂ',
    symbolTab: 'ምልክቶች',
    save: 'አስቀምጥ',
    saving: 'በማስቀመጥ ላይ...',
    loadError: 'ማስታወሻውን መጫን አልተቻለም',
    saveError: 'ማስታወሻውን ማስቀመጥ አልተቻለም',

    // Settings & Security & Backup
    language: 'ቋንቋ',
    languageEn: 'English',
    languageAm: 'አማርኛ',
    reflectionStats: 'የማስታወሻ ስታቲስቲክስ',
    dataAndBackup: 'መረጃ እና ባክአፕ',
    exportData: 'መረጃዬን ኤክስፖርት አድርግ',
    exportSub: 'ሁሉንም ማስታወሻዎችዎ በMarkdown ፋይል ኤክስፖርት ያድርጉ',
    exportingData: 'መረጃ በኤክስፖርት ላይ...',
    exportSuccess: 'ኤክስፖርት ዝግጁ ነው',
    exportError: 'ኤክስፖርት ማድረግ አልተሳካም',
    security: 'ደህንነት',
    appLock: 'መተግበሪያ ቆልፍ',
    appLockDesc: 'ለመክፈት የጣት አሻራ/የይለፍ ቃል ያስፈልጋል',
    lockTimeout: 'የመቆለፊያ ጊዜ',
    lockTimeoutDesc: 'መተግበሪያው ከመቆለፉ በፊት የሚቆይበት ጊዜ',
    minutesUnit: 'ደቂቃ',
    notifications: 'ማሳወቂያዎች',
    dailyReminder: 'የዕለት ተዕለት ማስታወሻ',
    dailyReminderDesc: 'የግፉ ማሳወቂያ የሚደርስበት ሰዓት',
    selectReminderTime: 'የማስታወሻ ሰዓት ይምረጡ',
    cancel: 'ሰርዝ',
    reminderTitle: 'የማስታወሻ ሰዓት ደርሷል',
    reminderBody: 'የቀናት ተከታታይነትዎን አይቁረጡ — የዛሬውን ይጻፉ',
    webModeNotice: 'የግፉ ማሳወቂያዎች የሚሰሩት በስልክ መተግበሪያዎች ላይ ብቻ ነው።',
    permissionRequired: 'ፈቃድ ያስፈልጋል',
    enableNotificationsMsg: 'እባክዎ በስልክ ማስተካከያ ውስጥ ማሳወቂያዎችን ይፍቀዱ።',
    reminderSetMsg: 'የዕለት ተዕለት ማስታወሻ ተስተካክሏል በ',
    signOut: 'ውጣ',
    signOutError: 'መውጣት አልተቻለም',

    // Auth & Lock Screen
    welcomeBack: 'እንኳን ደህና መጡ',
    passcodePrompt: 'ለመክፈት የይለፍ ቃሉን ያስገቡ',
    login: 'ግባ',
    register: 'ተመዝገብ',
    email: 'ኢሜይል',
    password: 'የይለፍ ቃል',
    biometricError: 'ማረጋገጥ አልተሳካም',
  }
};

export type TranslationKey = keyof typeof translations.en;
