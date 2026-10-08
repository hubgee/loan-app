import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all"); // all | active | pending | admin
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(null);

const load = async () => {
    setLoading(true);
    setError("");
    // public.profiles has no email column — the list is assembled
    // server-side by the SECURITY DEFINER admin_users() function, which
    // joins auth.users and refuses non-admins.
    const { data, error } = await supabase.rpc("admin_users");
    if (error) setError(error.message);
    else setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const toggleActive = async (u) => {
    setUpdating(u.id);
    setError("");
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !u.is_active })
      .eq("id", u.id);
    if (error) setError(error.message);
    else
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_active: !u.is_active } : x))
      );
    setUpdating(null);
  };

  const filtered = users.filter((u) => {
    if (filter === "active") return u.is_active && u.role !== "admin";
    if (filter === "pending") return !u.is_active;
    if (filter === "admin") return u.role === "admin";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">User Management</h1>
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "active", "admin"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                  filter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-sm rounded p-3">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">Loading users...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No users match this filter.</p>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-100">
                      {u.email ?? u.id}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          u.role === "admin"
                            ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          u.is_active
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200"
                            : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200"
                        }`}
                      >
                        {u.is_active ? "Active" : "Pending"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {u.role !== "admin" && (
                        <button
                          disabled={updating === u.id}
                          onClick={() => toggleActive(u)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            u.is_active ? "bg-green-600" : "bg-slate-300 dark:bg-slate-600"
                          } disabled:opacity-50`}
                          title={u.is_active ? "Deactivate" : "Activate"}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              u.is_active ? "left-[22px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
