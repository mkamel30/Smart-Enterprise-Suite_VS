const ExcelJS = require('exceljs');

/**
 * Generate Excel template with specified columns
 * @param {Array} columns - Array of column definitions: [{ header: 'Name', key: 'fieldName', width: 20 }]
 * @param {string} filename - Name of the file to download
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateTemplate(columns, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ط¨ظٹط§ظ†ط§طھ');

    // Set columns
    worksheet.columns = columns;

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Return buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

/**
 * Parse Excel file buffer into JSON
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Promise<Array>} Array of row objects
 */
async function parseExcelFile(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowData = {};
        row.eachCell((cell, colNumber) => {
            const header = worksheet.getRow(1).getCell(colNumber).value;
            rowData[header] = cell.value;
        });

        rows.push(rowData);
    });

    return rows;
}

/**
 * Export data to Excel
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Column definitions
 * @param {string} filename - File name
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function exportToExcel(data, columns, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ط¨ظٹط§ظ†ط§طھ');

    // Set columns
    worksheet.columns = columns;

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    data.forEach(item => {
        worksheet.addRow(item);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellLength = cell.value ? cell.value.toString().length : 10;
            if (cellLength > maxLength) {
                maxLength = cellLength;
            }
        });
        column.width = Math.min(maxLength + 2, 50);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

module.exports = {
    generateTemplate,
    parseExcelFile,
    exportToExcel
};
