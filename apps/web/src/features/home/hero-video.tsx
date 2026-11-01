'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const WIDE_QUERY = '(min-width: 768px)';
/** 1080p для широких экранов, вертикальный кадр 540×960 (~330 КБ) для телефонов */
const VIDEO_SRC = { wide: '/videos/hero.mp4', narrow: '/videos/hero-mobile.mp4' };
/** Первый кадр 160×90 (1 КБ), растянутый и размытый, — пока видео не началось */
const POSTER_SRC = '/videos/hero-poster-blur.webp';
const MOBILE_START_DELAY_MS = 1000;

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Фон hero: видео без звука плавно проявляется поверх тёмного фона после гидрации.
 * На широких экранах — обычный <video> над размытым первым кадром.
 * На телефоне видео во весь экран становится главным элементом (LCP) и появляется только
 * после скриптов — оценка падала с 93 до 55–65. Поэтому там кадры рисуются в <canvas>
 * (он не участвует в LCP, главным остаётся заголовок), а видео грузится после загрузки страницы.
 * Без видео остаются при «уменьшении движения» и в режиме экономии трафика.
 * Затемнение и декор — слоями поверх, в Hero.
 */
export function HeroVideo() {
  const video = useRef<FrameVideo>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    if (window.matchMedia(WIDE_QUERY).matches) {
      el.src = VIDEO_SRC.wide;
      // Автовоспроизведение может быть запрещено (экономия батареи) — тогда остаётся фон
      el.play().catch(() => undefined);
      return;
    }

    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let stopped = false;
    const draw = () => {
      if (stopped) return;
      ctx.drawImage(el, 0, 0, ctx.canvas.width, ctx.canvas.height);
      frame = el.requestVideoFrameCallback
        ? el.requestVideoFrameCallback(draw)
        : requestAnimationFrame(draw);
    };
    // Пауза после загрузки: декодер видео не занимает телефон, пока страница оживает
    let timer = 0;
    const start = () => {
      timer = window.setTimeout(() => {
        el.src = VIDEO_SRC.narrow;
        el.play().then(draw, () => undefined);
      }, MOBILE_START_DELAY_MS);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('load', start);
      if (el.cancelVideoFrameCallback) el.cancelVideoFrameCallback(frame);
      else cancelAnimationFrame(frame);
    };
  }, []);

  const fade = cn(
    'absolute inset-0 size-full object-cover transition-opacity duration-700',
    playing ? 'opacity-100' : 'opacity-0',
  );

  return (
    <div aria-hidden="true" className="absolute inset-0 -z-30">
      {/* eslint-disable-next-line @next/next/no-img-element -- фон 1 КБ, оптимизатор не нужен */}
      <img
        src={POSTER_SRC}
        alt=""
        className="absolute inset-0 hidden size-full scale-110 object-cover blur-2xl md:block"
      />
      <canvas ref={canvas} width={540} height={960} className={cn(fade, 'md:hidden')} />
      {/* На телефоне видео — только источник кадров для canvas: 1 px, невидимое */}
      <video
        ref={video}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        className={cn(fade, 'max-md:size-px max-md:opacity-0')}
      />
    </div>
  );
}
