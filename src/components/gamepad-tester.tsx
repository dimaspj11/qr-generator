import { useEffect, useRef, useState } from "react";
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

type PadSnap = {
  index: number;
  id: string;
  mapping: string;
  buttons: ButtonSnap[];
  axes: number[];
};

type Rumbler = {
  playEffect?: (
    type: string,
    params: { duration: number; startDelay: number; strongMagnitude: number; weakMagnitude: number },
  ) => Promise<void>;
  reset?: () => Promise<void>;
  pulse?: (value: number, duration: number) => Promise<void>;
};

function buttonName(index: number) {
  return NAMES[index] ?? `Button ${index}`;
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

function samePads(left: PadSnap[], right: PadSnap[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function axis(axes: number[], index: number) {
  return axes[index] ?? 0;
}

function Stick({ label, x, y }: { label: string; x: number; y: number }) {
  const cx = 50 + Math.max(-1, Math.min(1, x)) * 36;
  const cy = 50 + Math.max(-1, Math.min(1, y)) * 36;
  return (
    <figure className="rounded-panel border border-border bg-background p-3">
      <figcaption className="text-sm font-medium text-foreground">{label}</figcaption>
      <svg viewBox="0 0 100 100" className="mx-auto mt-2 aspect-square w-full max-w-40" role="img" aria-label={`${label}: x ${x.toFixed(2)}, y ${y.toFixed(2)}`}>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" className="text-border" strokeWidth="2" />
        <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" className="text-subtle" strokeWidth="1" />
        <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" className="text-border" strokeWidth="1" />
        <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" className="text-border" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="7" className="fill-accent" />
      </svg>
      <p className="mt-1 text-center font-mono text-xs text-muted tabular-nums">
        {x.toFixed(2)} , {y.toFixed(2)}
      </p>
    </figure>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const amount = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted tabular-nums">{amount.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-background" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(amount.toFixed(2))}>
        <div className="h-full bg-accent" style={{ width: `${amount * 100}%` }} />
      </div>
    </div>
  );
}

function PadKey({ name, pressed, value }: ButtonSnap) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-center rounded-control border px-2 text-center text-xs font-medium",
        pressed ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background text-muted",
      )}
      aria-pressed={pressed}
    >
      <span>
        {name}
        <span className="mt-0.5 block font-mono text-[10px] tabular-nums opacity-80">{value.toFixed(2)}</span>
      </span>
    </div>
  );
}

function Cross({ buttons, slots }: { buttons: ButtonSnap[]; slots: (number | null)[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((index, slot) =>
        index === null || !buttons[index] ? (
          <span key={slot} />
        ) : (
          <PadKey key={buttons[index].name} {...buttons[index]} />
        ),
      )}
    </div>
  );
}

