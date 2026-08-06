import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, User, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Register handleSubmit called", { fullName, email });
    setError("");
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, fullName);
      navigate("/");
    } catch (err) {
      setError(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Crear cuenta"
      subtitle="Regístrate para acceder al portal CIMA"
      footer={
        <Link to="/login" className="text-[#F5F5F3]/50 hover:text-[#C9A227] hover:underline block text-center text-xs">
          ¿Ya tienes cuenta? Inicia sesión aquí
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
          <Label htmlFor="fullName" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Nombre Completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
            <Input
              id="fullName"
              type="text"
              placeholder="Lic. María López"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-10 h-12 bg-[#080808] border-[#1A1A1A] text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:border-[#C9A227]"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-[#080808] border-[#1A1A1A] text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:border-[#C9A227]"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        <button type="submit" className="w-full h-12 font-medium bg-[#C9A227] hover:bg-[#A8841D] text-[#F5F5F3] flex items-center justify-center rounded-md cursor-pointer" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
