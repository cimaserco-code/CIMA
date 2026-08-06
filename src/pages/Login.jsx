import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Login handleSubmit called", { email });
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Email o contraseña inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Bienvenido de nuevo"
      subtitle="Inicia sesión para acceder al portal"
      footer={
        <Link to="/register" className="text-[#F5F5F3]/50 hover:text-[#C9A227] hover:underline block text-center text-xs">
          ¿No tienes cuenta? Regístrate aquí
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
          <Label htmlFor="email" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Email</Label>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs text-[#C9A227] hover:underline">¿Olvidaste tu contraseña?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F3]/20" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 bg-[#080808] border-[#1A1A1A] text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:border-[#C9A227]"
              required
            />
          </div>
        </div>
        <button type="submit" className="w-full h-12 font-medium bg-[#C9A227] hover:bg-[#A8841D] text-[#F5F5F3] flex items-center justify-center rounded-md cursor-pointer" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Ingresando...
            </>
          ) : (
            "Iniciar sesión"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}