/**
 * course.service.js (client) — Course allocation API calls
 */
import api from '../api/axios';

export const getCourses = async () => {
  const { data } = await api.get('/courses');
  return data.data; // { courses }
};

export const getMyCourses = async () => {
  const { data } = await api.get('/courses/my-courses');
  return data.data; // { courses }
};

export const assignCourseFaculty = async (courseId, facultyId, force = false) => {
  const { data } = await api.patch(`/courses/${courseId}/assign`, { facultyId, force });
  return data.data; // { course }
};

export const unassignCourseFaculty = async (courseId) => {
  const { data } = await api.patch(`/courses/${courseId}/unassign`);
  return data.data; // { course }
};
