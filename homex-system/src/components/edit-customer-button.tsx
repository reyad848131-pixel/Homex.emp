"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditCustomerModal } from "./edit-customer-modal";

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

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-sm font-bold hover:bg-gray-50 transition-colors">
        <Pencil className="w-4 h-4" />
        تعديل البيانات
      </button>
      {open && <EditCustomerModal customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}
