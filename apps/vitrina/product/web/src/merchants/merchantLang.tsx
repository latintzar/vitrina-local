/**
 * merchantLang.tsx — BG/EN translations + React context for the
 * merchant onboarding flow (vitrina.bg/merchants*).
 *
 * Bulgarian is default (our merchants are Sofia shops). The lang toggle
 * sits in the topbar of MerchantLanding and is preserved in
 * localStorage under the same key as the waiting-page toggle so the
 * visitor's preference carries across both experiences.
 *
 * Usage:
 *   <MerchantLangProvider>
 *     <MerchantLanding />
 *   </MerchantLangProvider>
 *
 *   const { t, lang, setLang } = useMerchantLang();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'bg' | 'en';

const STORAGE_KEY = 'vitrina.lang';

/* ------------------------------------------------------------------ */
/*  Dictionary                                                          */
/* ------------------------------------------------------------------ */

type MerchantDict = {
  /* ── Topbar ── */
  merchants: string;
  login: string;
  dashboard: string;

  /* ── Landing hero ── */
  heroHeadLine1: string;
  heroHeadLine2: string;
  heroSub: string;
  joinCta: string;
  logInCta: string;
  openDashboard: string;

  /* ── How it works ── */
  howKicker: string;
  howH2: string;
  how1Eyebrow: string;
  how1Title: string;
  how1Body: string;
  how2Eyebrow: string;
  how2Title: string;
  how2Body: string;
  how3Eyebrow: string;
  how3Title: string;
  how3Body: string;

  /* ── Benefits ── */
  benefitsKicker: string;
  benefitsH2: string;
  ben1Title: string;
  ben1Body: string;
  ben2Title: string;
  ben2Body: string;
  ben3Title: string;
  ben3Body: string;

  /* ── Final CTA ── */
  finalH2: string;
  finalNote: string;

  /* ── Auth sheet ── */
  authKicker: string;
  authTitle: string;
  authCopy: string;
  authGoogle: string;
  authOr: string;
  authEmail: string;
  authEmailLabel: string;
  authEmailInvalid: string;
  authContinue: string;
  authSending: string;
  authSendLink: string;
  authBack: string;
  authLinkSent: string;
  authCheckEmail: string;
  authResend: string;
  gateNoApplication: string;

  /* ── Signup flow — shared chrome ── */
  flowBack: string;
  flowNext: string;
  flowSkip: string;

  /* ── Step 1: Welcome ── */
  s1Title: string;
  s1Sub: string;
  s1Cta: string;

  /* ── Step 2: Company name ── */
  s2Title: string;
  s2Sub: string;
  s2Label: string;
  s2Placeholder: string;

  /* ── Step 3: Store address ── */
  s3Title: string;
  s3Sub: string;

  /* ── Step 4: POS software ── */
  s4Title: string;
  s4Sub: string;
  s4None: string;

  /* ── Step 5: Stock categories ── */
  s5Title: string;
  s5Sub: string;

  /* ── Step 6: E-commerce platform ── */
  s6Title: string;
  s6Sub: string;

  /* ── Step 7: Best contact person ── */
  s7Title: string;
  s7Sub: string;
  s7NameLabel: string;
  s7NamePlaceholder: string;
  s7RoleLabel: string;
  s7RolePlaceholder: string;

  /* ── Step 8: Phone ── */
  s8Title: string;
  s8Sub: string;
  s8Label: string;
  s8Placeholder: string;

  /* ── Step 9: Email ── */
  s9Title: string;
  s9Sub: string;
  s9Label: string;

  /* ── Step 10: Pickup windows ── */
  s10Title: string;
  s10Sub: string;
  s10AddWindow: string;
  s10LunchLabel: string;
  s10EveningLabel: string;
  s10Start: string;
  s10End: string;

  /* ── Step 11: Offer checkout-now ── */
  s11Title: string;
  s11Sub: string;
  s11Yes: string;
  s11YesSub: string;
  s11No: string;
  s11NoSub: string;

  /* ── Step 12: Terms ── */
  s12Title: string;
  s12Sub: string;
  s12Agree: string;

  /* ── Step 13: Success ── */
  s13Title: string;
  s13Sub: string;
  s13Cta: string;

  /* ── Final submit step (email + terms) ── */
  submitKicker: string;
  submitTitle: string;
  submitSub: string;
  submitEmailLabel: string;
  submitTermsLead: string;
  submitAgreeLabel: string;
  submitCta: string;

  /* ── Submitted confirmation screen ── */
  submittedTitle: string;
  submittedSub: string;
  submittedOpenMail: string;
  submittedHint: string;

  /* ── Claim / setup-access screens ── */
  claimLoading: string;
  claimErrorTitle: string;
  claimErrorSub: string;
  setupAccessKicker: string;
  setupAccessTitle: string;
  setupAccessSub: string;
  setupAccessPasswordTitle: string;
  setupAccessPasswordSub: string;
  setupAccessPasswordLabel: string;
  setupAccessPasswordSave: string;
  setupAccessGoogleTitle: string;
  setupAccessGoogleSub: string;
  setupAccessGoogleCta: string;
  setupAccessSkip: string;
  setupAccessContinue: string;

  /* ── Merchant ID card on dashboard ── */
  dashMerchantIdTitle: string;
  dashMerchantIdSub: string;
  dashMerchantIdCopy: string;
  dashMerchantIdCopied: string;

  /* ── Dashboard — Mode A (setup checklist) ── */
  dashChecklistTitle: string;
  dashChecklistSub: string;
  dashStripeTitle: string;
  dashStripeSub: string;
  dashStripeConnect: string;
  dashStripeConnected: string;
  dashPosTitle: string;
  dashPosSub: string;
  dashPosPending: string;
  dashPosViber: string;

  /* ── Dashboard — Mode B (live) ── */
  dashLiveTitle: string;
  dashLiveSub: string;

  /* ── Merchant terms card titles ── */
  termPickupTitle: string;
  termPickupBody: string;
  termNoLastTitle: string;
  termNoLastBody: string;
  termProductsTitle: string;
  termProductsBody: string;
  termQualityTitle: string;
  termQualityBody: string;
  termDeletionTitle: string;
  termDeletionBody: string;
  termStockLossTitle: string;
  termStockLossBody: string;
};

