import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1);
    const { user, profile } = useAuth();
    
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#080808]">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-[#C9A227]">404</h1>
                        <div className="h-0.5 w-16 bg-[#C9A227]/30 mx-auto"></div>
                    </div>
                    
                    <div className="space-y-3">
                        <h2 className="text-2xl font-medium text-[#F5F5F3]">
                            Página no encontrada
                        </h2>
                        <p className="text-[#F5F5F3]/50 leading-relaxed">
                            La página <span className="font-medium text-[#C9A227]">"{pageName}"</span> no existe en este portal.
                        </p>
                    </div>
                    
                    {profile?.role === 'Admin' && (
                        <div className="mt-8 p-4 bg-[#0F0F0F] rounded-lg border border-[#1A1A1A]">
                            <p className="text-sm font-medium text-[#C9A227]">Nota de Administrador</p>
                            <p className="text-xs text-[#F5F5F3]/50 mt-1">
                                Verifica que la ruta esté configurada correctamente en App.jsx.
                            </p>
                        </div>
                    )}
                    
                    <div className="pt-6">
                        <button 
                            onClick={() => window.location.href = '/'} 
                            className="inline-flex items-center px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-[#080808] bg-[#C9A227] hover:bg-[#A8841D] transition-colors"
                        >
                            Volver al Inicio
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}