/**
 * course.service.js (client) — Course catalog API calls
 *
 * NOTE: assignCourseFaculty, unassignCourseFaculty, getMyCourses have been
 *       removed. Faculty assignment is now via courseOffering.service.js.
 */
import api from '../api/axios';

export const getCourses = async () => {
  const { data } = await api.get('/courses');
  return data.data; // { courses }
};
