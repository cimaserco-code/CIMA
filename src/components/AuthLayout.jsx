import React from "react";
import packageJson from "../../package.json";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808] px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#C9A227 1px, transparent 1px), linear-gradient(90deg, #C9A227 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#C9A227] mb-5">
            <span className="font-heading text-[#080808] text-2xl font-semibold">C</span>
          </div>
          <span className="block font-heading text-[#F5F5F3] text-sm tracking-[0.3em] uppercase mb-2">
            CIMA
          </span>
          <h1 className="text-[#F5F5F3] text-2xl font-heading font-light">{title}</h1>
          {subtitle && <p className="text-[#F5F5F3]/40 text-sm mt-2">{subtitle}</p>}
        </div>
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-[#F5F5F3]/30 mt-6">{footer}</p>
        )}
      </div>
      <div className="fixed bottom-3 right-4 text-[#F5F5F3]/10 text-[10px] tracking-[0.2em] uppercase pointer-events-none select-none z-50 font-mono">
        CIMA v.{packageJson.version}
      </div>
    </div>
  );
}