/** Текст документа: абзацы через перевод строки; если все строки начинаются с «— » — список. */
export function TextBody({ text }: { text: string }) {
  const lines = text.split('\n');
  const items = lines.filter((line) => line.startsWith('— '));
  if (items.length === lines.length) {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-steel-300">
        {items.map((line) => (
          <li key={line}>{line.slice(2)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2 text-steel-300">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
