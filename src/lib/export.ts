import * as XLSX from "xlsx";

export function downloadExcel(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) return;

  // Convertir JSON → hoja de Excel
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ancho automático básico
  worksheet["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 18 }));

  // Crear libro
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");

  // Descargar archivo real .xlsx
  XLSX.writeFile(workbook, filename);
}
