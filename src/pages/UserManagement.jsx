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
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active, created_at")
      .order("created_at", { ascending: false });
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
      .from("users")
      .update({ active: !u.active })
      .eq("id", u.id);
    if (error) setError(error.message);
    else setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    setUpdating(null);
  };

  const filtered = users.filter((u) => {
    if (filter === "active") return u.active && u.role !== "admin";
    if (filter === "pending") return !u.active;
    if (filter === "admin") return u.role === "admin";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "active", "admin"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                  filter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-slate-500">Loading users...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No users match this filter.</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="p-3 font-medium text-slate-800">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          u.role === "admin"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          u.active
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {u.active ? "Active" : "Pending"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {u.role !== "admin" && (
                        <button
                          disabled={updating === u.id}
                          onClick={() => toggleActive(u)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            u.active ? "bg-green-600" : "bg-slate-300"
                          } disabled:opacity-50`}
                          title={u.active ? "Deactivate" : "Activate"}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              u.active ? "left-[22px]" : "left-0.5"
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
