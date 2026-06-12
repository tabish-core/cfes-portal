/**
 * cisImportMapper.js — Transforms raw DOCX extraction data into CIS form state.
 *
 * Input:  The `data` object from cisImportService.parseDocxBuffer()
 * Output: { formState, importSummary }
 *
 * formState keys match the React useState hooks in CourseInformationSheetPage.jsx:
 *   courseSummary, basicInfo, courseObjectives, courseContents,
 *   cloData, textbooks, obaData, weeklyPlan, grading
 *
 * Does NOT save to MongoDB or modify any existing CIS functionality.
 */

/* ── Helpers ────────────────────────────────────────────── */

/** Safely get a cell's text from a table row. Returns '' if missing. */
const cellText = (table, rowIdx, cellIdx) => {
  return table?.rows?.[rowIdx]?.cells?.[cellIdx]?.text?.trim() || '';
};

/** Safely get a cell's inner HTML from a table row. */
const cellHtml = (table, rowIdx, cellIdx) => {
  return table?.rows?.[rowIdx]?.cells?.[cellIdx]?.html || '';
};

/** Strip '%' suffix and parse to number. Returns '' if not a number. */
const parsePercent = (text) => {
  if (!text) return '';
  const cleaned = text.replace(/%/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? '' : num;
};

/** Parse a string to number, return '' if not a number. */
const parseNum = (text) => {
  if (!text) return '';
  const cleaned = text.trim();
  const num = Number(cleaned);
  return isNaN(num) ? '' : num;
};

/**
 * OBA category normalization.
 * Maps extracted DOCX category text to the exact <select> option values
 * used in OBATable.jsx's CATEGORY_OPTIONS.
 */
const CATEGORY_OPTIONS = [
  'Quiz', 'Assignment', 'Midterm', 'Final Exam',
  'Project', 'Lab', 'Presentation', 'Class Participation', 'Other'
];

const normalizeCategoryMap = {
  'quiz': 'Quiz',
  'quizzes': 'Quiz',
  'assignment': 'Assignment',
  'assignments': 'Assignment',
  'midterm': 'Midterm',
  'mid-term': 'Midterm',
  'mid term': 'Midterm',
  'final': 'Final Exam',
  'final exam': 'Final Exam',
  'final examination': 'Final Exam',
  'project': 'Project',
  'lab': 'Lab',
  'laboratory': 'Lab',
  'presentation': 'Presentation',
  'class participation': 'Class Participation',
  'participation': 'Class Participation',
};

const normalizeCategory = (rawCategory) => {
  if (!rawCategory) return '';
  const trimmed = rawCategory.trim();

  // Check exact match first
  if (CATEGORY_OPTIONS.includes(trimmed)) return trimmed;

  // Try normalized lookup
  const lower = trimmed.toLowerCase();
  if (normalizeCategoryMap[lower]) return normalizeCategoryMap[lower];

  // Partial match — check if any option is contained in the text
  for (const opt of CATEGORY_OPTIONS) {
    if (lower.includes(opt.toLowerCase())) return opt;
  }

  // Fallback: use original text (will show in "Other" / may not match dropdown)
  return trimmed;
};


/* ── Main Mapper ────────────────────────────────────────── */

/**
 * Map extracted DOCX data into CIS form state.
 * @param {Object} extractedData — output of cisImportService.parseDocxBuffer()
 * @returns {{ formState: Object, importSummary: Object }}
 */
const mapExtractedToFormState = (extractedData) => {
  const { tables } = extractedData;
  const imported = [];
  const missing = [];
  const unmapped = [];

  // We expect 9 tables in the standard CIS template
  if (!tables || tables.length < 9) {
    // Still try to map what we can
    console.warn(`[CIS Mapper] Expected 9 tables, found ${tables?.length || 0}`);
  }

  /* ── Table 1: Course Summary ────────────────────────── */
  const courseSummary = { courseCode: '', courseName: '', creditHours: '' };
  if (tables[0] && tables[0].rows.length >= 5) {
    const t = tables[0];
    courseSummary.courseCode = cellText(t, 4, 0);
    courseSummary.courseName = cellText(t, 4, 1);
    courseSummary.creditHours = cellText(t, 4, 2);

    if (courseSummary.courseCode) imported.push('courseSummary.courseCode');
    else missing.push('courseSummary.courseCode');

    if (courseSummary.courseName) imported.push('courseSummary.courseName');
    else missing.push('courseSummary.courseName');

    if (courseSummary.creditHours) imported.push('courseSummary.creditHours');
    else missing.push('courseSummary.creditHours');
  } else {
    missing.push('courseSummary (table not found)');
  }

  /* ── Table 2: Basic Information ─────────────────────── */
  const basicInfo = {
    instructor: '', designation: '', prerequisites: '', semester: '',
    email: '', phone: '', consultingHours: '', officeLocation: '',
  };
  if (tables[1] && tables[1].rows.length >= 5) {
    const t = tables[1];
    // Row 2 (index 1): Instructor | Value | Designation | Value
    basicInfo.instructor = cellText(t, 1, 1);
    basicInfo.designation = cellText(t, 1, 3);
    // Row 3 (index 2): Prerequisite(s) | Value | Semester | Value
    basicInfo.prerequisites = cellText(t, 2, 1);
    basicInfo.semester = cellText(t, 2, 3);
    // Row 4 (index 3): Email | Value | Phone | Value
    basicInfo.email = cellText(t, 3, 1);
    basicInfo.phone = cellText(t, 3, 3);
    // Row 5 (index 4): Consulting Hours | Value | Office Location | Value
    basicInfo.consultingHours = cellText(t, 4, 1);
    basicInfo.officeLocation = cellText(t, 4, 3);

    const biFields = ['instructor', 'designation', 'prerequisites', 'semester', 'email', 'phone', 'consultingHours', 'officeLocation'];
    biFields.forEach(f => {
      if (basicInfo[f]) imported.push(`basicInfo.${f}`);
      else missing.push(`basicInfo.${f}`);
    });
  } else {
    missing.push('basicInfo (table not found)');
  }

  /* ── Table 3: Course Objectives ─────────────────────── */
  let courseObjectives = '';
  if (tables[2] && tables[2].rows.length >= 2) {
    courseObjectives = cellText(tables[2], 1, 0);
    if (courseObjectives) imported.push('courseObjectives');
    else missing.push('courseObjectives');
  } else {
    missing.push('courseObjectives (table not found)');
  }

  /* ── Table 4: Course Contents ───────────────────────── */
  let courseContents = '';
  if (tables[3] && tables[3].rows.length >= 2) {
    courseContents = cellText(tables[3], 1, 0);
    if (courseContents) imported.push('courseContents');
    else missing.push('courseContents');
  } else {
    missing.push('courseContents (table not found)');
  }

  /* ── Table 5: CLO Table ─────────────────────────────── */
  const cloData = [];
  if (tables[4]) {
    const t = tables[4];
    // Rows 0-2 are headers (title + 2-row header). Data starts at row 3.
    // Last row is a footer note — exclude it.
    const dataStartRow = 3;
    const dataEndRow = t.rows.length - 1; // exclude footer

    // Capture ACM KA and SGD from first data row (they're vertically merged)
    let sharedAcmKa = '';
    let sharedSgd = '';

    for (let i = dataStartRow; i < dataEndRow; i++) {
      const row = t.rows[i];
      if (!row || !row.cells || row.cells.length < 4) continue;

      const clo = {
        cloNumber: row.cells[0]?.text?.trim() || '',
        cloStatement: row.cells[1]?.text?.trim() || '',
        btLevel: row.cells[2]?.text?.trim() || '',
        gaMapping: row.cells[3]?.text?.trim() || '',
        acmKaMapping: '',
        sgdMapping: '',
        weightPercentage: '',
      };

      // Handle merged cells: mammoth may include them only in the first row
      // or may omit them from subsequent rows (fewer cells)
      if (row.cells.length >= 7) {
        // Full row with all columns
        if (i === dataStartRow) {
          sharedAcmKa = row.cells[4]?.text?.trim() || '';
          sharedSgd = row.cells[5]?.text?.trim() || '';
        }
        clo.weightPercentage = parsePercent(row.cells[6]?.text);
      } else if (row.cells.length >= 5) {
        // Merged cells omitted — weight is at index 4
        clo.weightPercentage = parsePercent(row.cells[4]?.text);
      }

      // Apply shared merged values to all rows
      clo.acmKaMapping = sharedAcmKa;
      clo.sgdMapping = sharedSgd;

      cloData.push(clo);
    }

    if (cloData.length > 0) imported.push(`cloData (${cloData.length} rows)`);
    else missing.push('cloData (no data rows found)');
  } else {
    missing.push('cloData (table not found)');
  }

  /* ── Table 6: Textbooks ─────────────────────────────── */
  const textbooks = [];
  if (tables[5]) {
    const t = tables[5];
    // Row 0: title header, Row 1: column header (but in our template both are
    // often merged into row 0 as title). Let's detect header rows by checking
    // if the first cell contains a section number or header keyword.
    let dataStartRow = 1; // default

    // Find the first data row by skipping headers
    for (let i = 0; i < Math.min(3, t.rows.length); i++) {
      const firstCell = t.rows[i]?.cells?.[0]?.text?.trim()?.toLowerCase() || '';
      if (firstCell.startsWith('5.') || firstCell.includes('textbook') || firstCell.includes('book title') || firstCell === 's.no' || firstCell === 'sr.' || firstCell === '#') {
        dataStartRow = i + 1;
      }
    }

    for (let i = dataStartRow; i < t.rows.length; i++) {
      const row = t.rows[i];
      if (!row || !row.cells || row.cells.length < 2) continue;

      const book = {
        serialNo: row.cells[0]?.text?.trim() || `${textbooks.length + 1}`,
        bookTitle: row.cells[1]?.text?.trim() || '',
        authors: row.cells[2]?.text?.trim() || '',
        editionPublicationPublisher: row.cells[3]?.text?.trim() || '',
      };

      // Skip rows that look like they're empty or are another header
      if (!book.bookTitle && !book.authors) continue;

      textbooks.push(book);
    }

    if (textbooks.length > 0) imported.push(`textbooks (${textbooks.length} books)`);
    else missing.push('textbooks (no data rows found)');
  } else {
    missing.push('textbooks (table not found)');
  }

  /* ── Table 7: OBA Table ─────────────────────────────── */
  const obaData = [];
  if (tables[6]) {
    const t = tables[6];
    // Row 0: title ("6. CLO Outcome Based Assessment..."), 1 cell colspan=7
    // Row 1: column headers ("Assessment Tool" colspan=2, ...), 6 cells
    // Data rows: 7 cells — cell[0] = "CategoryNameWeight" (e.g. "Quiz10"),
    //   cell[1]=tool, cell[2]=cloMapped, cell[3]=marks, cell[4]=weight%, cell[5]=total, cell[6]=date
    // Total rows: 5 cells with "Total Category %" — skip
    // Spacing rows: 1 cell empty — skip
    // Grand total: 4 cells with "Total Marks" — skip
    // Footer note: 1 cell "Note:..." — skip

    for (let i = 2; i < t.rows.length; i++) {
      const row = t.rows[i];
      if (!row || !row.cells) continue;

      // Skip 1-cell rows (spacing rows, footer notes)
      if (row.cells.length <= 1) continue;

      // Skip total rows (5 cells or 4 cells containing "total")
      if (row.cells.length <= 5) {
        const rowText = row.cells.map(c => c.text?.trim() || '').join(' ').toLowerCase();
        if (rowText.includes('total')) continue;
      }

      // Only process 7-cell data rows
      if (row.cells.length >= 7) {
        const firstCellText = row.cells[0]?.text?.trim() || '';

        // Extract category name by stripping trailing digits from the
        // concatenated "CategoryNameWeight" string (e.g., "Quiz10" → "Quiz")
        const categoryRaw = firstCellText.replace(/\d+\s*$/, '').trim();
        const category = normalizeCategory(categoryRaw);

        const obaRow = {
          category,
          assessmentTool: row.cells[1]?.text?.trim() || '',
          cloMapped: row.cells[2]?.text?.trim() || '',
          cloMarks: parseNum(row.cells[3]?.text),
          weightPercentage: parsePercent(row.cells[4]?.text),
          totalMarks: parseNum(row.cells[5]?.text),
          assessmentDate: row.cells[6]?.text?.trim() || '',
        };

        if (obaRow.assessmentTool || obaRow.cloMapped) {
          obaData.push(obaRow);
        }
      }
    }

    if (obaData.length > 0) imported.push(`obaData (${obaData.length} rows)`);
    else missing.push('obaData (no data rows found)');
  } else {
    missing.push('obaData (table not found)');
  }

  /* ── Table 8: Weekly Plan ───────────────────────────── */
  const weeklyPlan = [];
  if (tables[7]) {
    const t = tables[7];
    // Row 0: title, Row 1: header. Data starts at row 2.
    let currentWeek = '';

    for (let i = 2; i < t.rows.length; i++) {
      const row = t.rows[i];
      if (!row || !row.cells) continue;

      // Detect special rows (Midterm/Final) — they have 2 cells with colspan
      if (row.cells.length === 2) {
        const weekCell = row.cells[0]?.text?.trim() || '';
        const spanText = row.cells[1]?.text?.trim() || '';
        const isSpecial = spanText.toLowerCase().includes('midterm') ||
                          spanText.toLowerCase().includes('final') ||
                          row.cells[1]?.colspan > 1;

        if (isSpecial) {
          weeklyPlan.push({
            week: weekCell,
            lectureNo: '',
            topicCovered: '',
            clo: '',
            assessmentTool: '',
            isSpecialRow: true,
            specialRowText: spanText,
          });
          currentWeek = ''; // Reset for next week
          continue;
        }
      }

      // Normal rows: may have 4 or 5 cells depending on week column merge
      if (row.cells.length >= 5) {
        // Full row with week column
        currentWeek = row.cells[0]?.text?.trim() || currentWeek;
        weeklyPlan.push({
          week: currentWeek,
          lectureNo: row.cells[1]?.text?.trim() || '',
          topicCovered: row.cells[2]?.text?.trim() || '',
          clo: row.cells[3]?.text?.trim() || '',
          assessmentTool: row.cells[4]?.text?.trim() || '',
          isSpecialRow: false,
          specialRowText: '',
        });
      } else if (row.cells.length >= 4) {
        // Week column merged from above — omitted by mammoth
        weeklyPlan.push({
          week: currentWeek,
          lectureNo: row.cells[0]?.text?.trim() || '',
          topicCovered: row.cells[1]?.text?.trim() || '',
          clo: row.cells[2]?.text?.trim() || '',
          assessmentTool: row.cells[3]?.text?.trim() || '',
          isSpecialRow: false,
          specialRowText: '',
        });
      }
    }

    if (weeklyPlan.length > 0) imported.push(`weeklyPlan (${weeklyPlan.length} rows)`);
    else missing.push('weeklyPlan (no data rows found)');
  } else {
    missing.push('weeklyPlan (table not found)');
  }

  /* ── Table 9: Grading Policy ────────────────────────── */
  const grading = {
    quizzes: '', assignments: '', project: '', midterm: '', finalExam: '',
  };
  if (tables[8]) {
    const t = tables[8];
    // Structure: Row 0 = header, Row 1 = data
    // Row 1, Cell 0: labels (multiple paragraphs), Cell 1: values (multiple paragraphs)
    if (t.rows.length >= 2 && t.rows[1]?.cells?.length >= 2) {
      // The values cell contains multiple lines, one per grading component
      // Extract from the HTML to get individual paragraphs
      const valuesHtml = cellHtml(t, 1, 1);

      // Parse the values — they appear as separate <p> tags
      const valueMatches = valuesHtml.match(/<p[^>]*>(.*?)<\/p>/g) || [];
      const values = valueMatches.map(match => {
        const text = match.replace(/<[^>]+>/g, '').trim();
        return parsePercent(text);
      });

      // Map values in order: quizzes, assignments, project, midterm, finalExam
      const keys = ['quizzes', 'assignments', 'project', 'midterm', 'finalExam'];
      keys.forEach((key, idx) => {
        if (values[idx] !== undefined && values[idx] !== '') {
          grading[key] = values[idx];
          imported.push(`grading.${key}`);
        } else {
          missing.push(`grading.${key}`);
        }
      });
    } else {
      missing.push('grading (table structure unexpected)');
    }
  } else {
    missing.push('grading (table not found)');
  }

  // instructorGradingPolicy is UI-only, not in DOCX
  unmapped.push('grading.instructorGradingPolicy (not present in DOCX template)');

  /* ── Build Result ───────────────────────────────────── */
  const formState = {
    courseSummary,
    basicInfo,
    courseObjectives,
    courseContents,
    cloData,
    textbooks,
    obaData,
    weeklyPlan,
    grading,
  };

  const importSummary = {
    imported,
    missing,
    unmapped,
    importedCount: imported.length,
    missingCount: missing.length,
    unmappedCount: unmapped.length,
  };

  return { formState, importSummary };
};


/* ── OBA Helper ─────────────────────────────────────────── */

/** Heuristic: is this cell text likely an OBA category name? */
const isLikelyCategory = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().replace(/\d+/g, '').trim();
  const categoryKeywords = [
    'quiz', 'assignment', 'midterm', 'final', 'project',
    'lab', 'presentation', 'participation', 'exam',
  ];
  return categoryKeywords.some(kw => lower.includes(kw));
};


module.exports = { mapExtractedToFormState };