export function GamepadTester({ active }: { active: boolean }) {
  const [pads, setPads] = useState<PadSnap[]>([]);
  const [selected, setSelected] = useState(0);
  const [note, setNote] = useState("");
  const [leftMotor, setLeftMotor] = useState(1);
  const [rightMotor, setRightMotor] = useState(1);
  const [duration, setDuration] = useState(500);
  const padsRef = useRef(pads);
  const runRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const wake = () => {
      const next = readPads();
      padsRef.current = next;
      setPads(next);
    };
    const tick = () => {
      const next = readPads();
      if (!samePads(padsRef.current, next)) {
        padsRef.current = next;
        setPads(next);
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("gamepadconnected", wake);
    window.addEventListener("gamepaddisconnected", wake);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("gamepadconnected", wake);
      window.removeEventListener("gamepaddisconnected", wake);
    };
  }, [active]);

  const pad = pads.find((item) => item.index === selected) ?? pads[0];
  const pressed = pad?.buttons.filter((button) => button.pressed).map((button) => button.name) ?? [];

  function livePad() {
    if (!pad) return null;
    return navigator.getGamepads?.()[pad.index] as (Gamepad & { vibrationActuator?: Rumbler; hapticActuators?: Rumbler[] }) | null;
  }

  async function sendRumble(strong: number, weak: number, ms: number) {
    const live = livePad();
    const actuator = live?.vibrationActuator;
    if (actuator?.playEffect) {
      await actuator.playEffect("dual-rumble", {
        duration: ms,
        startDelay: 0,
        strongMagnitude: strong,
        weakMagnitude: weak,
      });
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

  async function rumble(strong: number, weak: number, ms = duration) {
    const token = ++runRef.current;
    try {
      const sent = await sendRumble(strong, weak, ms);
      if (runRef.current !== token) return;
      setNote(sent ? (strong + weak === 0 ? "Vibration stopped." : "Vibration sent.") : "This controller does not report vibration.");
    } catch {
      if (runRef.current === token) setNote("This browser blocked vibration.");
    }
  }

  async function motorTest() {
    const token = ++runRef.current;
    const steps: { label: string; strong: number; weak: number }[] = [
      { label: "Left motor.", strong: 1, weak: 0 },
      { label: "Right motor.", strong: 0, weak: 1 },
      { label: "Both motors.", strong: 1, weak: 1 },
    ];
    try {
      for (const step of steps) {
        if (runRef.current !== token) return;
        setNote(step.label);
        const sent = await sendRumble(step.strong, step.weak, 450);
        if (!sent) {
          if (runRef.current === token) setNote("This controller does not report vibration.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
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

  return (
    <section className="mx-auto mt-6 grid w-full max-w-xl gap-4">
      <p className="text-center text-sm text-muted" role="status">
        {pad
          ? `${pressed.length > 0 ? `Pressed: ${pressed.join(", ")}` : "No buttons pressed."}`
          : "No controller yet. Connect one, then press any button."}
      </p>

      {pads.length > 1 ? (
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Controllers">
          {pads.map((item) => (
            <button
              key={item.index}
              type="button"
              role="tab"
              aria-selected={pad?.index === item.index}
              className={cn(
                "min-h-11 rounded-control border px-2 text-sm font-medium",
                pad?.index === item.index ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted",
              )}
              onClick={() => setSelected(item.index)}
            >
              Controller {item.index + 1}
            </button>
          ))}
        </div>
      ) : null}

      {pad ? (
        <div className="grid gap-4">
          <div className="rounded-panel border border-border bg-card p-4">
            <p className="break-all text-sm text-foreground">{pad.id}</p>
            <p className="mt-1 text-xs text-muted">Mapping: {pad.mapping}</p>
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Vibration test</h2>
            <div className="mt-3 grid gap-3">
              <label className="text-sm text-foreground" htmlFor="rumble-left">
                <span className="flex items-baseline justify-between">
                  Left motor
                  <span className="font-mono text-xs text-muted tabular-nums">{leftMotor.toFixed(2)}</span>
                </span>
                <input
                  id="rumble-left"
                  className="mt-1 h-11 w-full accent-foreground"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={leftMotor}
                  onChange={(event) => setLeftMotor(Number(event.target.value))}
                />
              </label>
              <label className="text-sm text-foreground" htmlFor="rumble-right">
                <span className="flex items-baseline justify-between">
                  Right motor
                  <span className="font-mono text-xs text-muted tabular-nums">{rightMotor.toFixed(2)}</span>
                </span>
                <input
                  id="rumble-right"
                  className="mt-1 h-11 w-full accent-foreground"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={rightMotor}
                  onChange={(event) => setRightMotor(Number(event.target.value))}
                />
              </label>
              <label className="text-sm text-foreground" htmlFor="rumble-duration">
                <span className="flex items-baseline justify-between">
                  Duration
                  <span className="font-mono text-xs text-muted tabular-nums">{duration} ms</span>
                </span>
                <input
                  id="rumble-duration"
                  className="mt-1 h-11 w-full accent-foreground"
                  type="range"
                  min={100}
                  max={2000}
                  step={50}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => void rumble(leftMotor, rightMotor)}>
                Play
              </Button>
              <Button type="button" variant="secondary" onClick={() => void motorTest()}>
                Left then right
              </Button>
              <Button type="button" variant="secondary" onClick={() => void rumble(1, 0, 450)}>
                Left only
              </Button>
              <Button type="button" variant="secondary" onClick={() => void rumble(0, 1, 450)}>
                Right only
              </Button>
              <Button type="button" variant="secondary" className="col-span-2" onClick={stopRumble}>
                Stop
              </Button>
            </div>
            <p className="mt-3 min-h-6 text-sm text-muted" role="status">
              {note || "Left is the heavy motor. Right is the light motor."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stick label="Left stick" x={axis(pad.axes, 0)} y={axis(pad.axes, 1)} />
            <Stick label="Right stick" x={axis(pad.axes, 2)} y={axis(pad.axes, 3)} />
          </div>

          <div className="rounded-panel border border-border bg-card grid gap-4 p-4">
            <Meter label="Left trigger" value={pad.buttons[6]?.value ?? 0} />
            <Meter label="Right trigger" value={pad.buttons[7]?.value ?? 0} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-panel border border-border bg-card p-3">
              <p className="mb-2 text-sm font-medium">D-pad</p>
              <Cross buttons={pad.buttons} slots={[null, 12, null, 14, null, 15, null, 13, null]} />
            </div>
            <div className="rounded-panel border border-border bg-card p-3">
              <p className="mb-2 text-sm font-medium">Face</p>
              <Cross buttons={pad.buttons} slots={[null, 3, null, 2, null, 1, null, 0, null]} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[4, 5, 10, 11, 8, 9, 16].map((index) =>
              pad.buttons[index] ? <PadKey key={pad.buttons[index].name} {...pad.buttons[index]} /> : null,
            )}
          </div>

          <div className="rounded-panel border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Every input</h2>
            <ul className="mt-3 grid gap-2">
              {pad.buttons.map((button, index) => (
                <li key={`${button.name}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                  <span className={button.pressed ? "text-foreground" : "text-muted"}>{button.name}</span>
                  <span className="font-mono text-xs text-subtle">#{index}</span>
                  <span className="w-12 text-right font-mono text-xs text-muted tabular-nums">{button.value.toFixed(2)}</span>
                </li>
              ))}
              {pad.axes.map((value, index) => (
                <li key={`axis-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                  <span className="text-muted">Axis {index}</span>
                  <span className="font-mono text-xs text-subtle">#{index}</span>
                  <span className="w-12 text-right font-mono text-xs text-muted tabular-nums">{value.toFixed(2)}</span>
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
