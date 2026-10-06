import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

export default function CollateralGallery({ loanId, compact = false }) {
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!loanId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("loan_collateral_files")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setFiles(data || []);
      const entries = await Promise.all(
        (data || []).map(async (f) => {
          const { data: s } = await supabase.storage.from("proofs").createSignedUrl(f.storage_path, 3600);
          return [f.id, { url: s?.signedUrl ?? null, isPdf: (f.original_name ?? f.storage_path ?? "").toLowerCase().endsWith(".pdf") }];
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  if (files.length === 0) return <p className="text-sm text-slate-500">No collateral files.</p>;

  if (compact) {
    return <p className="text-xs text-slate-500">{files.length} file{files.length > 1 ? "s" : ""} attached</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {files.map((f, i) => {
          const u = urls[f.id];
          const isPdf = u?.isPdf;
          return (
            <button key={f.id} type="button" onClick={() => setLightbox(i)}
              className="relative border rounded-xl overflow-hidden bg-slate-50 h-28 md:h-32 flex items-center justify-center text-xs">
              {!u?.url ? (
                <span className="text-slate-400">Loading…</span>
              ) : isPdf ? (
                <span className="p-2 text-center">📄 {f.original_name ?? `Doc ${i + 1}`}</span>
              ) : (
                <img src={u.url} alt={f.original_name ?? `collateral ${i + 1}`} className="w-full h-full object-cover" />
              )}
              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{i + 1}/{files.length}</span>
            </button>
          );
        })}
      </div>
      {lightbox !== null && files[lightbox] && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{files[lightbox].original_name}</p>
              <button onClick={() => setLightbox(null)} className="px-2 text-lg">✕</button>
            </div>
            {urls[files[lightbox].id]?.isPdf ? (
              <iframe src={urls[files[lightbox].id]?.url} title="doc" className="w-full h-[70vh]" />
            ) : (
              <img src={urls[files[lightbox].id]?.url} alt="collateral" className="w-full max-h-[70vh] object-contain bg-slate-100 rounded" />
            )}
            <div className="flex items-center justify-between">
              <button disabled={lightbox === 0} onClick={() => setLightbox((v) => Math.max(0, v - 1))} className="px-4 py-2 border rounded-xl text-sm disabled:opacity-40">← Prev</button>
              <span className="text-xs text-slate-500">{lightbox + 1} / {files.length}</span>
              <button disabled={lightbox === files.length - 1} onClick={() => setLightbox((v) => Math.min(files.length - 1, v + 1))} className="px-4 py-2 border rounded-xl text-sm disabled:opacity-40">Next →</button>
            </div>
            <a href={urls[files[lightbox].id]?.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 underline">Open in new tab</a>
          </div>
        </div>
      )}
    </div>
  );
}
