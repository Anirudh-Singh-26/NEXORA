"use client";

import { cn } from "@/lib/utils";
import { createNoise3D } from "simplex-noise";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

type WavyBackgroundProps = {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  backgroundFill?: string;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
};

/**
 * Aceternity UI Wavy Background.
 *
 * The animation settings and drawing behavior follow the original component.
 * Canvas sizing is scoped to its containing element so it can sit behind
 * NEXORA's Curator's Pick section instead of taking over the whole viewport.
 */
export function WavyBackground({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
}: WavyBackgroundProps) {
  const noise = useMemo(() => createNoise3D(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !container || !ctx) return;

    let w = 0;
    let h = 0;
    let nt = 0;
    let animationId = 0;

    const getSpeed = () => {
      switch (speed) {
        case "slow":
          return 0.001;
        case "fast":
          return 0.002;
        default:
          return 0.001;
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      w = ctx.canvas.width = Math.max(1, Math.floor(rect.width));
      h = ctx.canvas.height = Math.max(1, Math.floor(rect.height));
      ctx.filter = `blur(${blur}px)`;
    };

    const waveColors = colors ?? [
      "#38bdf8",
      "#818cf8",
      "#c084fc",
      "#e879f9",
      "#22d3ee",
    ];

    const drawWave = (count: number) => {
      nt += getSpeed();
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.lineWidth = waveWidth || 50;
        ctx.strokeStyle = waveColors[i % waveColors.length];
        for (let x = 0; x < w; x += 5) {
          const y = noise(x / 800, 0.3 * i, nt) * 100;
          ctx.lineTo(x, y + h * 0.5);
        }
        ctx.stroke();
        ctx.closePath();
      }
    };

    const render = () => {
      ctx.fillStyle = backgroundFill || "black";
      ctx.globalAlpha = waveOpacity || 0.5;
      ctx.fillRect(0, 0, w, h);
      drawWave(5);
      animationId = window.requestAnimationFrame(render);
    };

    resize();
    render();

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [backgroundFill, blur, colors, speed, waveOpacity, waveWidth, noise]);

  const isSafari =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Safari") &&
    !navigator.userAgent.includes("Chrome");

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        containerClassName,
      )}
    >
      <canvas
        className="absolute inset-0 z-0"
        ref={canvasRef}
        aria-hidden="true"
        style={{
          ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
        }}
      />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}
