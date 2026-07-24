"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditCustomerModal } from "./edit-customer-modal";
import { useI18n } from "@/lib/i18n";

interface Props {
  customer: {
    id: string;
    name: string;
    phone: string;
    phoneCode: string;
    governorate: string;
    wilayat: string;
    address: string | null;
  };
}

export function EditCustomerButton({ customer }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
        <Pencil className="w-4 h-4" />
        {t("editInfo")}
      </button>
      {open && <EditCustomerModal customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}
