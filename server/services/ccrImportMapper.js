/**
 * ccrImportMapper.js — Transforms raw DOCX extraction data into CCR form state.
 *
 * Input:  The `data` object from docxImportService.parseDocxBuffer()
 * Output: { formState, importSummary }
 */

/* ── Helpers ────────────────────────────────────────────── */

const cellText = (table, rowIdx, cellIdx) => {
  return table?.rows?.[rowIdx]?.cells?.[cellIdx]?.text?.trim() || '';
};

/* ── Main Mapper ────────────────────────────────────────── */

const mapExtractedToCCRFormState = (extractedData) => {
  const { tables } = extractedData;
  const imported = [];
  const missing = [];
  const unmapped = [];

  // We expect at least 4 tables in the CCR template
  if (!tables || tables.length < 4) {
    console.warn(`[CCR Mapper] Expected 4 tables, found ${tables?.length || 0}`);
  }

  /* ── Table 1: Course Information ──────────────────────── */
  const courseInfo = {
    facultyName: '', program: '', courseTitle: '', courseCode: '',
    edpCode: '', sessionDay: '', timeSlot: '', location: ''
  };

  if (tables[1] && tables[1].rows.length >= 4) {
    const t = tables[1];
    courseInfo.facultyName = cellText(t, 0, 1);
    courseInfo.sessionDay  = cellText(t, 0, 3);
    courseInfo.program     = cellText(t, 1, 1);
    courseInfo.timeSlot    = cellText(t, 1, 3);
    courseInfo.courseTitle = cellText(t, 2, 1);
    courseInfo.location    = cellText(t, 2, 3);
    courseInfo.edpCode     = cellText(t, 3, 1);
    courseInfo.courseCode  = cellText(t, 3, 3);

    const infoFields = ['facultyName', 'sessionDay', 'program', 'timeSlot', 'courseTitle', 'location', 'edpCode', 'courseCode'];
    infoFields.forEach(f => {
      if (courseInfo[f]) imported.push(`courseInfo.${f}`);
      else missing.push(`courseInfo.${f}`);
    });
  } else {
    missing.push('courseInfo (table not found)');
  }

  /* ── Table 2: Weekly Report ───────────────────────────── */
  const weeklyData = [];
  if (tables[2]) {
    const t = tables[2];
    let currentWeek = '';
    let currentDuration = '';

    // Row 0 is the header. Data starts at row 1.
    for (let i = 1; i < t.rows.length; i++) {
      const row = t.rows[i];
      if (!row || !row.cells) continue;

      const cells = row.cells;
      const rowText = cells.map(c => c.text).join(' ').toLowerCase();

      // Detection heuristic for special rows (Midterm/Final Exam)
      const isMidterm = rowText.includes('midterm') || (cells.length <= 4 && cells[2]?.text === 'MT');
      const isFinal = rowText.includes('final') || (cells.length <= 4 && cells[2]?.text === 'FE');

      if (isMidterm) {
        weeklyData.push({
          weekNo: cells[0]?.text || '8',
          isSpecialRow: true,
          specialRowText: 'Midterm',
          scheduleDate: '',
          activityType: 'MT',
          timeIn: '', timeOut: '', topicCovered: '', duration: '', signature: '', remarks: ''
        });
        currentWeek = '';
        currentDuration = '';
        continue;
      }

      if (isFinal) {
        weeklyData.push({
          weekNo: cells[0]?.text || '16',
          isSpecialRow: true,
          specialRowText: 'Final Exams',
          scheduleDate: '',
          activityType: 'FE',
          timeIn: '', timeOut: '', topicCovered: '', duration: '', signature: '', remarks: ''
        });
        currentWeek = '';
        currentDuration = '';
        continue;
      }

      // Normal rows
      if (cells.length >= 9) {
        currentWeek = cells[0].text || currentWeek;
        currentDuration = cells[6].text || currentDuration;
        weeklyData.push({
          weekNo: currentWeek,
          scheduleDate: cells[1].text,
          timeIn: cells[2].text,
          timeOut: cells[3].text,
          topicCovered: cells[4].text,
          activityType: cells[5].text,
          duration: currentDuration,
          signature: cells[7].text,
          remarks: cells[8].text,
          isSpecialRow: false,
        });
      } else if (cells.length === 8) {
        // Week No. omitted
        currentDuration = cells[5].text || currentDuration;
        weeklyData.push({
          weekNo: currentWeek,
          scheduleDate: cells[0].text,
          timeIn: cells[1].text,
          timeOut: cells[2].text,
          topicCovered: cells[3].text,
          activityType: cells[4].text,
          duration: currentDuration,
          signature: cells[6].text,
          remarks: cells[7].text,
          isSpecialRow: false,
        });
      } else if (cells.length === 7) {
        // Week No. and Duration omitted
        weeklyData.push({
          weekNo: currentWeek,
          scheduleDate: cells[0].text,
          timeIn: cells[1].text,
          timeOut: cells[2].text,
          topicCovered: cells[3].text,
          activityType: cells[4].text,
          duration: currentDuration,
          signature: cells[5].text,
          remarks: cells[6].text,
          isSpecialRow: false,
        });
      } else {
        // Just try to grab whatever we can (malformed)
        weeklyData.push({
          weekNo: currentWeek,
          scheduleDate: cells[0]?.text || '',
          timeIn: cells[1]?.text || '',
          timeOut: cells[2]?.text || '',
          topicCovered: cells[3]?.text || '',
          activityType: cells[4]?.text || '',
          duration: currentDuration,
          signature: cells[5]?.text || '',
          remarks: cells[6]?.text || '',
          isSpecialRow: false,
        });
      }
    }

    if (weeklyData.length > 0) imported.push(`weeklyData (${weeklyData.length} rows)`);
    else missing.push('weeklyData (no data rows found)');
  } else {
    missing.push('weeklyData (table not found)');
  }

  /* ── Table 3: Alternate Teacher ───────────────────────── */
  const alternateData = [];
  if (tables[3]) {
    const t = tables[3];
    // Row 0 is the Title row (colspan 9). Data starts at row 1.
    for (let i = 1; i < t.rows.length; i++) {
      const row = t.rows[i];
      if (!row || !row.cells) continue;
      const cells = row.cells;
      
      if (cells.length >= 9) {
        alternateData.push({
          rowNo: parseInt(cells[0].text) || (alternateData.length + 1),
          scheduleDate: cells[1].text,
          timeIn: cells[2].text,
          timeOut: cells[3].text,
          topicCovered: cells[4].text,
          activityType: cells[5].text,
          duration: cells[6].text,
          signature: cells[7].text,
          remarks: cells[8].text,
        });
      } else if (cells.length > 1) {
          // Graceful fallback for malformed rows
          alternateData.push({
            rowNo: parseInt(cells[0]?.text) || (alternateData.length + 1),
            scheduleDate: cells[1]?.text || '',
            timeIn: cells[2]?.text || '',
            timeOut: cells[3]?.text || '',
            topicCovered: cells[4]?.text || '',
            activityType: cells[5]?.text || '',
            duration: cells[6]?.text || '',
            signature: cells[7]?.text || '',
            remarks: cells[8]?.text || '',
          });
      }
    }
    
    if (alternateData.length > 0) imported.push(`alternateData (${alternateData.length} rows)`);
    else missing.push('alternateData (no data rows found)');
  } else {
    missing.push('alternateData (table not found)');
  }

  const formState = {
    courseInfo,
    weeklyData,
    alternateData,
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

module.exports = { mapExtractedToCCRFormState };
