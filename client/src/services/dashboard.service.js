import api from '../api/axios';

/**
 * Fetch Dean Dashboard Statistics
 * @returns {Promise<Object>} Statistics object
 */
export const getDeanDashboardStats = async () => {
  const response = await api.get('/dashboard/dean');
  return response.data;
};

/**
 * Fetch HoD Dashboard Statistics
 * @returns {Promise<Object>} Statistics object
 */
export const getHodDashboardStats = async () => {
  const response = await api.get('/dashboard/hod');
  return response.data;
};
