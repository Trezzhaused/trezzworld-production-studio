import React, { useState, useRef, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type ProductionStyle =
  | "cinematic" | "3d" | "surreal" | "animated" | "slideshow" | "standard" | "documentary";

type MusicEngine =
  | "musicgen-small" | "musicgen-medium" | "musicgen-large"
  | "audiogen" | "riffusion" | "local-audiocraft";

interface VideoJob {
  jobId: string;
  concept: string;
  style: string;
  status: "queued" | "generating_storyboard" | "rendering" | "encoding" | "done" | "error";
  progress: number;
  message: string;
  downloadReady: boolean;
  outputPath?: string;
  error?: string;
  warnings?: string[];
  usedPhotorealistic?: boolean;
  storyboard?: any;
  hoursUntilArchive?: number;
}

interface MusicJob {
  jobId: string;
  concept: string;
  genre: string;
  mood: string;
  bpm: number;
  engine: string;
  engineName: string;
  status: "queued" | "generating_brief" | "composing" | "encoding" | "done" | "error";
  progress: number;
  message: string;
  composition: string;
  downloadReady: boolean;
  archived: boolean;
  hoursUntilArchive: number;
  error?: string;
}

const API = "/api";
const STUDIO_PRODUCT_NAME = "TrezzBLOX Studio Creator";
const STUDIO_PRODUCT_SHORT = "TrezzBLOX";

// ── Production style config ───────────────────────────────────────────────────

const PRODUCTION_STYLES: { id: ProductionStyle; label: string; icon: string; desc: string }[] = [
  { id: "cinematic",   label: "Cinematic",        icon: "🎬", desc: "Film-quality photorealistic cinematography" },
  { id: "3d",          label: "3D",               icon: "🎲", desc: "Photorealistic 3D rendered visuals" },
  { id: "surreal",     label: "Surreal / Fantasy", icon: "🌀", desc: "Dreamlike and fantastical imagery" },
  { id: "animated",    label: "Animated",          icon: "✏️", desc: "Anime and cartoon style animation" },
  { id: "slideshow",   label: "Slideshow",         icon: "🖼️", desc: "Clean photo slideshow presentation" },
  { id: "standard",    label: "Standard",          icon: "▶️", desc: "General purpose video production" },
  { id: "documentary", label: "Documentary",       icon: "📷", desc: "Cinéma vérité documentary style" },
];

const MUSIC_ENGINES: { id: MusicEngine; label: string; desc: string; quality: string }[] = [
  { id: "musicgen-small",  label: "MusicGen Small (Fast)",     desc: "Meta AI — text-to-music, fast generation",        quality: "⭐⭐" },
  { id: "musicgen-medium", label: "MusicGen Medium (Balanced)", desc: "Meta AI — better quality, moderate speed",       quality: "⭐⭐⭐" },
  { id: "musicgen-large",  label: "MusicGen Large (Best)",     desc: "Meta AI — highest quality, slower",               quality: "⭐⭐⭐⭐⭐" },
  { id: "audiogen",        label: "AudioGen (SFX)",            desc: "Meta AudioCraft — sound effects & ambient audio", quality: "🔊 SFX" },
  { id: "riffusion",       label: "Riffusion",                 desc: "Spectrogram diffusion — creative & unique",       quality: "⭐⭐⭐" },
  { id: "local-audiocraft", label: "Local AudioCraft",         desc: "Runs on your machine — no API key needed",        quality: "⭐⭐⭐⭐" },
];

const GENRES = ["cinematic", "electronic", "ambient", "hip-hop", "jazz", "rock", "classical", "folk", "lofi", "trap", "edm"];
const MOODS = ["epic", "dark", "happy", "sad", "tense", "peaceful", "energetic"];

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ProgressBar({ value, color = "#38bdf8" }: { value: number; color?: string }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: "100%",
        background: color, transition: "width 0.4s ease",
        borderRadius: 4,
      }} />
    </div>
  );
}

// ── Video Editor Panel ────────────────────────────────────────────────────────

