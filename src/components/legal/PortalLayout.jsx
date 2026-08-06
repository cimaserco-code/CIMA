import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import PortalSidebar from "./PortalSidebar";
import packageJson from "../../../package.json";

export default function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-[#080808] relative">
      <PortalSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-y-auto bg-[#0F0F0F]">
        <div className="lg:hidden h-14 flex items-center px-4 border-b border-[#1A1A1A] bg-[#080808] sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-[#F5F5F3]"><Menu size={22} /></button>
          <span className="ml-4 font-heading text-[#F5F5F3] text-sm tracking-[0.3em] uppercase">CIMA</span>
        </div>
        <div className="p-6 md:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>
      <div className="fixed bottom-3 right-4 text-[#F5F5F3]/10 text-[10px] tracking-[0.2em] uppercase pointer-events-none select-none z-50 font-mono">
        CIMA v.{packageJson.version}
      </div>
    </div>
  );
}