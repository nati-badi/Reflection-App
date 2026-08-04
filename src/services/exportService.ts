import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DayEntry } from '../types';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { format, parseISO } from 'date-fns';
import { getDayDocument } from './db';
import { EthDateTime } from 'ethiopian-calendar-date-converter';
import { ETHIOPIAN_MONTHS_EN } from '../constants/translations';
import * as Print from 'expo-print';

const getExportDays = async (userId: string): Promise<DayEntry[]> => {
  let days: DayEntry[] = [];
  try {
    const q = query(
      collection(db, 'days'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    days = querySnapshot.docs
      .map(docSnap => docSnap.data() as DayEntry)
      .filter(d => d.contentMarkdown && d.contentMarkdown.trim().length > 0);
  } catch (e) {
    console.warn('Firestore export query failed (using local fallback):', e);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayDoc = await getDayDocument(userId, todayStr);
    if (todayDoc && todayDoc.contentMarkdown && todayDoc.contentMarkdown.trim().length > 0) {
      days = [todayDoc];
    }
  }
  return days;
};

const markdownToHtml = (markdown: string): string => {
  const lines = markdown.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;

  const parseInline = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  };

  const closeLists = () => {
    let res = '';
    if (inUl) { res += '</ul>'; inUl = false; }
    if (inOl) { res += '</ol>'; inOl = false; }
    return res;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Unordered List
    if (/^-\s+/.test(line) || /^\*\s+/.test(line)) {
      if (inOl) html += closeLists();
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${parseInline(line.replace(/^[-\*]\s+/, ''))}</li>`;
      continue;
    }
    
    // Ordered List
    if (/^\d+\.\s+/.test(line)) {
      if (inUl) html += closeLists();
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${parseInline(line.replace(/^\d+\.\s+/, ''))}</li>`;
      continue;
    }
    
    // Not a list, close any open lists
    html += closeLists();

    if (line.trim() === '') {
      // empty line, skip if previous was empty or just let paragraph handle spacing
      html += '<br/>';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html += `<h${level}>${parseInline(headingMatch[2])}</h${level}>`;
      continue;
    }

    // Normal paragraph
    html += `<p>${parseInline(line)}</p>`;
  }
  
  html += closeLists();
  return html;
};

export const exportJournalData = async (userId: string, language: 'en' | 'am' = 'en'): Promise<{ success: boolean; message?: string }> => {
  try {
    const days = await getExportDays(userId);

    if (days.length === 0) {
      return { success: false, message: 'No reflections found to export.' };
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 2. Format single Markdown file with dual Gregorian + Ethiopian calendar headers
    let markdownOutput = `# Reflection Journal Backup\n`;
    markdownOutput += `Generated on ${todayStr}\n\n`;
    markdownOutput += `Total Days: ${days.length}\n\n`;
    markdownOutput += `---\n\n`;

    days.forEach(day => {
      const moodDisplay = day.mood ? ` · ${day.mood}` : '';
      let dateHeader = day.date;
      try {
        const parsedDate = parseISO(day.date);
        const gregFormatted = format(parsedDate, 'MMM d, yyyy');
        const ethDate = EthDateTime.fromEuropeanDate(parsedDate);
        
        if (language === 'am') {
          const { ETHIOPIAN_MONTHS_AM } = require('../constants/translations');
          const ethMonthAm = ETHIOPIAN_MONTHS_AM[ethDate.month - 1];
          const ethFormatted = `${ethMonthAm} ${ethDate.date}፣ ${ethDate.year} ዓ.ም`;
          dateHeader = `${ethFormatted} · ${gregFormatted} (${day.date})`;
        } else {
          const ethMonthEn = ETHIOPIAN_MONTHS_EN[ethDate.month - 1];
          const ethFormatted = `${ethMonthEn} ${ethDate.date}, ${ethDate.year}`;
          dateHeader = `${gregFormatted} · ${ethFormatted} (${day.date})`;
        }
      } catch (e) {
        // Fallback to raw date if parsing fails
      }

      markdownOutput += `## ${dateHeader}${moodDisplay}\n\n`;
      markdownOutput += `${day.contentMarkdown.trim()}\n\n`;
      markdownOutput += `---\n\n`;
    });

    const fileName = `reflection_backup_${todayStr}.md`;

    // 3. Share or Download file based on platform
    if (Platform.OS === 'web') {
      const blob = new Blob([markdownOutput], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true };
    } else {
      const fileUri = `${cacheDirectory}${fileName}`;
      await writeAsStringAsync(fileUri, markdownOutput, {
        encoding: EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/markdown',
          dialogTitle: 'Export Reflection Journal Backup',
          UTI: 'public.plain-text',
        });
        return { success: true };
      } else {
        return { success: false, message: 'Sharing is not available on this device.' };
      }
    }
  } catch (error: any) {
    console.error('Export failed:', error);
    return { success: false, message: error.message || 'Export failed.' };
  }
};

export const exportJournalDataAsPdf = async (userId: string, language: 'en' | 'am' = 'en'): Promise<{ success: boolean; message?: string }> => {
  try {
    const days = await getExportDays(userId);

    if (days.length === 0) {
      return { success: false, message: 'No reflections found to export.' };
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1A1A1A; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { font-size: 28px; font-weight: bold; margin-bottom: 8px; }
          .header-subtitle { color: #666; font-size: 14px; margin-bottom: 40px; }
          .day-section { margin-bottom: 40px; page-break-inside: avoid; }
          .day-header { font-size: 20px; font-weight: bold; color: #1A1A1A; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #EAEAEA; }
          p { margin-top: 0; margin-bottom: 12px; }
          ul, ol { margin-top: 0; margin-bottom: 12px; padding-left: 24px; }
          li { margin-bottom: 4px; }
          h1, h2, h3, h4, h5, h6 { margin-top: 16px; margin-bottom: 8px; }
          hr { border: 0; border-top: 1px solid #EAEAEA; margin: 40px 0; }
        </style>
      </head>
      <body>
        <h1>Reflection Journal Backup</h1>
        <div class="header-subtitle">Generated on ${todayStr} • Total Days: ${days.length}</div>
        <hr>
    `;

    days.forEach(day => {
      const moodDisplay = day.mood ? ` ${day.mood}` : '';
      let dateHeader = day.date;
      try {
        const parsedDate = parseISO(day.date);
        const gregFormatted = format(parsedDate, 'MMM d, yyyy');
        const ethDate = EthDateTime.fromEuropeanDate(parsedDate);
        
        if (language === 'am') {
          const { ETHIOPIAN_MONTHS_AM } = require('../constants/translations');
          const ethMonthAm = ETHIOPIAN_MONTHS_AM[ethDate.month - 1];
          const ethFormatted = `${ethMonthAm} ${ethDate.date}፣ ${ethDate.year} ዓ.ም`;
          dateHeader = `${ethFormatted} · ${gregFormatted}`;
        } else {
          const ethMonthEn = ETHIOPIAN_MONTHS_EN[ethDate.month - 1];
          const ethFormatted = `${ethMonthEn} ${ethDate.date}, ${ethDate.year}`;
          dateHeader = `${gregFormatted} · ${ethFormatted}`;
        }
      } catch (e) {}

      htmlContent += `
        <div class="day-section">
          <div class="day-header">${dateHeader}${moodDisplay}</div>
          ${markdownToHtml(day.contentMarkdown)}
        </div>
      `;
    });

    htmlContent += `
      </body>
      </html>
    `;

    const fileName = `reflection-backup-${todayStr}.pdf`;

    if (Platform.OS === 'web') {
      // expo-print's web implementation ignores the `html` parameter and just calls window.print()
      // So we manually create a hidden iframe and print its contents
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }

      // Wait a moment for styles to apply before printing
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Cleanup after print dialog closes
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 500);

      return { success: true };
    } else {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const newUri = `${cacheDirectory}${fileName}`;
      
      // Move to a proper named file
      const { moveAsync } = require('expo-file-system/legacy');
      await moveAsync({ from: uri, to: newUri });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Reflection Journal PDF Backup',
          UTI: 'com.adobe.pdf',
        });
        return { success: true };
      } else {
        return { success: false, message: 'Sharing is not available on this device.' };
      }
    }
  } catch (error: any) {
    console.error('PDF Export failed:', error);
    return { success: false, message: error.message || 'PDF Export failed.' };
  }
};