/* ------------------------------------------------------------------ */
/*  Bulgarian                                                           */
/* ------------------------------------------------------------------ */

const BG: MerchantDict = {
  merchants: 'Търговци',
  login: 'Влез',
  dashboard: 'Табло',

  heroHeadLine1: 'Добави магазина си',
  heroHeadLine2: 'във Витрина.',
  heroSub:
    'Купувачите в България намират хранителни стоки, инструменти и занаятчийска храна в независими магазини близо до тях — и плащат през Витрина. Ние се грижим за витрината и разплащането. Ти се грижиш за магазина.',
  joinCta: 'Присъедини се като търговец',
  logInCta: 'Влез',
  openDashboard: 'Отвори таблото',

  howKicker: 'Как работи',
  howH2: 'Три стъпки. Същият магазин. Нови клиенти.',
  how1Eyebrow: '1',
  how1Title: 'Свържи наличностите си',
  how1Body:
    'Включи своята каса или ни изпращай Viber фийд. Ние придружаваме първата синхронизация — след като сте на живо, рафтът ти се обновява сам.',
  how2Eyebrow: '2',
  how2Title: 'Избери какво да показваш',
  how2Body:
    'Ти решаваш кои продукти да влязат в твоята Витрина и колко се чувстваш комфортно да поемеш.',
  how3Eyebrow: '3',
  how3Title: 'Приемай плащания, подготви, предай',
  how3Body:
    'Купувачите плащат през Витрина. Получаваш известие, подготвяш поръчката в прозореца за вземане и те я вземат.',

  benefitsKicker: 'Защо Витрина',
  benefitsH2: 'Нов рафт, без допълнителен наем.',
  ben1Title: 'Твоят магазин, онлайн — без уебсайт',
  ben1Body:
    'Витрина рафтът е малка част от работата по управлението на онлайн магазин. Ние се грижим за откривaемостта, ти правиш това, което правиш добре.',
  ben2Title: 'Парите идват директно при теб',
  ben2Body:
    'Stripe Express преводи директно към твоята банка. Ние никога не задържаме парите ти или инвентара ти.',
  ben3Title: 'Ти задаваш ритъма',
  ben3Body:
    'Прозорците за вземане сам избираш. Без поръчки в последния момент. Пазим времето ти по същия начин, по който пазим времето на купувача.',

  finalH2: 'Готов да сложиш магазина си на картата?',
  finalNote:
    'Отнема около 4 минути. Ние придружаваме интеграцията лично, ако предпочиташ.',

  authKicker: 'Витрина · Търговци',
  authTitle: 'Влез, за да продължиш',
  authCopy:
    'Запазваме отговорите ти докато попълваш — ще се озовеш в таблото си при следващо влизане.',
  authGoogle: 'Продължи с Google',
  authOr: 'или',
  authEmail: 'Използвай имейл',
  authEmailLabel: 'Имейл',
  authEmailInvalid: 'Въведи валиден имейл адрес.',
  authContinue: 'Продължи',
  authSending: 'Изпращане…',
  authSendLink: 'Изпрати ми магически линк',
  authBack: '← Назад',
  authLinkSent: 'Изпратихме линк на твоя имейл — провери входящата поща, после се върни тук.',
  authCheckEmail: 'Провери имейла си',
  authResend: 'Изпрати пак',
  gateNoApplication: 'Няма намерен търговски акаунт за този имейл. Кандидатствай по-долу — щом одобрим заявката, ще получиш линк за вход.',

  flowBack: 'Назад',
  flowNext: 'Напред',
  flowSkip: 'Пропусни',

  s1Title: 'Здравей от Витрина.',
  s1Sub:
    'Ще ни отнеме около 4 минути. Запазваме всяка стъпка, така че можеш да спреш и да продължиш по-късно.',
  s1Cta: 'Да започваме',

  s2Title: 'Как се казва магазинът ти?',
  s2Sub: 'Ще бъде показано на купувачите точно така, както го въведеш.',
  s2Label: 'Название на магазина',
  s2Placeholder: 'напр. Зеленчукарница "При Иван"',

  s3Title: 'Къде е магазинът ти?',
  s3Sub: 'Купувачите намират твоя магазин по местоположение. Можеш да провериш пина на картата.',

  s4Title: 'Какъв софтуер за касов апарат използваш?',
  s4Sub:
    'Ще ни помогне да конфигурираме правилния метод за синхронизация на наличностите. Избери всички, които ползваш.',
  s4None: 'Нямам / друго',

  s5Title: 'Какво продаваш?',
  s5Sub: 'Избери всички категории, в които се специализираш.',

  s6Title: 'Имаш ли онлайн магазин?',
  s6Sub: 'Помага ни да разберем дигиталния ти отпечатък.',

  s7Title: 'Кой е най-добрият контакт за интеграция?',
  s7Sub: 'Ще се свържем с тях при настройката на синхронизацията.',
  s7NameLabel: 'Пълно име',
  s7NamePlaceholder: 'Иван Петров',
  s7RoleLabel: 'Роля или длъжност',
  s7RolePlaceholder: 'напр. Собственик, Управител',

  s8Title: 'Какъв е телефонният ти номер?',
  s8Sub: 'Само ако трябва да се свържем за настройката.',
  s8Label: 'Телефон',
  s8Placeholder: '088 123 4567',

  s9Title: 'На кой имейл да те намерим?',
  s9Sub: 'Предварително попълнен от профила ти — смени го ако предпочиташ друг.',
  s9Label: 'Имейл',

  s10Title: 'Кога могат да вземат поръчките?',
  s10Sub:
    'Задаваме два прозореца по подразбиране. Добави или промени ги по желание.',
  s10AddWindow: '+ Добави прозорец',
  s10LunchLabel: 'Обяд',
  s10EveningLabel: 'Следобед',
  s10Start: 'От',
  s10End: 'До',

  s11Title: 'Искаш ли клиентите да плащат предварително?',
  s11Sub:
    'Онлайн плащането дава на купувачите по-гладко преживяване и ти гарантирани продажби.',
  s11Yes: 'Да — искам онлайн плащания',
  s11YesSub: 'Ще свържем Stripe за директни преводи.',
  s11No: 'Не — само вземане без предварително плащане',
  s11NoSub: 'Клиентите плащат в магазина.',

  s12Title: 'Нашите обещания към теб.',
  s12Sub: 'Прочети, после потвърди, и сте готови.',
  s12Agree: 'Съгласен/на — да започваме',

  s13Title: 'Добре дошъл в Витрина.',
  s13Sub:
    'Приложението ти е изпратено. Ще те потвърдим лично преди да отидем на живо.',
  s13Cta: 'Виж таблото си',

  submitKicker: 'Последна стъпка',
  submitTitle: 'Запази резултатите си.',
  submitSub:
    'На какъв имейл да изпратим достъпа до таблото? Запазваме отговорите от формата за този имейл — ще влезеш с един клик.',
  submitEmailLabel: 'Имейл на търговеца',
  submitTermsLead:
    'Кратко споразумение за партньорството ни с Витрина — шест точки, без дребен шрифт.',
  submitAgreeLabel: 'Прочетох и съм съгласен/а с шестте точки по-горе.',
  submitCta: 'Изпрати ми достъп до таблото',

  submittedTitle: 'Готово, {company}.',
  submittedSub:
    'Изпратихме имейл с линк към таблото ти. Отвори го, натисни „Отвори таблото си“ и създай акаунта си с Google, Apple или парола.',
  submittedOpenMail: 'Отвори пощата си',
  submittedHint:
    'Ако имейлът не пристигне в рамките на няколко минути, отговори на този имейл и Питър ще го пусне отново.',

  claimLoading: 'Проверяваме линка ти…',
  claimErrorTitle: 'Линкът не сработи.',
  claimErrorSub:
    'Може да е изтекъл или вече да е използван. Свържи се с Питър и ще ти изпратим нов.',
  setupAccessKicker: 'Сигурност на акаунта',
  setupAccessTitle: 'Как искаш да влизаш по-късно?',
  setupAccessSub:
    'Винаги можеш да поискаш магически линк, но настройването на парола или Google акаунт прави следващия вход по-бърз.',
  setupAccessPasswordTitle: 'Постави парола',
  setupAccessPasswordSub: 'Браузърът ти може да я запомни и да я попълва вместо теб.',
  setupAccessPasswordLabel: 'Нова парола',
  setupAccessPasswordSave: 'Запази паролата',
  setupAccessGoogleTitle: 'Свържи Google акаунт',
  setupAccessGoogleSub: 'Един клик при следващото влизане.',
  setupAccessGoogleCta: 'Свържи Google',
  setupAccessSkip: 'Пропусни — само магически линкове',
  setupAccessContinue: 'Продължи към таблото',

  dashMerchantIdTitle: 'Твой Витрина ID',
  dashMerchantIdSub:
    'Ако настройваме твоя POS впоследствие, може да те помолим да въведеш този код в нашия конектор.',
  dashMerchantIdCopy: 'Копирай',
  dashMerchantIdCopied: 'Копирано ✓',

  dashChecklistTitle: 'Почти готов.',
  dashChecklistSub:
    'Само две стъпки ни делят от пускането на магазина ти на живо.',
  dashStripeTitle: 'Свържи плащания',
  dashStripeSub:
    'Настрой Stripe Express за да получаваш директни плащания.',
  dashStripeConnect: 'Свържи Stripe',
  dashStripeConnected: 'Stripe свързан ✓',
  dashPosTitle: 'Свържи наличностите',
  dashPosSub:
    'Ще настроим интеграцията с касата ти лично. Ще се свържем скоро.',
  dashPosPending: 'Очаква интеграция',
  dashPosViber: 'Ще изпращам Viber снимки вместо това',

  dashLiveTitle: 'Магазинът ти е на живо.',
  dashLiveSub: 'Купувачите могат да намерят и поръчат от твоята Витрина.',

  termPickupTitle: 'Ти определяш прозорците за вземане',
  termPickupBody:
    'Поръчките са зададени за точните прозорци за вземане, които си избрал. Ние не позволяваме поръчки в последния момент извън тях.',
  termNoLastTitle: 'Без поръчки в последния момент',
  termNoLastBody:
    'Приемаме поръчки само по-рано от твоя прозорец за вземане. Правилото е същото за всички търговци и купувачи.',
  termProductsTitle: 'Ти отговаряш за продуктите',
  termProductsBody:
    'Ти контролираш какво е изброено и в какви количества. Ние показваме само това, което потвърждаваш.',
  termQualityTitle: 'Ти се грижиш за качеството',
  termQualityBody:
    'Витрина не проверява качеството на продукта. Репутацията ти зависи от свежестта и точността.',
  termDeletionTitle: 'Ти можеш да се оттеглиш по всяко време',
  termDeletionBody:
    'Изпрати ни съобщение или изключи магазина от таблото — ние ще обработим всичко незабавно без минимален период.',
  termStockLossTitle: 'Ние пазим наличностите ти',
  termStockLossBody:
    'Ако нещо се обърка от наша страна, ще се свържем веднага. Ти не носиш отговорност за загуби, причинени от нашия софтуер.',
};

