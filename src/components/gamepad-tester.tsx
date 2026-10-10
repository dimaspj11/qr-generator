import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAMES = [
  "A",
  "B",
  "X",
  "Y",
  "Left bumper",
  "Right bumper",
  "Left trigger",
  "Right trigger",
  "Back",
  "Start",
  "Left stick click",
  "Right stick click",
  "D-pad up",
  "D-pad down",
  "D-pad left",
  "D-pad right",
  "Home",
];

type ButtonSnap = { name: string; pressed: boolean; value: number };
type PadSnap = { index: number; id: string; mapping: string; timestamp: number; buttons: ButtonSnap[]; axes: number[] };
type Rumbler = {
  playEffect?: (type: string, params: { duration: number; startDelay: number; strongMagnitude: number; weakMagnitude: number }) => Promise<void>;
  reset?: () => Promise<void>;
  pulse?: (value: number, duration: number) => Promise<void>;
};
type StickTrack = { trail: { x: number; y: number }[]; buckets: number[] };
type Poll = { hz: number; avg: number; peak: number; interval: number; jitter: number; bars: number[] };

const EMPTY_POLL: Poll = { hz: 0, avg: 0, peak: 0, interval: 0, jitter: 0, bars: [] };

function buttonName(index: number) {
  return NAMES[index] ?? `Button ${index}`;
}

function emptyTrack(): StickTrack {
  return { trail: [], buckets: Array.from({ length: 36 }, () => 0) };
}

function readPads(): PadSnap[] {
  const source = navigator.getGamepads?.() ?? [];
  const pads: PadSnap[] = [];
  for (const pad of source) {
    if (!pad) continue;
    pads.push({
      index: pad.index,
      id: pad.id || `Controller ${pad.index + 1}`,
      mapping: pad.mapping || "unknown",
      timestamp: pad.timestamp,
      buttons: pad.buttons.map((button, index) => ({
        name: buttonName(index),
        pressed: button.pressed || button.value > 0.15,
        value: button.value,
      })),
      axes: Array.from(pad.axes),
    });
  }
  return pads;
}

function simulatedPad(now: number): PadSnap {
  const buttons = Array.from({ length: 17 }, (_, index) => ({
    name: buttonName(index),
    pressed: false,
    value: 0,
  }));
  const order = [0, 1, 2, 3, 4, 5, 12, 15, 13, 14, 8, 9, 10, 11];
  const step = order[Math.floor(now / 650) % order.length] ?? 0;
  buttons[step] = { name: buttonName(step), pressed: true, value: 1 };
  const pull = (Math.sin(now / 320) + 1) / 2;
  buttons[6] = { name: buttonName(6), pressed: pull > 0.15, value: pull };
  buttons[7] = { name: buttonName(7), pressed: 1 - pull > 0.15, value: 1 - pull };
  const angle = now / 480;
  return {
    index: 0,
    id: "Simulated controller",
    mapping: "standard",
    timestamp: now,
    buttons,
    axes: [Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, Math.cos(angle + 1.7) * 0.72, Math.sin(angle + 1.7) * 0.72],
  };
}

function axis(axes: number[], index: number) {
  return axes[index] ?? 0;
}

function magnitude(x: number, y: number) {
  return Math.hypot(x, y);
}

function coverage(track: StickTrack) {
  const filled = track.buckets.filter((value) => value >= 0.85).length;
  return filled / track.buckets.length;
}

function shapeError(track: StickTrack) {
  const outer = track.buckets.filter((value) => value >= 0.5);
  if (outer.length === 0) return 0;
  const mean = outer.reduce((sum, value) => sum + Math.abs(1 - value), 0) / outer.length;
  return mean;
}

function remember(track: StickTrack, x: number, y: number) {
  const size = magnitude(x, y);
  if (size > 0.02) {
    track.trail.push({ x, y });
    if (track.trail.length > 240) track.trail.shift();
    const angle = Math.atan2(y, x);
    const index = Math.floor((((angle + Math.PI) / (Math.PI * 2)) * track.buckets.length) % track.buckets.length);
    track.buckets[index] = Math.max(track.buckets[index] ?? 0, Math.min(1, size));
  }
}

