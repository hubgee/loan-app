import { useEffect, useState } from "react";

function getStoredIsDark() {
  const stored = localStorage.getItem("darkMode");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function useDarkMode() {
  const [isDark, setIsDark] = useState(getStoredIsDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("darkMode", String(next));
  };

  return [isDark, toggle];
}