/* ------------------------------------------------------------------ */
/*  English                                                             */
/* ------------------------------------------------------------------ */

const EN: MerchantDict = {
  merchants: 'Merchants',
  login: 'Log in',
  dashboard: 'Dashboard',

  heroHeadLine1: 'List your shop',
  heroHeadLine2: 'on Vitrina.',
  heroSub:
    'Bulgarian buyers find groceries, hardware, and craft food at independent shops near them — and pay through Vitrina. We handle the storefront and the checkout. You keep your shop.',
  joinCta: 'Join as a Vitrina merchant',
  logInCta: 'Log in',
  openDashboard: 'Open dashboard',

  howKicker: 'How it works',
  howH2: 'Three steps. Same shop. New customers.',
  how1Eyebrow: '1',
  how1Title: 'Connect your stock',
  how1Body:
    "Plug in your POS or send us a Viber feed. We chaperone the first sync — once you're live, your shelf updates itself.",
  how2Eyebrow: '2',
  how2Title: 'Pick what to show',
  how2Body:
    "You decide which products go on your Vitrina shelf and how much you're comfortable committing to.",
  how3Eyebrow: '3',
  how3Title: 'Get paid, prepare, hand over',
  how3Body:
    'Buyers pay through Vitrina. You get a notification, prepare during your pickup window, and they collect.',

  benefitsKicker: 'Why Vitrina',
  benefitsH2: 'A new shelf, with no extra rent.',
  ben1Title: 'Your shop, online — without the website',
  ben1Body:
    "A Vitrina shelf is a fraction of the work of running an online store. We do the discovery, you do what you're great at.",
  ben2Title: 'Money lands in your account',
  ben2Body:
    'Stripe Express deposits go straight to your bank. We never sit on your money or hold inventory for you.',
  ben3Title: 'You set the rhythm',
  ben3Body:
    "Pickup windows you choose. No last-minute orders. We protect your time the same way we protect the buyer's.",

  finalH2: 'Ready to put your shop on the map?',
  finalNote:
    "Takes about 4 minutes. We chaperone the integration in person if you'd like.",

  authKicker: 'Vitrina · Merchants',
  authTitle: 'Sign in to continue',
  authCopy:
    "We save your answers as you go — you'll land on your dashboard when you return.",
  authGoogle: 'Continue with Google',
  authOr: 'or',
  authEmail: 'Use email instead',
  authEmailLabel: 'Email',
  authEmailInvalid: 'Please enter a valid email address.',
  authContinue: 'Continue',
  authSending: 'Sending…',
  authSendLink: 'Email me a magic link',
  authBack: '← Back',
  authLinkSent: 'We sent a link to your email — check your inbox, then come back here.',
  authCheckEmail: 'Check your email',
  authResend: 'Resend link',
  gateNoApplication: "We couldn't find a merchant account for that email. Apply below — once we approve you, you'll get a sign-in link.",

  flowBack: 'Back',
  flowNext: 'Next',
  flowSkip: 'Skip',

  s1Title: 'Hello from Vitrina.',
  s1Sub:
    'This takes about 4 minutes. We save every step, so you can stop and come back later.',
  s1Cta: "Let's go",

  s2Title: "What's your shop called?",
  s2Sub: 'This will be shown to buyers exactly as you enter it.',
  s2Label: 'Shop name',
  s2Placeholder: "e.g. Ivan's Greengrocer",

  s3Title: 'Where is your shop?',
  s3Sub:
    'Buyers find your shop by location. You can check the pin on the map.',

  s4Title: 'Which POS software do you use?',
  s4Sub:
    'Helps us configure the right stock-sync method. Pick all that apply.',
  s4None: 'None / other',

  s5Title: 'What do you sell?',
  s5Sub: 'Pick all categories you specialise in.',

  s6Title: 'Do you sell online?',
  s6Sub: 'Helps us understand your digital footprint.',

  s7Title: "Who's the best contact for integration?",
  s7Sub: "We'll reach out to them when setting up the sync.",
  s7NameLabel: 'Full name',
  s7NamePlaceholder: 'Jane Smith',
  s7RoleLabel: 'Role or job title',
  s7RolePlaceholder: 'e.g. Owner, Manager',

  s8Title: "What's your phone number?",
  s8Sub: 'Only if we need to reach you during setup.',
  s8Label: 'Phone',
  s8Placeholder: '088 123 4567',

  s9Title: 'Which email should we reach you on?',
  s9Sub: 'Pre-filled from your profile — change it if you prefer another.',
  s9Label: 'Email',

  s10Title: 'When can buyers collect their orders?',
  s10Sub:
    'We set two windows by default. Add or adjust them as you like.',
  s10AddWindow: '+ Add window',
  s10LunchLabel: 'Lunch',
  s10EveningLabel: 'Afternoon',
  s10Start: 'From',
  s10End: 'To',

  s11Title: 'Do you want buyers to pay upfront?',
  s11Sub:
    'Online checkout gives buyers a smoother experience and you guaranteed sales.',
  s11Yes: 'Yes — I want online payments',
  s11YesSub: "We'll connect Stripe for direct payouts.",
  s11No: 'No — collect-only, no online payment',
  s11NoSub: 'Customers pay at the shop.',

  s12Title: 'Our promises to you.',
  s12Sub: "Read through, then confirm and you're set.",
  s12Agree: "I agree — let's go",

  s13Title: 'Welcome to Vitrina.',
  s13Sub:
    "Your application is in. We'll confirm you personally before going live.",
  s13Cta: 'View your dashboard',

  submitKicker: 'Last step',
  submitTitle: 'Lock in your answers.',
  submitSub:
    "What email should we send your dashboard access to? We save the form answers for this email so you sign in with one click.",
  submitEmailLabel: 'Merchant email',
  submitTermsLead:
    "A short agreement for our partnership — six points, no fine print.",
  submitAgreeLabel: 'I have read and agree to the six points above.',
  submitCta: 'Send my dashboard access',

  submittedTitle: "All set, {company}.",
  submittedSub:
    "We sent you an email with a link to your dashboard. Open it, tap \u201cOpen my dashboard\u201d, and finish creating your account with Google, Apple, or a password.",
  submittedOpenMail: 'Open my email',
  submittedHint:
    "If the email doesn\u2019t arrive within a few minutes, reply to this email and Peter will resend it.",

  claimLoading: 'Verifying your link…',
  claimErrorTitle: "That link didn\u2019t work.",
  claimErrorSub:
    "It may have expired or been used already. Contact Peter and we\u2019ll send a fresh one.",
  setupAccessKicker: 'Account security',
  setupAccessTitle: 'How do you want to sign in later?',
  setupAccessSub:
    "You can always request a magic link, but setting a password or linking Google makes signing in next time faster.",
  setupAccessPasswordTitle: 'Set a password',
  setupAccessPasswordSub: 'Your browser can save it and auto-fill it next time.',
  setupAccessPasswordLabel: 'New password',
  setupAccessPasswordSave: 'Save password',
  setupAccessGoogleTitle: 'Link your Google account',
  setupAccessGoogleSub: 'One tap to sign in next time.',
  setupAccessGoogleCta: 'Link Google',
  setupAccessSkip: 'Skip — magic links are fine',
  setupAccessContinue: 'Continue to dashboard',

  dashMerchantIdTitle: 'Your Vitrina ID',
  dashMerchantIdSub:
    "If we hook up your POS later, we may ask you to enter this code into our connector.",
  dashMerchantIdCopy: 'Copy',
  dashMerchantIdCopied: 'Copied ✓',

  dashChecklistTitle: 'Almost there.',
  dashChecklistSub:
    'Just two steps before your shop goes live.',
  dashStripeTitle: 'Connect payouts',
  dashStripeSub:
    'Set up Stripe Express to receive direct bank payouts.',
  dashStripeConnect: 'Connect Stripe',
  dashStripeConnected: 'Stripe connected ✓',
  dashPosTitle: 'Connect your stock',
  dashPosSub:
    "We'll set up the POS integration with you in person. We'll be in touch shortly.",
  dashPosPending: 'Awaiting integration',
  dashPosViber: "I'll send Viber photos instead",

  dashLiveTitle: 'Your shop is live.',
  dashLiveSub: 'Buyers can find and order from your Vitrina shelf.',

  termPickupTitle: 'You own the pickup windows',
  termPickupBody:
    "Orders are set to the exact pickup windows you chose. We don't allow last-minute orders outside them.",
  termNoLastTitle: 'No last-minute orders',
  termNoLastBody:
    'We only accept orders with enough lead time before your pickup window. The rule is the same for every merchant and every buyer.',
  termProductsTitle: "You're responsible for your products",
  termProductsBody:
    "You control what's listed and in what quantities. We only surface what you confirm.",
  termQualityTitle: "You're responsible for quality",
  termQualityBody:
    "Vitrina doesn't inspect product quality. Your reputation depends on freshness and accuracy.",
  termDeletionTitle: 'You can leave at any time',
  termDeletionBody:
    "Message us or flip the switch on your dashboard — we'll handle everything immediately with no minimum period.",
  termStockLossTitle: 'We protect your stock data',
  termStockLossBody:
    "If something goes wrong on our side, we'll be in touch immediately. You're not liable for losses caused by our software.",
};

