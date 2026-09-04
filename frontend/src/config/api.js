// Central API configuration — uses Vite env variable in production
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
