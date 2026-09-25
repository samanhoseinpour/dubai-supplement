// Every Persian string the storefront shows (spec §6.5). Components import a
// key, never a literal. Voice: formal شما, plain verbs, a call to action names
// what happens, an error says what went wrong and what to do next.

/** A placeholder until a real mark exists; one constant, used everywhere. */
export const SITE_NAME = 'دبی ساپلیمنت'

export const copy = {
  siteName: SITE_NAME,
  tagline: 'مکمل‌های ورزشی اصل، با ارسال به سراسر ایران',
  skipToContent: 'پرش به محتوا',
  nav: {
    primary: 'ناوبری اصلی',
    home: 'صفحهٔ اصلی',
    brands: 'برندها',
  },
  home: {
    headline: 'مکمل‌های ورزشی اصل، برای تمرین جدی',
    lead: 'پروتئین، کراتین و ویتامین‌ها از برندهای معتبر، با ضمانت اصالت و ارسال سریع.',
    cta: 'مشاهدهٔ برندها',
  },
  theme: {
    label: 'انتخاب طرح',
    light: 'روشن',
    dark: 'تاریک',
    system: 'سیستم',
  },
  footer: {
    rights: 'همهٔ حقوق محفوظ است',
  },
  actions: {
    retry: 'تلاش دوباره',
    backHome: 'بازگشت به صفحهٔ اصلی',
    addToCart: 'افزودن به سبد خرید',
    close: 'بستن',
  },
  errors: {
    title: 'مشکلی پیش آمد',
    body: 'لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، کمی بعد برگردید.',
    notFoundTitle: 'صفحه پیدا نشد',
    notFoundBody: 'نشانی را بررسی کنید یا به صفحهٔ اصلی برگردید.',
  },
  price: {
    discount: 'تخفیف',
    original: 'قیمت قبل',
  },
  design: {
    title: 'سیستم طراحی',
    intro: 'هر جزء در هر حالت، در طرح روشن و تاریک. جزئی که اینجا نیست، وجود ندارد.',
    panels: { light: 'طرح روشن', dark: 'طرح تاریک' },
    sections: {
      colors: 'رنگ‌ها',
      typography: 'تایپوگرافی',
      buttons: 'دکمه‌ها',
      links: 'پیوندها',
      surfaces: 'سطح‌ها',
      textFields: 'فیلدهای متنی',
      badges: 'نشان‌ها',
      skeletons: 'اسکلت‌ها',
      price: 'قیمت',
      emptyState: 'حالت خالی',
      themeToggle: 'تغییر طرح',
    },
    states: {
      default: 'عادی',
      disabled: 'غیرفعال',
      loading: 'در حال بارگذاری',
      error: 'خطا',
      withIcon: 'با آیکن',
      iconOnly: 'فقط آیکن',
      block: 'تمام‌عرض',
      withHint: 'با راهنما',
      inline: 'در متن',
    },
    samples: {
      heading: 'پروتئین وی ایزوله',
      paragraph:
        'مکمل‌های ورزشی وقتی نتیجه می‌دهند که اصل باشند و درست مصرف شوند. هر محصول در این فروشگاه با ضمانت اصالت عرضه می‌شود و برچسب مصرف آن به فارسی نوشته شده است.',
      brandSentence: 'پروتئین وی MuscleTech با طعم شکلات',
      label: 'شمارهٔ موبایل',
      hint: 'با ۰۹ شروع می‌شود',
      placeholder: '۰۹۱۲ ۳۴۵ ۶۷۸۹',
      phonePartial: '۰۹۱',
      phoneFull: '۰۹۱۲۳۴۵۶۷۸۹',
      error: 'شمارهٔ موبایل معتبر نیست',
      cardTitle: 'کراتین مونوهیدرات',
      cardBody: 'خالص، بدون طعم، ۳۰۰ گرم',
      badgeNew: 'جدید',
      badgeStock: 'موجود',
      badgeOut: 'ناموجود',
      emptyTitle: 'هنوز چیزی اینجا نیست',
      emptyBody: 'به‌زودی محصولات این بخش اضافه می‌شوند.',
      emptyAction: 'مشاهدهٔ همهٔ برندها',
      link: 'راهنمای مصرف',
      linkSentence: 'پیش از مصرف، این راهنما را بخوانید:',
    },
  },
} as const
