import React from "react";

export default function LawyerSelect({ members, selected, onChange }) {
  const toggle = (name) => {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  };
  return (
    <div className="space-y-0.5 max-h-36 overflow-y-auto border border-[#1A1A1A] p-2 bg-[#0F0F0F]">
      {members.length === 0 && <p className="text-[#F5F5F3]/20 text-[11px] px-2 py-1">Sin miembros del equipo</p>}
      {members.map((m) => (
        <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#1A1A1A] px-2 py-1">
          <input type="checkbox" checked={selected.includes(m.name)} onChange={() => toggle(m.name)} className="accent-[#C9A227]" />
          <span className="text-sm text-[#F5F5F3]/70">{m.name}</span>
        </label>
      ))}
    </div>
  );
}