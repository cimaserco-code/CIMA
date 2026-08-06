import React from "react";

export default function CaseSelect({ cases, value, onChange, inputCls }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin caso</option>
      {cases.map((c) => <option key={c.id} value={c.case_number}>{c.case_number} — {c.title}</option>)}
    </select>
  );
}