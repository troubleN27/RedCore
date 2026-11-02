/** Шапка страниц компании: заголовок и вводный текст. */
export function PageIntro({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="max-w-3xl space-y-4">
      <h1 className="font-display text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {intro && <p className="text-lg leading-relaxed text-pretty text-steel-300">{intro}</p>}
    </header>
  );
}
