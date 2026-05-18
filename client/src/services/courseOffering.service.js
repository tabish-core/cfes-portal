/**
 * courseOffering.service.js (client) — Course Offering API calls
 */
import api from '../api/axios';

export const createOffering = async (facultyId, courseId, semesterId, section = 'A') => {
  const { data } = await api.post('/offerings', { facultyId, courseId, semesterId, section });
  return data.data; // { offering }
};

export const removeOffering = async (offeringId) => {
  const { data } = await api.delete(`/offerings/${offeringId}`);
  return data.data; // { offering }
};

export const getOfferingsBySemester = async (semesterId) => {
  const { data } = await api.get(`/offerings?semester=${semesterId}`);
  return data.data; // { offerings }
};

export const getMyOfferings = async (semesterId) => {
  const { data } = await api.get(`/offerings/my-courses?semester=${semesterId}`);
  return data.data; // { offerings }
};
