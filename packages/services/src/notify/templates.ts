import { formatPrice, type Locale } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import type { EmailMessage } from './notify';

// Письма собираются из словаря emails.* — на языке покупателя. Вёрстка табличная и с
// инлайн-стилями: так её одинаково показывают Gmail, Outlook и почта Mail.ru.

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(locale: Locale, title: string, body: string): string {
  const t = getTranslator(locale);
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#0a0a0b;font-family:Inter,Arial,sans-serif;color:#f5f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#16161a;border:1px solid #2a2a31;border-radius:12px">
<tr><td style="padding:24px 28px;border-bottom:2px solid #d40000;font-size:22px;font-weight:700;letter-spacing:1px"><span style="color:#ff2800">RED</span>CORE</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:20px">${escape(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #2a2a31;font-size:12px;color:#a1a1aa">${escape(t('emails.footer'))}</td></tr>
</table></td></tr></table></body></html>`;
}

const paragraph = (text: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#d4d4d8">${escape(text)}</p>`;

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${escape(href)}" style="display:inline-block;background:#d40000;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${escape(label)}</a></p>`;

export function otpEmail(locale: Locale, to: string, code: string, minutes: number): EmailMessage {
  const t = getTranslator(locale);
  const body =
    paragraph(t('emails.otp.body', { minutes })) +
    `<p style="margin:8px 0 20px;font-size:34px;font-weight:700;letter-spacing:8px;font-family:monospace;color:#fff">${escape(code)}</p>` +
    paragraph(t('emails.otp.ignore'));
  return {
    to,
    subject: t('emails.otp.subject', { code }),
    text: `${t('emails.otp.body', { minutes })}\n\n${code}\n\n${t('emails.otp.ignore')}`,
    html: layout(locale, t('emails.otp.heading'), body),
  };
}

export function otpSms(locale: Locale, code: string): string {
  return getTranslator(locale)('emails.otp.sms', { code });
}

export interface OrderEmailData {
  locale: Locale;
  to: string;
  name: string;
  number: string;
  url: string;
  items: { name: string; qty: number; totalUzs: number }[];
  subtotalUzs: number;
  discountUzs: number;
  deliveryUzs: number;
  servicesUzs: number;
  totalUzs: number;
}

export type OrderEmailKind =
  | { kind: 'created'; card: boolean }
  | { kind: 'paid' }
  | { kind: 'cancelled'; reason: 'payment_expired' | 'customer' | 'admin' };

export function orderEmail(data: OrderEmailData, event: OrderEmailKind): EmailMessage {
  const t = getTranslator(data.locale);
  const price = (amount: number) => formatPrice(amount, data.locale);
  const intro =
    event.kind === 'created'
      ? t(event.card ? 'emails.order.created.bodyCard' : 'emails.order.created.body')
      : event.kind === 'paid'
        ? t('emails.order.paid.body', { amount: price(data.totalUzs) })
        : t('emails.order.cancelled.body', { reason: t(`emails.cancelReasons.${event.reason}`) });
  const subject = t(`emails.order.${event.kind}.subject`, { number: data.number });

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#a1a1aa">${escape(label)}</td><td align="right" style="padding:6px 0;font-size:14px;${strong ? 'font-weight:700;color:#fff' : 'color:#d4d4d8'}">${escape(value)}</td></tr>`;
  const items = data.items
    .map((item) =>
      row(item.qty > 1 ? `${item.name} × ${item.qty}` : item.name, price(item.totalUzs)),
    )
    .join('');
  const totals = [
    row(t('emails.order.subtotal'), price(data.subtotalUzs)),
    data.discountUzs > 0 ? row(t('emails.order.discount'), `−${price(data.discountUzs)}`) : '',
    row(t('emails.order.delivery'), price(data.deliveryUzs)),
    data.servicesUzs > 0 ? row(t('emails.order.services'), price(data.servicesUzs)) : '',
    row(t('emails.order.total'), price(data.totalUzs), true),
  ].join('');

  const body =
    paragraph(t('emails.order.greeting', { name: data.name })) +
    paragraph(intro) +
    (event.kind === 'cancelled'
      ? ''
      : `<h2 style="margin:20px 0 8px;font-size:15px">${escape(t('emails.order.items'))}</h2>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}<tr><td colspan="2" style="border-top:1px solid #2a2a31"></td></tr>${totals}</table>`) +
    button(data.url, t('emails.order.open'));

  const textLines = [
    t('emails.order.greeting', { name: data.name }),
    intro,
    '',
    ...data.items.map((i) => `${i.name} × ${i.qty} — ${price(i.totalUzs)}`),
    `${t('emails.order.total')}: ${price(data.totalUzs)}`,
    '',
    data.url,
  ];
  return {
    to: data.to,
    subject,
    text: textLines.join('\n'),
    html: layout(data.locale, t('emails.order.number', { number: data.number }), body),
  };
}
