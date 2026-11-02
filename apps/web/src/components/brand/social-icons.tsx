import type { SVGProps } from 'react';

// Значки соцсетей в стиле lucide (контур 2px): в lucide фирменных значков нет.

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" />
    </Icon>
  );
}

export function YouTubeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </Icon>
  );
}

export function TelegramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m6.5 11.6 10-4.1-1.7 9-3.5-2.6-1.9 1.8.3-3.2 4.4-3.9-5.6 3.4z" />
    </Icon>
  );
}
