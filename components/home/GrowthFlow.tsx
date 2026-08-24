"use client";

import { useEffect, useRef } from "react";

const STAGES = ["Attention", "Traffic", "Engagement", "Leads", "Conversion", "Revenue"];
// Slight vertical zigzag keeps the diagram from reading as one flat, boring line.
const Y_FRACTIONS = [0.42, 0.22, 0.58, 0.3, 0.62, 0.4];

type Particle = {
  stage: number; // which gap it's traveling (0..STAGES.length-2)
  t: number; // 0..1 progress along the gap
  speed: number;
  offset: number; // perpendicular jitter
};

export function GrowthFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;

    function nodePositions() {
      return STAGES.map((_, i) => ({
        x: (i / (STAGES.length - 1)) * w,
        y: Y_FRACTIONS[i] * h,
      }));
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent) {
      const rect = wrap!.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width;
      mouseY = (e.clientY - rect.top) / rect.height;
    }
    if (!reduced) wrap.addEventListener("mousemove", onMove);

    const particles: Particle[] = [];
    for (let gap = 0; gap < STAGES.length - 1; gap++) {
      const count = 5;
      for (let i = 0; i < count; i++) {
        particles.push({
          stage: gap,
          t: i / count,
          speed: 0.0016 + Math.random() * 0.001,
          offset: (Math.random() - 0.5) * 14,
        });
      }
    }

    let raf = 0;

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      const nodes = nodePositions();
      const driftX = (mouseX - 0.5) * 10;
      const driftY = (mouseY - 0.5) * 10;

      // faint dot grid for texture
      ctx!.fillStyle = "rgba(245,244,241,0.09)";
      const spacing = 34;
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          ctx!.fillRect(x, y, 1.2, 1.2);
        }
      }

      // connecting lines
      ctx!.strokeStyle = "rgba(245,244,241,0.32)";
      ctx!.lineWidth = 1.2;
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        ctx!.beginPath();
        ctx!.moveTo(a.x + driftX * 0.3, a.y + driftY * 0.3);
        const midX = (a.x + b.x) / 2;
        ctx!.bezierCurveTo(midX, a.y, midX, b.y, b.x + driftX * 0.3, b.y + driftY * 0.3);
        ctx!.stroke();
      }

      // particles
      particles.forEach((p) => {
        if (!reduced) {
          p.t += p.speed;
          if (p.t > 1) {
            p.t = 0;
            p.offset = (Math.random() - 0.5) * 14;
          }
        }
        const a = nodes[p.stage];
        const b = nodes[p.stage + 1];
        const midX = (a.x + b.x) / 2;
        const x = bezier(a.x, midX, midX, b.x, p.t) + driftX * 0.3;
        const y = bezier(a.y, a.y, b.y, b.y, p.t) + p.offset + driftY * 0.3;

        const grad = ctx!.createRadialGradient(x, y, 0, x, y, 7);
        grad.addColorStop(0, "rgba(215,161,59,1)");
        grad.addColorStop(1, "rgba(215,161,59,0)");
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(x, y, 7, 0, Math.PI * 2);
        ctx!.fill();
      });

      // nodes
      nodes.forEach((n) => {
        const x = n.x + driftX * 0.3;
        const y = n.y + driftY * 0.3;
        ctx!.beginPath();
        ctx!.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(245,244,241,0.95)";
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(x, y, 10, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(215,161,59,0.7)";
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
      });

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      wrap.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full h-[280px] sm:h-[340px] lg:h-[420px]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      {STAGES.map((label, i) => (
        <span
          key={label}
          className="absolute font-mono-label text-ink-faint whitespace-nowrap"
          style={{
            left: `${(i / (STAGES.length - 1)) * 100}%`,
            top: `${Y_FRACTIONS[i] * 100}%`,
            transform:
              i === 0
                ? "translate(0%, 18px)"
                : i === STAGES.length - 1
                ? "translate(-100%, 18px)"
                : "translate(-50%, 18px)",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function bezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
