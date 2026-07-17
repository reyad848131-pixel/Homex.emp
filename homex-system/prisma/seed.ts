import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const employees = [
    { name: "رياض الحميمي", civilId: "2016", phone: "+96899999901", role: "admin", password: hash("2016") },
    { name: "سالم النبهاني", civilId: "1389", phone: "+96899999902", role: "manager", password: hash("1389") },
    { name: "محمد العوفي", civilId: "1383", phone: "+96899999903", role: "sales", password: hash("1383") },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { civilId: emp.civilId },
      update: {},
      create: emp,
    });
  }

  const categories = [
    { id: "kitchens", nameAr: "المطابخ", nameEn: "Kitchens", icon: "ChefHat", pricingType: "per_sqm", sortOrder: 1,
      config: JSON.stringify({
        regions: { muscat: { price: 120 }, batinah: { price: 130 }, other: { price: 150 } },
        multipliers: { "2unit": 1, "3unit": 1.3 },
        porcelainSurcharge: 55,
        island: { small: 390, large: 600 }
      })
    },
    { id: "cabinets", nameAr: "الخزائن", nameEn: "Cabinets", icon: "DoorOpen", pricingType: "per_sqm", basePrice: 54, sortOrder: 2,
      config: JSON.stringify({ basePrice: 54, glassDoor: 60, led: 25, shapes: ["single", "L", "U"] })
    },
    { id: "nightstand", nameAr: "كومودينو", nameEn: "Nightstand", icon: "Lamp", pricingType: "per_unit", sortOrder: 3,
      config: JSON.stringify({ standard: 30, round: 50 })
    },
    { id: "curtains", nameAr: "الستائر", nameEn: "Curtains", icon: "Blinds", pricingType: "per_meter", sortOrder: 4,
      config: JSON.stringify({ types: { chiffon: 8, blackout: 12, both: 18 }, electricMotor: { base: 45, perMeter: 5 }, minOrder: 3 })
    },
    { id: "dressing-table", nameAr: "تسريحة", nameEn: "Dressing Table", icon: "Sparkles", pricingType: "per_meter", basePrice: 120, sortOrder: 5,
      config: JSON.stringify({ pricePerMeter: 120, lighting: 20 })
    },
    { id: "bed", nameAr: "السرير", nameEn: "Bed", icon: "BedDouble", pricingType: "per_unit", sortOrder: 6,
      config: JSON.stringify({
        types: { wood: "خشب", fabric: "قماش" },
        sizes: { "90x190": 85, "120x200": 110, "150x200": 130, "160x200": 140, "180x200": 160, "200x200": 180 },
        lighting: 20
      })
    },
    { id: "cladding", nameAr: "الكلادينق", nameEn: "Cladding", icon: "Layers", pricingType: "per_sqm", sortOrder: 7,
      config: JSON.stringify({ types: { wood: 35, pvc: 28, fabric: 42, stone: 55 }, lighting: 15 })
    },
    { id: "tv-table", nameAr: "طاولة تلفزيون", nameEn: "TV Table", icon: "Tv", pricingType: "per_sqm", basePrice: 50, sortOrder: 8,
      config: JSON.stringify({ pricePerSqm: 50, addon: 20 })
    },
    { id: "office-desk", nameAr: "مكتب", nameEn: "Office Desk", icon: "Monitor", pricingType: "per_sqm", basePrice: 50, sortOrder: 9,
      config: JSON.stringify({ pricePerSqm: 50, addon: 20 })
    },
    { id: "sofa-set", nameAr: "أطقم الجلوس", nameEn: "Sofa Set", icon: "Sofa", pricingType: "per_unit", sortOrder: 10,
      config: JSON.stringify({ standard: { min: 80, max: 95 }, wooden: { min: 110, max: 140 } })
    },
    { id: "laundry", nameAr: "غرفة الغسيل", nameEn: "Laundry", icon: "WashingMachine", pricingType: "per_sqm", basePrice: 60, sortOrder: 11,
      config: JSON.stringify({ pricePerSqm: 60, lighting: 20 })
    },
    { id: "other", nameAr: "أخرى", nameEn: "Other", icon: "Plus", pricingType: "manual", sortOrder: 12,
      config: JSON.stringify({})
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  const defaultSettings = [
    { key: "company_name", value: "Homex" },
    { key: "company_phone", value: "+96899999900" },
    { key: "company_address", value: "مسقط، سلطنة عمان" },
    { key: "company_cr", value: "" },
    { key: "vat_rate", value: "5" },
    { key: "advance_pct", value: "15" },
    { key: "quote_validity_days", value: "30" },
    { key: "currency", value: "ر.ع" },
  ];

  for (const s of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
