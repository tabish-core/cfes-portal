/**
 * auth.service.js (client) — All auth-related API calls.
 * Keeps Axios calls out of components and context.
 */
import api from '../api/axios';

/**
 * Login with email + password.
 * @returns {{ user, token }}
 */
export const loginUser = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data; // { user, token }
};

/**
 * Fetch the currently authenticated user's profile.
 * @returns {{ user }}
 */
export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data.data; // { user }
};

/**
 * Admin creates a faculty account.
 * @param {{ name: string, email: string, password: string, department?: string }} payload
 * @returns {{ user, token }}
 */
export const registerFaculty = async (payload) => {
  const { data } = await api.post('/auth/register', {
    designation: 'faculty', // default
    ...payload,
  });
  return data.data; // { user, token }
};

/**
 * Admin fetches all faculty users.
 * @returns {{ faculties: Array }}
 */
export const getFaculties = async () => {
  const { data } = await api.get('/users/faculty');
  return data.data; // { faculties }
};

/**
 * Admin updates a faculty user's credentials/profile.
 * @param {string} id
 * @param {{ name?: string, email?: string, password?: string, department?: string, isActive?: boolean }} payload
 * @returns {{ faculty: object }}
 */
export const updateFacultyUser = async (id, payload) => {
  const { data } = await api.put(`/users/faculty/${id}`, payload);
  return data.data; // { faculty }
};
