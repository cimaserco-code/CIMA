import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Always show success screen
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Restablecer contraseña"
      subtitle="Te enviaremos un enlace para restablecer tu contraseña"
      footer={
        <Link to="/login" className="text-[#C9A227] font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Volver a Iniciar Sesión
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-[#F5F5F3] text-center">
          Si existe una cuenta registrada con {email}, recibirás un enlace de restablecimiento a la brevedad.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Correo Electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 bg-[#080808] border-[#1A1A1A] text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:border-[#C9A227]"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium bg-[#C9A227] hover:bg-[#A8841D] text-[#F5F5F3]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Enlace"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
