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

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
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
  const [statusMessage, setStatusMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/roblox/games`);
      const data = await res.json();
      const nextJobs: RobloxJob[] = data.jobs ?? [];
      setJobs(nextJobs);
      setSelectedJob((current) => {
        if (!nextJobs.length) return null;
        if (!current) return nextJobs[0];
        return nextJobs.find((job) => job.jobId === current.jobId) ?? nextJobs[0];
      });
    } catch {
      // Leave current UI state intact if the refresh fails.
    }
  }, []);

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
    refreshJobs();
    loadOauthStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("robloxAuth")) {
      loadOauthStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshJobs]);

  const signOut = async () => {
    await fetch(`${API}/roblox/oauth/logout`, { method: "POST" });
    loadOauthStatus();
  };

  const createJob = async () => {
    if (!concept.trim() || !universeId.trim() || !placeId.trim()) return;
    setCreating(true);
    setStatusMessage("");
    try {
      const res = await fetch(`${API}/roblox/game/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, genre, maxPlayers, monetization, universeId, placeId }),
      });
      const job: RobloxJob = await res.json();
      if (!res.ok) throw new Error((job as any).detail || "Failed to create Roblox job.");
      setJobs((prev) => [job, ...prev]);
      setSelectedJob(job);
      setConcept("");
      setStatusMessage(`Queued Roblox job ${job.jobId}.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to create Roblox job.");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    pollRef.current = setInterval(() => { refreshJobs(); }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refreshJobs]);

  const canCreate = concept.trim() && universeId.trim() && placeId.trim() && !creating;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Roblox sign-in bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 14px",
      }}>
        <div style={{ color: "#94a3b8", fontSize: 12 }}>
          {oauthStatus.connected
            ? `🎮 Signed in as ${oauthStatus.user?.name || oauthStatus.user?.preferred_username || "Roblox user"}`
            : "🎮 Not signed in — publish/monetization will use a static admin API key if configured"}
        </div>
        {oauthStatus.connected ? (
          <button onClick={signOut} style={btnStyle(true)}>Sign out</button>
        ) : (
          <a href={`${API}/roblox/oauth/login`} style={{ ...btnStyle(true), textDecoration: "none" }}>Sign in with Roblox</a>
        )}
      </div>

      {/* Creation form */}
      <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14 }}>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          aria-label="Roblox game concept"
          placeholder='Describe your game... (e.g., "A tycoon where players build and manage a pizza shop")'
          rows={3}
          style={{ ...inputStyle, resize: "vertical", border: "none", background: "transparent", padding: "4px 2px", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Roblox game genre" style={pillStyle}>
            {ROBLOX_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <input type="number" value={maxPlayers} min={2} max={100} onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 20)} aria-label="Maximum players" title="Max players" style={{ ...pillStyle, width: 70 }} />
          <select value={monetization} onChange={(e) => setMonetization(e.target.value)} aria-label="Roblox monetization strategy" style={pillStyle}>
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
            aria-label="Roblox place ID or game URL"
            style={{ ...inputStyle, width: 260 }}
          />
          <input
            type="text"
            placeholder={lookingUpUniverse ? "Looking up..." : "Universe ID (auto-fills if found)"}
            value={universeId}
            onChange={(e) => setUniverseId(e.target.value)}
            aria-label="Roblox universe ID"
            style={{ ...inputStyle, width: 220 }}
          />
          <div style={{ flex: 1 }} />
          <button onClick={createJob} disabled={!canCreate} style={{ ...btnStyle(!!canCreate), padding: "10px 20px", fontSize: 13, fontWeight: 700 }}>
            {creating ? "⏳ Creating..." : "🎮 Generate Game"}
          </button>
        </div>
        {statusMessage && (
          <div aria-live="polite" style={{ color: statusMessage.startsWith("Queued") ? "#86efac" : "#fca5a5", fontSize: 12, marginTop: 8 }}>
            {statusMessage}
          </div>
        )}
        {(!universeId.trim() || !placeId.trim()) && (
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 8 }}>
            Don't have these yet? Create an empty Experience at{" "}
            <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
              create.roblox.com
            </a>{" "}— Roblox doesn't offer an API to create one from scratch, or to list your
            experiences automatically even when signed in. Paste the Place ID (or the game's
            URL) above and the Universe ID auto-fills when possible.
          </div>
        )}
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>JOBS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {jobs.map((job) => (
              <button
                key={job.jobId}
                type="button"
                onClick={() => setSelectedJob(job)}
                style={{
                  background: selectedJob?.jobId === job.jobId ? "#0f2438" : "#0a0f1a",
                  border: `1px solid ${selectedJob?.jobId === job.jobId ? "#38bdf8" : "#1e3a5f"}`,
                  borderRadius: 6, padding: "10px 14px", cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  fontFamily: "inherit",
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
              </button>
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
    try {
      const token = getTrezzhausToken();
      const res = await fetch(`${API}/lumi/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          missionId: sessionId.current,
          useOllama,
          ollamaModel: useOllama ? (ollamaModel || undefined) : undefined,
          domain,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content, model: data.model, imageUrl: data.imageUrl }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "LUMI is unreachable — check your connection." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: 10 }}>
      {/* AI choice bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="LUMI conversation domain" style={pillStyle} title="Conversation domain">
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
          <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} aria-label="Ollama model" style={pillStyle}>
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

      {/* Messages */}
      <div ref={scrollRef} aria-live="polite" style={{
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
          aria-label="Message LUMI"
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

// ── Image Studio Tab ──────────────────────────────────────────────────────────

const IMAGE_STYLES = [
  { id: "cinematic", label: "🎬 Cinematic", desc: "Film-quality photorealistic" },
  { id: "3d", label: "🎲 3D Render", desc: "Photorealistic 3D" },
  { id: "anime", label: "✏ Anime", desc: "Anime & illustration style" },
  { id: "surreal", label: "🌀 Surreal", desc: "Dreamlike fantasy art" },
  { id: "logo", label: "🔤 Logo / Brand", desc: "Clean vector-style branding" },
  { id: "poster", label: "🪧 Poster / Ad", desc: "Marketing & promotional art" },
  { id: "portrait", label: "🧑 Portrait", desc: "Character / headshot" },
  { id: "landscape", label: "🏔 Landscape", desc: "Scenic environment" },
];

const IMAGE_FILTERS = [
  { id: "sharpen",   label: "✨ Sharpen",   icon: "✨" },
  { id: "blur",      label: "💧 Blur",      icon: "💧" },
  { id: "enhance",   label: "⚡ Enhance",   icon: "⚡" },
  { id: "grayscale", label: "⬛ Grayscale", icon: "⬛" },
  { id: "resize",    label: "📐 Resize",    icon: "📐" },
];

interface ImageResult {
  imageId: string;
  imageUrl: string;
  prompt: string;
  style: string;
  source: "ai" | "vector" | "upload";
  note?: string;
}

function ImageTab() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filtering, setFiltering] = useState<string | null>(null);
  const [resizeW, setResizeW] = useState(800);
  const [resizeH, setResizeH] = useState(600);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [selected, setSelected] = useState<ImageResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`${API}/image/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, width, height }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Generation failed.");
      const img: ImageResult = { imageId: data.imageId, imageUrl: data.imageUrl, prompt, style, source: data.source, note: data.note };
      setImages((prev) => [img, ...prev]);
      setSelected(img);
      setPrompt("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/image/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed.");
      const img: ImageResult = { imageId: data.imageId, imageUrl: data.imageUrl, prompt: file.name, style: "upload", source: "upload" };
      setImages((prev) => [img, ...prev]);
      setSelected(img);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const applyFilter = async (operation: string) => {
    if (!selected) return;
    setFiltering(operation);
    setError("");
    try {
      const body: any = { imageId: selected.imageId, operation };
      if (operation === "resize") { body.width = resizeW; body.height = resizeH; }
      const res = await fetch(`${API}/image/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Filter failed.");
      const img: ImageResult = { imageId: data.imageId, imageUrl: data.imageUrl, prompt: `${selected.prompt} [${operation}]`, style: selected.style, source: selected.source };
      setImages((prev) => [img, ...prev]);
      setSelected(img);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFiltering(null);
    }
  };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left: create / upload panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>🖼 IMAGE STUDIO</div>

        {/* Style selector */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {IMAGE_STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)} title={s.desc} aria-label={s.desc} style={{
              ...pillStyle, cursor: "pointer",
              background: style === s.id ? "#0f2438" : "#0a0f1a",
              color: style === s.id ? "#38bdf8" : "#64748b",
              border: `1px solid ${style === s.id ? "#38bdf8" : "#1e3a5f"}`,
            }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Prompt box */}
        <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14 }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) generate(); }}
            placeholder='Describe your image... (e.g., "A glowing neon city skyline at night, rain-soaked streets, cinematic")'
            rows={4}
            style={{ ...inputStyle, resize: "vertical", border: "none", background: "transparent", padding: "4px 2px", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={`${width}x${height}`} onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              setWidth(w); setHeight(h);
            }} style={pillStyle}>
              <option value="512x512">512×512</option>
              <option value="768x768">768×768</option>
              <option value="1024x1024">1024×1024 (Square)</option>
              <option value="1920x1080">1920×1080 (16:9)</option>
              <option value="1080x1920">1080×1920 (Vertical)</option>
              <option value="1200x628">1200×628 (Banner)</option>
            </select>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ ...btnStyle(!uploading), background: "#1e293b" }}
            >
              {uploading ? "⏳ Uploading..." : "⬆ Upload Image"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }} />
            <button
              onClick={generate}
              disabled={generating || !prompt.trim()}
              style={{ ...btnStyle(!generating && !!prompt.trim()), padding: "10px 20px", fontWeight: 700 }}
            >
              {generating ? "⏳ Generating..." : "✨ Generate"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#7f1d1d22", border: "1px solid #ef444444", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Touchup tools for selected image */}
        {selected && (
          <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14 }}>
            <div style={{ color: "#a855f7", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
              ⚒ TOUCHUP TOOLS
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              {IMAGE_FILTERS.filter((f) => f.id !== "resize").map((f) => (
                <button key={f.id} onClick={() => applyFilter(f.id)} disabled={filtering !== null} style={btnStyle(filtering === null)}>
                  {filtering === f.id ? "⏳..." : f.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: 11 }}>📐 Resize to</span>
              <input type="number" value={resizeW} min={64} max={4096}
                onChange={(e) => setResizeW(parseInt(e.target.value) || 800)}
                style={{ ...inputStyle, width: 70 }} />
              <span style={{ color: "#475569", fontSize: 11 }}>×</span>
              <input type="number" value={resizeH} min={64} max={4096}
                onChange={(e) => setResizeH(parseInt(e.target.value) || 600)}
                style={{ ...inputStyle, width: 70 }} />
              <button onClick={() => applyFilter("resize")} disabled={filtering !== null} style={btnStyle(filtering === null)}>
                {filtering === "resize" ? "⏳..." : "Apply"}
              </button>
            </div>
          </div>
        )}

        {/* Gallery thumbnails */}
        {images.length > 0 && (
          <div>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              GALLERY ({images.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {images.map((img) => (
                <div
                  key={img.imageId}
                  onClick={() => setSelected(img)}
                  style={{
                    cursor: "pointer", borderRadius: 6, overflow: "hidden",
                    border: `2px solid ${selected?.imageId === img.imageId ? "#38bdf8" : "#1e3a5f"}`,
                    aspectRatio: "1", background: "#0a0f1a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <img src={img.imageUrl} alt={img.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: preview panel */}
      {selected && (
        <div style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#000", borderRadius: 10, overflow: "hidden", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={selected.imageUrl} alt={selected.prompt} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ background: "#0a0f1a", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "#e2e8f0", fontSize: 12, lineHeight: 1.4 }}>{selected.prompt}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ ...pillStyle, fontSize: 10 }}>{selected.style}</span>
              <span style={{ ...pillStyle, fontSize: 10, color: selected.source === "ai" ? "#22c55e" : "#f59e0b" }}>
                {selected.source === "ai" ? "✓ AI Generated" : selected.source === "vector" ? "⬡ Vector" : "⬆ Uploaded"}
              </span>
            </div>
            {selected.note && (
              <div style={{ color: "#f59e0b", fontSize: 11 }}>{selected.note}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <a href={selected.imageUrl} download={`studio-${selected.imageId}.png`}
                style={{ ...btnStyle(true), textDecoration: "none", flex: 1, textAlign: "center" }}>
                ⬇ Download
              </a>
              <button onClick={() => {
                setPrompt(`Variation of: ${selected.prompt}`);
                setStyle(selected.style);
              }} style={{ ...btnStyle(true), flex: 1 }}>
                🔀 Variation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Voice Studio Tab ──────────────────────────────────────────────────────────

interface VoiceResult {
  audioId: string;
  audioUrl: string;
  text: string;
  voiceLabel: string;
}

function VoiceTab() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("en-US-female");
  const [voices, setVoices] = useState<{ id: string; label: string; gender: string; language: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<VoiceResult[]>([]);
  const [selected, setSelected] = useState<VoiceResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch(`${API}/voice/catalogue`)
      .then((r) => r.json())
      .then((d) => setVoices(d.voices ?? []))
      .catch(() => {
        fetch(`${API}/video/voices`).then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
      });
  }, []);

  const generate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`${API}/voice/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Voice generation failed.");
      const result: VoiceResult = { audioId: data.audioId, audioUrl: data.audioUrl, text, voiceLabel: data.voiceLabel };
      setResults((prev) => [result, ...prev]);
      setSelected(result);
      setText("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const charLimit = 5000;
  const chars = text.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>🎙 VOICE STUDIO</div>

      {/* Voice selector */}
      <div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>SELECT VOICE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
          {voices.map((v) => (
            <button key={v.id} onClick={() => setVoiceId(v.id)} style={{
              textAlign: "left", padding: "8px 12px", borderRadius: 6,
              cursor: "pointer", border: "none",
              background: voiceId === v.id ? "#0f2438" : "#0a0f1a",
              borderLeft: `3px solid ${voiceId === v.id ? "#38bdf8" : "#1e3a5f"}`,
            }}>
              <div style={{ color: voiceId === v.id ? "#e2e8f0" : "#94a3b8", fontSize: 12, fontWeight: voiceId === v.id ? 700 : 400 }}>
                {v.gender === "female" ? "👩" : "👨"} {v.label}
              </div>
              <div style={{ color: "#475569", fontSize: 11 }}>{v.language}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Text input */}
      <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>SCRIPT / TEXT</div>
          <div style={{ color: chars > charLimit * 0.9 ? "#ef4444" : "#475569", fontSize: 11 }}>{chars.toLocaleString()} / {charLimit.toLocaleString()}</div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, charLimit))}
          placeholder="Type or paste your script here... LUMI can write it for you in the LUMI tab."
          rows={8}
          style={{ ...inputStyle, resize: "vertical", border: "none", background: "transparent", padding: "4px 2px", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={generate}
            disabled={generating || !text.trim()}
            style={{ ...btnStyle(!generating && !!text.trim()), padding: "10px 24px", fontWeight: 700 }}
          >
            {generating ? "⏳ Synthesizing..." : "🎙 Generate Voice"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d22", border: "1px solid #ef444444", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Player for selected result */}
      {selected && (
        <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            NOW PLAYING — {selected.voiceLabel}
          </div>

          <audio ref={audioRef} src={selected.audioUrl} onEnded={() => setPlaying(false)} />

          {/* Waveform visual */}
          <div style={{
            background: "#000d1a", borderRadius: 6, height: 48, marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 1, overflow: "hidden",
          }}>
            {Array.from({ length: 80 }).map((_, i) => {
              const h = playing ? Math.abs(Math.sin(i * 0.35)) * 36 + 4 : 4 + (i % 5) * 4;
              return (
                <div key={i} style={{
                  width: 2, height: h, borderRadius: 2,
                  background: playing ? "#a855f7" : "#1e3a5f",
                  transition: "height 0.1s ease",
                }} />
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={togglePlay} style={btnStyle(true)}>
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <a href={selected.audioUrl} download={`voice-${selected.audioId}.mp3`}
              style={{ ...btnStyle(true), textDecoration: "none" }}>
              ⬇ Download MP3
            </a>
          </div>

          <div style={{ marginTop: 10, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
            {selected.text.slice(0, 200)}{selected.text.length > 200 ? "..." : ""}
          </div>
        </div>
      )}

      {/* History list */}
      {results.length > 1 && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>HISTORY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((r) => (
              <div key={r.audioId} onClick={() => setSelected(r)} style={{
                background: selected?.audioId === r.audioId ? "#0f2438" : "#0a0f1a",
                border: `1px solid ${selected?.audioId === r.audioId ? "#38bdf8" : "#1e3a5f"}`,
                borderRadius: 6, padding: "10px 14px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
                    {r.text.slice(0, 60)}{r.text.length > 60 ? "..." : ""}
                  </div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{r.voiceLabel}</div>
                </div>
                <a href={r.audioUrl} download onClick={(e) => e.stopPropagation()}
                  style={{ ...btnStyle(true), textDecoration: "none", fontSize: 11 }}>
                  ⬇
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Control Panel Tab ──────────────────────────────────────────────────────────

const MODULE_DEFS = [
  { id: "video",    icon: "🎬", label: "Video Studio",     desc: "AI video generation, cinematic rendering, editing, trim, export", color: "#38bdf8" },
  { id: "image",    icon: "🖼",  label: "Image Studio",    desc: "AI image creation, upload, GIMP touchup filters, download", color: "#a78bfa" },
  { id: "music",    icon: "🎵", label: "Music Composer",   desc: "Text-to-music via MusicGen, AudioGen, Riffusion. BPM, stems, download", color: "#34d399" },
  { id: "voice",    icon: "🎙", label: "Voice Studio",     desc: "Text-to-speech narration in 14 voices. No API key needed", color: "#f472b6" },
  { id: "lumi",     icon: "🤖", label: "LUMI AI",          desc: "Unlimited AI chat, image gen, vector art, code, creative direction", color: "#fbbf24" },
  { id: "roblox",   icon: "🎮", label: "Roblox Creator",   desc: "AI-designed Luau games, monetization, publish to Roblox", color: "#f97316" },
  { id: "settings", icon: "⚙",  label: "Settings & Keys",  desc: "API keys for AI providers, TrezzHaus account SSO, image key test", color: "#64748b" },
];

function ControlTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [cpData, setCpData] = useState<any>(null);
  const [platformStatus, setPlatformStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [missionPrompt, setMissionPrompt] = useState("");
  const [booting, setBooting] = useState(false);
  const [bootResult, setBootResult] = useState<any>(null);
  const [toolsStatus, setToolsStatus] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/studio/control-plane`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/studio/platform-status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/lumi/tools/status`).then((r) => r.json()).catch(() => null),
    ]).then(([cp, platform, tools]) => {
      setCpData(cp);
      setPlatformStatus(platform);
      setToolsStatus(tools);
      setLoading(false);
    });
  }, []);

  const bootMission = async () => {
    if (!missionPrompt.trim()) return;
    setBooting(true);
    try {
      const res = await fetch(`${API}/studio/control-plane/boot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: missionPrompt }),
      });
      setBootResult(await res.json());
    } catch {
      setBootResult({ error: "Could not connect to backend." });
    } finally {
      setBooting(false);
    }
  };

  const readiness = cpData?.productionReadiness ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero banner */}
      <div style={{
        background: "linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)",
        border: "1px solid #1e3a5f", borderRadius: 16, padding: 28,
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, marginBottom: 6 }}>
          <span style={{ color: "#38bdf8" }}>TrezzWorld</span>{" "}
          <span style={{ color: "#e2e8f0" }}>Production Studio</span>
        </div>
        <div style={{ color: "#64748b", fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
          Your AAA+ AI creative studio — video, image, music, voice, games, and unlimited LUMI AI.
          Everything you need to create, edit, upload, download, and launch.
        </div>

        {/* Readiness meter */}
        <div style={{ maxWidth: 400, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 11, marginBottom: 4 }}>
            <span>Studio Readiness</span>
            <span style={{ color: readiness >= 80 ? "#22c55e" : readiness >= 50 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>
              {readiness}%
            </span>
          </div>
          <ProgressBar value={readiness} color={readiness >= 80 ? "#22c55e" : readiness >= 50 ? "#f59e0b" : "#38bdf8"} />
        </div>

        {/* Mission launcher */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={missionPrompt}
            onChange={(e) => setMissionPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") bootMission(); }}
            aria-label="Mission prompt"
            placeholder={cpData?.missionPromptPlaceholder ?? "Describe your creative mission..."}
            style={{ ...inputStyle, flex: 1, fontSize: 13 }}
          />
          <button onClick={bootMission} disabled={booting || !missionPrompt.trim()}
            style={{ ...btnStyle(!booting && !!missionPrompt.trim()), padding: "10px 20px", fontWeight: 700 }}>
            {booting ? "⏳ Launching..." : "🚀 Launch Mission"}
          </button>
        </div>
        {bootResult && (
          <div style={{ marginTop: 10, background: "#0f2438", borderRadius: 8, padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>
            <div style={{ color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>
              ✓ Mission {bootResult.missionId} launched
            </div>
            {bootResult.summary}
          </div>
        )}
      </div>

      {platformStatus && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 16 }}>
            <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              ACCESSIBILITY
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
              {platformStatus.accessibility?.summary}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(platformStatus.accessibility?.checks ?? []).map((check: any) => (
                <div key={check.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: "#cbd5e1", fontSize: 12 }}>{check.label}</span>
                  <span style={{ color: check.status === "active" ? "#22c55e" : "#f59e0b", fontSize: 11, fontWeight: 700 }}>
                    {check.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 16 }}>
            <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              INTEGRATIONS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(platformStatus.integrations?.services ?? []).map((service: any) => (
                <div key={service.id} style={{ borderBottom: "1px solid #0f172a", paddingBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>{service.label}</span>
                    <span style={{ color: service.status === "ready" ? "#22c55e" : service.status === "partial" ? "#f59e0b" : "#ef4444", fontSize: 11, fontWeight: 700 }}>
                      {service.status}
                    </span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{service.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 16 }}>
            <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              SAFETY
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
              {platformStatus.safety?.summary}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontSize: 12, lineHeight: 1.6 }}>
              {(platformStatus.safety?.guidelines ?? []).map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Module grid */}
      <div>
        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>STUDIO MODULES</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {MODULE_DEFS.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => onNavigate(mod.id as Tab)}
              style={{
                background: "#0a0f1a",
                border: `1px solid ${mod.color}33`,
                borderRadius: 10, padding: 16, cursor: "pointer",
                transition: "border-color 0.2s",
                textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = mod.color + "88")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = mod.color + "33")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{mod.icon}</span>
                <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>{mod.label}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{mod.desc}</div>
              <div style={{ marginTop: 10 }}>
                <span style={{ color: mod.color, fontSize: 11, fontWeight: 600 }}>Open →</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Capability providers from control plane */}
      {cpData?.capabilityProviders && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            CAPABILITY PROVIDERS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
            {cpData.capabilityProviders.map((p: any) => (
              <div key={p.capability} style={{
                background: "#0a0f1a",
                border: `1px solid ${p.status === "ready" ? "#22c55e33" : p.status === "standby" ? "#f59e0b33" : "#1e3a5f"}`,
                borderRadius: 8, padding: "10px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{p.capability}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                    background: p.status === "ready" ? "#22c55e22" : p.status === "standby" ? "#f59e0b22" : "#1e3a5f",
                    color: p.status === "ready" ? "#22c55e" : p.status === "standby" ? "#f59e0b" : "#475569",
                  }}>
                    {p.status}
                  </span>
                </div>
                <div style={{ color: "#475569", fontSize: 11 }}>{p.providerId}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creative tools status */}
      {toolsStatus && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            CREATIVE TOOLS
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(toolsStatus).filter(([k]) => k !== "summary").map(([key, val]: [string, any]) => {
              const available = val === true || val?.available === true;
              return (
                <div key={key} style={{
                  background: "#0a0f1a",
                  border: `1px solid ${available ? "#22c55e33" : "#1e3a5f"}`,
                  borderRadius: 8, padding: "8px 14px",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ color: available ? "#22c55e" : "#475569", fontSize: 11 }}>
                    {available ? "✓" : "✗"}
                  </span>
                  <span style={{ color: available ? "#94a3b8" : "#475569", fontSize: 12 }}>
                    {key}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Execution queue */}
      {cpData?.executionQueue && cpData.executionQueue.length > 0 && (
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            META-BUILDER QUEUE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cpData.executionQueue.map((job: any) => (
              <div key={job.jobId} style={{
                background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 6, padding: "10px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{job.name}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{job.workerId} · {job.stage}</div>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ color: "#475569", fontSize: 12, textAlign: "center" }}>Loading studio status...</div>
      )}
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────

type Tab = "control" | "video" | "image" | "music" | "voice" | "lumi" | "roblox" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "control",  label: "Control",  icon: "🎛" },
  { id: "video",    label: "Video",    icon: "🎬" },
  { id: "image",    label: "Image",    icon: "🖼" },
  { id: "music",    label: "Music",    icon: "🎵" },
  { id: "voice",    label: "Voice",    icon: "🎙" },
  { id: "lumi",     label: "LUMI",     icon: "🤖" },
  { id: "roblox",   label: "Roblox",   icon: "🎮" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function getInitialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  return TABS.some((tab) => tab.id === t) ? (t as Tab) : "control";
}

export default function App() {
  const [tab, setTab] = useState<Tab>(getInitialTab());
  const [session, setSession] = useState<{ loggedIn: boolean; isOwner: boolean; account: any } | null>(null);
  const focusTab = (nextTab: Tab) => {
    setTab(nextTab);
    requestAnimationFrame(() => {
      document.getElementById(`tab-${nextTab}`)?.focus();
    });
  };
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") return focusTab(TABS[0].id);
    if (event.key === "End") return focusTab(TABS[TABS.length - 1].id);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + TABS.length) % TABS.length;
    focusTab(TABS[nextIndex].id);
  };

  useEffect(() => {
    const token = getTrezzhausToken();
    if (!token) { setSession({ loggedIn: false, isOwner: false, account: null }); return; }
    fetch(`${API}/auth/session`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then(setSession).catch(() => setSession({ loggedIn: false, isOwner: false, account: null }));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #020817 0%, #040d1e 100%)",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <a href="#main-content" style={{ ...srOnlyStyle, top: 8, left: 8 }}>
        Skip to main content
      </a>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #0f172a",
        padding: "10px 24px",
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
          {session?.loggedIn && (
            <span style={{
              background: session.isOwner ? "#0ea5e922" : "#1e293b",
              border: `1px solid ${session.isOwner ? "#0ea5e9" : "#334155"}`,
              color: session.isOwner ? "#38bdf8" : "#94a3b8",
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            }}>
              {session.isOwner ? "👑 OWNER" : `@${session.account?.username}`}
            </span>
          )}
        </div>

        {/* Tab bar */}
        <nav aria-label="Studio sections">
          <div role="tablist" aria-label="Studio sections" style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {TABS.map((t, index) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              style={{
                padding: "6px 13px", borderRadius: 6, border: "none",
                cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: tab === t.id ? "#0ea5e9" : "transparent",
                color: tab === t.id ? "#fff" : "#64748b",
                transition: "all 0.2s",
              }}
            >
              {t.icon} {t.label}
            </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main id="main-content" style={{ flex: 1, padding: 24, maxWidth: 1280, width: "100%", margin: "0 auto" }}>
        <section id="panel-control" role="tabpanel" aria-labelledby="tab-control" hidden={tab !== "control"}>
          {tab === "control" && <ControlTab onNavigate={setTab} />}
        </section>
        <section id="panel-video" role="tabpanel" aria-labelledby="tab-video" hidden={tab !== "video"}>
          {tab === "video" && <VideoTab />}
        </section>
        <section id="panel-image" role="tabpanel" aria-labelledby="tab-image" hidden={tab !== "image"}>
          {tab === "image" && <ImageTab />}
        </section>
        <section id="panel-music" role="tabpanel" aria-labelledby="tab-music" hidden={tab !== "music"}>
          {tab === "music" && <MusicTab />}
        </section>
        <section id="panel-voice" role="tabpanel" aria-labelledby="tab-voice" hidden={tab !== "voice"}>
          {tab === "voice" && <VoiceTab />}
        </section>
        <section id="panel-lumi" role="tabpanel" aria-labelledby="tab-lumi" hidden={tab !== "lumi"}>
          {tab === "lumi" && <LumiTab />}
        </section>
        <section id="panel-roblox" role="tabpanel" aria-labelledby="tab-roblox" hidden={tab !== "roblox"}>
          {tab === "roblox" && <RobloxTab />}
        </section>
        <section id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden={tab !== "settings"}>
          {tab === "settings" && <SettingsTab />}
        </section>
      </main>
    </div>
  );
}
