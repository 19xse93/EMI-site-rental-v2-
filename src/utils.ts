import { UserPermissions } from './types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
};

export const standardizeDate = (val: string | number): string => {
  if (!val) return '';
  let strVal = String(val).trim();
  if (!strVal) return '';

  // Excel serial dates (typically numbers between 20000 and 90000)
  if (!isNaN(Number(strVal)) && Number(strVal) > 20000 && Number(strVal) < 90000) {
    const excelDays = parseFloat(strVal);
    const d = new Date((excelDays - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  let d = new Date(strVal);
  if (isNaN(d.getTime())) {
    // Try custom slash/dot separators
    const parts = strVal.split(/[-/.]/);
    if (parts.length === 3) {
      d = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      if (isNaN(d.getTime()) && parts[2].length === 2) {
        d = new Date(`${parts[1]}/${parts[0]}/20${parts[2]}`);
      }
    }
  }

  if (isNaN(d.getTime())) {
    d = new Date(strVal.replace(/-/g, ' '));
  }

  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    if (year < 2000 || year > 2100) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
};

export const safeParseDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const standard = standardizeDate(dateStr);
  if (!standard) return null;
  const d = new Date(standard);
  return isNaN(d.getTime()) ? null : d;
};

export const formatMonthLabel = (monthStr: string | null | undefined): string => {
  try {
    if (!monthStr || typeof monthStr !== 'string') return 'Unknown';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch (e) {
    return String(monthStr);
  }
};

export const getAgingCategory = (dueDate: string, status: string): string => {
  if (status === 'Paid') return 'Paid';
  const due = safeParseDate(dueDate);
  if (!due) return 'Current';
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);
  const diffTime = TODAY.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Current';
  if (diffDays <= 30) return '1-30 Days';
  if (diffDays <= 60) return '31-60 Days';
  if (diffDays <= 90) return '61-90 Days';
  return '> 90 Days';
};

export const getAgingColor = (category: string): string => {
  switch (category) {
    case 'Current': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case '1-30 Days': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case '31-60 Days': return 'bg-orange-100 text-orange-800 border-orange-200';
    case '61-90 Days': return 'bg-red-100 text-red-00 border-red-200';
    case '> 90 Days': return 'bg-rose-600 text-white border-rose-700';
    case 'Paid': return 'bg-gray-100 text-gray-600 border-gray-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getAgingBgColor = (category: string): string => {
  switch (category) {
    case 'Current': return 'bg-emerald-500';
    case '1-30 Days': return 'bg-yellow-400';
    case '31-60 Days': return 'bg-orange-500';
    case '61-90 Days': return 'bg-red-500';
    case '> 90 Days': return 'bg-rose-700';
    default: return 'bg-gray-300';
  }
};

export const getWeekRange = (dateStr: string): string => {
  const d = safeParseDate(dateStr) || new Date();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

export const getDaysDiff = (startStr: string | null | undefined, endStr: string | null | undefined): number | null => {
  const s = safeParseDate(startStr);
  const e = safeParseDate(endStr);
  if (!s || !e) return null;
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
};

export const parseCSV = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const currentline = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = currentline[j] ? currentline[j].trim().replace(/^"|"$/g, '') : '';
      obj[headers[j]] = val;
    }
    result.push(obj);
  }
  return result;
};

export const mapAccessLevelToPermissions = (levels: number[]): UserPermissions => {
  const p: UserPermissions = {
    viewPo: false,
    viewApv: false,
    viewTreasury: false,
    viewReports: false,
    managePo: false,
    manageApv: false,
    manageTreasury: false,
    deleteRecords: false,
    manageUsers: false,
    systemAdmin: false,
    exportData: false,
  };

  const levelArray = Array.isArray(levels) ? levels : [levels !== undefined ? levels : 0];

  let isLegacyGuest = levelArray.length === 0 || (levelArray.length === 1 && levelArray[0] === 0);

  // Level 3 is absolute superuser/system admin
  if (levelArray.includes(3)) {
    return {
      viewPo: true,
      viewApv: true,
      viewTreasury: true,
      viewReports: true,
      managePo: true,
      manageApv: true,
      manageTreasury: true,
      deleteRecords: true,
      manageUsers: true,
      systemAdmin: true,
      exportData: true,
    };
  }

  if (levelArray.includes(4)) {
    p.manageTreasury = true;
    p.viewTreasury = true;
    p.viewReports = true;
    p.exportData = true;
  }
  if (levelArray.includes(2)) {
    p.managePo = true;
    p.viewPo = true;
    p.viewReports = true;
    p.exportData = true;
  }
  if (levelArray.includes(5)) {
    p.manageApv = true;
    p.viewApv = true;
    p.viewReports = true;
    p.exportData = true;
  }
  if (levelArray.includes(1)) {
    p.exportData = true;
  }

  // Handle modular visibility toggles
  if (levelArray.includes(10) || isLegacyGuest) p.viewPo = true;
  if (levelArray.includes(11) || isLegacyGuest) p.viewApv = true;
  if (levelArray.includes(12) || isLegacyGuest) p.viewTreasury = true;
  if (levelArray.includes(13) || isLegacyGuest) p.viewReports = true;

  return p;
};
