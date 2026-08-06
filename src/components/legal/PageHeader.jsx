import React from "react";

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-[#F5F5F3] text-2xl md:text-3xl font-heading font-light">{title}</h1>
        {subtitle && <p className="text-[#F5F5F3]/40 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}