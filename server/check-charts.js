const ExcelJS = require('exceljs');

const checkCharts = () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Test');
  
  const properties = Object.getOwnPropertyNames(Object.getPrototypeOf(ws));
  console.log("Worksheet methods:");
  console.log(properties.filter(p => p.toLowerCase().includes('chart') || p.toLowerCase().includes('graph') || p.toLowerCase().includes('draw')));
};

checkCharts();
