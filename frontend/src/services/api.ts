import axios from 'axios'

// In production VITE_API_URL is set in the Vercel dashboard
// In local dev it falls back to localhost
export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE })

// Token helpers — admin uses sessionStorage (per-tab), customer uses localStorage (persistent)
export const getToken  = () => sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
export const clearAuth = () => {
  if (sessionStorage.getItem('access_token')) sessionStorage.clear()
  else localStorage.clear()
}

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAuth()
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api

/* ── Auth ─────────────────────────────────────── */
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(r => r.data)

export const getMe = () =>
  api.get('/auth/me').then(r => r.data)

/* ── Categories ──────────────────────────────── */
export const getCategories = () =>
  api.get('/categories/').then(r => r.data)

export const getCategory = (id: string) =>
  api.get(`/categories/${id}`).then(r => r.data)

/* ── Locations (all rooms across all categories) ─ */
export const getAllLocations = () =>
  api.get('/options/locations/all').then(r => r.data as { location_id: string; floor?: string; space?: string; room_code?: string }[])

/* ── Options — room-based navigation ─────────── */
export const getFloors = (categoryId: string) =>
  api.get(`/options/${categoryId}/floors`).then(r => r.data)

export const getRooms = (categoryId: string, floor: string) =>
  api.get(`/options/${categoryId}/floors/${encodeURIComponent(floor)}/rooms`).then(r => r.data)

export const getRoomOptions = (categoryId: string, locationId: string, subSection?: string) =>
  api.get(`/options/${categoryId}/rooms/${locationId}`, {
    params: subSection ? { sub_section: subSection } : {}
  }).then(r => r.data)

/* ── Options — direct navigation ─────────────── */
export const getDirectOptions = (categoryId: string, subSection?: string) =>
  api.get(`/options/${categoryId}`, {
    params: subSection ? { sub_section: subSection } : {}
  }).then(r => r.data)

export const getFlooringPackages = () =>
  api.get('/options/CAT002/packages').then(r => r.data)

/* ── Villa ────────────────────────────────────── */
export const getMyVilla = () =>
  api.get('/villas/').then(r => r.data)  // returns array; customer gets [their villa]

/* ── Selections / Cart ────────────────────────── */
export const getMySelections = () =>
  api.get('/selections/my').then(r => r.data)

export const upsertSelection = (data: {
  category_id: string
  sub_section?: string
  option_id: string
  location_id?: string
  selection_type: 'standard' | 'upgrade'
  customer_notes?: string
}) => api.post('/selections/upsert', data).then(r => r.data)

export const removeSelection = (data: {
  option_id: string
  location_id?: string
}) => api.delete('/selections/remove', { data }).then(r => r.data)

export const clearAllSelections = () =>
  api.delete('/selections/clear').then(r => r.data)

/* ── Interests ───────────────────────────────────── */
export const submitInterest = (categoryId: string, categoryName: string) =>
  api.post('/interests', { category_id: categoryId, category_name: categoryName }).then(r => r.data)

export const listInterests = () =>
  api.get('/interests/admin').then(r => r.data)

/* ── Admin ────────────────────────────────────── */
export const getDashboard = () =>
  api.get('/admin/dashboard').then(r => r.data)

export const listCustomers = () =>
  api.get('/admin/customers').then(r => r.data)

export const createCustomer = (data: {
  email: string; password: string; full_name: string;
  phone?: string; villa_id?: string; customization_deadline?: string
}) => api.post('/admin/customers', data).then(r => r.data)

export const updateCustomer = (id: string, data: any) =>
  api.patch(`/admin/customers/${id}`, data).then(r => r.data)

export const deleteCustomer = (id: string) =>
  api.delete(`/admin/customers/${id}`)

export const getCustomerSelections = (id: string) =>
  api.get(`/admin/customers/${id}/selections`).then(r => r.data)

export const listAllVillas = () =>
  api.get('/villas/').then(r => r.data)

export const listQuotes = () =>
  api.get('/quotes/').then(r => r.data)

export const getMyQuotes = () =>
  api.get('/quotes/my').then(r => r.data)

export const requestQuote = (data: { customer_notes?: string }) =>
  api.post('/quotes/', data).then(r => r.data)

export const markQuoteRead = (id: string) =>
  api.post(`/quotes/${id}/read`).then(r => r.data)

export const updateQuote = (id: string, data: {
  status: string; admin_notes?: string; quoted_price?: number; item_prices?: any[]
}) => api.patch(`/quotes/${id}`, data).then(r => r.data)

export const sendQuoteToCustomer = (id: string, data: {
  status: string; item_prices?: any[]; quoted_price?: number
}) => api.post(`/quotes/${id}/send`, data).then(r => r.data)

export const acceptQuote = (id: string) =>
  api.post(`/quotes/${id}/accept`).then(r => r.data)

export const requestQuoteChanges = (id: string) =>
  api.post(`/quotes/${id}/request_changes`).then(r => r.data)

export const unfreezeQuote = (id: string) =>
  api.post(`/quotes/${id}/unfreeze`).then(r => r.data)

/* ── Admin Options ────────────────────────────────── */
export const listOptions = (categoryId: string) =>
  api.get(`/options/${categoryId}`).then(r => r.data)

export const listOptionsAdmin = (categoryId: string) =>
  api.get(`/admin/options/${categoryId}`).then(r => r.data)

export const createOption = (data: any) =>
  api.post('/admin/options', data).then(r => r.data)

export const updateOption = (optionId: string, data: any) =>
  api.patch(`/admin/options/${optionId}`, data).then(r => r.data)

export const deleteOption = (optionId: string) =>
  api.delete(`/admin/options/${optionId}`)

/* ── Drawing Register ─────────────────────────── */
export const listDrawingRegister = () =>
  api.get('/drawing-register/', { timeout: 20000 }).then(r => r.data)

export const getMyDrawingPlans = () =>
  api.get('/drawing-register/my').then(r => r.data)

export const uploadFloorPlan = (villaId: string, file: File, planType: 'standard' | 'updated') => {
  const form = new FormData()
  form.append('file', file)
  form.append('plan_type', planType)
  return api.post(`/drawing-register/${villaId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const uploadOptionImage = (file: File, categoryId: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('category_id', categoryId)
  return api.post('/admin/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data as { path: string })
}
