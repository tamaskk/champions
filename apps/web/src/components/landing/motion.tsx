"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll reveal that never hides content by mistake: the server renders everything visible. Once
 * JavaScript runs, an element that is still below the fold is "armed" (hidden) and revealed when it
 * scrolls in; anything already on screen, or with reduced motion, simply stays as it is.
 */
function useArmedReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.state = "armed";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.state = "in";
        io.disconnect();
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/** Whether the element has come into view (for demos that start by themselves). */
function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** Fades, rises and unblurs its children when scrolled into view. `variant="draw"` grows a line instead. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "reveal",
}: {
  children?: ReactNode;
  delay?: number;
  className?: string;
  variant?: "reveal" | "draw";
}) {
  const ref = useArmedReveal<HTMLDivElement>(variant === "draw" ? 0 : 0.15);
  return (
    <div
      ref={ref}
      className={`${variant === "reveal" ? "lp-reveal" : "lp-draw"} ${className}`}
      style={{ transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** A word whose letters rise in one after another when it comes into view. */
export function LetterReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useArmedReveal<HTMLParagraphElement>(0.3);
  return (
    <p ref={ref} aria-label={text} className={className}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden className="lp-letter" style={{ transitionDelay: `${i * 55}ms` }}>
          {ch}
        </span>
      ))}
    </p>
  );
}

/**
 * Counts a number up when it comes into view ("113k", "85.2", "38–0" keep their format). The final
 * value is rendered first, so it's right without JavaScript and for crawlers.
 */
export function CountUp({ value, className = "", duration = 1600 }: { value: string; className?: string; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.4);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const numbers = [...value.matchAll(/\d+(?:\.\d+)?/g)];
    if (!numbers.length) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      let i = 0;
      setShown(
        value.replace(/\d+(?:\.\d+)?/g, (m) => {
          const target = Number(numbers[i++]![0]);
          const decimals = m.includes(".") ? m.split(".")[1]!.length : 0;
          return (target * eased).toFixed(decimals);
        }),
      );
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);
  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}

/** Tells a child when it has come into view (e.g. to start a demo). */
export function useFirstView<T extends Element>(threshold = 0.5) {
  return useInView<T>(threshold);
}
