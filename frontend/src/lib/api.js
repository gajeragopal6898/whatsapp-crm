import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'https://whatsapp-crm-production-4099.up.railway.app'

const api = axios.create({ baseURL: `${BASE}/api` })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
