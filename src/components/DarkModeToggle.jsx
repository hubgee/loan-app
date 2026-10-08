import useDarkMode from "../hooks/useDarkMode";

export default function DarkModeToggle() {
  const [isDark, toggle] = useDarkMode();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="text-lg leading-none px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
