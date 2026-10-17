const XLSX = require('xlsx');
const { parseStudentExcel, findColumnIndices } = require('../services/obe/obeStudentExcelParser');

describe('OBE Student Excel Parser', () => {
  // Helper to create an Excel buffer
  const createWorkbookBuffer = (aoa) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  test('parses a valid Excel file containing multiple students', () => {
    const data = [
      ['Registration Number', 'Student Name'],
      ['FA20-BCS-001', 'Alice Cooper'],
      ['FA20-BCS-002', 'Bob Dylan'],
      ['FA20-BCS-003', 'Charlie Parker']
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(3);
    expect(result.validRows.length).toBe(3);
    expect(result.invalidRows.length).toBe(0);
    expect(result.validRows[0].registrationNo).toBe('FA20-BCS-001');
    expect(result.validRows[0].studentName).toBe('Alice Cooper');
    expect(result.validRows[1].registrationNo).toBe('FA20-BCS-002');
    expect(result.validRows[2].registrationNo).toBe('FA20-BCS-003');
  });

  test('preserves registration numbers with leading zeros as text', () => {
    const data = [
      ['Registration Number', 'Student Name'],
      ['001234', 'Leading Zero One'],
      ['000789', 'Leading Zero Two']
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.validRows.length).toBe(2);
    expect(result.validRows[0].registrationNo).toBe('001234');
    expect(result.validRows[1].registrationNo).toBe('000789');
  });

  test('supports flexible header naming (e.g. Reg No, Full Name)', () => {
    const data = [
      ['Reg No', 'Full Name'],
      ['004455', 'David Bowie']
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].registrationNo).toBe('004455');
    expect(result.validRows[0].studentName).toBe('David Bowie');
  });

  test('fails gracefully when columns are missing or incorrectly named', () => {
    const data = [
      ['Address', 'Phone Number'],
      ['123 Main St', '555-1234']
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Could not find expected headers/i);
    expect(result.validRows.length).toBe(0);
  });

  test('ignores completely empty rows without error', () => {
    const data = [
      ['Registration Number', 'Student Name'],
      ['001111', 'John Doe'],
      ['', ''], // empty row
      [null, null], // empty row
      ['   ', '   '], // whitespace only row
      ['002222', 'Jane Smith']
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.validRows.length).toBe(2);
    expect(result.validRows[0].registrationNo).toBe('001111');
    expect(result.validRows[1].registrationNo).toBe('002222');
  });

  test('flags missing registration numbers or student names', () => {
    const data = [
      ['Registration Number', 'Student Name'],
      ['', 'Missing Reg'],
      ['003333', ''],
      ['   ', '   '] // completely empty row is ignored
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.validRows.length).toBe(0);
    expect(result.invalidRows.length).toBe(2);
    expect(result.invalidRows[0].error).toBe('Missing registration number');
    expect(result.invalidRows[1].error).toBe('Missing student name');
  });

  test('detects duplicate registration numbers within spreadsheet', () => {
    const data = [
      ['Registration Number', 'Student Name'],
      ['001234', 'Original Student'],
      ['005555', 'Second Student'],
      ['001234', 'Duplicate Student'] // duplicate
    ];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(3);
    expect(result.validRows.length).toBe(2);
    expect(result.invalidRows.length).toBe(1);
    expect(result.invalidRows[0].registrationNo).toBe('001234');
    expect(result.invalidRows[0].error).toMatch(/Duplicate registration number in spreadsheet/i);
  });

  test('handles completely empty spreadsheet', () => {
    const data = [];
    const buffer = createWorkbookBuffer(data);
    const result = parseStudentExcel(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });
});
