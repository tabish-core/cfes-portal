/**
 * semester.service.js (client) — Semester API calls
 */
import api from '../api/axios';

export const getSemesters = async () => {
  const { data } = await api.get('/semesters');
  return data.data; // { semesters }
};

export const getActiveSemester = async () => {
  const { data } = await api.get('/semesters/active');
  return data.data; // { semester }
};

export const createSemester = async (name) => {
  const { data } = await api.post('/semesters', { name });
  return data.data; // { semester }
};

export const toggleSemesterStatus = async (id) => {
  const { data } = await api.patch(`/semesters/${id}/toggle`);
  return data.data; // { semester }
};
