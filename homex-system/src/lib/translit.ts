// Arabic → Latin transliteration for customer names, so non-Arabic staff can
// read them. Names have no perfect automatic mapping (Arabic omits short
// vowels), so we lean on a dictionary of the most common Omani first names and
// tribe (Al-…) surnames for accuracy, and fall back to a letter map otherwise.
// Names already written in Latin letters are returned unchanged.

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

// Common Omani first names (bare, no article).
const FIRST_NAMES: Record<string, string> = {
  "محمد": "Mohammed", "أحمد": "Ahmed", "احمد": "Ahmed", "خالد": "Khalid",
  "علي": "Ali", "سالم": "Salim", "سعيد": "Said", "حمد": "Hamad", "حمود": "Hamoud",
  "ناصر": "Nasser", "سلطان": "Sultan", "عبدالله": "Abdullah", "عبد الله": "Abdullah",
  "عبدالرحمن": "Abdulrahman", "عبدالعزيز": "Abdulaziz", "يوسف": "Yousuf", "راشد": "Rashid",
  "ماجد": "Majid", "حسن": "Hassan", "حسين": "Hussain", "فيصل": "Faisal", "طارق": "Tariq",
  "عمر": "Omar", "يعقوب": "Yaqoob", "بدر": "Bader", "منذر": "Munther", "هلال": "Hilal",
  "زياد": "Ziyad", "وليد": "Waleed", "أمجد": "Amjad", "امجد": "Amjad", "معتصر": "Motaser",
  "فهد": "Fahad", "إبراهيم": "Ibrahim", "ابراهيم": "Ibrahim", "خليفة": "Khalifa",
  "سيف": "Saif", "مازن": "Mazin", "ثاني": "Thani", "جاسم": "Jasim", "قيس": "Qais",
  "محمود": "Mahmoud", "عبدالملك": "Abdulmalik", "مروان": "Marwan", "سلمان": "Salman",
  "عبدالرحيم": "Abdulrahim", "طلال": "Talal", "معاذ": "Muadh", "أنس": "Anas",
  "بلال": "Bilal", "عادل": "Adel", "نبيل": "Nabil", "رامي": "Rami", "سامي": "Sami",
  "خميس": "Khamis", "مبارك": "Mubarak", "عيسى": "Issa", "موسى": "Musa", "زايد": "Zayed",
  "راكان": "Rakan", "ريان": "Rayan", "معمر": "Muammar", "غالب": "Ghalib", "سند": "Sanad",
  "بن": "Bin", "ابن": "Ibn", "بنت": "Bint", "أبو": "Abu", "ابو": "Abu", "آل": "Al", "عبد": "Abd",
  "فاطمة": "Fatma", "عائشة": "Aisha", "مريم": "Mariam", "خديجة": "Khadija", "نورة": "Noura",
  "سميرة": "Samira", "منى": "Muna", "هدى": "Huda", "ريم": "Reem", "شيخة": "Shaikha",
};

// Common Omani tribe surnames (the "ال…" family names) → "Al …".
const TRIBES: Record<string, string> = {
  "العدوي": "Al Adawi", "الهنائي": "Al Hinai", "البلوشي": "Al Balushi", "العامري": "Al Amri",
  "الحارثي": "Al Harthy", "الرواحي": "Al Rawahi", "الكندي": "Al Kindi", "النبهاني": "Al Nabhani",
  "الشعيلي": "Al Shuaili", "الحبسي": "Al Habsi", "الغافري": "Al Ghafri", "السعدي": "Al Saadi",
  "الريامي": "Al Riyami", "البوسعيدي": "Al Busaidi", "المعمري": "Al Mamari", "الزدجالي": "Al Zadjali",
  "القاسمي": "Al Qasimi", "الجابري": "Al Jabri", "الوهيبي": "Al Wahaibi", "المقبالي": "Al Maqbali",
  "البادي": "Al Badi", "الفارسي": "Al Farsi", "السيابي": "Al Siyabi", "الرحبي": "Al Rahbi",
  "الصوافي": "Al Sawafi", "البطاشي": "Al Battashi", "الشحي": "Al Shehhi", "المحروقي": "Al Mahrouqi",
  "الحوسني": "Al Hosni", "الخروصي": "Al Kharusi", "المسكري": "Al Maskari", "الهطالي": "Al Hatali",
  "العبري": "Al Abri", "الشقصي": "Al Shaqsi", "المنذري": "Al Munthiri", "الراشدي": "Al Rashdi",
  "الحضرمي": "Al Hadhrami", "العلوي": "Al Alawi", "الاسماعيلي": "Al Ismaili", "الإسماعيلي": "Al Ismaili",
  "الحسني": "Al Hasani", "القصابي": "Al Qassabi", "العلوية": "Al Alawi", "السناني": "Al Sanani",
  "الحجري": "Al Hajri", "الغساني": "Al Ghassani", "الأنصاري": "Al Ansari", "الانصاري": "Al Ansari",
  "الخنبشي": "Al Khanbashi", "العجمي": "Al Ajmi", "الشملي": "Al Shamli", "الطوقي": "Al Touqi",
};

const LETTERS: Record<string, string> = {
  "ء": "", "آ": "aa", "أ": "a", "ؤ": "'", "إ": "i", "ئ": "'", "ا": "a", "ب": "b",
  "ة": "a", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh",
  "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "dh", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "w", "ى": "a", "ي": "y", "ﻻ": "la",
  // strip harakat/tatweel
  "ً": "", "ٌ": "", "ٍ": "", "َ": "", "ُ": "", "ِ": "", "ّ": "", "ْ": "", "ـ": "",
};

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

function translitBare(word: string): string {
  let out = "";
  for (const ch of word) out += LETTERS[ch] ?? ch;
  return cap(out);
}

function translitWord(word: string): string {
  if (!word) return word;
  if (TRIBES[word]) return TRIBES[word];
  if (FIRST_NAMES[word]) return FIRST_NAMES[word];
  // Family name with the definite article we don't have in the dictionary:
  // render it as "Al <rest>" which reads naturally for Omani surnames.
  if (word.startsWith("ال") && word.length > 2) return "Al " + translitBare(word.slice(2));
  return translitBare(word);
}

// Transliterate a full Arabic name to readable Latin. Latin/mixed input is left
// untouched; only Arabic words are converted.
export function transliterateName(name: string): string {
  return (name || "")
    .split(/\s+/)
    .map((w) => (hasArabic(w) ? translitWord(w) : w))
    .join(" ")
    .trim();
}

// Display a customer/person name for the current locale: English viewers get a
// Latin reading of Arabic names; Arabic viewers (and already-Latin names) see
// the original.
export function displayName(name: string, locale: string): string {
  if (locale !== "en" || !name || !hasArabic(name)) return name;
  return transliterateName(name);
}
