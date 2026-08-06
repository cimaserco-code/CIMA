import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      navigate("/login");
    } catch (err) {
      setError(err.message || "Error al actualizar contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Lock}
      title="Nueva contraseña"
      subtitle="Ingresa tu nueva contraseña a continuación"
      footer={
        <Link to="/login" className="text-[#C9A227] font-medium hover:underline">
          Volver al Inicio de Sesión
        </Link>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-red-400/5 border border-red-400/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Nueva Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12 bg-[#080808] border-[#1A1A1A] text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:border-[#C9A227]"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Confirmar Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12 bg-[#080808] border-[#1A1A1A] text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:border-[#C9A227]"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium bg-[#C9A227] hover:bg-[#A8841D] text-[#F5F5F3]" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Actualizando...
            </>
          ) : (
            "Actualizar contraseña"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
