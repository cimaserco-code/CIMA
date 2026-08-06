import React from "react";

export default function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-[#080808] border border-[#1A1A1A] p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">{label}</span>
        {Icon && <Icon size={16} className="text-[#C9A227]" />}
      </div>
      <p className="text-[#F5F5F3] text-3xl font-heading font-light">{value}</p>
    </div>
  );
}