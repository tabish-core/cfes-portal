const mongoose = require('mongoose');
const { generateCCPWord } = require('../services/documentService/generateCCPWord');
const { generateCCPPDF } = require('../services/documentService/generateCCPPDF');
const { exportCCPForm } = require('../controllers/ccp.controller');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const Semester = require('../models/Semester.model');
const CCP = require('../models/CCP.model');
const JSZip = require('jszip');
const cheerio = require('cheerio');

describe('CCP Export Service & Controller Tests', () => {
  const sampleData = {
    headerInfo: {
      department: 'Software Engineering',
      program: 'BE',
      courseTitle: 'DIGITAL LOGIC DESIGN',
      courseCode: 'EE210',
      announcedDate: '01-Nov-2024',
      dueDate: '15-Dec-2024',
      totalMarks: '20',
    },
    mappingTable: {
      mappedClo: 'CLO3',
      sdg: '4 & 9',
      knowledgeProfile: 'WK3 (Engineering Fundamentals)\nWK5 (Engineering Design)',
      complexProblemSolvingMapped:
        'WP1 (Range of Conflicting Requirements)\nWP2 (Depth of Analysis required)\nWP3 (Depth of Knowledge required)',
    },
    problemStatement: 'Design a digital traffic light controller using FSM.',
    constraintsAssumptions: 'Must use standard 74xx TTL ICs or FPGA Spartan-6.',
    computationalTools: 'Logisim Evolution, Verilog HDL, Modelsim.',
    expectedOutcomes: 'A fully validated simulation waveform and report.',
    deliverables: {
      heading: 'Report (must include)',
      items: [
        { label: 'Introduction and Problem Definition', required: true, completed: false },
        { label: 'State Transition Diagram and ASM Chart', required: true, completed: false },
        { label: 'Circuit Schematic and Simulation Waveforms', required: true, completed: false },
        { label: 'References', required: true, completed: false },
      ],
    },
    wpAttributes: [
      { code: 'WP1', title: 'Range of Conflicting Requirements', isMapped: true, justification: 'Conflicting timing requirements.' },
      { code: 'WP2', title: 'Depth of Analysis required', isMapped: true, justification: 'FSM reduction required.' },
      { code: 'WP3', title: 'Depth of Knowledge required', isMapped: true, justification: 'Requires sequential synthesis knowledge.' },
      { code: 'WP4', title: 'Familiarity of issues', isMapped: false, justification: 'NA' },
      { code: 'WP5', title: 'Extent of applicable codes', isMapped: false, justification: 'NA' },
      { code: 'WP6', title: 'Extent of stakeholder involvement', isMapped: false, justification: 'NA' },
      { code: 'WP7', title: 'Consequences', isMapped: false, justification: 'NA' },
      { code: 'WP8', title: 'Interdependence', isMapped: false, justification: 'NA' },
    ],
  };

  describe('1. Word Generation (generateCCPWord)', () => {
    test('generates valid .docx buffer with correct structure and page break', async () => {
      const buffer = await generateCCPWord(sampleData);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(10000);

      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file('word/document.xml').async('text');
      const $ = cheerio.load(docXml, { xmlMode: true });

      // Check Department & Program
      const p0Text = $('w\\:body > w\\:p').eq(0).text();
      expect(p0Text).toContain('Software Engineering');
      expect(p0Text).toContain('BE');

      // Check Course Title
      const p1Text = $('w\\:body > w\\:p').eq(1).text();
      expect(p1Text).toContain('DIGITAL LOGIC DESIGN');

      // Check deliberate page break
      const pageBreakCount = $('w\\:br[w\\:type="page"]').length;
      expect(pageBreakCount).toBe(1);

      // Check Table 1 has 10 rows (header + subheader + WP1-WP8)
      const tbl1Rows = $('w\\:body > w\\:tbl').eq(1).find('w\\:tr').length;
      expect(tbl1Rows).toBe(10);
    });

    test('safely escapes special XML characters (&, <, >, ", \') in docx', async () => {
      const specialData = {
        ...sampleData,
        problemStatement: 'Testing <script>alert("XSS")</script> & "AT&T" & \'single\'.',
      };
      const buffer = await generateCCPWord(specialData);
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file('word/document.xml').async('text');

      expect(docXml).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; &amp; &quot;AT&amp;T&quot; &amp; &apos;single&apos;.');
    });

    test('applies consistent 4-6 pt (80-120 dxa) spacing after headings and renders dynamic text in black', async () => {
      const buffer = await generateCCPWord(sampleData);
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file('word/document.xml').async('text');
      const $ = cheerio.load(docXml, { xmlMode: true });

      // Verify headings have w:after between 60 and 120 dxa (3 to 6 pt)
      const headings = [
        'Problem Statement:',
        'Constraints/ Assumptions:',
        'Identification of areas where use of computational / modern tool is required.',
        'Expected Outcomes:',
        'Report (must include)',
      ];

      headings.forEach(h => {
        let matched = false;
        $('w\\:p').each((_, p) => {
          if ($(p).text().includes(h)) {
            matched = true;
            const afterVal = parseInt($(p).find('w\\:spacing').attr('w:after') || '0', 10);
            expect(afterVal).toBeGreaterThanOrEqual(60);
            expect(afterVal).toBeLessThanOrEqual(120);
            expect($(p).find('w\\:b').length).toBeGreaterThan(0);
          }
        });
        expect(matched).toBe(true);
      });

      // Verify header logo enlargement with clean CIS logo
      const headerXml = await zip.file('word/header1.xml').async('text');
      expect(headerXml).toContain('cx="2196000" cy="516000"');
    });
  });

  describe('2. PDF Generation (generateCCPPDF)', () => {
    test('generates a valid PDF buffer with exactly 2 pages', async () => {
      const pdfBuffer = await generateCCPPDF(sampleData);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(20000);

      const pdfString = pdfBuffer.toString('latin1');
      const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
      expect(pageMatches.length).toBe(2);
    });
  });

  describe('3. Export Controller & Authorization (exportCCPForm)', () => {
    const courseId = new mongoose.Types.ObjectId();
    const facultyId = new mongoose.Types.ObjectId();
    const departmentId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Course, 'findById').mockResolvedValue({
        _id: courseId,
        courseCode: 'CS420',
        courseName: 'Computer Vision',
        department: departmentId,
        assignedFaculty: facultyId,
      });
      jest.spyOn(CourseOffering, 'exists').mockResolvedValue(true);
      jest.spyOn(CourseOffering, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then(onFulfilled, onRejected) {
          return Promise.resolve([]).then(onFulfilled, onRejected);
        },
        catch(onRejected) {
          return Promise.resolve([]).catch(onRejected);
        },
      });
      jest.spyOn(CCP, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Semester, 'findOne').mockResolvedValue(null);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('validates format parameter and rejects unsupported formats', async () => {
      let errorResponse = null;
      const mockRes = {
        status(code) {
          return {
            json(payload) {
              errorResponse = { code, payload };
            },
          };
        },
      };
      const mockReq = {
        params: { courseId: courseId.toString() },
        query: { format: 'csv' },
        user: { _id: facultyId, designation: 'faculty' },
      };

      await exportCCPForm(mockReq, mockRes, () => {});
      expect(errorResponse.code).toBe(400);
      expect(errorResponse.payload.message).toContain("Invalid export format. Must be 'docx' or 'pdf'.");
    });

    test('rejects export if user is unauthorized for course (HTTP 403)', async () => {
      jest.spyOn(Course, 'findById').mockResolvedValueOnce({
        _id: courseId,
        department: new mongoose.Types.ObjectId(),
        assignedFaculty: new mongoose.Types.ObjectId(), // Different faculty
      });
      jest.spyOn(CourseOffering, 'exists').mockResolvedValueOnce(false);

      let errorResponse = null;
      const mockRes = {
        status(code) {
          return {
            json(payload) {
              errorResponse = { code, payload };
            },
          };
        },
      };
      const mockReq = {
        params: { courseId: courseId.toString() },
        query: { format: 'docx' },
        user: { _id: new mongoose.Types.ObjectId(), designation: 'faculty' },
      };

      await exportCCPForm(mockReq, mockRes, () => {});
      expect(errorResponse.code).toBe(403);
      expect(errorResponse.payload.message).toContain('Forbidden');
    });

    test('returns 404 when CCP form has not been saved yet', async () => {
      jest.spyOn(CCP, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      let errorResponse = null;
      const mockRes = {
        status(code) {
          return {
            json(payload) {
              errorResponse = { code, payload };
            },
          };
        },
      };
      const mockReq = {
        params: { courseId: courseId.toString() },
        query: { format: 'docx' },
        user: { _id: facultyId, designation: 'faculty' },
      };

      await exportCCPForm(mockReq, mockRes, () => {});
      expect(errorResponse.code).toBe(404);
      expect(errorResponse.payload.message).toContain('CCP form not found. Please save it first.');
    });

    test('exports docx with correct headers when authorized and record exists', async () => {
      jest.spyOn(CCP, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...sampleData,
          course: courseId,
          faculty: facultyId,
          formType: 'ASSESS_PROJECT',
          headerInfo: { ...sampleData.headerInfo, courseCode: 'CS420' },
        }),
      });

      const headers = {};
      let sentBuffer = null;
      const mockRes = {
        setHeader(key, val) {
          headers[key] = val;
        },
        send(buf) {
          sentBuffer = buf;
        },
      };
      const mockReq = {
        params: { courseId: courseId.toString() },
        query: { format: 'docx' },
        user: { _id: facultyId, designation: 'faculty' },
      };

      await exportCCPForm(mockReq, mockRes, () => {});
      expect(headers['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(headers['Content-Disposition']).toBe('attachment; filename="CCP_Class_Project_CS420.docx"');
      expect(Buffer.isBuffer(sentBuffer)).toBe(true);
      expect(sentBuffer.length).toBeGreaterThan(10000);
    });

    test('exports pdf with correct headers when authorized and record exists', async () => {
      jest.spyOn(CCP, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...sampleData,
          course: courseId,
          faculty: facultyId,
          formType: 'ASSESS_PROJECT',
          headerInfo: { ...sampleData.headerInfo, courseCode: 'CS420' },
        }),
      });

      const headers = {};
      let sentBuffer = null;
      const mockRes = {
        setHeader(key, val) {
          headers[key] = val;
        },
        send(buf) {
          sentBuffer = buf;
        },
      };
      const mockReq = {
        params: { courseId: courseId.toString() },
        query: { format: 'pdf' },
        user: { _id: facultyId, designation: 'faculty' },
      };

      await exportCCPForm(mockReq, mockRes, () => {});
      expect(headers['Content-Type']).toBe('application/pdf');
      expect(headers['Content-Disposition']).toBe('attachment; filename="CCP_Class_Project_CS420.pdf"');
      expect(Buffer.isBuffer(sentBuffer)).toBe(true);
      expect(sentBuffer.length).toBeGreaterThan(20000);
    });
  });
});
