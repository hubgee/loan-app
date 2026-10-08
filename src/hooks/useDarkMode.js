import { useEffect, useState } from "react";

export default function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("darkMode");
    if (stored !== null) {
      const next = stored === "true";
      setIsDark(next);
      document.documentElement.classList.toggle("dark", next);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const next = mq.matches;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("darkMode", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  return [isDark, toggle];
}
