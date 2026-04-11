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
  duration: number;       // minutes
  durationSecs: number;   // seconds (raw)
  load: number;
  status: string;
  date: string;
}

interface PeakHour  { hour: number;  count: number; }
interface Dailystat { date: string;  count: number; }

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
  dailyStats: Dailystat[];
}

interface ExportData {
  generatedAt?: string;
  stats: ExportStats;
  records: ExportRecord[];
  users?: any[];
  machines?: any[];
  incidents?: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtHour  = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const fmtDate  = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); }
  catch { return iso; }
};

// ─── CSV ──────────────────────────────────────────────────────────────────────

const generateCSV = (data: ExportData): string => {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = [];

  // Analytics summary block
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

  if (data.stats.dailyStats.length > 0) {
    lines.push('"=== LAST 7 DAYS ==="');
    lines.push('"Date","Sessions"');
    data.stats.dailyStats.forEach(d => lines.push(`${esc(fmtDate(d.date))},${esc(d.count)}`));
    lines.push('');
  }

  if (data.stats.peakHours.length > 0) {
    lines.push('"=== PEAK HOURS ==="');
    lines.push('"Hour","Sessions"');
    data.stats.peakHours.forEach(p => lines.push(`${esc(fmtHour(p.hour))},${esc(p.count)}`));
    lines.push('');
  }

  // Full records
  lines.push('"=== ALL USAGE RECORDS ==="');
  lines.push(['"#"','"Machine"','"User ID"','"Duration (min)"','"Status"','"Date"'].join(','));
  data.records.forEach((r, i) =>
    lines.push([esc(i + 1), esc(r.machineId), esc(r.userId), esc(r.duration), esc(r.status), esc(r.date)].join(','))
  );

  return lines.join('\n');
};

// ─── TXT ──────────────────────────────────────────────────────────────────────

const generateTXT = (data: ExportData): string => {
  const line  = (c = '=') => c.repeat(80) + '\n';
  const row   = (label: string, value: any) => `${label.padEnd(30)} ${value}\n`;
  let txt = '';

  txt += line();
  txt += '                    LAUNDRIX ADMIN REPORT\n';
  txt += line();
  txt += `Generated: ${data.generatedAt ?? new Date().toLocaleString()}\n`;
  txt += line() + '\n';

  txt += 'SUMMARY STATISTICS\n' + line('-');
  txt += row('Total Sessions:',        data.stats.totalSessions);
  txt += row('Total Users:',           data.stats.totalUsers);
  txt += row('Total Machines:',        data.stats.totalMachines);
  txt += row('Active Users (7 days):', data.stats.activeUsers);
  txt += row('Avg Duration:',          data.stats.averageDuration);
  txt += row('Completion Rate:',       data.stats.completionRate);
  txt += row('Unauthorized Attempts:', data.stats.unauthorizedCount);
  txt += row('Total Incidents:',       data.stats.totalIncidents);
  txt += '\n';

  if (data.stats.dailyStats.length > 0) {
    txt += 'USAGE — LAST 7 DAYS\n' + line('-');
    data.stats.dailyStats.forEach(d =>
      txt += `${fmtDate(d.date).padEnd(30)} ${d.count} session(s)\n`
    );
    txt += '\n';
  }

  if (data.stats.peakHours.length > 0) {
    txt += 'PEAK USAGE HOURS\n' + line('-');
    data.stats.peakHours.forEach((p, i) =>
      txt += `${String(i + 1).padEnd(4)} ${fmtHour(p.hour).padEnd(20)} ${p.count} session(s)\n`
    );
    txt += '\n';
  }

  txt += `ALL USAGE RECORDS (${data.records.length} total)\n` + line('-');
  data.records.forEach((r, i) => {
    txt += `${String(i + 1).padEnd(5)} Machine: ${r.machineId.padEnd(8)} `;
    txt += `User: ${r.userId.padEnd(28)} `;
    txt += `${r.duration}m  ${r.status.padEnd(15)} ${r.date}\n`;
  });

  return txt;
};

// ─── XLSX ─────────────────────────────────────────────────────────────────────

