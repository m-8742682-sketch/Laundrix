import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportRecord {
  id: string;
  userId: string;
  user: string;
  machineId: string;
  duration: number;     // minutes
  durationSecs: number; // raw seconds
  load: number;
  status: string;
  date: string;
}

interface PeakHour  { hour: number; count: number; }
interface DailyStat { date: string; count: number; }

interface ExportStats {
  totalSessions: number;
  totalUsers: number;
  totalMachines: number;
  activeUsers: number;
  totalIncidents: number;
  averageDuration: string;
  completionRate: string;
  unauthorizedCount: number;
  peakHours: PeakHour[];
  dailyStats: DailyStat[];
}

interface ExportData {
  generatedAt?: string;
  stats: ExportStats;
  records: ExportRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safe     = (v: any): string => String(v ?? '');
const pad      = (s: any, n: number) => safe(s).padEnd(n);
const fmtHour  = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const fmtDate  = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); }
  catch { return iso || '—'; }
};
const statusTag = (s: string) =>
  s === 'Normal' ? 'tag-n' : s === 'Unauthorized' ? 'tag-u' : 'tag-i';

// ─── CSV ──────────────────────────────────────────────────────────────────────

const generateCSV = (data: ExportData): string => {
  const esc = (v: any) => `"${safe(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];

  lines.push('"LAUNDRIX ADMIN REPORT"');
  lines.push(`"Generated","${data.generatedAt ?? new Date().toLocaleString()}"`);
  lines.push('');

  lines.push('"=== SUMMARY ==="');
  lines.push(`"Total Sessions","${data.stats.totalSessions}"`);
  lines.push(`"Total Users","${data.stats.totalUsers}"`);
  lines.push(`"Total Machines","${data.stats.totalMachines}"`);
  lines.push(`"Active Users (7d)","${data.stats.activeUsers}"`);
  lines.push(`"Avg Duration","${data.stats.averageDuration}"`);
  lines.push(`"Completion Rate","${data.stats.completionRate}"`);
  lines.push(`"Unauthorized Attempts","${data.stats.unauthorizedCount}"`);
  lines.push(`"Total Incidents","${data.stats.totalIncidents}"`);
  lines.push('');

  const normal   = data.records.filter(r => r.status === 'Normal').length;
  const total    = data.stats.totalSessions;
  lines.push('"=== SYSTEM HEALTH ==="');
  lines.push(`"Normal Sessions","${normal}"`);
  lines.push(`"Completion Rate","${data.stats.completionRate}"`);
  lines.push(`"Unauthorized","${data.stats.unauthorizedCount} (${total > 0 ? Math.round((data.stats.unauthorizedCount / total) * 100) : 0}%)"`);
  lines.push('');

  if ((data.stats.dailyStats ?? []).length > 0) {
    lines.push('"=== LAST 7 DAYS ==="');
    lines.push('"Date","Sessions"');
    data.stats.dailyStats.forEach(d => lines.push(`${esc(fmtDate(d.date))},${esc(d.count)}`));
    lines.push('');
  }

  if ((data.stats.peakHours ?? []).length > 0) {
    lines.push('"=== PEAK USAGE HOURS ==="');
    lines.push('"Rank","Hour","Sessions"');
    data.stats.peakHours.forEach((p, i) =>
      lines.push(`${esc(i + 1)},${esc(fmtHour(p.hour))},${esc(p.count)}`)
    );
    lines.push('');
  }

  lines.push(`"=== ALL USAGE RECORDS (${data.records.length} total) ==="`);
  lines.push(['"#"','"Machine"','"User ID"','"Duration (min)"','"Status"','"Date"'].join(','));
  data.records.forEach((r, i) =>
    lines.push([esc(i + 1), esc(r.machineId), esc(r.userId), esc(r.duration), esc(r.status), esc(r.date)].join(','))
  );

  return lines.join('\n');
};

// ─── TXT ──────────────────────────────────────────────────────────────────────

const generateTXT = (data: ExportData): string => {
  const DIV  = (c = '=') => c.repeat(80) + '\n';
  const row  = (label: string, value: any) => `${pad(label, 32)}${safe(value)}\n`;
  let txt = '';

  txt += DIV();
  txt += '                   LAUNDRIX ADMIN REPORT\n';
  txt += DIV();
  txt += `Generated: ${data.generatedAt ?? new Date().toLocaleString()}\n`;
  txt += DIV() + '\n';

  // Summary
  txt += 'SUMMARY STATISTICS\n' + DIV('-');
  txt += row('Total Sessions:',        data.stats.totalSessions);
  txt += row('Total Users:',           data.stats.totalUsers);
  txt += row('Total Machines:',        data.stats.totalMachines);
  txt += row('Active Users (7 days):', data.stats.activeUsers);
  txt += row('Avg Duration:',          data.stats.averageDuration);
  txt += row('Completion Rate:',       data.stats.completionRate);
  txt += row('Unauthorized Attempts:', data.stats.unauthorizedCount);
  txt += row('Total Incidents:',       data.stats.totalIncidents);
  txt += '\n';

  // System health
  const total  = data.stats.totalSessions;
  const normal = data.records.filter(r => r.status === 'Normal').length;
  const unauth = data.stats.unauthorizedCount;
  txt += 'SYSTEM HEALTH\n' + DIV('-');
  txt += row('Normal Sessions:',       `${normal} (${data.stats.completionRate})`);
  txt += row('Unauthorized:',          `${unauth} (${total > 0 ? Math.round((unauth / total) * 100) : 0}%)`);
  txt += '\n';

  // Last 7 days
  if ((data.stats.dailyStats ?? []).length > 0) {
    txt += 'USAGE — LAST 7 DAYS\n' + DIV('-');
    data.stats.dailyStats.forEach(d =>
      txt += `${pad(fmtDate(d.date), 30)} ${d.count} session(s)\n`
    );
    txt += '\n';
  }

  // Peak hours — note: hour is a NUMBER, use fmtHour(p.hour) not p.hour.padEnd()
  if ((data.stats.peakHours ?? []).length > 0) {
    txt += 'PEAK USAGE HOURS\n' + DIV('-');
    data.stats.peakHours.forEach((p, i) =>
      txt += `${pad(i + 1, 4)} ${pad(fmtHour(p.hour), 20)} ${p.count} session(s)\n`
    );
    txt += '\n';
  }

  // ALL records — no slice
  txt += `ALL USAGE RECORDS (${data.records.length} total)\n` + DIV('-');
  data.records.forEach((r, i) => {
    txt += `${pad(i + 1, 6)} Machine: ${pad(r.machineId, 8)} `;
    txt += `User: ${pad(r.userId, 30)} `;
    txt += `${pad(r.duration + 'm', 8)} ${pad(r.status, 15)} ${safe(r.date)}\n`;
  });

  return txt;
};

// ─── XLSX ─────────────────────────────────────────────────────────────────────

const generateXLSX = async (data: ExportData, file: File) => {
  const wb = XLSX.utils.book_new();
  const total  = data.stats.totalSessions;
  const normal = data.records.filter(r => r.status === 'Normal').length;
  const unauth = data.stats.unauthorizedCount;

  // Sheet 1: Summary + System Health + Daily + Peak
  const rows: any[][] = [
    ['LAUNDRIX ADMIN REPORT'],
    [`Generated: ${data.generatedAt ?? new Date().toLocaleString()}`],
    [],
    ['SUMMARY STATISTICS'],
    ['Total Sessions',         data.stats.totalSessions],
    ['Total Users',            data.stats.totalUsers],
    ['Total Machines',         data.stats.totalMachines],
    ['Active Users (7 days)',  data.stats.activeUsers],
    ['Avg Duration',           data.stats.averageDuration],
    ['Completion Rate',        data.stats.completionRate],
    ['Unauthorized Attempts',  unauth],
    ['Total Incidents',        data.stats.totalIncidents],
    [],
    ['SYSTEM HEALTH'],
    ['Normal Sessions',        normal],
    ['Completion Rate',        data.stats.completionRate],
    ['Unauthorized Rate',      `${total > 0 ? Math.round((unauth / total) * 100) : 0}%`],
    [],
  ];

  if ((data.stats.dailyStats ?? []).length > 0) {
    rows.push(['LAST 7 DAYS'], ['Date', 'Sessions']);
    data.stats.dailyStats.forEach(d => rows.push([fmtDate(d.date), d.count]));
    rows.push([]);
  }

  if ((data.stats.peakHours ?? []).length > 0) {
    rows.push(['PEAK USAGE HOURS'], ['Rank', 'Hour', 'Sessions']);
    data.stats.peakHours.forEach((p, i) => rows.push([i + 1, fmtHour(p.hour), p.count]));
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Summary');

  // Sheet 2: ALL records — no slice
  const recordRows = data.records.map((r, i) => ({
    '#':            i + 1,
    'Machine':      safe(r.machineId),
    'User ID':      safe(r.userId),
    'Duration (m)': r.duration,
    'Status':       safe(r.status),
    'Date':         safe(r.date),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(recordRows),
    `Records (${data.records.length})`
  );

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await file.write(wbout, { encoding: 'base64' });
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

const generatePDF = async (data: ExportData, file: File) => {
  const total  = data.stats.totalSessions;
  const normal = data.records.filter(r => r.status === 'Normal').length;
  const unauth = data.stats.unauthorizedCount;

  const dailyHTML = (data.stats.dailyStats ?? []).length > 0 ? `
    <h2>Usage &mdash; Last 7 Days</h2>
    <table>
      <tr><th>Date</th><th>Sessions</th></tr>
      ${data.stats.dailyStats.map(d =>
        `<tr><td>${fmtDate(d.date)}</td><td>${d.count}</td></tr>`
      ).join('')}
    </table>` : '';

  const peakHTML = (data.stats.peakHours ?? []).length > 0 ? `
    <h2>Peak Usage Hours</h2>
    <table>
      <tr><th>Rank</th><th>Hour</th><th>Sessions</th></tr>
      ${data.stats.peakHours.map((p, i) =>
        `<tr><td>#${i+1}</td><td>${fmtHour(p.hour)}</td><td>${p.count}</td></tr>`
      ).join('')}
    </table>` : '';

  // ALL records — no slice, paged via CSS
  const recordRows = data.records.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${safe(r.machineId)}</td>
      <td class="uid">${safe(r.userId)}</td>
      <td>${safe(r.duration)} min</td>
      <td class="${statusTag(r.status)}">${safe(r.status)}</td>
      <td>${safe(r.date)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page   { size: A4; margin: 18mm 14mm; }
  body    { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #0f172a; }
  h1      { color: #0369A1; text-align: center; font-size: 18px; margin: 0 0 4px; }
  h2      { color: #0369A1; font-size: 12px; margin: 16px 0 6px;
            border-bottom: 1.5px solid #0EA5E9; padding-bottom: 3px; }
  .ts     { text-align: center; color: #64748b; font-style: italic; margin-bottom: 16px; font-size: 9px; }
  .grid   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .kpi    { background: #EEF2FF; border-radius: 6px; padding: 7px 10px; }
  .kpi-v  { font-size: 16px; font-weight: 900; color: #0369A1; }
  .kpi-l  { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
  .health { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .h-row  { background: #F8FAFC; border-radius: 6px; padding: 6px 10px;
            display: flex; justify-content: space-between; align-items: center; }
  .h-lbl  { font-size: 9px; color: #334155; }
  .h-val  { font-size: 11px; font-weight: 800; }
  .c-g    { color: #059669; }
  .c-r    { color: #DC2626; }
  table   { width: 100%; border-collapse: collapse; font-size: 9px;
            page-break-inside: auto; }
  thead tr{ display: table-header-group; }
  tr      { page-break-inside: avoid; }
  th      { background: #0EA5E9; color: #fff; padding: 4px 6px; text-align: left; }
  td      { border-bottom: 1px solid #e2e8f0; padding: 3px 6px; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .tag-n  { color: #059669; font-weight: 700; }
  .tag-u  { color: #DC2626; font-weight: 700; }
  .tag-i  { color: #D97706; font-weight: 700; }
  .uid    { font-size: 8px; color: #64748b; }
  .footer { margin-top: 16px; text-align: center; color: #94a3b8; font-size: 8px;
            border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
  <h1>LAUNDRIX ADMIN REPORT</h1>
  <div class="ts">Generated: ${data.generatedAt ?? new Date().toLocaleString()}</div>

  <h2>Summary Statistics</h2>
  <div class="grid">
    <div class="kpi"><div class="kpi-v">${total}</div><div class="kpi-l">Total Sessions</div></div>
    <div class="kpi"><div class="kpi-v">${data.stats.averageDuration}</div><div class="kpi-l">Avg Duration</div></div>
    <div class="kpi"><div class="kpi-v">${data.stats.completionRate}</div><div class="kpi-l">Completion Rate</div></div>
    <div class="kpi"><div class="kpi-v">${data.stats.activeUsers}</div><div class="kpi-l">Active Users (7d)</div></div>
    <div class="kpi"><div class="kpi-v">${normal}</div><div class="kpi-l">Normal Sessions</div></div>
    <div class="kpi"><div class="kpi-v">${unauth}</div><div class="kpi-l">Unauthorized</div></div>
    <div class="kpi"><div class="kpi-v">${data.stats.totalUsers}</div><div class="kpi-l">Registered Users</div></div>
    <div class="kpi"><div class="kpi-v">${data.stats.totalMachines}</div><div class="kpi-l">Machines</div></div>
  </div>

  <h2>System Health</h2>
  <div class="health">
    <div class="h-row"><span class="h-lbl">Completion Rate</span><span class="h-val c-g">${data.stats.completionRate}</span></div>
    <div class="h-row"><span class="h-lbl">Unauthorized Rate</span><span class="h-val c-r">${total > 0 ? Math.round((unauth / total) * 100) : 0}%</span></div>
    <div class="h-row"><span class="h-lbl">Normal Sessions</span><span class="h-val c-g">${normal}</span></div>
    <div class="h-row"><span class="h-lbl">Unauthorized Attempts</span><span class="h-val c-r">${unauth}</span></div>
  </div>

  ${dailyHTML}
  ${peakHTML}

  <h2>All Usage Records &mdash; ${data.records.length} total</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Machine</th><th>User ID</th><th>Duration</th><th>Status</th><th>Date</th></tr>
    </thead>
    <tbody>${recordRows}</tbody>
  </table>

  <div class="footer">Laundrix &bull; ${data.records.length} record(s) &bull; ${new Date().getFullYear()}</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  const tempFile = new File(uri);
  await tempFile.copy(file);
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export const executeExport = async (format: string | string[], data: ExportData) => {
  const fmt      = Array.isArray(format) ? format[0] : format;
  const fileName = `laundrix_report_${Date.now()}.${fmt}`;
  const file     = new File(Paths.document, fileName);

  switch (fmt) {
    case 'csv':  await file.write(generateCSV(data));  break;
    case 'txt':  await file.write(generateTXT(data));  break;
    case 'xlsx': await generateXLSX(data, file);       break;
    case 'pdf':  await generatePDF(data, file);        break;
    default:     throw new Error(`Unsupported format: ${fmt}`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
  return { success: true, uri: file.uri };
};
