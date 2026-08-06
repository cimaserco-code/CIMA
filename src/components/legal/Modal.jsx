import React from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-[#080808] border border-[#1A1A1A] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[#F5F5F3] text-lg font-heading font-light">{title}</h3>
          <button onClick={onClose} className="text-[#F5F5F3]/30 hover:text-[#F5F5F3]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}