const generateXLSX = async (data: ExportData, file: File) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryRows: any[][] = [
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
    ['Unauthorized Attempts',  data.stats.unauthorizedCount],
    ['Total Incidents',        data.stats.totalIncidents],
    [],
  ];
  if (data.stats.dailyStats.length > 0) {
    summaryRows.push(['LAST 7 DAYS']);
    summaryRows.push(['Date', 'Sessions']);
    data.stats.dailyStats.forEach(d => summaryRows.push([fmtDate(d.date), d.count]));
    summaryRows.push([]);
  }
  if (data.stats.peakHours.length > 0) {
    summaryRows.push(['PEAK HOURS']);
    summaryRows.push(['Hour', 'Sessions']);
    data.stats.peakHours.forEach(p => summaryRows.push([fmtHour(p.hour), p.count]));
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  // Sheet 2: All Records
  const recordRows = data.records.map((r, i) => ({
    '#':            i + 1,
    'Machine':      r.machineId,
    'User ID':      r.userId,
    'Duration (m)': r.duration,
    'Status':       r.status,
    'Date':         r.date,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recordRows), `All Records (${data.records.length})`);

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await file.write(wbout, { encoding: 'base64' });
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

const generatePDF = async (data: ExportData, file: File) => {
  const totalSessions   = data.stats.totalSessions;
  const normalCount     = data.records.filter(r => r.status === 'Normal').length;
  const unauthorizedCnt = data.stats.unauthorizedCount;

  const dailyStatsHTML = data.stats.dailyStats.length > 0 ? `
    <h2>Usage — Last 7 Days</h2>
    <table>
      <tr><th>Date</th><th>Sessions</th></tr>
      ${data.stats.dailyStats.map(d => `<tr><td>${fmtDate(d.date)}</td><td>${d.count}</td></tr>`).join('')}
    </table>` : '';

  const peakHTML = data.stats.peakHours.length > 0 ? `
    <h2>Peak Usage Hours</h2>
    <table>
      <tr><th>Rank</th><th>Hour</th><th>Sessions</th></tr>
      ${data.stats.peakHours.map((p, i) => `<tr><td>#${i+1}</td><td>${fmtHour(p.hour)}</td><td>${p.count}</td></tr>`).join('')}
    </table>` : '';

  const html = `
    <html>
    <head>
      <style>
        body    { font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; font-size: 12px; }
        h1      { color: #0369A1; text-align: center; font-size: 22px; margin-bottom: 4px; }
        h2      { color: #0369A1; font-size: 15px; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #0EA5E9; padding-bottom: 4px; }
        .ts     { text-align: center; color: #64748b; font-style: italic; margin-bottom: 24px; }
        .grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .kpi    { background: #EEF2FF; border-radius: 8px; padding: 10px 14px; }
        .kpi-v  { font-size: 22px; font-weight: 900; color: #0369A1; }
        .kpi-l  { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        table   { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
        th      { background: #0EA5E9; color: #fff; padding: 6px 8px; text-align: left; }
        td      { border-bottom: 1px solid #e2e8f0; padding: 5px 8px; }
        tr:nth-child(even) td { background: #F8FAFC; }
        .tag-n  { color: #059669; font-weight: 700; }
        .tag-u  { color: #DC2626; font-weight: 700; }
        .tag-i  { color: #D97706; font-weight: 700; }
        .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 10px; }
      </style>
    </head>
    <body>
      <h1>LAUNDRIX ADMIN REPORT</h1>
      <div class="ts">Generated: ${data.generatedAt ?? new Date().toLocaleString()}</div>

      <h2>Summary Statistics</h2>
      <div class="grid">
        <div class="kpi"><div class="kpi-v">${totalSessions}</div><div class="kpi-l">Total Sessions</div></div>
        <div class="kpi"><div class="kpi-v">${data.stats.averageDuration}</div><div class="kpi-l">Avg Duration</div></div>
        <div class="kpi"><div class="kpi-v">${data.stats.completionRate}</div><div class="kpi-l">Completion Rate</div></div>
        <div class="kpi"><div class="kpi-v">${data.stats.activeUsers}</div><div class="kpi-l">Active Users (7d)</div></div>
        <div class="kpi"><div class="kpi-v">${normalCount}</div><div class="kpi-l">Normal Sessions</div></div>
        <div class="kpi"><div class="kpi-v">${unauthorizedCnt}</div><div class="kpi-l">Unauthorized</div></div>
        <div class="kpi"><div class="kpi-v">${data.stats.totalUsers}</div><div class="kpi-l">Registered Users</div></div>
        <div class="kpi"><div class="kpi-v">${data.stats.totalMachines}</div><div class="kpi-l">Machines</div></div>
      </div>

      ${dailyStatsHTML}
      ${peakHTML}

      <h2>All Usage Records (${data.records.length})</h2>
      <table>
        <tr><th>#</th><th>Machine</th><th>User ID</th><th>Duration</th><th>Status</th><th>Date</th></tr>
        ${data.records.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.machineId}</td>
            <td style="font-size:9px">${r.userId}</td>
            <td>${r.duration} min</td>
            <td class="${r.status === 'Normal' ? 'tag-n' : r.status === 'Unauthorized' ? 'tag-u' : 'tag-i'}">${r.status}</td>
            <td>${r.date}</td>
          </tr>`).join('')}
      </table>

      <div class="footer">Laundrix · Report contains ${data.records.length} record(s) · ${new Date().getFullYear()}</div>
    </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  const tempFile = new File(uri);
  await tempFile.copy(file);
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export const executeExport = async (format: string | string[], data: ExportData) => {
  const fileFormat = Array.isArray(format) ? format[0] : format;
  const fileName   = `laundrix_report_${Date.now()}.${fileFormat}`;
  const file       = new File(Paths.document, fileName);

  switch (fileFormat) {
    case 'csv':  await file.write(generateCSV(data)); break;
    case 'txt':  await file.write(generateTXT(data)); break;
    case 'xlsx': await generateXLSX(data, file);      break;
    case 'pdf':  await generatePDF(data, file);        break;
    default:     throw new Error(`Unsupported format: ${fileFormat}`);
  }

  const fileUri = file.uri;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
  return { success: true, uri: fileUri };
};
