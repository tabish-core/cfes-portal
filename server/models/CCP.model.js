/**
 * CCP.model.js — Mongoose schema for Complex Computing Problem (CCP) /
 * Complex Engineering Problem (CEP) / Class Project form (formType: 'ASSESS_PROJECT').
 *
 * Follows the project's established conventions (CIS/CCC models):
 *  - Compound unique index on { course, faculty, semester, formType }
 *  - Logical sections: Header, Mapping, Problem Statement & Narratives,
 *    Deliverables Checklist, WP1–WP8 Attributes & Justifications.
 */
const mongoose = require('mongoose');

const deliverableItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const wpAttributeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    isMapped: { type: Boolean, default: false },
    justification: { type: String, default: '' },
  },
  { _id: false }
);

const DEFAULT_DELIVERABLE_ITEMS = [
  { label: 'Introduction', required: true, completed: false },
  { label: 'Literature review (discuss two models)', required: true, completed: false },
  { label: 'Designed model', required: true, completed: false },
  { label: 'Methodology', required: true, completed: false },
  { label: 'Result and Discussion', required: true, completed: false },
  { label: 'References', required: true, completed: false },
];

const DEFAULT_WP_ATTRIBUTES = [
  {
    code: 'WP1',
    title: 'Range of Conflicting Requirements',
    description: 'Involve wide-ranging or conflicting technical, engineering and other issues.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP2',
    title: 'Depth of Analysis required',
    description: 'Have no obvious solution and require abstract thinking, originality in analysis to formulate suitable models.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP3',
    title: 'Depth of Knowledge required',
    description: 'Requires research-based knowledge much of which is at, or informed by, the forefront of the academic discipline.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP4',
    title: 'Familiarity of issues',
    description: 'Involve infrequently encountered issues.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP5',
    title: 'Extent of applicable codes',
    description: 'Are outside problems encompassed by standards and codes of practice for professional engineering/computing.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP6',
    title: 'Extent of stakeholder involvement and level of conflicting requirements.',
    description: 'Involve diverse groups of stakeholders with widely varying needs.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP7',
    title: 'Consequences',
    description: 'Have significant consequences in a range of contexts, characterized by serious problems with respect to health and safety, society, politics, business, etc.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP8',
    title: 'Interdependence',
    description: 'Are high level problems including many component parts or sub-problems.',
    isMapped: false,
    justification: '',
  },
];

const ccpSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      default: null,
    },
    formType: {
      type: String,
      enum: ['ASSESS_PROJECT'],
      default: 'ASSESS_PROJECT',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted'],
      default: 'draft',
    },

    // 1. Header Information
    headerInfo: {
      department: { type: String, default: '' },
      program: { type: String, default: '' },
      courseTitle: { type: String, default: '' },
      courseCode: { type: String, default: '' },
      announcedDate: { type: String, default: '' },
      dueDate: { type: String, default: '' },
      totalMarks: { type: String, default: '' },
    },

    // 2. Mapping Table (Page 1)
    mappingTable: {
      mappedClo: { type: String, default: '' },
      sdg: { type: String, default: '' },
      knowledgeProfile: { type: String, default: '' },
      complexProblemSolvingMapped: { type: String, default: '' },
    },

    // 3. Problem Statement & Narratives (Page 1)
    problemStatement: { type: String, default: '' },
    constraintsAssumptions: { type: String, default: '' },
    computationalTools: { type: String, default: '' },
    expectedOutcomes: { type: String, default: '' },

    // 4. Deliverables Checklist (Page 1)
    deliverables: {
      heading: { type: String, default: 'Report (must include)' },
      items: {
        type: [deliverableItemSchema],
        default: () => DEFAULT_DELIVERABLE_ITEMS.map((item) => ({ ...item })),
      },
    },

    // 5. WP1–WP8 Attributes & Justifications (Page 2)
    wpAttributes: {
      type: [wpAttributeSchema],
      default: () => DEFAULT_WP_ATTRIBUTES.map((attr) => ({ ...attr })),
    },
  },
  { timestamps: true }
);

// Unique compound index: only one CCP per course + faculty + semester + formType
ccpSchema.index(
  { course: 1, faculty: 1, semester: 1, formType: 1 },
  { unique: true }
);

module.exports = mongoose.model('CCP', ccpSchema);