function VideoEditor({ job, onJobCreated }: { job: VideoJob; onJobCreated?: (job: VideoJob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [scenes, setScenes] = useState<any[]>(job.storyboard?.scenes ?? []);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [exportRes, setExportRes] = useState("1080p");
  const [reworkBusy, setReworkBusy] = useState<string | null>(null);
  const [reworkMode, setReworkMode] = useState<"manual" | "lumi">("manual");
  const [lumiInstruction, setLumiInstruction] = useState("");
  const [reworkError, setReworkError] = useState("");

  useEffect(() => { setScenes(job.storyboard?.scenes ?? []); }, [job.jobId]);

  const moveScene = (i: number, dir: -1 | 1) => {
    const next = [...scenes];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setScenes(next);
  };

  const rerender = async () => {
    setReworkBusy("rerender");
    try {
      const res = await fetch(`${API}/video/${job.jobId}/rerender`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard: { ...job.storyboard, scenes } }),
      });
      const newJob: VideoJob = await res.json();
      onJobCreated?.(newJob);
    } catch (err) {
      console.error("Re-render failed:", err);
    } finally {
      setReworkBusy(null);
    }
  };

  const trim = async () => {
    setReworkBusy("trim");
    try {
      const res = await fetch(`${API}/video/${job.jobId}/trim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startSeconds: trimStart, endSeconds: trimEnd }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newJob: VideoJob = await res.json();
      onJobCreated?.(newJob);
    } catch (err) {
      console.error("Trim failed:", err);
    } finally {
      setReworkBusy(null);
    }
  };

  const exportAs = async () => {
    setReworkBusy("export");
    try {
      const res = await fetch(`${API}/video/${job.jobId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution: exportRes }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newJob: VideoJob = await res.json();
      onJobCreated?.(newJob);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setReworkBusy(null);
    }
  };

  const lumiEdit = async () => {
    if (!lumiInstruction.trim()) return;
    setReworkBusy("lumi");
    setReworkError("");
    try {
      const res = await fetch(`${API}/video/${job.jobId}/lumi-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: lumiInstruction }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "LUMI couldn't apply that edit.");
      }
      const newJob: VideoJob = await res.json();
      onJobCreated?.(newJob);
      setLumiInstruction("");
    } catch (err: any) {
      setReworkError(err.message || "LUMI edit failed.");
    } finally {
      setReworkBusy(null);
    }
  };

  const downloadUrl = job.downloadReady
    ? `${API}/video/${job.jobId}/download`
    : null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const onTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTrimEnd((prev) => prev || videoRef.current!.duration);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const setVol = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.volume = v;
    setVolume(v);
  };

  return (
    <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }}>
      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
        VIDEO EDITOR
      </div>

      {/* Preview */}
      <div style={{
        background: "#000", borderRadius: 6, overflow: "hidden",
        aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12,
      }}>
        {downloadUrl ? (
          <video
            ref={videoRef}
            src={downloadUrl}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <div style={{ color: "#334155", fontSize: 13 }}>
            {job.status === "done" ? "Video ready" : "Rendering..."}
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="range" min={0} max={duration || 100} step={0.1}
          value={currentTime} onChange={seek}
          style={{ width: "100%", accentColor: "#38bdf8" }}
          disabled={!downloadUrl}
        />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: 11 }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <button
          onClick={togglePlay} disabled={!downloadUrl}
          style={btnStyle(downloadUrl !== null)}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <span style={{ color: "#64748b", fontSize: 11 }}>🔊</span>
          <input
            type="range" min={0} max={1} step={0.05}
            value={volume} onChange={setVol}
            style={{ flex: 1, accentColor: "#38bdf8" }}
          />
        </div>

        {downloadUrl && (
          <a href={downloadUrl} download style={{ ...btnStyle(true), textDecoration: "none" }}>
            ⬇ Download MP4
          </a>
        )}
      </div>

      {/* Image generation status — why this video looks like it does */}
      {job.status === "done" && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: 6, fontSize: 11,
          background: job.usedPhotorealistic ? "#052e1622" : "#78350f22",
          border: `1px solid ${job.usedPhotorealistic ? "#22c55e44" : "#f59e0b44"}`,
          color: job.usedPhotorealistic ? "#86efac" : "#fbbf24",
        }}>
          {job.usedPhotorealistic
            ? "✓ Rendered with AI-generated photorealistic frames."
            : "⚠ Rendered with the built-in text-card renderer (no AI frames succeeded). Check Settings → Test Image Generation to see why."}
        </div>
      )}
      {job.warnings && job.warnings.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>WARNINGS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
            {job.warnings.map((w, i) => (
              <div key={i} style={{ background: "#0f172a", borderRadius: 4, padding: "6px 10px", color: "#94a3b8", fontSize: 11 }}>
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storyboard scenes — reorderable */}
      {scenes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>STORYBOARD SCENES (drag order with ▲▼, then Re-render)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {scenes.map((scene: any, i: number) => (
              <div key={i} style={{
                background: "#0f172a", borderRadius: 4, padding: "6px 10px",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{scene.title}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{(scene.visual_description || "").slice(0, 60)}...</div>
                </div>
                <div style={{ color: "#38bdf8", fontSize: 11 }}>{scene.duration_seconds}s</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <button onClick={() => moveScene(i, -1)} disabled={i === 0} style={{ ...btnStyle(i !== 0), padding: "1px 6px", fontSize: 10 }}>▲</button>
                  <button onClick={() => moveScene(i, 1)} disabled={i === scenes.length - 1} style={{ ...btnStyle(i !== scenes.length - 1), padding: "1px 6px", fontSize: 10 }}>▼</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REWORK-iT — lightweight server-driven edits */}
      {job.status === "done" && (
        <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ color: "#a855f7", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              ⚒ REWORK-iT
            </div>
            <select
              value={reworkMode}
              onChange={(e) => setReworkMode(e.target.value as "manual" | "lumi")}
              style={{ ...inputStyle, width: 200 }}
            >
              <option value="manual">✏ Manual edit</option>
              <option value="lumi">🤖 Lumi AI assist</option>
            </select>
          </div>

          {reworkError && (
            <div style={{ background: "#7f1d1d22", border: "1px solid #ef444444", borderRadius: 6, padding: "6px 10px", color: "#fca5a5", fontSize: 11, marginBottom: 8 }}>
              {reworkError}
            </div>
          )}

          {reworkMode === "lumi" ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={lumiInstruction}
                onChange={(e) => setLumiInstruction(e.target.value)}
                placeholder='e.g. "make scene 3 happen at night" or "swap the first two scenes"'
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={(e) => { if (e.key === "Enter") lumiEdit(); }}
              />
              <button onClick={lumiEdit} disabled={reworkBusy !== null || !lumiInstruction.trim()} style={btnStyle(reworkBusy === null && !!lumiInstruction.trim())}>
                {reworkBusy === "lumi" ? "⏳ Lumi is editing..." : "✨ Apply with Lumi"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <button onClick={rerender} disabled={reworkBusy !== null} style={btnStyle(reworkBusy === null)}>
                {reworkBusy === "rerender" ? "⏳ Re-rendering..." : "🔁 Re-render with edited scenes"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>Trim</span>
            <input type="number" value={trimStart} min={0} max={duration} step={0.5}
              onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
              style={{ ...inputStyle, width: 60 }} />
            <span style={{ color: "#475569", fontSize: 11 }}>to</span>
            <input type="number" value={trimEnd} min={0} max={duration} step={0.5}
              onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
              style={{ ...inputStyle, width: 60 }} />
            <button onClick={trim} disabled={reworkBusy !== null} style={btnStyle(reworkBusy === null)}>
              {reworkBusy === "trim" ? "⏳..." : "✂ Trim"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>Export as</span>
            <select value={exportRes} onChange={(e) => setExportRes(e.target.value)} style={{ ...inputStyle, width: 90 }}>
              <option>720p</option>
              <option>1080p</option>
              <option>4k</option>
              <option>vertical</option>
              <option>square</option>
            </select>
            <button onClick={exportAs} disabled={reworkBusy !== null} style={btnStyle(reworkBusy === null)}>
              {reworkBusy === "export" ? "⏳..." : "⬇ Export"}
            </button>
          </div>
        </div>
      )}

      {/* Archive notice */}
      {job.hoursUntilArchive !== undefined && job.status === "done" && (
        <div style={{
          marginTop: 10, padding: "6px 10px",
          background: "#1e293b", borderRadius: 4,
          color: "#64748b", fontSize: 11,
          borderLeft: "3px solid #334155",
        }}>
          ⏱ Archives in {job.hoursUntilArchive.toFixed(1)}h — download before archiving
        </div>
      )}
    </div>
  );
}

// ── Music Editor Panel ────────────────────────────────────────────────────────

function MusicEditor({ job }: { job: MusicJob }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [bpmOverride, setBpmOverride] = useState(job.bpm);
  const [showComposition, setShowComposition] = useState(false);

  const downloadUrl = job.downloadReady
    ? `${API}/music/${job.jobId}/download`
    : null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }}>
      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
        MUSIC EDITOR — {job.engineName}
      </div>

      {downloadUrl && (
        <audio
          ref={audioRef}
          src={downloadUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
          onEnded={() => setPlaying(false)}
        />
      )}

      {/* Waveform visualizer (static representation) */}
      <div style={{
        background: "#000d1a", borderRadius: 6, height: 60, marginBottom: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Animated waveform bars */}
        {Array.from({ length: 64 }).map((_, i) => {
          const barH = playing
            ? Math.abs(Math.sin(i * 0.4 + currentTime * 2)) * 50 + 4
            : 4 + (i % 7) * 4;
          return (
            <div key={i} style={{
              width: 3, marginRight: 1,
              height: barH,
              background: playing ? "#38bdf8" : "#1e3a5f",
              borderRadius: 2,
              transition: "height 0.1s ease",
            }} />
          );
        })}
        {/* Playhead */}
        {duration > 0 && (
          <div style={{
            position: "absolute", left: `${(currentTime / duration) * 100}%`,
            top: 0, bottom: 0, width: 2, background: "#f59e0b",
          }} />
        )}
      </div>

      {/* Scrubber */}
      <input
        type="range" min={0} max={duration || 100} step={0.1}
        value={currentTime}
        onChange={(e) => {
          const t = parseFloat(e.target.value);
          if (audioRef.current) audioRef.current.currentTime = t;
          setCurrentTime(t);
        }}
        style={{ width: "100%", accentColor: "#38bdf8", marginBottom: 4 }}
        disabled={!downloadUrl}
      />
      <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: 11, marginBottom: 10 }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={togglePlay} disabled={!downloadUrl} style={btnStyle(downloadUrl !== null)}>
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* Volume */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "#64748b", fontSize: 11 }}>🔊</span>
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (audioRef.current) audioRef.current.volume = v;
              setVolume(v);
            }}
            style={{ width: 80, accentColor: "#38bdf8" }}
          />
        </div>

        {/* Loop toggle */}
        <button
          onClick={() => { if (audioRef.current) audioRef.current.loop = !audioRef.current.loop; }}
          style={btnStyle(true)}
        >
          🔁 Loop
        </button>

        {downloadUrl && (
          <a href={downloadUrl} download style={{ ...btnStyle(true), textDecoration: "none" }}>
            ⬇ Download MP3/WAV
          </a>
        )}
      </div>

      {/* Beat / BPM controls */}
      <div style={{
        background: "#0f172a", borderRadius: 6, padding: 12, marginBottom: 10,
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
      }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>BPM</div>
          <input
            type="number" value={bpmOverride} min={60} max={200}
            onChange={(e) => setBpmOverride(parseInt(e.target.value) || 120)}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>Genre</div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>{job.genre}</div>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>Mood</div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>{job.mood}</div>
        </div>
      </div>

      {/* Stem labels (metadata only — full stem separation requires demucs) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {["🥁 Drums", "🎸 Bass", "🎹 Melody", "🎺 Harmony", "🎤 Vocals"].map((stem) => (
          <div key={stem} style={{
            padding: "4px 10px", background: "#0f172a",
            border: "1px solid #1e3a5f", borderRadius: 12,
            color: "#64748b", fontSize: 11,
          }}>
            {stem}
          </div>
        ))}
      </div>

      {/* Composition brief toggle */}
      <button
        onClick={() => setShowComposition(!showComposition)}
        style={{ ...btnStyle(true), fontSize: 11, marginBottom: 8 }}
      >
        {showComposition ? "▾ Hide" : "▸ Show"} Composition Brief
      </button>

      {showComposition && job.composition && (
        <pre style={{
          background: "#0f172a", borderRadius: 6, padding: 10,
          color: "#94a3b8", fontSize: 11, whiteSpace: "pre-wrap",
          maxHeight: 200, overflowY: "auto", margin: 0,
        }}>
          {job.composition}
        </pre>
      )}

      {/* Archive notice */}
      {job.status === "done" && !job.archived && (
        <div style={{
          marginTop: 8, padding: "6px 10px",
          background: "#1e293b", borderRadius: 4,
          color: "#64748b", fontSize: 11,
          borderLeft: "3px solid #334155",
        }}>
          ⏱ Archives in {job.hoursUntilArchive?.toFixed(1)}h
        </div>
      )}
      {job.archived && (
        <div style={{
          marginTop: 8, padding: "6px 10px",
          background: "#1e293b", borderRadius: 4,
          color: "#475569", fontSize: 11,
          borderLeft: "3px solid #0f766e",
        }}>
          📦 Archived — contact admin to retrieve
        </div>
      )}
    </div>
  );
}

// ── Video Tab ─────────────────────────────────────────────────────────────────

function VideoTab() {
  const [activeStyle, setActiveStyle] = useState<ProductionStyle>("cinematic");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [fps, setFps] = useState(24);
  const [resolution, setResolution] = useState("1080p");
  const [narrate, setNarrate] = useState(true);
  const [narratorVoice, setNarratorVoice] = useState("en-US-female");
  const [includeMusic, setIncludeMusic] = useState(true);
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([]);
  const [hasImageKey, setHasImageKey] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API}/video/voices`).then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
    fetch(`${API}/lumi/user-keys`).then((r) => r.json()).then((d) => {
      const configured = (d.providers ?? []).filter((p: any) => ["huggingface", "fal", "openai"].includes(p.provider) && p.configured);
      setHasImageKey(configured.length > 0);
    }).catch(() => {});
  }, []);

  const createJob = async () => {
    if (!prompt.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/video/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: prompt,
          durationSeconds: duration,
          style: activeStyle,
          resolution,
          fps,
          narrate,
          narratorVoice,
          includeMusic,
        }),
      });
      const job: VideoJob = await res.json();
      setJobs((prev) => [job, ...prev]);
      setSelectedJob(job);
      setPrompt("");
    } catch (err) {
      console.error("Failed to create video job:", err);
    } finally {
      setCreating(false);
    }
  };

  // Poll active jobs
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const active = jobs.filter((j) => !["done", "error"].includes(j.status));
      if (!active.length) return;

      const updated = await Promise.all(
        active.map(async (j) => {
          try {
            const res = await fetch(`${API}/video/${j.jobId}/status`);
            return (await res.json()) as VideoJob;
          } catch {
            return j;
          }
        })
      );

      setJobs((prev) =>
        prev.map((j) => updated.find((u) => u.jobId === j.jobId) ?? j)
      );

      // Update selected job
      setSelectedJob((sel) =>
        sel ? (updated.find((u) => u.jobId === sel.jobId) ?? sel) : sel
      );
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {hasImageKey === false && (
        <div style={{
          background: "#78350f22", border: "1px solid #f59e0b44", borderRadius: 6,
          padding: "8px 12px", color: "#fbbf24", fontSize: 12,
        }}>
          ⚠ No image generation API key configured — videos will use a plain text-card
          renderer instead of real photorealistic frames. Add a free Hugging Face key in
          the <strong>Settings</strong> tab to unlock real AI-generated visuals.
        </div>
      )}

      {/* Prompt box, Pollo.ai-style: textarea + a pill bar of generation options */}
      <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14 }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Describe your ${activeStyle} video... (e.g., "A lone astronaut walking across a red Martian desert at sunset")`}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", border: "none", background: "transparent", padding: "4px 2px", marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={activeStyle} onChange={(e) => setActiveStyle(e.target.value as ProductionStyle)}
            title={PRODUCTION_STYLES.find((s) => s.id === activeStyle)?.desc}
            style={pillStyle}>
            {PRODUCTION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
          </select>

          <input type="number" value={duration} min={5} max={600} step={5}
            onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
            title="Duration (seconds)"
            style={{ ...pillStyle, width: 64 }}
          />

          <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={pillStyle}>
            <option>720p</option>
            <option>1080p</option>
            <option>4k</option>
            <option>vertical</option>
            <option>square</option>
          </select>

          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value))} style={pillStyle}>
            <option value={24}>24 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>

          <select
            value={narrate ? narratorVoice : "none"}
            onChange={(e) => { e.target.value === "none" ? setNarrate(false) : (setNarrate(true), setNarratorVoice(e.target.value)); }}
            style={pillStyle}
          >
            <option value="none">🔇 No narration</option>
            {voices.map((v) => <option key={v.id} value={v.id}>🎙 {v.label}</option>)}
          </select>

          <button
            onClick={() => setIncludeMusic(!includeMusic)}
            style={{ ...pillStyle, cursor: "pointer", color: includeMusic ? "#38bdf8" : "#64748b" }}
          >
            {includeMusic ? "🎵 Music on" : "🔇 Music off"}
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={createJob}
            disabled={creating || !prompt.trim()}
            style={{
              ...btnStyle(!creating && prompt.trim().length > 0),
              padding: "10px 20px", fontSize: 13, fontWeight: 700,
            }}
          >
            {creating ? "⏳ Creating..." : `🎬 Generate`}
          </button>
        </div>
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            JOBS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {jobs.map((job) => (
              <div
                key={job.jobId}
                onClick={() => setSelectedJob(job)}
                style={{
                  background: selectedJob?.jobId === job.jobId ? "#0f2438" : "#0a0f1a",
                  border: `1px solid ${selectedJob?.jobId === job.jobId ? "#38bdf8" : "#1e3a5f"}`,
                  borderRadius: 6, padding: "10px 14px", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
                    {job.concept.slice(0, 50)}{job.concept.length > 50 ? "..." : ""}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <ProgressBar value={job.progress} />
                <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{job.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected job editor */}
      {selectedJob && (
        <VideoEditor
          key={selectedJob.jobId}
          job={selectedJob}
          onJobCreated={(newJob) => {
            setJobs((prev) => [newJob, ...prev]);
            setSelectedJob(newJob);
          }}
        />
      )}
    </div>
  );
}

// ── Music Tab ─────────────────────────────────────────────────────────────────

function MusicTab() {
  const [engine, setEngine] = useState<MusicEngine>("musicgen-small");
  const [concept, setConcept] = useState("");
  const [genre, setGenre] = useState("cinematic");
  const [mood, setMood] = useState("epic");
  const [bpm, setBpm] = useState(120);
  const [duration, setDuration] = useState(60);
  const [jobs, setJobs] = useState<MusicJob[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedJob, setSelectedJob] = useState<MusicJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createJob = async () => {
    if (!concept.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/music/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, genre, mood, bpm, durationSeconds: duration, engine }),
      });
      const job: MusicJob = await res.json();
      setJobs((prev) => [job, ...prev]);
      setSelectedJob(job);
      setConcept("");
    } catch (err) {
      console.error("Failed to create music job:", err);
    } finally {
      setCreating(false);
    }
  };

  // Poll
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const active = jobs.filter((j) => !["done", "error"].includes(j.status));
      if (!active.length) return;
      const updated = await Promise.all(
        active.map(async (j) => {
          try {
            const res = await fetch(`${API}/music/${j.jobId}/status`);
            return (await res.json()) as MusicJob;
          } catch {
            return j;
          }
        })
      );
      setJobs((prev) => prev.map((j) => updated.find((u) => u.jobId === j.jobId) ?? j));
      setSelectedJob((sel) => sel ? (updated.find((u) => u.jobId === sel.jobId) ?? sel) : sel);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Engine selector */}
      <div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
          MUSIC ENGINE
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MUSIC_ENGINES.map((e) => (
            <button
              key={e.id}
              onClick={() => setEngine(e.id)}
              style={{
                textAlign: "left", padding: "8px 12px", borderRadius: 6,
                cursor: "pointer", border: "none",
                background: engine === e.id ? "#0f2438" : "#0a0f1a",
                borderLeft: `3px solid ${engine === e.id ? "#38bdf8" : "#1e3a5f"}`,
                color: engine === e.id ? "#e2e8f0" : "#64748b",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: engine === e.id ? 700 : 400 }}>{e.label}</span>
                <span style={{ fontSize: 11 }}>{e.quality}</span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{e.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Concept input */}
      <div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: 1 }}>
          MUSIC CONCEPT
        </div>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder='Describe your music... (e.g., "Epic orchestral battle theme with rising brass and pounding drums")'
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Settings grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>Genre</div>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} style={inputStyle}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>Mood</div>
          <select value={mood} onChange={(e) => setMood(e.target.value)} style={inputStyle}>
            {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>BPM</div>
          <input type="number" value={bpm} min={60} max={200}
            onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>Duration (s)</div>
          <input type="number" value={duration} min={15} max={600} step={15}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            style={inputStyle}
          />
        </div>
      </div>

      <button
        onClick={createJob}
        disabled={creating || !concept.trim()}
        style={{
          ...btnStyle(!creating && concept.trim().length > 0),
          padding: "12px 24px", fontSize: 14, fontWeight: 700,
        }}
      >
        {creating ? "⏳ Generating..." : "🎵 Generate Music"}
      </button>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            TRACKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {jobs.map((job) => (
              <div
                key={job.jobId}
                onClick={() => setSelectedJob(job)}
                style={{
                  background: selectedJob?.jobId === job.jobId ? "#0f2438" : "#0a0f1a",
                  border: `1px solid ${selectedJob?.jobId === job.jobId ? "#38bdf8" : "#1e3a5f"}`,
                  borderRadius: 6, padding: "10px 14px", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
                    {job.concept.slice(0, 50)}{job.concept.length > 50 ? "..." : ""}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <ProgressBar value={job.progress} color="#a855f7" />
                <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>
                  {job.engineName} • {job.genre} • {job.bpm} BPM • {job.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedJob && <MusicEditor key={selectedJob.jobId} job={selectedJob} />}
    </div>
  );
}

// ── Settings Tab — API keys (the actual switch that turns on photorealistic gen) ──

interface ProviderInfo {
  provider: string;
  name: string;
  description: string;
  cost: string;
  get_key_url: string;
  recommended: boolean;
  configured: boolean;
  key_preview?: string;
}

const TREZZHAUS_AUTH_API = "https://trezzhaus-os.onrender.com";
const TREZZHAUS_TOKEN_KEY = "trezzhaus_session_token";

export function getTrezzhausToken(): string | null {
  return localStorage.getItem(TREZZHAUS_TOKEN_KEY);
}

function AccountSection() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [session, setSession] = useState<{ loggedIn: boolean; isOwner: boolean; account: any } | null>(null);

  const loadSession = async () => {
    const token = getTrezzhausToken();
    if (!token) { setSession({ loggedIn: false, isOwner: false, account: null }); return; }
    try {
      const res = await fetch(`${API}/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
      setSession(await res.json());
    } catch {
      setSession({ loggedIn: false, isOwner: false, account: null });
    }
  };

  useEffect(() => { loadSession(); }, []);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(`${TREZZHAUS_AUTH_API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || (mode === "register" ? "Registration failed." : "Login failed."));
        return;
      }
      localStorage.setItem(TREZZHAUS_TOKEN_KEY, data.token);
      setPassword("");
      await loadSession();
    } catch {
      setLoginError("Could not reach the TrezzHaus account service — check your connection.");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TREZZHAUS_TOKEN_KEY);
    setSession({ loggedIn: false, isOwner: false, account: null });
  };

  if (session === null) return null;

  return (
    <div>
      <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        🔑 TrezzHaus Account
      </div>
      {session.loggedIn ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Signed in as <strong style={{ color: "#e2e8f0" }}>{session.account?.username}</strong>
          </span>
          {session.isOwner && (
            <span style={{ background: "#0ea5e9", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
              OWNER
            </span>
          )}
          <button onClick={logout} style={{ ...pillStyle, cursor: "pointer" }}>Sign out</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxWidth: 320 }}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {mode === "register" ? "Create your TrezzHaus account." : "Sign in with your TrezzHaus account to unlock owner-only LUMI behavior."}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setMode("login"); setLoginError(""); }} style={{ ...pillStyle, cursor: "pointer", color: mode === "login" ? "#38bdf8" : "#64748b" }}>Sign in</button>
            <button onClick={() => { setMode("register"); setLoginError(""); }} style={{ ...pillStyle, cursor: "pointer", color: mode === "register" ? "#38bdf8" : "#64748b" }}>Register</button>
          </div>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={inputStyle}
          />
          {loginError && <div style={{ color: "#f87171", fontSize: 12 }}>{loginError}</div>}
          <button onClick={submit} disabled={loggingIn} style={{ ...pillStyle, cursor: "pointer", background: "#0ea5e9", color: "#fff" }}>
            {loggingIn ? "Working…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [masterDocument, setMasterDocument] = useState<any>(null);

  const load = async () => {
    try {
      const res = await fetch(`${API}/lumi/user-keys`);
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch (err) {
      console.error("Failed to load providers:", err);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch(`${API}/master-document`)
      .then((res) => res.json())
      .then(setMasterDocument)
      .catch(() => setMasterDocument(null));
  }, []);

  const save = async (provider: string) => {
    const apiKey = (drafts[provider] || "").trim();
    if (!apiKey) return;
    setSaving(provider);
    setMessage("");
    try {
      const res = await fetch(`${API}/lumi/user-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey }),
      });
      const data = await res.json();
      setMessage(res.ok ? data.message : (data.detail || "Failed to save key."));
      setDrafts((d) => ({ ...d, [provider]: "" }));
      await load();
    } catch (err) {
      setMessage("Failed to save key — check your connection.");
    } finally {
      setSaving(null);
    }
  };

  const testImageGeneration = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/debug/image-test`, { method: "POST" });
      setTestResult(await res.json());
    } catch (err) {
      setTestResult({ ok: false, reason: "Request failed — check your connection." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <AccountSection />

      {masterDocument && (
        <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700 }}>🧭 Master document layer</div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{masterDocument.summary}</div>
            </div>
            <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700, textAlign: "right" }}>{masterDocument.product || STUDIO_PRODUCT_NAME}</div>
          </div>

          <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 600 }}>{masterDocument.title}</div>

          {masterDocument.mission && (
            <div style={{ color: "#64748b", fontSize: 11 }}>
              Mission: {masterDocument.mission}
            </div>
          )}

          {masterDocument.positioning?.headline && (
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{masterDocument.positioning.headline}</div>
          )}
          {masterDocument.positioning?.tagline && (
            <div style={{ color: "#94a3b8", fontSize: 11 }}>{masterDocument.positioning.tagline}</div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {masterDocument.domains?.slice(0, 4).map((domain: string, index: number) => (
              <span key={`${domain}-${index}`} style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 999, padding: "4px 8px", color: "#94a3b8", fontSize: 10 }}>
                {domain}
              </span>
            ))}
            {masterDocument.repositories?.slice(0, 4).map((repo: string, index: number) => (
              <span key={`${repo}-${index}`} style={{ background: "#0f172a", border: "1px solid rgba(56, 189, 248, 0.28)", borderRadius: 999, padding: "4px 8px", color: "#38bdf8", fontSize: 10 }}>
                {repo}
              </span>
            ))}
          </div>

          {masterDocument.audience?.length > 0 && (
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Audience</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {masterDocument.audience.map((item: string, index: number) => (
                  <span key={`${item}-${index}`} style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 999, padding: "4px 8px", color: "#94a3b8", fontSize: 10 }}>{item}</span>
                ))}
              </div>
            </div>
          )}

          {masterDocument.marketingPillars?.length > 0 && (
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Marketing pillars</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {masterDocument.marketingPillars.map((item: string, index: number) => (
                  <span key={`${item}-${index}`} style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 999, padding: "4px 8px", color: "#94a3b8", fontSize: 10 }}>{item}</span>
                ))}
              </div>
            </div>
          )}

          {masterDocument.contentPreview?.length > 0 && (
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Preview</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {masterDocument.contentPreview.slice(0, 4).map((item: string, index: number) => (
                  <div key={`${item}-${index}`} style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>{item}</div>
                ))}
              </div>
            </div>
          )}

          {masterDocument.launchChecklist?.length > 0 && (
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Launch checklist</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {masterDocument.launchChecklist.slice(0, 4).map((item: string, index: number) => (
                  <div key={`${item}-${index}`} style={{ color: "#94a3b8", fontSize: 11 }}>{item}</div>
                ))}
              </div>
            </div>
          )}

          {masterDocument.source && (
            <div style={{ color: "#475569", fontSize: 10 }}>Source: {masterDocument.source}</div>
          )}
        </div>
      )}

      <div>
        <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          ⚙ API Keys
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Add a Hugging Face or fal.ai key to unlock real photorealistic/3D video frames.
          Without one, the Video Studio falls back to a plain text-card renderer.
        </div>
      </div>

      {message && (
        <div style={{ background: "#0f2438", border: "1px solid #38bdf8", borderRadius: 6, padding: "8px 12px", color: "#94a3b8", fontSize: 12 }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {providers.map((p) => (
          <div key={p.provider} style={{
            background: "#0a0f1a", border: `1px solid ${p.configured ? "#22c55e44" : "#1e3a5f"}`,
            borderRadius: 8, padding: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                {p.recommended && (
                  <span style={{ background: "#38bdf822", color: "#38bdf8", fontSize: 10, padding: "1px 6px", borderRadius: 8 }}>Recommended</span>
                )}
                {p.configured && (
                  <span style={{ background: "#22c55e22", color: "#22c55e", fontSize: 10, padding: "1px 6px", borderRadius: 8 }}>✓ Configured ({p.key_preview})</span>
                )}
              </div>
              <a href={p.get_key_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 11 }}>Get a key ↗</a>
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>{p.description} · {p.cost}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                placeholder={p.configured ? "Replace key..." : "Paste API key..."}
                value={drafts[p.provider] || ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.provider]: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => save(p.provider)}
                disabled={saving !== null || !(drafts[p.provider] || "").trim()}
                style={btnStyle(saving === null && !!(drafts[p.provider] || "").trim())}
              >
                {saving === p.provider ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>🧪 Test Image Generation</div>
          <button onClick={testImageGeneration} disabled={testing} style={btnStyle(!testing)}>
            {testing ? "Testing..." : "Run Test"}
          </button>
        </div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
          Generates one real test image using whichever key is configured above, and shows
          the exact result — use this to confirm a key actually works without running a full video.
        </div>
        {testResult && (
          <div style={{
            background: testResult.ok ? "#052e1622" : "#7f1d1d22",
            border: `1px solid ${testResult.ok ? "#22c55e44" : "#ef444444"}`,
            borderRadius: 6, padding: "8px 12px", fontSize: 11,
            color: testResult.ok ? "#86efac" : "#fca5a5",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{testResult.ok ? "✓ Success" : "✗ Failed"}</div>
            {testResult.configured && (
              <div style={{ color: "#64748b", marginBottom: 4 }}>
                Configured: {Object.entries(testResult.configured).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}
              </div>
            )}
            {testResult.reason && <div>{testResult.reason}</div>}
            {testResult.ok && <div>Generated {testResult.imageBytes} bytes.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    queued:               { color: "#475569", label: "Queued" },
    generating_storyboard:{ color: "#f59e0b", label: "Planning" },
    generating_brief:     { color: "#f59e0b", label: "Planning" },
    rendering:            { color: "#0ea5e9", label: "Rendering" },
    composing:            { color: "#a855f7", label: "Composing" },
    encoding:             { color: "#0ea5e9", label: "Encoding" },
    done:                 { color: "#22c55e", label: "Done" },
    error:                { color: "#ef4444", label: "Error" },
  };
  const { color, label } = map[status] ?? { color: "#64748b", label: status };
  return (
    <div style={{
      padding: "2px 8px", borderRadius: 10, fontSize: 10,
      background: color + "22", color, fontWeight: 700, border: `1px solid ${color}44`,
    }}>
      {label}
    </div>
  );
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 6, border: "none",
    cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? "#0ea5e9" : "#1e293b",
    color: enabled ? "#fff" : "#475569",
    fontSize: 12, fontWeight: 600,
    transition: "background 0.2s",
  };
}

const inputStyle: React.CSSProperties = {
  background: "#0f172a", border: "1px solid #1e3a5f",
  borderRadius: 6, padding: "8px 10px", color: "#e2e8f0",
  fontSize: 12, width: "100%", outline: "none",
  fontFamily: "inherit",
};

// Pollo.ai-style compact option pill (dropdown/button in the generation bar)
const pillStyle: React.CSSProperties = {
  background: "#0f172a", border: "1px solid #1e3a5f",
  borderRadius: 16, padding: "6px 12px", color: "#94a3b8",
  fontSize: 11, outline: "none", fontFamily: "inherit",
  width: "auto",
};

// ── Roblox Tab ────────────────────────────────────────────────────────────────

interface RobloxJob {
  jobId: string;
  concept: string;
  genre: string;
  maxPlayers: number;
  monetization: string;
  universeId?: string | null;
  placeId?: string | null;
  status: "queued" | "designing" | "scripting" | "packaging" | "done" | "error";
  progress: number;
  message: string;
  designDoc?: any;
  scriptCount: number;
  downloadReady: boolean;
  error?: string;
}

const ROBLOX_GENRES = ["Adventure", "Obby", "Simulator", "RPG", "Tycoon", "Horror", "Battle Royale", "Roleplay"];
const ROBLOX_MONETIZATION = ["freemium", "premium", "gamepasses-only", "ad-supported"];
const ROBLOX_TEMPLATES = [
  {
    id: "tycoon",
    title: "Tycoon",
    genre: "Tycoon",
    monetization: "freemium",
    prompt: "A cozy but chaotic tycoon where players run a smoothie shop, expand to a mall, and unlock wild upgrades.",
  },
  {
    id: "obby",
    title: "Obby",
    genre: "Obby",
    monetization: "premium",
    prompt: "A bright, fast-paced obby with moving platforms, hidden shortcuts, and a dramatic final boss stage.",
  },
  {
    id: "sim",
    title: "Simulator",
    genre: "Simulator",
    monetization: "ad-supported",
    prompt: "A relaxing simulator where players collect magical pets, decorate a floating island, and unlock rare rewards.",
  },
  {
    id: "horror",
    title: "Horror",
    genre: "Horror",
    monetization: "gamepasses-only",
    prompt: "A spooky multiplayer horror experience where players solve environmental puzzles while dodging a mysterious entity.",
  },
] as const;

const DEFAULT_TEMPLATE_ID = ROBLOX_TEMPLATES[0].id;

// Steps Lumi/Luau genuinely cannot do via any Roblox API — confirmed via Roblox's
// own Open Cloud docs (no API exists for these; they require the Roblox website/Studio).
const ROBLOX_HUMAN_TODO = [
  { title: "Create the Experience on Roblox", body: "Roblox has no API to create a brand-new experience from scratch. In Roblox Studio or the Creator Dashboard, create one empty experience — that gives you the Universe ID and Place ID to paste into this form. Everything after that is automated." },
  { title: "Confirm monetization eligibility", body: "Your Roblox account needs to be in good standing and meet Roblox's age/region requirements to sell Game Passes or Developer Products. This is an account-level check only Roblox can do." },
  { title: "Set up payout / tax info", body: "To cash out Robux earnings (DevEx), add a payout method and tax information in the Creator Dashboard. This is a billing/identity step Roblox requires directly from you." },
  { title: "Add custom icons for Game Passes / Products", body: "The monetization API call here creates passes/products without a custom image. Upload a unique icon for each one in the Creator Dashboard if you want something other than the default." },
  { title: "Add store page assets", body: "Screenshots, a trailer video, and the experience's public description/genre tags are set via the Creator Dashboard website — not exposed through any API." },
  { title: "Playtest in Roblox Studio", body: "Only a human (or real players) can verify the generated Luau scripts actually play well — bugs, balance, and feel need a real playtest before going live." },
  { title: "Complete the age-rating questionnaire", body: "Roblox requires an Experience Guidelines / age-rating survey for compliance, completed on the website — this can't be automated." },
  { title: "Enable monetization toggles", body: "If this is the first time monetizing this experience, double-check 'Allow sales' / regional pricing toggles are enabled in the Creator Dashboard." },
];

const CREATOR_CAPABILITIES = [
  {
    title: "Prompt to concept",
    body: "Describe the vibe of your experience and the studio turns it into a launch-ready concept brief.",
    icon: "✍️",
  },
  {
    title: "Asset pipeline",
    body: "Generate the core structure, scripts, metadata, and experience-ready assets in one place.",
    icon: "🧱",
  },
  {
    title: "Publish + monetize",
    body: "Wrap the experience with publishing actions, launch checklists, and game pass or product setup.",
    icon: "🚀",
  },
  {
    title: "Human-in-the-loop",
    body: "Keep the creative control high while letting Lumi handle the repetitive setup work for you.",
    icon: "🧠",
  },
] as const;

function RobloxTodoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#000000aa", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0a0f1acc", border: "1px solid #38bdf855", borderRadius: 16,
          padding: 24, maxWidth: 560, maxHeight: "80vh", overflowY: "auto",
          boxShadow: "0 0 60px #0ea5e933",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 700 }}>📋 Finish Launch — Human Steps</div>
          <button onClick={onClose} style={{ ...btnStyle(true), padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginBottom: 14 }}>
          Lumi and the generated Luau scripts handle game logic, scripting, publishing, and monetization setup.
          These steps need a human because no Roblox API exists for them:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ROBLOX_HUMAN_TODO.map((item, i) => (
            <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" style={{ marginTop: 3 }} />
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{item.body}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function RobloxEditor({ job }: { job: RobloxJob }) {
  const [showTodo, setShowTodo] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const [scripts, setScripts] = useState<any[]>([]);
  const [passName, setPassName] = useState("");
  const [passPrice, setPassPrice] = useState(100);
  const [passDesc, setPassDesc] = useState("");
  const [monetizationKind, setMonetizationKind] = useState<"game-pass" | "developer-product">("game-pass");
  const [monetizationBusy, setMonetizationBusy] = useState(false);
  const [monetizationMsg, setMonetizationMsg] = useState("");

  useEffect(() => {
    if (job.status === "done") {
      fetch(`${API}/roblox/game/${job.jobId}/scripts`).then((r) => r.json()).then((d) => setScripts(d.scripts ?? [])).catch(() => {});
    }
  }, [job.jobId, job.status]);

  const publish = async () => {
    setPublishing(true);
    setPublishMsg("");
    try {
      const res = await fetch(`${API}/roblox/game/${job.jobId}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Publish failed.");
      setPublishMsg(`✓ Published — version ${data.versionNumber}`);
      setShowTodo(true);
    } catch (err: any) {
      setPublishMsg(`✗ ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const addMonetization = async () => {
    if (!passName.trim()) return;
    setMonetizationBusy(true);
    setMonetizationMsg("");
    try {
      const res = await fetch(`${API}/roblox/game/${job.jobId}/monetization/${monetizationKind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: passName, price: passPrice, description: passDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create.");
      setMonetizationMsg(`✓ Created "${passName}" at R$${passPrice}`);
      setPassName(""); setPassDesc("");
    } catch (err: any) {
      setMonetizationMsg(`✗ ${err.message}`);
    } finally {
      setMonetizationBusy(false);
    }
  };

  const downloadUrl = job.downloadReady ? `${API}/roblox/game/${job.jobId}/download` : null;

  return (
    <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }}>
      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
        GAME EDITOR
      </div>

      {job.designDoc?.title && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700 }}>{job.designDoc.title}</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>{job.designDoc.tagline}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {downloadUrl && (
          <a href={downloadUrl} download style={{ ...btnStyle(true), textDecoration: "none" }}>⬇ Download ZIP (Rojo)</a>
        )}
        {job.status === "done" && (
          <button onClick={publish} disabled={publishing} style={btnStyle(!publishing)}>
            {publishing ? "⏳ Publishing..." : "🚀 Publish to Roblox"}
          </button>
        )}
        <button onClick={() => setShowTodo(true)} style={{ ...btnStyle(true), color: "#a855f7" }}>
          📋 Finish Launch Checklist
        </button>
      </div>
      {publishMsg && <div style={{ color: publishMsg.startsWith("✓") ? "#86efac" : "#fca5a5", fontSize: 12, marginBottom: 12 }}>{publishMsg}</div>}

      {scripts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>GENERATED SCRIPTS ({scripts.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
            {scripts.map((s, i) => (
              <div key={i} style={{ background: "#0f172a", borderRadius: 4, padding: "6px 10px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}>{s.path}</span>
                <span style={{ color: "#475569", fontSize: 10 }}>{s.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {job.status === "done" && (
        <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 12 }}>
          <div style={{ color: "#a855f7", fontSize: 11, marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
            💰 MONETIZATION
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select value={monetizationKind} onChange={(e) => setMonetizationKind(e.target.value as any)} style={pillStyle}>
              <option value="game-pass">Game Pass</option>
              <option value="developer-product">Developer Product</option>
            </select>
            <input type="text" placeholder="Name" value={passName} onChange={(e) => setPassName(e.target.value)} style={{ ...inputStyle, width: 140 }} />
            <input type="number" placeholder="Price (R$)" value={passPrice} min={0} onChange={(e) => setPassPrice(parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: 90 }} />
            <input type="text" placeholder="Description" value={passDesc} onChange={(e) => setPassDesc(e.target.value)} style={{ ...inputStyle, width: 160 }} />
            <button onClick={addMonetization} disabled={monetizationBusy || !passName.trim()} style={btnStyle(!monetizationBusy && !!passName.trim())}>
              {monetizationBusy ? "⏳" : "+ Create"}
            </button>
          </div>
          {monetizationMsg && <div style={{ color: monetizationMsg.startsWith("✓") ? "#86efac" : "#fca5a5", fontSize: 12 }}>{monetizationMsg}</div>}
        </div>
      )}

      {showTodo && <RobloxTodoModal onClose={() => setShowTodo(false)} />}
    </div>
  );
}

function RobloxTab() {
  const [concept, setConcept] = useState("");
  const [genre, setGenre] = useState("Adventure");
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [monetization, setMonetization] = useState("freemium");
  const [universeId, setUniverseId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [jobs, setJobs] = useState<RobloxJob[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RobloxJob | null>(null);
  const [oauthStatus, setOauthStatus] = useState<{ connected: boolean; user?: any }>({ connected: false });
  const [lookingUpUniverse, setLookingUpUniverse] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATE_ID);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lookupUniverseFromPlace = async (rawPlaceId: string) => {
    if (!rawPlaceId.trim() || universeId.trim()) return; // don't override a manually-entered universe ID
    setLookingUpUniverse(true);
    try {
      const res = await fetch(`${API}/roblox/lookup-universe?placeId=${encodeURIComponent(rawPlaceId)}`);
      const data = await res.json();
      if (data.placeId) setPlaceId(data.placeId); // normalizes a pasted URL down to just the numeric ID
      if (data.universeId) setUniverseId(data.universeId);
    } catch {
      // best-effort only — leave universeId blank for manual entry
    } finally {
      setLookingUpUniverse(false);
    }
  };

  const loadOauthStatus = () => {
    fetch(`${API}/roblox/oauth/status`).then((r) => r.json()).then(setOauthStatus).catch(() => {});
  };

  useEffect(() => {
    loadOauthStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("robloxAuth")) {
      loadOauthStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const signOut = async () => {
    await fetch(`${API}/roblox/oauth/logout`, { method: "POST" });
    loadOauthStatus();
  };

  const createJob = async () => {
    if (!concept.trim() || !universeId.trim() || !placeId.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/roblox/game/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, genre, maxPlayers, monetization, universeId, placeId }),
      });
      const job: RobloxJob = await res.json();
      setJobs((prev) => [job, ...prev]);
      setSelectedJob(job);
      setConcept("");
    } catch (err) {
      console.error("Failed to create Roblox job:", err);
    } finally {
      setCreating(false);
    }
  };

  const applyTemplate = (template: (typeof ROBLOX_TEMPLATES)[number]) => {
    setSelectedTemplate(template.id);
    setConcept(template.prompt);
    setGenre(template.genre);
    setMonetization(template.monetization);
  };

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const active = jobs.filter((j) => !["done", "error"].includes(j.status));
      if (!active.length) return;
      const updated = await Promise.all(
        active.map(async (j) => {
          try {
            const res = await fetch(`${API}/roblox/game/${j.jobId}/status`);
            return (await res.json()) as RobloxJob;
          } catch {
            return j;
          }
        })
      );
      setJobs((prev) => prev.map((j) => updated.find((u) => u.jobId === j.jobId) ?? j));
      setSelectedJob((sel) => (sel ? (updated.find((u) => u.jobId === sel.jobId) ?? sel) : sel));
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs]);

  const canCreate = concept.trim() && universeId.trim() && placeId.trim() && !creating;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: "linear-gradient(135deg, #ff9b2e 0%, #ff4d6d 45%, #7c4dff 100%)",
        borderRadius: 24,
        padding: 24,
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.26)",
        boxShadow: "0 20px 60px rgba(255, 77, 109, 0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", opacity: 0.9 }}>
              AI-Powered Creator Studio
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, marginTop: 8 }}>
              Build your next hit experience with a prompt and a few smart choices.
            </div>
            <div style={{ fontSize: 14, marginTop: 10, opacity: 0.92, maxWidth: 560 }}>
              Describe the vibe, pick a template, connect your experience IDs, and let the studio generate the core systems and launch-ready structure.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                aria-label={`Start building your ${STUDIO_PRODUCT_SHORT} experience`}
                onClick={() => document.getElementById("roblox-creator-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                style={{ ...btnStyle(true), background: "#fff", color: "#111827", padding: "10px 16px" }}
              >
                ✨ Start building
              </button>
              <div role="status" aria-live="polite" style={{ ...btnStyle(true), cursor: "default", background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                ⚡ Prompt → Generate → Publish
              </div>
            </div>
          </div>
          <div style={{ minWidth: 250, background: "rgba(3, 7, 18, 0.24)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.8 }}>Studio flow</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {[
                "Describe the game idea in plain English",
                "Pick a template and tune the genre",
                "Generate the experience and launch assets",
              ].map((step) => (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 4 }}>
        {CREATOR_CAPABILITIES.map((capability) => (
          <div key={capability.title} style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{capability.icon}</div>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{capability.title}</div>
            <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{capability.body}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <div id="roblox-creator-form" style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 18, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 700 }}>Create a {STUDIO_PRODUCT_NAME} experience</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Start from a template or type your own idea.</div>
            </div>
            <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Prompt-first workflow</div>
          </div>

          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder='Describe your game... (e.g., "A tycoon where players build and manage a pizza shop")'
            rows={3}
            style={{ ...inputStyle, resize: "vertical", border: "1px solid rgba(56, 189, 248, 0.24)", background: "rgba(2, 6, 23, 0.85)", padding: "10px 12px", marginBottom: 12 }}
          />

          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
            Quick starts
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {ROBLOX_TEMPLATES.map((template) => {
              const active = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  style={{
                    background: active ? "rgba(56, 189, 248, 0.16)" : "#0f172a",
                    border: active ? "1px solid rgba(56, 189, 248, 0.48)" : "1px solid #1e3a5f",
                    borderRadius: 999,
                    color: active ? "#e2e8f0" : "#94a3b8",
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {template.title}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ ...pillStyle, minWidth: 120 }}>
              {ROBLOX_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="number" value={maxPlayers} min={2} max={100} onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 20)} title="Max players" style={{ ...pillStyle, width: 70 }} />
            <select value={monetization} onChange={(e) => setMonetization(e.target.value)} style={{ ...pillStyle, minWidth: 140 }}>
              {ROBLOX_MONETIZATION.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Place ID (or paste the game's roblox.com URL)"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              onBlur={(e) => lookupUniverseFromPlace(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            />
            <input
              type="text"
              placeholder={lookingUpUniverse ? "Looking up..." : "Universe ID (auto-fills if found)"}
              value={universeId}
              onChange={(e) => setUniverseId(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            />
            <button onClick={createJob} disabled={!canCreate} style={{ ...btnStyle(!!canCreate), padding: "10px 20px", fontSize: 13, fontWeight: 700 }}>
              {creating ? "⏳ Creating..." : "🎮 Generate Game"}
            </button>
          </div>
          {(!universeId.trim() || !placeId.trim()) && (
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 10 }}>
              Don't have these yet? Create an empty Experience at{" "}
              <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
                create.roblox.com
              </a>{" "}— Roblox doesn't offer an API to create one from scratch, or to list your
              experiences automatically even when signed in. Paste the Place ID (or the game's
              URL) above and the Universe ID auto-fills when possible.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16 }}>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>What you get</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {[
                "Gameplay systems and starter scripts",
                "Monetization hooks and build-ready structure",
                "Publishing guidance for Roblox Studio",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d6d" }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>Studio access</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                  {oauthStatus.connected
                    ? `Signed in as ${oauthStatus.user?.name || oauthStatus.user?.preferred_username || "Roblox user"}`
                    : "Connect your Roblox account for publishing workflows"}
                </div>
              </div>
              {oauthStatus.connected ? (
                <button onClick={signOut} style={btnStyle(true)}>Sign out</button>
              ) : (
                <a href={`${API}/roblox/oauth/login`} style={{ ...btnStyle(true), textDecoration: "none" }}>Sign in</a>
              )}
            </div>
          </div>
        </div>
      </div>

      {jobs.length > 0 && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>JOBS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {jobs.map((job) => (
              <div
                key={job.jobId}
                onClick={() => setSelectedJob(job)}
                style={{
                  background: selectedJob?.jobId === job.jobId ? "#0f2438" : "#0a0f1a",
                  border: `1px solid ${selectedJob?.jobId === job.jobId ? "#38bdf8" : "#1e3a5f"}`,
                  borderRadius: 6, padding: "10px 14px", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
                    {job.concept.slice(0, 50)}{job.concept.length > 50 ? "..." : ""}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <ProgressBar value={job.progress} color="#a855f7" />
                <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{job.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedJob && <RobloxEditor key={selectedJob.jobId} job={selectedJob} />}
    </div>
  );
}

// ── LUMI Chat Tab ─────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  model?: string;
  imageUrl?: string | null;
}

const DOMAINS = [
  { id: "default", label: "General" },
  { id: "video", label: "Video Production" },
  { id: "music", label: "Music Composition" },
  { id: "game", label: "Game Design" },
  { id: "code", label: "Code Generation" },
  { id: "creative", label: "Creative Direction" },
];

function getOrCreateSessionId(): string {
  const key = "trezzworld_lumi_session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function LumiTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [domain, setDomain] = useState("default");
  const [useOllama, setUseOllama] = useState(false);
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaModels, setOllamaModels] = useState<{ id: string; available: boolean }[]>([]);
  const [cascade, setCascade] = useState<{ id: string; tier: string }[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<any>(null);
  const sessionId = useRef(getOrCreateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/lumi/chat/history?mission_id=${sessionId.current}`)
      .then((r) => r.json())
      .then((d) => {
        const history = (d.history ?? []).map((h: any) => ({ role: h.role, content: h.content, model: h.model_used }));
        setMessages(history);
      })
      .catch(() => {});

    fetch(`${API}/lumi/models`).then((r) => r.json()).then((d) => {
      setCascade(d.cascade ?? []);
      setOllamaModels(d.ollama?.catalogue ?? []);
    }).catch(() => {});

    fetch(`${API}/lumi/memory/status?limit=5`).then((r) => r.json()).then((d) => {
      setMemoryStatus(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    let assistantIndex = -1;
    let streamedText = "";
    setMessages((prev) => {
      const next = [...prev, { role: "assistant", content: "" }];
      assistantIndex = next.length - 1;
      return next;
    });

    try {
      const token = getTrezzhausToken();
      const res = await fetch(`${API}/lumi/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({
          message: text,
          missionId: sessionId.current,
          useOllama,
          ollamaModel: useOllama ? (ollamaModel || undefined) : undefined,
          domain,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "LUMI stream failed.");
      }
      if (!res.body) throw new Error("LUMI stream unavailable.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = JSON.parse(trimmed.slice(5).trim());
          if (payload.type === "chunk" && typeof payload.delta === "string") {
            streamedText += payload.delta;
            setMessages((prev) => prev.map((msg, idx) => idx === assistantIndex ? { ...msg, content: streamedText } : msg));
          }
          if (payload.type === "done") {
            streamedText = payload.content ?? streamedText;
            setMessages((prev) => prev.map((msg, idx) => idx === assistantIndex ? {
              ...msg,
              content: streamedText,
              model: payload.model,
              imageUrl: payload.imageUrl,
            } : msg));
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data:")) {
          const payload = JSON.parse(trimmed.slice(5).trim());
          if (payload.type === "chunk" && typeof payload.delta === "string") {
            streamedText += payload.delta;
            setMessages((prev) => prev.map((msg, idx) => idx === assistantIndex ? { ...msg, content: streamedText } : msg));
          }
          if (payload.type === "done") {
            streamedText = payload.content ?? streamedText;
            setMessages((prev) => prev.map((msg, idx) => idx === assistantIndex ? {
              ...msg,
              content: streamedText,
              model: payload.model,
              imageUrl: payload.imageUrl,
            } : msg));
          }
        }
      }
    } catch (err: any) {
      if (assistantIndex >= 0) {
        setMessages((prev) => prev.map((msg, idx) => idx === assistantIndex ? { ...msg, content: err.message || "LUMI is unreachable — check your connection." } : msg));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: 10 }}>
      {/* AI choice bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} style={pillStyle} title="Conversation domain">
          {DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>

        <button
          onClick={() => setUseOllama(!useOllama)}
          style={{ ...pillStyle, cursor: "pointer", color: useOllama ? "#38bdf8" : "#64748b" }}
          title="Toggle between the free OpenRouter model cascade and your local Ollama"
        >
          {useOllama ? "🖥 Local Ollama" : "☁ OpenRouter cascade"}
        </button>

        {useOllama && (
          <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} style={pillStyle}>
            <option value="">Auto (SuperGemma)</option>
            {ollamaModels.filter((m) => m.available).map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
          </select>
        )}

        {!useOllama && cascade.length > 0 && (
          <span style={{ color: "#475569", fontSize: 11 }} title={cascade.map((c) => c.id).join(", ")}>
            {cascade.length} models in cascade
          </span>
        )}
      </div>

      {memoryStatus && (
        <div style={{ background: "#07111d", border: "1px solid #1e3a5f", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700 }}>🧠 LUMI memory-learning</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>
            {memoryStatus.chatTurns} chat turns • {memoryStatus.memoryFragments} learned fragments • {memoryStatus.capabilities?.length ?? 0} capabilities
          </div>
          {memoryStatus.recentFragments?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {memoryStatus.recentFragments.slice(0, 3).map((fragment: any, index: number) => (
                <div key={`${fragment.capability}-${index}`} style={{ color: "#94a3b8", fontSize: 11, background: "#0f172a", borderRadius: 6, padding: "6px 8px" }}>
                  <span style={{ color: "#38bdf8" }}>{fragment.capability}</span> · score {fragment.score.toFixed(2)} · {fragment.preview}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", background: "#0a0f1a", border: "1px solid #1e3a5f",
        borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 60 }}>
            🤖 Ask LUMI anything — video ideas, music direction, game design, code, or creative strategy.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "75%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              background: m.role === "user" ? "#0ea5e9" : "#0f172a",
              color: m.role === "user" ? "#fff" : "#e2e8f0",
            }}>
              {m.imageUrl && (
                <div style={{ marginBottom: 8 }}>
                  <img src={m.imageUrl} alt="LUMI generated" style={{ maxWidth: "100%", borderRadius: 6, display: "block", marginBottom: 6 }} />
                  <a href={m.imageUrl} download style={{ color: "#38bdf8", fontSize: 11, textDecoration: "none" }}>⬇ Download image</a>
                </div>
              )}
              {m.content}
              {m.role === "assistant" && m.model && m.model !== "none" && (
                <div style={{ color: "#475569", fontSize: 10, marginTop: 6 }}>— {m.model}</div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ color: "#475569", fontSize: 12 }}>🤖 LUMI is thinking…</div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message LUMI... (Enter to send, Shift+Enter for new line)"
          rows={2}
          style={{ ...inputStyle, flex: 1, resize: "vertical" }}
        />
        <button onClick={send} disabled={sending || !input.trim()} style={btnStyle(!sending && !!input.trim())}>
          {sending ? "⏳" : "➤ Send"}
        </button>
      </div>
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────

type Tab = "video" | "music" | "lumi" | "roblox" | "settings";
type LegalView = "app" | "privacy" | "terms" | "contact" | "cookies";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "video",    label: "Video",    icon: "🎬" },
  { id: "music",    label: "Music",    icon: "🎵" },
  { id: "lumi",     label: "LUMI",     icon: "🤖" },
  { id: "roblox",   label: STUDIO_PRODUCT_SHORT,   icon: "🎮" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function getInitialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  return (t === "video" || t === "music" || t === "lumi" || t === "roblox" || t === "settings") ? t : "roblox";
}

function getInitialLegalView(): LegalView {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "privacy" || hash === "terms" || hash === "contact" || hash === "cookies" ? hash : "app";
}

function getLegalTitle(view: LegalView) {
  switch (view) {
    case "privacy": return "Privacy policy";
    case "terms": return "Terms of service";
    case "contact": return "Contact";
    case "cookies": return "Cookie notice";
    default: return "Studio information";
  }
}

function LegalPage({ view, onBack }: { view: LegalView; onBack: () => void }) {
  const content = {
    privacy: {
      title: "Privacy policy",
      body: "TrezzWorld Production Studio stores only the information needed to keep your workspace usable: local preferences, session IDs, and optional API keys configured through the Settings tab. We do not sell user data or use third-party tracking by default. If you enable external services or publish content, those providers may process your requests according to their own privacy terms.",
      bullets: ["Local preference and session storage live in your browser.", "API keys entered in Settings are stored only in the environment or service configuration you choose.", "If you connect external publishing services, you remain responsible for reviewing their privacy policies."],
    },
    terms: {
      title: "Terms of service",
      body: "You may use TrezzWorld Production Studio for lawful creative work, prototyping, and publishing workflows. Do not upload or generate content that infringes the rights of others, includes malware, or targets users with abuse or spam.",
      bullets: ["Respect copyright, trademarks, and platform rules when publishing generated assets.", "Be responsible for any outputs you distribute or monetize.", "The studio may be rate-limited or disabled if abuse or excessive usage is detected."],
    },
    contact: {
      title: "Contact",
      body: "Need help, want to collaborate, or have a launch issue? Reach out to the TrezzHaus team at hello@trezzhaus.com and include the project name and the exact workflow that is failing.",
      bullets: ["Include screenshots or logs when reporting a bug.", "For production incidents, mention your environment and any recent deployment changes."],
    },
    cookies: {
      title: "Cookie notice",
      body: "This studio uses browser storage for a simple consent flag, tab state, and session continuity. No third-party analytics cookies are required for the core experience.",
      bullets: ["Accepting cookies keeps the consent banner from showing again.", "Declining cookies still leaves the studio usable, but you may see the banner again on future visits."],
    },
  }[view];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #020817 0%, #040d1e 100%)", color: "#e2e8f0", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 18, padding: 24 }}>
        <button onClick={onBack} style={{ ...btnStyle(true), marginBottom: 16 }}>← Back to studio</button>
        <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>Launch-ready compliance</div>
        <div style={{ color: "#e2e8f0", fontSize: 28, fontWeight: 800, marginTop: 6 }}>{content.title}</div>
        <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>{content.body}</div>
        <ul style={{ color: "#94a3b8", lineHeight: 1.7, paddingLeft: 20, marginTop: 12 }}>
          {content.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>(getInitialTab());
  const [legalView, setLegalView] = useState<LegalView>(getInitialLegalView());
  const [cookieConsent, setCookieConsent] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("trezzworld_cookie_consent");
    return stored ? stored === "accepted" : null;
  });

  useEffect(() => {
    const onHashChange = () => {
      setLegalView(getInitialLegalView());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openLegalView = (view: LegalView) => {
    setLegalView(view);
    if (view === "app") {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
      return;
    }
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${view}`);
  };

  const setCookieChoice = (choice: boolean) => {
    window.localStorage.setItem("trezzworld_cookie_consent", choice ? "accepted" : "declined");
    setCookieConsent(choice);
  };

  if (legalView !== "app") {
    return <LegalPage view={legalView} onBack={() => openLegalView("app")} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #020817 0%, #040d1e 100%)",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {cookieConsent === null && (
        <div style={{
          borderBottom: "1px solid #1e3a5f",
          padding: "12px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap", background: "#0a0f1a",
        }}>
          <div style={{ color: "#94a3b8", fontSize: 13, maxWidth: 760 }}>
            This studio uses browser storage for a simple consent flag and session continuity. No third-party tracking cookies are required for the core experience.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setCookieChoice(false)} style={{ ...btnStyle(true), background: "#0f172a", color: "#94a3b8" }}>Decline</button>
            <button onClick={() => setCookieChoice(true)} style={btnStyle(true)}>Accept</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #0f172a",
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#020817cc", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>
            <span style={{ color: "#38bdf8" }}>Trezz</span>
            <span style={{ color: "#e2e8f0" }}>World</span>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              Production Studio
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: tab === t.id ? "#0ea5e9" : "transparent",
                color: tab === t.id ? "#fff" : "#64748b",
                transition: "all 0.2s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        {tab === "video" && <VideoTab />}
        {tab === "music" && <MusicTab />}
        {tab === "lumi" && <LumiTab />}
        {tab === "roblox" && <RobloxTab />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <div style={{ borderTop: "1px solid #0f172a", padding: "16px 24px", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", background: "#020817cc" }}>
        <button onClick={() => openLegalView("privacy")} style={{ ...btnStyle(true), background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8" }}>Privacy</button>
        <button onClick={() => openLegalView("terms")} style={{ ...btnStyle(true), background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8" }}>Terms</button>
        <button onClick={() => openLegalView("contact")} style={{ ...btnStyle(true), background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8" }}>Contact</button>
        <button onClick={() => openLegalView("cookies")} style={{ ...btnStyle(true), background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8" }}>Cookies</button>
      </div>
    </div>
  );
}
