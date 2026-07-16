import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export async function getCsrf() {
  const origin = new URL(API_URL, window.location.origin).origin;
  await axios.get(`${origin}/sanctum/csrf-cookie`, { withCredentials: true });
}