/* ------------------------------------------------------------------ */
/*  Context                                                             */
/* ------------------------------------------------------------------ */

const DICTS: Record<Lang, MerchantDict> = { bg: BG, en: EN };

interface MerchantLangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: MerchantDict;
}

const MerchantLangContext = createContext<MerchantLangContextValue | null>(null);

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'bg';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'bg' || stored === 'en') return stored;
  } catch {
    // private-mode; no-op
  }
  return 'bg';
}

export function MerchantLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // swallow
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l === 'bg' ? 'bg' : 'en';
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'bg' ? 'bg' : 'en';
    }
  }, [lang]);

  const value = useMemo<MerchantLangContextValue>(
    () => ({ lang, setLang, t: DICTS[lang] }),
    [lang, setLang],
  );

  return (
    <MerchantLangContext.Provider value={value}>
      {children}
    </MerchantLangContext.Provider>
  );
}

export function useMerchantLang(): MerchantLangContextValue {
  const ctx = useContext(MerchantLangContext);
  if (ctx) return ctx;
  // Graceful fallback for callers outside the merchant flow — the
  // AuthSheet is now shared across shopper checkout (PayButton) and
  // merchant onboarding, so it can render outside MerchantLangProvider.
  // Detect language from localStorage (the storage key is the same for
  // the waiting page and merchant landing) and return a stable, no-op
  // setLang so the modal still copies correctly without throwing.
  const lang = detectInitialLang();
  return {
    lang,
    setLang: () => {
      /* no-op outside provider */
    },
    t: DICTS[lang],
  };
}
