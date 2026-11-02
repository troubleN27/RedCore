'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const VIDEO_SRC = '/videos/configurator.mp4';
/** Первый кадр 960×540 (~19 КБ) */
const POSTER_SRC = '/videos/configurator-poster.webp';

/**
 * Видео в окне секции 3D-конфигуратора: грузится, только когда окно подъезжает к экрану,
 * и ставится на паузу, когда уходит из виду. При «уменьшении движения» — только кадр.
 */
export function ConfiguratorVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          el.pause();
          return;
        }
        if (!el.src) el.src = VIDEO_SRC;
        // Автовоспроизведение может быть запрещено (экономия батареи) — тогда остаётся кадр
        el.play().catch(() => undefined);
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative aspect-video">
      {/* eslint-disable-next-line @next/next/no-img-element -- кадр 19 КБ уже сжат, оптимизатор не нужен */}
      <img
        src={POSTER_SRC}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <video
        ref={video}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onPlaying={() => setPlaying(true)}
        className={cn(
          'absolute inset-0 size-full object-cover transition-opacity duration-700',
          playing ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
