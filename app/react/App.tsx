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

function SettingsTab() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
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

// ── App shell ─────────────────────────────────────────────────────────────────

type Tab = "video" | "music" | "lumi" | "roblox" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "video",    label: "Video",    icon: "🎬" },
  { id: "music",    label: "Music",    icon: "🎵" },
  { id: "lumi",     label: "LUMI",     icon: "🤖" },
  { id: "roblox",   label: "Roblox",   icon: "🎮" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("video");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #020817 0%, #040d1e 100%)",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
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
        <div style={{ display: "flex", gap: 4 }}>
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
        {tab === "lumi" && (
          <div style={{ color: "#64748b", textAlign: "center", paddingTop: 80 }}>
            LUMI AI Chat — coming in next build
          </div>
        )}
        {tab === "roblox" && (
          <div style={{ color: "#64748b", textAlign: "center", paddingTop: 80 }}>
            Roblox Game Creator — coming in next build
          </div>
        )}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
