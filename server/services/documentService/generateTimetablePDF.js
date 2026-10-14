/**
 * generateTimetablePDF.js — Generates an A4 Landscape PDF matching the official Class Schedule and Counseling Hours format.
 */
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { launchBrowser } = require('./launchBrowser');
const { DAYS_OF_WEEK } = require('../../models/Timetable.model');
const { timeToMinutes } = require('../timetable.validator');

const DAY_LABELS = {
  Monday: 'MON',
  Tuesday: 'TUES',
  Wednesday: 'WED',
  Thursday: 'THUR',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
  MON: 'MON',
  TUES: 'TUES',
  WED: 'WED',
  THUR: 'THUR',
  FRI: 'FRI',
  SAT: 'SAT',
  SUN: 'SUN'
};

/**
 * Preprocess timetable data into a clean structure ready for the Handlebars template.
 * @param {object} timetable
 * @returns {object}
 */
const preprocessTimetableForPDF = (timetable) => {
  const timeSlots = [...(timetable.timeSlots || [])];
  timeSlots.sort((a, b) => (timeToMinutes(a.startTime) || 0) - (timeToMinutes(b.startTime) || 0));

  const slotIndexMap = new Map();
  timeSlots.forEach((slot, idx) => {
    slotIndexMap.set(slot.slotId, idx);
  });

  const slotCount = timeSlots.length;

  // Determine days list
  let daysConfig = timetable.days && timetable.days.length > 0
    ? timetable.days
    : DAYS_OF_WEEK.map((d) => ({ day: d, isOffDay: ['Saturday', 'Sunday'].includes(d) }));

  const activities = timetable.activities || [];

  const processedDays = daysConfig.map((dayCfg) => {
    const dayName = dayCfg.day;
    const dayLabel = DAY_LABELS[dayName] || dayName;

    if (dayCfg.isOffDay) {
      return {
        day: dayName,
        dayLabel,
        isOffDay: true,
        cells: []
      };
    }

    const dayActivities = activities.filter((a) => a.day === dayName);

    // Map starting slot indices
    const actByStartIdx = new Map();
    dayActivities.forEach((act) => {
      const sIdx = slotIndexMap.get(act.startSlotId);
      const eIdx = slotIndexMap.get(act.endSlotId);
      if (sIdx !== undefined && eIdx !== undefined && eIdx >= sIdx) {
        actByStartIdx.set(sIdx, {
          activity: act,
          startIdx: sIdx,
          endIdx: eIdx,
          colspan: eIdx - sIdx + 1
        });
      }
    });

    const cells = [];
    let k = 0;
    while (k < slotCount) {
      if (actByStartIdx.has(k)) {
        const item = actByStartIdx.get(k);
        const act = item.activity;

        cells.push({
          isActivity: true,
          colspan: item.colspan,
          title: act.title || 'Scheduled Activity',
          venue: act.venue || '',
          activityType: act.activityType || '',
          notes: act.notes || ''
        });
        k = item.endIdx + 1;
      } else {
        cells.push({
          isActivity: false,
          colspan: 1
        });
        k++;
      }
    }

    return {
      day: dayName,
      dayLabel,
      isOffDay: false,
      cells
    };
  });

  // Base64 Logo
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  let logoBase64 = null;
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  }

  const academicTerm = timetable.facultyInfo?.academicTerm ||
    (timetable.semester && timetable.semester.name ? timetable.semester.name : 'Current Term');

  return {
    facultyInfo: {
      facultyName: timetable.facultyInfo?.facultyName || '',
      designation: timetable.facultyInfo?.designation || '',
      department: timetable.facultyInfo?.department || 'Department of Computer Science',
      facultySchool: timetable.facultyInfo?.facultySchool || 'Faculty of Engineering Sciences and Technology',
      academicTerm
    },
    academicTerm,
    timeSlots,
    slotCount,
    processedDays,
    consultingHours: timetable.consultingHours || [],
    logoBase64
  };
};

/**
 * Generate PDF buffer for timetable.
 * @param {object} timetable
 * @returns {Promise<Buffer>}
 */
const generateTimetablePDF = async (timetable) => {
  let browser;
  try {
    const templateData = preprocessTimetableForPDF(timetable);
    const templatePath = path.join(__dirname, 'templates', 'timetableTemplate.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    const template = handlebars.compile(templateHtml);
    const finalHtml = template(templateData);

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.4in',
        bottom: '0.4in',
        left: '0.5in',
        right: '0.5in'
      }
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Timetable PDF Generation Error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = {
  generateTimetablePDF,
  preprocessTimetableForPDF
};
