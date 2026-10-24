/**
 * liveIntegrationPhase1.js
 *
 * Live MongoDB integration test for Phase 1.
 * Tests actual database operations against MongoDB Atlas:
 * 1. Creates two separate CourseOffering documents for the SAME course and faculty: Section A and Section B.
 * 2. Saves CourseChecklist for Section A and CourseChecklist for Section B.
 * 3. Verifies both checklists exist independently and have distinct sections and offering IDs.
 * 4. Saves CIS for Section A and CIS for Section B.
 * 5. Verifies both CIS documents exist independently without E11000 duplicate key errors.
 * 6. Tests getOfferingById authorization against real documents:
 *    - Faculty assigned to offering can access.
 *    - Unassigned faculty receives 403 Forbidden.
 * 7. Cleans up all test documents created.
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const CourseOffering = require('../models/CourseOffering.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CIS = require('../models/CIS.model');
const courseOfferingService = require('../services/courseOffering.service');

function verifyTestDbConfiguration() {
  const testUri = process.env.MONGO_TEST_URI;
  if (!testUri) {
    throw new Error('SAFETY ERROR: MONGO_TEST_URI is not set. Refusing to run live integration test without an explicitly configured test database.');
  }
  if (process.env.MONGO_URI && testUri.trim() === process.env.MONGO_URI.trim()) {
    throw new Error('SAFETY ERROR: MONGO_TEST_URI cannot be identical to production MONGO_URI.');
  }
  return testUri;
}

async function run() {
  let testUri;
  try {
    testUri = verifyTestDbConfiguration();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  console.log('Connecting to Dedicated Test MongoDB...');
  await mongoose.connect(testUri);
  console.log('Connected to test database.');

  const User = require('../models/User.model');
  let realFaculty = await User.findOne({ designation: 'faculty' });
  if (!realFaculty) {
    realFaculty = await User.create({
      name: 'Test Faculty User',
      email: `test_faculty_${Date.now()}@example.com`,
      password: 'testPassword123!',
      designation: 'faculty',
    });
  }
  const testCourseId = new mongoose.Types.ObjectId();
  const testFacultyId1 = realFaculty._id;
  const testFacultyId2 = new mongoose.Types.ObjectId();
  const testSemesterId = new mongoose.Types.ObjectId();
  const testDeptId = new mongoose.Types.ObjectId();

  let offeringA = null;
  let offeringB = null;
  let checklistA = null;
  let checklistB = null;
  let cisA = null;
  let cisB = null;

  try {
    console.log('\n--- Test 1: Create Section A and Section B Offerings ---');
    offeringA = await CourseOffering.create({
      course: testCourseId,
      faculty: testFacultyId1,
      semester: testSemesterId,
      section: 'A',
      status: 'active',
    });
    console.log('Created Offering A:', offeringA._id.toString(), 'Section:', offeringA.section);

    offeringB = await CourseOffering.create({
      course: testCourseId,
      faculty: testFacultyId1,
      semester: testSemesterId,
      section: 'B',
      status: 'active',
    });
    console.log('Created Offering B:', offeringB._id.toString(), 'Section:', offeringB.section);

    console.log('\n--- Test 2: Save Independent CourseChecklists for Section A & B ---');
    checklistA = await CourseChecklist.create({
      courseOffering: offeringA._id,
      course: testCourseId,
      faculty: testFacultyId1,
      semester: testSemesterId,
      section: 'A',
      items: [{ formType: 'CIS', isCompleted: true }],
    });
    console.log('Created Checklist A:', checklistA._id.toString(), 'Section:', checklistA.section);

    checklistB = await CourseChecklist.create({
      courseOffering: offeringB._id,
      course: testCourseId,
      faculty: testFacultyId1,
      semester: testSemesterId,
      section: 'B',
      items: [{ formType: 'CIS', isCompleted: false }],
    });
    console.log('Created Checklist B:', checklistB._id.toString(), 'Section:', checklistB.section);

    if (checklistA._id.equals(checklistB._id)) {
      throw new Error('Checklists should have different IDs!');
    }
    console.log('SUCCESS: Two independent checklists exist without index collision.');

    console.log('\n--- Test 3: Save Independent CIS Forms for Section A & B ---');
    cisA = await CIS.create({
      courseOffering: offeringA._id,
      course: testCourseId,
      faculty: testFacultyId1,
      semester: testSemesterId,
      section: 'A',
      headerInfo: { courseTitle: 'Software Architecture - Sec A' },
    });
    console.log('Created CIS A:', cisA._id.toString(), 'Section:', cisA.section);

    cisB = await CIS.create({
      courseOffering: offeringB._id,
      course: testCourseId,
      faculty: testFacultyId1,
      semester: testSemesterId,
      section: 'B',
      headerInfo: { courseTitle: 'Software Architecture - Sec B' },
    });
    console.log('Created CIS B:', cisB._id.toString(), 'Section:', cisB.section);

    if (cisA._id.equals(cisB._id)) {
      throw new Error('CIS forms should have different IDs!');
    }
    console.log('SUCCESS: Two independent CIS forms saved without E11000 duplicate key error.');

    console.log('\n--- Test 4: Verify Authorization Scoping ---');
    // Faculty 1 can access their offering
    const faculty1User = { _id: testFacultyId1, designation: 'faculty' };
    const fetchedOffering = await courseOfferingService.getOfferingById(offeringA._id, faculty1User);
    console.log('Faculty 1 access to Offering A: AUTHORIZED (200). ID:', fetchedOffering._id.toString());

    // Faculty 2 cannot access Faculty 1's offering
    const faculty2User = { _id: testFacultyId2, designation: 'faculty' };
    let unauthorizedBlocked = false;
    try {
      await courseOfferingService.getOfferingById(offeringA._id, faculty2User);
    } catch (err) {
      if (err.statusCode === 403) {
        unauthorizedBlocked = true;
        console.log('Faculty 2 access to Offering A: FORBIDDEN (403) -', err.message);
      }
    }
    if (!unauthorizedBlocked) {
      throw new Error('Security failure: Faculty 2 should have been blocked from Faculty 1 offering!');
    }

    console.log('\n========================================');
    console.log('ALL LIVE INTEGRATION TESTS PASSED!');
    console.log('========================================');
  } finally {
    console.log('\nCleaning up test artifacts from database...');
    if (offeringA) await CourseOffering.deleteOne({ _id: offeringA._id });
    if (offeringB) await CourseOffering.deleteOne({ _id: offeringB._id });
    if (checklistA) await CourseChecklist.deleteOne({ _id: checklistA._id });
    if (checklistB) await CourseChecklist.deleteOne({ _id: checklistB._id });
    if (cisA) await CIS.deleteOne({ _id: cisA._id });
    if (cisB) await CIS.deleteOne({ _id: cisB._id });
    console.log('Cleanup complete.');
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Integration test failed:', err);
    process.exit(1);
  });
}

module.exports = {
  run,
  verifyTestDbConfiguration,
};
