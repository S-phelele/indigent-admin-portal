import axios from 'axios';

/**
 * The one HTTP client.
 *
 * No default Content-Type: axios sets application/json automatically for object
 * payloads, and leaving it unset lets the browser generate the multipart boundary
 * for FormData uploads. Forcing it here breaks file uploads.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // A request that never returns leaves a spinner turning forever, which reads
  // as the site being broken. Better to fail and say so.
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Retry a read once when the network hiccups.
 *
 * Municipal connections drop packets. A GET is safe to repeat — it changes
 * nothing — and one silent retry turns a large share of "something went wrong"
 * into a page that simply loaded. Writes are never retried: repeating a POST
 * could create a second application or send a second SMS.
 */
async function retryOnce(error) {
  const config = error.config;
  const isRead = (config?.method || 'get').toLowerCase() === 'get';
  const noResponse = !error.response;

  if (isRead && noResponse && !config.__retried) {
    config.__retried = true;
    await new Promise((r) => setTimeout(r, 600));
    return api(config);
  }
  return Promise.reject(error);
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;

    if (status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      const path = window.location.pathname;
      if (!path.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    // A password issued by staff and sent over SMS has to be replaced before
    // anything else works. Send them to the one page that lets them.
    if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
      if (!window.location.pathname.includes('/profile')) window.location.href = '/profile';
      return Promise.reject(err);
    }

    if (status === 403 && code === 'ACCOUNT_DEACTIVATED') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login?deactivated=1';
      return Promise.reject(err);
    }

    return retryOnce(err);
  }
);

export default api;
