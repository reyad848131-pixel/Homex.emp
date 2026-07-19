# دليل نشر نظام Homex - الدليل الشامل

## ما الذي تحتاجه؟

### 1. سيرفر سحابي (Cloud Server)
**الخيارات المناسبة (مرتبة حسب السهولة):**

| الخدمة | السعر الشهري | المواصفات المناسبة |
|--------|-------------|-------------------|
| Hetzner | ~5€ (حوالي 2 ر.ع) | 2 CPU, 4GB RAM, 40GB SSD |
| DigitalOcean | $12 (حوالي 4.5 ر.ع) | 1 CPU, 2GB RAM, 50GB SSD |
| Vultr | $12 (حوالي 4.5 ر.ع) | 1 CPU, 2GB RAM, 55GB SSD |

**المواصفات المطلوبة (7 مستخدمين):**
- المعالج: 1-2 cores
- الذاكرة: 2GB RAM (الحد الأدنى)
- التخزين: 20GB+ SSD
- النظام: Ubuntu 22.04 أو 24.04
- الموقع: أقرب لعُمان (مثل: فرانكفورت أو البحرين)

### 2. دومين (Domain) - اختياري لكن مستحسن
- مثال: `homex.om` أو `app.homex.com`
- السعر: 5-15$ سنوياً
- يمكنك الاستغناء عنه واستخدام IP السيرفر مباشرة

### 3. لا تحتاج على أجهزة الموظفين
- لا Node.js
- لا Python
- لا CMD
- لا أي برامج تطوير
- فقط ملف التثبيت (EXE)

---

## خطوات النشر على السيرفر

### الخطوة 1: شراء السيرفر
1. سجّل في [Hetzner](https://www.hetzner.com) أو [DigitalOcean](https://www.digitalocean.com)
2. أنشئ سيرفر جديد:
   - نوع: Ubuntu 22.04
   - حجم: أصغر حجم يحتوي 2GB RAM
   - الموقع: أقرب لعُمان
3. ستحصل على:
   - عنوان IP (مثال: `157.90.123.45`)
   - كلمة مرور root

### الخطوة 2: الاتصال بالسيرفر
من CMD على جهازك:
```
ssh root@157.90.123.45
```
أدخل كلمة المرور.

### الخطوة 3: تثبيت Docker
```bash
curl -fsSL https://get.docker.com | sh
```

### الخطوة 4: رفع المشروع
```bash
# تثبيت git
apt update && apt install -y git

# تحميل المشروع
git clone https://github.com/reyad848131-pixel/Homex.emp.git
cd Homex.emp/homex-system
```

### الخطوة 5: إعداد البيئة
```bash
# نسخ ملف الإعدادات
cp .env.production.example .env.production

# تعديل الإعدادات
nano .env.production
```

غيّر القيم التالية:
```
DB_PASSWORD=كلمة_مرور_قوية_هنا
NEXTAUTH_SECRET=سر_عشوائي_طويل
NEXTAUTH_URL=https://your-domain.com
```

لتوليد سر عشوائي:
```bash
openssl rand -base64 32
```

### الخطوة 6: إعداد SSL (اختياري - للدومين)
إذا عندك دومين:
```bash
mkdir -p nginx/ssl
# ثبّت certbot واحصل على شهادة SSL
apt install certbot
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

إذا بدون دومين (IP مباشر فقط):
```bash
mkdir -p nginx/ssl
# شهادة ذاتية
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=homex"
```

### الخطوة 7: تشغيل النظام
```bash
docker compose --env-file .env.production up -d
```

### الخطوة 8: إنشاء قاعدة البيانات والبيانات الأولية
```bash
# تشغيل migrations
docker compose exec app npx prisma migrate deploy

# إضافة البيانات الأولية
docker compose exec app npx tsx prisma/seed.ts
```

### الخطوة 9: التأكد من أن كل شيء يعمل
```bash
# تحقق من حالة الخدمات
docker compose ps

# تحقق من السجلات
docker compose logs -f app
```

افتح المتصفح على: `https://your-domain.com` أو `https://157.90.123.45`

---

## تجهيز أجهزة الموظفين

### الطريقة 1: تطبيق Windows (EXE)
1. على جهاز فيه Node.js، ادخل مجلد `desktop/`
2. شغّل:
```
npm install
npm run build
```
3. ستجد ملف التثبيت في `desktop/dist/`
4. قبل البناء، عدّل `desktop/config.json`:
```json
{
  "serverUrl": "https://your-domain.com"
}
```
5. وزّع ملف `Homex Setup.exe` على الموظفين
6. الموظف يثبّت → يفتح → يسجّل دخول

### الطريقة 2: المتصفح (بدون تثبيت)
1. افتح `https://your-domain.com` من أي متصفح
2. يعمل من الكمبيوتر، الآيباد، والجوال

---

## النسخ الاحتياطي

### تلقائي
النظام يأخذ نسخة احتياطية تلقائياً كل 24 ساعة.
- تُحفظ في مجلد `backups/` على السيرفر
- تُحذف النسخ الأقدم من 30 يوم تلقائياً

### يدوي
```bash
# أخذ نسخة يدوية
docker compose exec db pg_dump -U homex homex_prod > backup_manual.sql

# نسخ الملف لجهازك
scp root@157.90.123.45:~/Homex.emp/homex-system/backups/latest.dump ./
```

### استعادة من نسخة
```bash
# استعادة نسخة احتياطية
docker compose exec -T db pg_restore -U homex -d homex_prod < backup_file.dump
```

---

## التحديث

### تحديث Backend (السيرفر)
```bash
ssh root@157.90.123.45
cd Homex.emp/homex-system
git pull origin claude/session-vq7i9k
docker compose --env-file .env.production up -d --build
```

### تحديث قاعدة البيانات
```bash
docker compose exec app npx prisma migrate deploy
```

### تحديث تطبيق Windows
إذا فعّلت Auto Update:
- التحديث يوصل تلقائياً للموظفين

إذا بدون Auto Update:
1. ابنِ نسخة جديدة من `desktop/`
2. وزّع ملف EXE الجديد على الموظفين

---

## حل المشاكل

### السيرفر توقف
```bash
ssh root@157.90.123.45
cd Homex.emp/homex-system
docker compose --env-file .env.production restart
```

### تحقق من السجلات
```bash
docker compose logs -f app     # سجلات التطبيق
docker compose logs -f db      # سجلات قاعدة البيانات
docker compose logs -f nginx   # سجلات الويب
```

### الموظف يشوف "لا يمكن الاتصال"
1. تأكد السيرفر شغال (الأمر أعلاه)
2. تأكد الموظف متصل بالإنترنت
3. جرّب تفتح الرابط من متصفحك أنت

### نسيت كلمة المرور
سجّل دخول كـ admin (رقم مدني: 2016) وغيّر كلمة المرور من صفحة الموظفين.

---

## ملخص التكلفة الشهرية

| البند | التكلفة |
|-------|--------|
| سيرفر سحابي | 2-5 ر.ع / شهر |
| دومين (اختياري) | 0.5 ر.ع / شهر |
| **المجموع** | **2-5.5 ر.ع / شهر** |

لا توجد رسوم إضافية — البرنامج ملكك بالكامل.
