/**
 * courseOffering.service.js (client) — Course Offering API calls
 */
import api from '../api/axios';

export const createOffering = async (facultyId, courseId, semesterId, section = 'A', departmentId = null) => {
  const payload = {
    facultyId: facultyId === 'UNASSIGNED' ? null : (facultyId || null),
    courseId,
    semesterId,
    section,
  };
  if (departmentId) payload.departmentId = departmentId;
  const { data } = await api.post('/offerings', payload);
  return data.data; // { offering }
};

export const removeOffering = async (offeringId) => {
  const { data } = await api.delete(`/offerings/${offeringId}`);
  return data.data; // { offering }
};

export const getOfferingsBySemester = async (semesterId, includeProgress = false) => {
  const url = includeProgress
    ? `/offerings?semester=${semesterId}&includeProgress=true`
    : `/offerings?semester=${semesterId}`;
  const { data } = await api.get(url);
  return data.data; // { offerings }
};

export const getMyOfferings = async (semesterId, includeProgress = true) => {
  const url = includeProgress
    ? `/offerings/my-courses?semester=${semesterId}&includeProgress=true`
    : `/offerings/my-courses?semester=${semesterId}`;
  const { data } = await api.get(url);
  return data.data; // { offerings }
};

export const getMyDashboardStats = async (semesterId) => {
  const { data } = await api.get(`/offerings/my-stats?semester=${semesterId}`);
  return data.data; // { stats }
};

export const getOfferingById = async (offeringId) => {
  const { data } = await api.get(`/offerings/${offeringId}`);
  return data.data; // { offering }
};

