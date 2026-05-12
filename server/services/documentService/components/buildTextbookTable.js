const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } = require('docx');

const buildTextbookTable = (textbooks) => {
  const titleRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "5. Course Textbook / Reference Books and Supplementary Reading Material", bold: true })] })],
        columnSpan: 4,
        shading: { fill: "e2e8f0" }
      })
    ]
  });

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Book Title", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Author(s)", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Edition/ publication year/publisher", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "f1f5f9" } }),
    ]
  });

  const dataRows = textbooks.map(book => {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: book.serialNo || "", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: book.bookTitle || "" })] }),
        new TableCell({ children: [new Paragraph({ text: book.authors || "" })] }),
        new TableCell({ children: [new Paragraph({ text: book.editionPublicationPublisher || "" })] }),
      ]
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
    },
    rows: [titleRow, headerRow, ...dataRows]
  });
};

module.exports = { buildTextbookTable };
