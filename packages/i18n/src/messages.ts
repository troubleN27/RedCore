import ruCatalog from '../messages/ru/catalog.json';
import ruAi from '../messages/ru/ai.json';
import ruFps from '../messages/ru/fps.json';
import ruTelegram from '../messages/ru/telegram.json';
import uzTelegram from '../messages/uz/telegram.json';
import uzAi from '../messages/uz/ai.json';
import ruPolicies from '../messages/ru/policies.json';
import uzPolicies from '../messages/uz/policies.json';
import uzFps from '../messages/uz/fps.json';
import ruProduct from '../messages/ru/product.json';
import ruShop from '../messages/ru/shop.json';
import ruSpecs from '../messages/ru/specs.json';
import ruCompat from '../messages/ru/compat.json';
import ruConfigurator from '../messages/ru/configurator.json';
import ruComingSoon from '../messages/ru/comingSoon.json';
import ruCommon from '../messages/ru/common.json';
import ruDev from '../messages/ru/dev.json';
import ruErrors from '../messages/ru/errors.json';
import ruFooter from '../messages/ru/footer.json';
import ruHome from '../messages/ru/home.json';
import ruMetadata from '../messages/ru/metadata.json';
import ruNav from '../messages/ru/nav.json';
import uzCatalog from '../messages/uz/catalog.json';
import uzProduct from '../messages/uz/product.json';
import uzShop from '../messages/uz/shop.json';
import uzSpecs from '../messages/uz/specs.json';
import uzCompat from '../messages/uz/compat.json';
import uzConfigurator from '../messages/uz/configurator.json';
import uzComingSoon from '../messages/uz/comingSoon.json';
import uzCommon from '../messages/uz/common.json';
import uzDev from '../messages/uz/dev.json';
import uzErrors from '../messages/uz/errors.json';
import uzFooter from '../messages/uz/footer.json';
import uzHome from '../messages/uz/home.json';
import uzMetadata from '../messages/uz/metadata.json';
import uzNav from '../messages/uz/nav.json';
import ruAuth from '../messages/ru/auth.json';
import uzAuth from '../messages/uz/auth.json';
import ruCart from '../messages/ru/cart.json';
import uzCart from '../messages/uz/cart.json';
import ruCheckout from '../messages/ru/checkout.json';
import uzCheckout from '../messages/uz/checkout.json';
import ruOrder from '../messages/ru/order.json';
import uzOrder from '../messages/uz/order.json';
import ruAccount from '../messages/ru/account.json';
import uzAccount from '../messages/uz/account.json';
import ruConsole from '../messages/ru/console.json';
import uzConsole from '../messages/uz/console.json';
import type { Locale } from './config';

// Русский словарь — эталон структуры. Узбекский обязан повторять её ключ в ключ:
// пропуск ключа ловит тип ниже, лишние ключи и плейсхолдеры — тест parity.
const ru = {
  common: ruCommon,
  nav: ruNav,
  home: ruHome,
  footer: ruFooter,
  metadata: ruMetadata,
  errors: ruErrors,
  comingSoon: ruComingSoon,
  compat: ruCompat,
  configurator: ruConfigurator,
  catalog: ruCatalog,
  product: ruProduct,
  shop: ruShop,
  specs: ruSpecs,
  dev: ruDev,
  console: ruConsole,
  account: ruAccount,
  order: ruOrder,
  checkout: ruCheckout,
  cart: ruCart,
  auth: ruAuth,
  fps: ruFps,
  policies: ruPolicies,
  ai: ruAi,
  telegram: ruTelegram,
};

export type Messages = typeof ru;

const uz: Messages = {
  common: uzCommon,
  nav: uzNav,
  home: uzHome,
  footer: uzFooter,
  metadata: uzMetadata,
  errors: uzErrors,
  comingSoon: uzComingSoon,
  compat: uzCompat,
  configurator: uzConfigurator,
  catalog: uzCatalog,
  product: uzProduct,
  shop: uzShop,
  specs: uzSpecs,
  dev: uzDev,
  console: uzConsole,
  account: uzAccount,
  order: uzOrder,
  checkout: uzCheckout,
  cart: uzCart,
  auth: uzAuth,
  fps: uzFps,
  policies: uzPolicies,
  ai: uzAi,
  telegram: uzTelegram,
};

export const messages: Record<Locale, Messages> = { ru, uz };

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