function drawStick(canvas: HTMLCanvasElement, x: number, y: number, track: StickTrack, deadzone: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  const center = size / 2;
  const radius = size / 2 - 8;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "#2a3140";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(center, 10);
  ctx.lineTo(center, size - 10);
  ctx.moveTo(10, center);
  ctx.lineTo(size - 10, center);
  ctx.stroke();
  ctx.strokeStyle = "#8d96a6";
  ctx.beginPath();
  ctx.arc(center, center, radius * deadzone, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#2ec8ff";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  track.trail.forEach((point, index) => {
    const px = center + point.x * radius;
    const py = center + point.y * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.globalAlpha = 0.45;
  track.buckets.forEach((value, index) => {
    if (value <= 0) return;
    const angle = (index / track.buckets.length) * Math.PI * 2 - Math.PI;
    ctx.beginPath();
    ctx.arc(center + Math.cos(angle) * value * radius, center + Math.sin(angle) * value * radius, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#7ad9ff";
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  const drifted = magnitude(x, y) > deadzone;
  ctx.fillStyle = drifted ? "#2ec8ff" : "#f4f7fb";
  ctx.beginPath();
  ctx.arc(center + x * radius, center + y * radius, 6, 0, Math.PI * 2);
  ctx.fill();
}

function KeyCap({ name, pressed }: { name: string; pressed: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-center rounded-control border px-1 text-center text-xs font-medium",
        pressed ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background text-muted",
      )}
      aria-pressed={pressed}
    >
      {name}
    </div>
  );
}

export function GamepadTester({ active }: { active: boolean }) {
  const [pads, setPads] = useState<PadSnap[]>([]);
  const [selected, setSelected] = useState(0);
  const [deadzone, setDeadzone] = useState(0.1);
  const [poll, setPoll] = useState<Poll>(EMPTY_POLL);
  const [history, setHistory] = useState<{ name: string; at: string }[]>([]);
  const [note, setNote] = useState("");
  const [driftSeconds, setDriftSeconds] = useState<number | null>(null);
  const [driftResult, setDriftResult] = useState<{ left: number; right: number } | null>(null);
  const [leftMotor, setLeftMotor] = useState(1);
  const [rightMotor, setRightMotor] = useState(1);
  const [duration, setDuration] = useState(400);
  const [simOn, setSimOn] = useState(false);
  const padsRef = useRef(pads);
  const simRef = useRef(false);
  const runRef = useRef(0);
  const tracks = useRef<[StickTrack, StickTrack]>([emptyTrack(), emptyTrack()]);
  const pollRef = useRef({ lastTs: -1, samples: [] as number[], peak: 0 });
  const pressedRef = useRef<boolean[]>([]);
  const driftRef = useRef<{ until: number; left: number; right: number } | null>(null);
  const driftSecond = useRef<number | null>(null);
  const deadzoneRef = useRef(deadzone);
  const leftCanvas = useRef<HTMLCanvasElement>(null);
  const rightCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    deadzoneRef.current = deadzone;
  }, [deadzone]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const next = simRef.current ? [simulatedPad(performance.now())] : readPads();
      const current = next.find((item) => item.index === selected) ?? next[0];
      if (current) {
        const lx = axis(current.axes, 0);
        const ly = axis(current.axes, 1);
        const rx = axis(current.axes, 2);
        const ry = axis(current.axes, 3);
        remember(tracks.current[0], lx, ly);
        remember(tracks.current[1], rx, ry);
        if (leftCanvas.current) drawStick(leftCanvas.current, lx, ly, tracks.current[0], deadzoneRef.current);
        if (rightCanvas.current) drawStick(rightCanvas.current, rx, ry, tracks.current[1], deadzoneRef.current);

        const previous = pollRef.current.lastTs;
        if (previous >= 0 && current.timestamp > previous) {
          const delta = current.timestamp - previous;
          if (delta > 0 && delta < 200) {
            const samples = pollRef.current.samples;
            samples.push(delta);
            if (samples.length > 40) samples.shift();
            const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
            const mean = avg;
            const jitter = Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length);
            const hz = avg > 0 ? 1000 / avg : 0;
            pollRef.current.peak = Math.max(pollRef.current.peak, hz);
            setPoll({
              hz,
              avg: hz,
              peak: pollRef.current.peak,
              interval: avg,
              jitter,
              bars: samples.slice(-18),
            });
          }
        }
        pollRef.current.lastTs = current.timestamp;

        const edges = current.buttons.flatMap((button, index) =>
          button.pressed && !pressedRef.current[index] ? [button.name] : [],
        );
        pressedRef.current = current.buttons.map((button) => button.pressed);
        if (edges.length > 0) {
          const at = new Date().toLocaleTimeString();
          setHistory((items) => [...edges.map((name) => ({ name, at })), ...items].slice(0, 12));
        }

        const drift = driftRef.current;
        if (drift) {
          drift.left = Math.max(drift.left, magnitude(lx, ly));
          drift.right = Math.max(drift.right, magnitude(rx, ry));
          const remain = Math.max(0, Math.ceil((drift.until - performance.now()) / 1000));
          if (remain !== driftSecond.current) {
            driftSecond.current = remain;
            setDriftSeconds(remain);
          }
          if (performance.now() >= drift.until) {
            setDriftResult({ left: drift.left, right: drift.right });
            setDriftSeconds(null);
            driftRef.current = null;
            driftSecond.current = null;
          }
        }
      }
      if (JSON.stringify(padsRef.current) !== JSON.stringify(next)) {
        padsRef.current = next;
        setPads(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, selected]);

  const pad = pads.find((item) => item.index === selected) ?? pads[0];
  const pressedNames = pad?.buttons.filter((button) => button.pressed).map((button) => button.name) ?? [];

  function toggleSim() {
    simRef.current = !simRef.current;
    setSimOn(simRef.current);
    pollRef.current = { lastTs: -1, samples: [], peak: 0 };
    pressedRef.current = [];
    setPoll(EMPTY_POLL);
    if (!simRef.current) {
      const live = readPads();
      padsRef.current = live;
      setPads(live);
      setHistory([]);
    }
  }

  function clearMap() {
    tracks.current = [emptyTrack(), emptyTrack()];
    if (pad && leftCanvas.current && rightCanvas.current) {
      drawStick(leftCanvas.current, axis(pad.axes, 0), axis(pad.axes, 1), tracks.current[0], deadzone);
      drawStick(rightCanvas.current, axis(pad.axes, 2), axis(pad.axes, 3), tracks.current[1], deadzone);
    }
  }

  function startDrift() {
    driftRef.current = { until: performance.now() + 3000, left: 0, right: 0 };
    setDriftResult(null);
    setDriftSeconds(3);
    driftSecond.current = 3;
  }

  function livePad() {
    if (!pad) return null;
    return navigator.getGamepads?.()[pad.index] as (Gamepad & { vibrationActuator?: Rumbler; hapticActuators?: Rumbler[] }) | null;
  }

  async function sendRumble(strong: number, weak: number, ms: number) {
    const live = livePad();
    const actuator = live?.vibrationActuator;
    if (actuator?.playEffect) {
      await actuator.playEffect("dual-rumble", { duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak });
      return true;
    }
    const haptic = live?.hapticActuators?.[0];
    if (haptic?.pulse && strong + weak > 0) {
      await haptic.pulse(Math.max(strong, weak), ms);
      return true;
    }
    if (actuator?.reset && strong + weak === 0) {
      await actuator.reset();
      return true;
    }
    return false;
  }

  async function playPattern(steps: { strong: number; weak: number; ms: number; gap: number; label: string }[]) {
    const token = ++runRef.current;
    try {
      for (const step of steps) {
        if (runRef.current !== token) return;
        setNote(step.label);
        const sent = await sendRumble(step.strong, step.weak, step.ms);
        if (!sent) {
          if (runRef.current === token) setNote("This controller does not report vibration.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, step.ms + step.gap));
      }
      if (runRef.current === token) setNote("Vibration test finished.");
    } catch {
      if (runRef.current === token) setNote("This browser blocked vibration.");
    }
  }

  function stopRumble() {
    runRef.current += 1;
    void sendRumble(0, 0, 0).then(
      (sent) => setNote(sent ? "Vibration stopped." : "This controller does not report vibration."),
      () => setNote("This browser blocked vibration."),
    );
  }

  const leftDeviation = pad ? magnitude(axis(pad.axes, 0), axis(pad.axes, 1)) : 0;
  const rightDeviation = pad ? magnitude(axis(pad.axes, 2), axis(pad.axes, 3)) : 0;
  const maxBar = Math.max(1, ...poll.bars);

  return (
    <section className="mx-auto mt-6 grid w-full max-w-xl gap-4">
      <p className="text-center text-sm text-muted" role="status">
        {pad
          ? pressedNames.length > 0
            ? `Pressed: ${pressedNames.join(", ")}`
            : simOn
              ? "Simulated controller."
              : "Connected. No buttons pressed."
          : "No controller yet. Connect one, or simulate it."}
      </p>
      <GamepadFigure pad={pad ?? null} />
      <Button type="button" className="w-full" variant={simOn ? "secondary" : "primary"} onClick={toggleSim}>
        {simOn ? "Stop simulation" : "Simulate"}
      </Button>
      {pads.length > 1 ? (
        <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Controllers">
          {pads.map((item) => (
            <button
              key={item.index}
              type="button"
              role="tab"
              aria-selected={pad?.index === item.index}
              className={cn(
                "min-h-11 rounded-control border text-sm font-medium",
                pad?.index === item.index ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted",
              )}
              onClick={() => setSelected(item.index)}
            >
              P{item.index + 1}
            </button>
          ))}
        </div>
      ) : null}

      {pad ? (
        <div className="grid gap-4">
          <div className="rounded-panel border border-border bg-card p-4">
            <p className="break-all text-sm text-foreground">{pad.id}</p>
            <p className="mt-1 text-xs text-muted">
              Player {pad.index + 1} · {pad.mapping}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <KeyCap name="LB" pressed={Boolean(pad.buttons[4]?.pressed)} />
              <KeyCap name="RB" pressed={Boolean(pad.buttons[5]?.pressed)} />
            </div>
            <div className="mt-3 grid gap-3">
              <Meter label="LT" value={pad.buttons[6]?.value ?? 0} />
              <Meter label="RT" value={pad.buttons[7]?.value ?? 0} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Cross title="D-pad" buttons={pad.buttons} slots={[null, 12, null, 14, null, 15, null, 13, null]} />
              <Cross title="Face" buttons={pad.buttons} slots={[null, 3, null, 2, null, 1, null, 0, null]} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <KeyCap name="Back" pressed={Boolean(pad.buttons[8]?.pressed)} />
              <KeyCap name="Home" pressed={Boolean(pad.buttons[16]?.pressed)} />
              <KeyCap name="Start" pressed={Boolean(pad.buttons[9]?.pressed)} />
              <KeyCap name="L3" pressed={Boolean(pad.buttons[10]?.pressed)} />
              <KeyCap name="R3" pressed={Boolean(pad.buttons[11]?.pressed)} />
            </div>
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium">Sticks</h2>
              <span className="font-mono text-xs text-muted">deadzone {deadzone.toFixed(2)}</span>
            </div>
            <label className="mt-2 block" htmlFor="deadzone">
              <span className="sr-only">Deadzone</span>
              <input
                id="deadzone"
                className="h-11 w-full accent-foreground"
                type="range"
                min={0}
                max={0.4}
                step={0.01}
                value={deadzone}
                onChange={(event) => setDeadzone(Number(event.target.value))}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StickReadout title="Left stick" x={axis(pad.axes, 0)} y={axis(pad.axes, 1)} deviation={leftDeviation} deadzone={deadzone} track={tracks.current[0]} canvasRef={leftCanvas} />
              <StickReadout title="Right stick" x={axis(pad.axes, 2)} y={axis(pad.axes, 3)} deviation={rightDeviation} deadzone={deadzone} track={tracks.current[1]} canvasRef={rightCanvas} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={startDrift} disabled={driftSeconds !== null}>
                {driftSeconds !== null ? `Hands off ${driftSeconds}s` : "Drift test"}
              </Button>
              <Button type="button" variant="secondary" onClick={clearMap}>
                Clear map
              </Button>
            </div>
            <p className="mt-3 min-h-6 text-sm text-muted" role="status">
              {driftSeconds !== null
                ? "Keep your hands off the sticks."
                : driftResult
                  ? `Rest drift L ${driftResult.left.toFixed(3)} · R ${driftResult.right.toFixed(3)}${driftResult.left > deadzone || driftResult.right > deadzone ? " — outside the deadzone." : " — inside the deadzone."}`
                  : "Move each stick in a full circle. The map shows range and roundness."}
            </p>
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Polling</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Rate" value={`${poll.hz.toFixed(0)} Hz`} />
              <Stat label="Peak" value={`${poll.peak.toFixed(0)} Hz`} />
              <Stat label="Interval" value={`${poll.interval.toFixed(2)} ms`} />
              <Stat label="Jitter" value={`${poll.jitter.toFixed(2)} ms`} />
            </dl>
            <div className="mt-3 flex h-12 items-end gap-1" aria-hidden>
              {(poll.bars.length > 0 ? poll.bars : [0]).map((value, index) => (
                <span key={index} className="flex-1 rounded-sm bg-accent" style={{ height: `${Math.max(8, (value / maxBar) * 100)}%` }} />
              ))}
            </div>
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Vibration</h2>
            <div className="mt-3 grid gap-3">
              <Range id="rumble-left" label="Heavy motor" display={leftMotor.toFixed(2)} min={0} max={1} step={0.05} value={leftMotor} onChange={setLeftMotor} />
              <Range id="rumble-right" label="Light motor" display={rightMotor.toFixed(2)} min={0} max={1} step={0.05} value={rightMotor} onChange={setRightMotor} />
              <Range id="rumble-duration" label="Duration" display={`${duration} ms`} min={100} max={2000} step={50} value={duration} onChange={setDuration} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => void playPattern([{ strong: leftMotor, weak: rightMotor, ms: duration, gap: 0, label: "Playing." }])}>
                Play
              </Button>
              <Button type="button" variant="secondary" onClick={() => void playPattern([{ strong: 1, weak: 0, ms: 450, gap: 150, label: "Heavy motor." }, { strong: 0, weak: 1, ms: 450, gap: 150, label: "Light motor." }, { strong: 1, weak: 1, ms: 450, gap: 0, label: "Both motors." }])}>
                Heavy then light
              </Button>
              <Button type="button" variant="secondary" onClick={() => void playPattern([{ strong: 1, weak: 0, ms: 450, gap: 0, label: "Heavy motor." }])}>
                Heavy
              </Button>
              <Button type="button" variant="secondary" onClick={() => void playPattern([{ strong: 0, weak: 1, ms: 450, gap: 0, label: "Light motor." }])}>
                Light
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void playPattern(
                    Array.from({ length: 4 }, () => ({ strong: 1, weak: 1, ms: 80, gap: 80, label: "Burst." })),
                  )
                }
              >
                Burst
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void playPattern(
                    Array.from({ length: 6 }, () => ({ strong: 0.3, weak: 0.8, ms: 60, gap: 90, label: "Pulse." })),
                  )
                }
              >
                Pulse
              </Button>
              <Button type="button" variant="secondary" className="col-span-2" onClick={stopRumble}>
                Stop
              </Button>
            </div>
            <p className="mt-3 min-h-6 text-sm text-muted">{note || "Heavy is the left motor. Light is the right motor."}</p>
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Button history</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Press a button to log it.</p>
            ) : (
              <ul className="mt-2 grid gap-1">
                {history.map((item, index) => (
                  <li key={`${item.at}-${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
                    <span>{item.name}</span>
                    <span className="font-mono text-xs text-muted">{item.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Raw input</h2>
            <ul className="mt-3 grid gap-2">
              {pad.buttons.map((button, index) => (
                <li key={`${button.name}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                  <span className={button.pressed ? "text-foreground" : "text-muted"}>{button.name}</span>
                  <span className="font-mono text-xs text-subtle">#{index}</span>
                  <span className="w-14 text-right font-mono text-xs text-muted tabular-nums">{button.value.toFixed(2)}</span>
                </li>
              ))}
              {pad.axes.map((value, index) => (
                <li key={`axis-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                  <span className="text-muted">Axis {index}</span>
                  <span className="font-mono text-xs text-subtle">#{index}</span>
                  <span className="w-14 text-right font-mono text-xs text-muted tabular-nums">{value >= 0 ? "+" : ""}{value.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-panel border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted">USB and Bluetooth both work. Some browsers hide the pad until you press a button.</p>
        </div>
      )}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const amount = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted tabular-nums">{amount.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-background" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(amount.toFixed(2))}>
        <div className="h-full bg-accent" style={{ width: `${amount * 100}%` }} />
      </div>
    </div>
  );
}

function Cross({ title, buttons, slots }: { title: string; buttons: ButtonSnap[]; slots: (number | null)[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((index, slot) =>
          index === null || !buttons[index] ? <span key={slot} /> : <KeyCap key={buttons[index].name} name={buttons[index].name.split(" ").at(-1) ?? buttons[index].name} pressed={buttons[index].pressed} />,
        )}
      </div>
    </div>
  );
}

function StickReadout({
  title,
  x,
  y,
  deviation,
  deadzone,
  track,
  canvasRef,
}: {
  title: string;
  x: number;
  y: number;
  deviation: number;
  deadzone: number;
  track: StickTrack;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <figure>
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <canvas ref={canvasRef} width={200} height={200} className="mt-2 aspect-square w-full rounded-control bg-background" aria-label={`${title} position`} />
      <p className={cn("mt-1 text-center font-mono text-[11px] tabular-nums", deviation > deadzone ? "text-warn" : "text-muted")}>
        {x >= 0 ? "+" : ""}
        {x.toFixed(3)} , {y >= 0 ? "+" : ""}
        {y.toFixed(3)}
      </p>
      <p className="text-center text-[11px] text-muted">
        Dev {deviation.toFixed(3)} · Cover {(coverage(track) * 100).toFixed(0)}% · Err {shapeError(track).toFixed(2)}
      </p>
    </figure>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

function Range({
  id,
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm" htmlFor={id}>
      <span className="flex items-baseline justify-between">
        {label}
        <span className="font-mono text-xs text-muted tabular-nums">{display}</span>
      </span>
      <input id={id} className="mt-1 h-11 w-full accent-foreground" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

const MARKS: { index: number; x: number; y: number; w: number; h?: number }[] = [
  { index: 4, x: 31, y: 17.6, w: 8, h: 4 },
  { index: 5, x: 69, y: 17.6, w: 8, h: 4 },
  { index: 12, x: 32.4, y: 31.6, w: 3.4 },
  { index: 14, x: 28.4, y: 36, w: 3.4 },
  { index: 15, x: 36.4, y: 36, w: 3.4 },
  { index: 13, x: 32.4, y: 40.4, w: 3.4 },
  { index: 3, x: 66.4, y: 44.2, w: 4.2 },
  { index: 2, x: 63.6, y: 50.4, w: 4.2 },
  { index: 1, x: 71.2, y: 50.8, w: 4.2 },
  { index: 0, x: 67.4, y: 57.2, w: 4.2 },
  { index: 8, x: 49.6, y: 45.4, w: 6.2, h: 3.2 },
  { index: 9, x: 49.6, y: 53.6, w: 6.2, h: 3.2 },
];

function GamepadFigure({ pad }: { pad: PadSnap | null }) {
  const on = (index: number) => Boolean(pad?.buttons[index]?.pressed);
  const amount = (index: number) => pad?.buttons[index]?.value ?? 0;
  const lx = pad ? axis(pad.axes, 0) : 0;
  const ly = pad ? axis(pad.axes, 1) : 0;
  const rx = pad ? axis(pad.axes, 2) : 0;
  const ry = pad ? axis(pad.axes, 3) : 0;
  return (
    <div className="relative overflow-hidden rounded-panel border border-border bg-black">
      <img src="/gamepad.jpg" alt="Controller, with the active buttons lit" className="block h-auto w-full" width={1792} height={1008} />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{ left: "31%", top: "17.2%", width: "9%", height: "5%", transform: "translate(-50%, -50%)", background: `rgba(46,200,255,${amount(6) * 0.75})`, boxShadow: amount(6) > 0.2 ? "0 0 16px #2ec8ff" : undefined }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{ left: "69%", top: "17.2%", width: "9%", height: "5%", transform: "translate(-50%, -50%)", background: `rgba(46,200,255,${amount(7) * 0.75})`, boxShadow: amount(7) > 0.2 ? "0 0 16px #2ec8ff" : undefined }}
        aria-hidden
      />
      {MARKS.map((mark) => (
        <span
          key={mark.index}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${mark.x}%`,
            top: `${mark.y}%`,
            width: `${mark.w}%`,
            height: mark.h ? `${mark.h}%` : undefined,
            aspectRatio: mark.h ? undefined : "1",
            transform: "translate(-50%, -50%)",
            background: on(mark.index) ? "rgba(46,200,255,0.78)" : "transparent",
            boxShadow: on(mark.index) ? "0 0 16px #2ec8ff" : undefined,
          }}
          aria-hidden
        />
      ))}
      <StickDot x={41.6} y={52.2} dx={lx} dy={ly} pressed={on(10)} />
      <StickDot x={60.2} y={35.2} dx={rx} dy={ry} pressed={on(11)} />
    </div>
  );
}

function StickDot({ x, y, dx, dy, pressed }: { x: number; y: number; dx: number; dy: number; pressed: boolean }) {
  return (
    <span
      className="pointer-events-none absolute size-3 rounded-full bg-accent"
      style={{
        left: `${x + dx * 2.4}%`,
        top: `${y + dy * 4.2}%`,
        transform: "translate(-50%, -50%)",
        boxShadow: pressed ? "0 0 0 8px rgba(46,200,255,0.45), 0 0 18px #2ec8ff" : "0 0 10px #2ec8ff",
      }}
      aria-hidden
    />
  );
}
