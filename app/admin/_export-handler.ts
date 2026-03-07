import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import XLSX from 'xlsx';

// --- Types ---
interface ExportRecord {
  id: string;
  user: string;
  machineId: string;
  duration: number;
  load: number;
  status: string;
  date: string;
}

interface ExportStats {
  totalSessions: number;
  totalUsers: number;
  totalMachines: number;
  activeUsers: number;
  totalIncidents: number;
  averageDuration?: string; // Added this to match your data
  // FIX: Changed hour from 'number' to 'string' to match "14:00" format
  peakHours?: { hour: string; count: number }[]; 
  dailyStats?: { date: string; count: number }[];
}

interface ExportData {
  stats: ExportStats;
  records: ExportRecord[];
}

// --- Generators ---

const generateCSV = (data: ExportData): string => {
  const headers = ["ID", "User", "Machine", "Duration (min)", "Load (kg)", "Status", "Date"];
  const rows = data.records.map(r => 
    [r.id, r.user, r.machineId, r.duration, r.load, r.status, r.date]
      .map(field => `"${field}"`).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

const generateTXT = (data: ExportData): string => {
  const { stats, records } = data;
  const now = new Date().toLocaleString();
  let txt = "";

  const line = (char = "=") => char.repeat(80) + "\n";
  const row = (label: string, value: any) => `${label.padEnd(25)} ${value}\n`;

  txt += line();
  txt += "LAUNDRIX ADMIN REPORT\n";
  txt += line();
  txt += `Generated: ${now}\n`;
  txt += line() + "\n";

  txt += "SUMMARY STATISTICS\n";
  txt += line("-");
  txt += row("Total Sessions:", stats.totalSessions);
  txt += row("Total Users:", stats.totalUsers);
  txt += row("Total Machines:", stats.totalMachines);
  txt += row("Active Users:", stats.activeUsers);
  txt += row("Total Incidents:", stats.totalIncidents);
  if(stats.averageDuration) txt += row("Avg Duration:", stats.averageDuration);
  txt += line("-") + "\n";

  if (stats.dailyStats && stats.dailyStats.length > 0) {
    txt += "DAILY USAGE (Last 7 Days)\n" + line("-");
    stats.dailyStats.forEach(d => txt += `${d.date.padEnd(20)} ${d.count} sessions\n`);
    txt += "\n";
  }

  if (stats.peakHours && stats.peakHours.length > 0) {
    txt += "PEAK HOURS\n" + line("-");
    stats.peakHours.forEach(p => txt += `${p.hour.padEnd(20)} ${p.count} sessions\n`);
    txt += "\n";
  }

  txt += "USAGE RECORDS\n" + line("-");
  records.slice(0, 100).forEach((r, i) => {
    txt += `${i + 1}. Machine: ${r.machineId} | User: ${r.user}\n`;
    txt += `   Duration: ${r.duration} min | Load: ${r.load} kg\n`;
    txt += `   Status: ${r.status} | Date: ${r.date}\n`;
    txt += line("-");
  });

  return txt;
};

const generateXLSX = async (data: ExportData, file: File) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryData = [
    ["LAUNDRIX ADMIN REPORT"],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ["SUMMARY STATISTICS"],
    ["Total Sessions", data.stats.totalSessions],
    ["Total Users", data.stats.totalUsers],
    ["Total Machines", data.stats.totalMachines],
    ["Active Users", data.stats.activeUsers],
    ["Total Incidents", data.stats.totalIncidents],
    ["Average Duration", data.stats.averageDuration],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // 2. Records Sheet
  const recordRows = data.records.map(r => ({
    "ID": r.id,
    "User": r.user,
    "Machine": r.machineId,
    "Duration (min)": r.duration,
    "Load (kg)": r.load,
    "Status": r.status,
    "Date": r.date
  }));
  const wsRecords = XLSX.utils.json_to_sheet(recordRows);
  XLSX.utils.book_append_sheet(wb, wsRecords, "Usage Records");

  // Write to Base64 string using new API
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await file.write(wbout, { encoding: 'base64' });
};

const generatePDF = async (data: ExportData, file: File) => {
  const html = `
    <html>
      <head>
        <style>
          body { font-family: Helvetica, sans-serif; padding: 20px; }
          h1 { color: #0369A1; text-align: center; }
          .timestamp { text-align: center; font-style: italic; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background-color: #0EA5E9; color: white; padding: 8px; text-align: left; }
          td { border-bottom: 1px solid #ddd; padding: 8px; }
          tr:nth-child(even) { background-color: #F8FAFC; }
          .summary-box { background-color: #EEF2FF; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <h1>LAUNDRIX ADMIN REPORT</h1>
        <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>

        <div class="summary-box">
          <h2>Summary Statistics</h2>
          <p><strong>Total Sessions:</strong> ${data.stats.totalSessions}</p>
          <p><strong>Total Users:</strong> ${data.stats.totalUsers}</p>
          <p><strong>Total Machines:</strong> ${data.stats.totalMachines}</p>
          <p><strong>Active Users (7 days):</strong> ${data.stats.activeUsers}</p>
          <p><strong>Total Incidents:</strong> ${data.stats.totalIncidents}</p>
        </div>

        <h2>Usage Records (Last 50)</h2>
        <table>
          <tr>
            <th>Machine</th><th>User</th><th>Duration</th><th>Load</th><th>Status</th><th>Date</th>
          </tr>
          ${data.records.slice(0, 50).map(r => `
            <tr>
              <td>${r.machineId}</td>
              <td>${r.user}</td>
              <td>${r.duration} min</td>
              <td>${r.load} kg</td>
              <td>${r.status}</td>
              <td>${r.date}</td>
            </tr>
          `).join('')}
        </table>
      </body>
    </html>
  `;

  // Print to temp file
  const { uri } = await Print.printToFileAsync({ html });
  
  // Create File object from temp uri and copy to our destination
  const tempFile = new File(uri);
  await tempFile.copy(file);
};

// --- Main Handler ---

export const executeExport = async (format: string | string[], data: ExportData) => {
  const fileFormat = Array.isArray(format) ? format[0] : format;
  const fileName = `laundrix_report_${Date.now()}.${fileFormat}`;
  
  // Create File object in Document directory
  const file = new File(Paths.document, fileName);

  try {
    switch (fileFormat) {
      case 'csv':
        await file.write(generateCSV(data));
        break;
      case 'txt':
        await file.write(generateTXT(data));
        break;
      case 'xlsx':
        await generateXLSX(data, file);
        break;
      case 'pdf':
        await generatePDF(data, file);
        break;
      default:
        throw new Error(`Unsupported format: ${fileFormat}`);
    }

    // Share the file (use the 'uri' property of the File object)
    const fileUri = file.uri;
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      console.log(`File saved to ${fileUri}`);
    }
    
    return { success: true, uri: fileUri };
    
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
};