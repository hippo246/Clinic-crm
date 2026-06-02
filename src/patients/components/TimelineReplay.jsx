import { useState } from "react";

/**
 * Timeline Replay - Play timeline like a video
 * Jan 2025: Patient created → Feb 2025: First visit → Mar 2025: Follow-up
 * Makes long histories understandable
 */
export default function TimelineReplay({ patient, timeline }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1000);

  const sortedTimeline = [...timeline].sort((a, b) => new Date(a.date) - new Date(b.date));

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < sortedTimeline.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const currentEvent = sortedTimeline[currentIndex];
  const progress = ((currentIndex + 1) / sortedTimeline.length) * 100;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#7c4fff20",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-player-play" style={{ fontSize: 16, color: "#7c4fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Timeline Replay
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {sortedTimeline.length} events · {currentIndex + 1} of {sortedTimeline.length}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          height: 6, borderRadius: 3,
          background: "var(--surface2)",
          overflow: "hidden",
        }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #7c4fff, #ec4899)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Current Event */}
      {currentEvent && (
        <div style={{
          padding: 16, borderRadius: 8,
          background: "#7c4fff10", border: "1px solid #7c4fff30",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#7c4fff20",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`ti ${currentEvent.icon || "ti-circle"}`} style={{ fontSize: 20, color: "#7c4fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                {currentEvent.label || currentEvent.type}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {new Date(currentEvent.date).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric"
                })}
              </div>
              {currentEvent.note && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  {currentEvent.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleReset}
          style={{
            padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-refresh" style={{ fontSize: 12 }} />
        </button>
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          style={{
            padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: currentIndex === 0 ? "var(--surface2)" : "var(--accent-soft)",
            border: currentIndex === 0 ? "1px solid var(--border)" : "1px solid var(--accent)",
            color: currentIndex === 0 ? "var(--muted)" : "var(--accent)",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
          }}
        >
          <i className="ti ti-player-track-prev" style={{ fontSize: 12 }} />
        </button>
        <button
          onClick={handlePlay}
          style={{
            padding: "10px 20px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className={`ti ${isPlaying ? "ti-player-pause" : "ti-player-play"}`} style={{ fontSize: 12 }} />
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === sortedTimeline.length - 1}
          style={{
            padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: currentIndex === sortedTimeline.length - 1 ? "var(--surface2)" : "var(--accent-soft)",
            border: currentIndex === sortedTimeline.length - 1 ? "1px solid var(--border)" : "1px solid var(--accent)",
            color: currentIndex === sortedTimeline.length - 1 ? "var(--muted)" : "var(--accent)",
            cursor: currentIndex === sortedTimeline.length - 1 ? "not-allowed" : "pointer",
          }}
        >
          <i className="ti ti-player-track-next" style={{ fontSize: 12 }} />
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{
              padding: "4px 8px", borderRadius: 4, fontSize: 11,
              background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
            }}
          >
            <option value={2000}>Slow</option>
            <option value={1000}>Normal</option>
            <option value={500}>Fast</option>
          </select>
        </div>
      </div>

      {/* Timeline Overview */}
      <div style={{
        marginTop: 20, padding: 12, borderRadius: 8,
        background: "var(--surface2)", border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
          Timeline Overview
        </div>
        <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {sortedTimeline.map((event, idx) => (
            <div
              key={idx}
              onClick={() => { setCurrentIndex(idx); setIsPlaying(false); }}
              style={{
                minWidth: 40, height: 40, borderRadius: "50%",
                background: idx <= currentIndex ? "#7c4fff" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              title={event.label || event.type}
            >
              <i className={`ti ${event.icon || "ti-circle"}`} style={{ fontSize: 14, color: idx <= currentIndex ? "#fff" : "var(--muted)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
