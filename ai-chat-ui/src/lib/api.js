import axios from "axios";

export function createApiClient(getAccessTokenSilently) {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
  });
  instance.interceptors.request.use(async (config) => {
    const token = await getAccessTokenSilently();
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
    return config;
  });
  return instance;
}
