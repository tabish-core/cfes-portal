const XLSX = require('xlsx');

/**
 * Flexibility map for header detection
 */
const findColumnIndices = (headerRow) => {
  let regIndex = -1;
  let nameIndex = -1;

  if (!Array.isArray(headerRow)) {
    return { regIndex, nameIndex };
  }

  headerRow.forEach((col, idx) => {
    if (col === null || col === undefined) return;
    const str = String(col).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      str.includes('registrationno') ||
      str.includes('registrationnum') ||
      str.includes('regno') ||
      str.includes('regnum') ||
      str.includes('rollno') ||
      str.includes('rollnum') ||
      str.includes('studentid') ||
      str === 'registration' ||
      str === 'reg'
    ) {
      regIndex = idx;
    } else if (
      str.includes('studentname') ||
      str.includes('fullname') ||
      str === 'name' ||
      str === 'student'
    ) {
      nameIndex = idx;
    }
  });

  return { regIndex, nameIndex };
};

/**
 * Parse an Excel file (Buffer or Uint8Array)
 * @param {Buffer|Uint8Array} buffer 
 * @returns {Object} { success, error, rows, validRows, invalidRows, totalRows }
 */
const parseStudentExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellText: true,
      raw: false // Preserves leading zeros as formatted strings
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        error: 'The selected Excel workbook does not contain any worksheets.',
        rows: [],
        validRows: [],
        invalidRows: [],
        totalRows: 0
      };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rawMatrix = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    if (!rawMatrix || rawMatrix.length === 0) {
      return {
        success: false,
        error: 'The selected spreadsheet is completely empty.',
        rows: [],
        validRows: [],
        invalidRows: [],
        totalRows: 0
      };
    }

    // Find header row (search first 10 rows)
    let headerRowIdx = -1;
    let regColIdx = -1;
    let nameColIdx = -1;

    for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
      const row = rawMatrix[i];
      if (Array.isArray(row)) {
        const { regIndex, nameIndex } = findColumnIndices(row);
        if (regIndex !== -1 && nameIndex !== -1) {
          headerRowIdx = i;
          regColIdx = regIndex;
          nameColIdx = nameIndex;
          break;
        }
      }
    }

    if (headerRowIdx === -1) {
      return {
        success: false,
        error: 'Could not find expected headers. Please ensure the spreadsheet includes "Registration Number" and "Student Name" columns, or download the template.',
        rows: [],
        validRows: [],
        invalidRows: [],
        totalRows: 0
      };
    }

    // Parse data rows
    const rows = [];
    const seenRegs = new Map(); // normalizedReg -> firstRowNumber

    for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || !Array.isArray(row)) continue;

      // Check if row is completely empty
      const isEntireRowEmpty = row.every(c => c === null || c === undefined || String(c).trim() === '');
      if (isEntireRowEmpty) {
        continue; // Ignore completely blank rows
      }

      const rawReg = row[regColIdx];
      const rawName = row[nameColIdx];

      // Preserve registration number as string without losing leading zeros
      const registrationNo = typeof rawReg === 'string'
        ? rawReg.trim()
        : (rawReg !== null && rawReg !== undefined ? String(rawReg).trim() : '');

      const studentName = typeof rawName === 'string'
        ? rawName.trim()
        : (rawName !== null && rawName !== undefined ? String(rawName).trim() : '');

      let isValid = true;
      let errorMessage = null;

      if (!registrationNo && !studentName) {
        isValid = false;
        errorMessage = 'Missing registration number and student name';
      } else if (!registrationNo) {
        isValid = false;
        errorMessage = 'Missing registration number';
      } else if (!studentName) {
        isValid = false;
        errorMessage = 'Missing student name';
      } else {
        // Detect duplicates in spreadsheet
        const normReg = registrationNo.toUpperCase();
        if (seenRegs.has(normReg)) {
          isValid = false;
          errorMessage = `Duplicate registration number in spreadsheet (matches row ${seenRegs.get(normReg)})`;
        } else {
          seenRegs.set(normReg, r + 1);
        }
      }

      rows.push({
        rowNumber: r + 1,
        registrationNo,
        studentName,
        isValid,
        error: errorMessage
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        error: 'The spreadsheet contains headers, but no student data rows were found.',
        rows: [],
        validRows: [],
        invalidRows: [],
        totalRows: 0
      };
    }

    const validRows = rows.filter(r => r.isValid);
    const invalidRows = rows.filter(r => !r.isValid);

    return {
      success: true,
      error: null,
      rows,
      validRows,
      invalidRows,
      totalRows: rows.length
    };
  } catch (err) {
    return {
      success: false,
      error: 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.',
      rows: [],
      validRows: [],
      invalidRows: [],
      totalRows: 0
    };
  }
};

module.exports = {
  findColumnIndices,
  parseStudentExcel
};
