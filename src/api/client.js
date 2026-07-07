import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export async function getCsrf() {
  await axios.get("/sanctum/csrf-cookie", { withCredentials: true });
}
