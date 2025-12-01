import React, { useState, useEffect } from 'react';
import { Lock, Bug, Loader2, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
    onLoginSuccess: () => void;
    onDemoStart: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onDemoStart }) => {
    const [showDemoInput, setShowDemoInput] = useState(false);
    
    // Login State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [isMemberstackReady, setIsMemberstackReady] = useState(false);

    // Demo State
    const [demoPwd, setDemoPwd] = useState('');
    const [demoError, setDemoError] = useState('');

    useEffect(() => {
        // Wait for Memberstack to be available
        const checkMs = () => {
            if (window.$memberstackDom) {
                setIsMemberstackReady(true);
            } else {
                setTimeout(checkMs, 100);
            }
        };
        checkMs();
    }, []);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setAuthError('');

        try {
            if (!window.$memberstackDom) {
                throw new Error("Autentiseringstjenesten lastes fortsatt... Prøv igjen om et øyeblikk.");
            }

            // Imperative login
            const response = await window.$memberstackDom.loginMember({
                email,
                password
            });
            
            if (response.data) {
                // Success
                onLoginSuccess();
            } else {
                throw new Error("Innlogging feilet. Vennligst sjekk e-post og passord.");
            }

        } catch (error: any) {
            console.error("Login Error:", error);
            setAuthError(error.message || "Feil e-post eller passord.");
            setIsLoading(false);
        }
    };

    const handleDemoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (demoPwd === 'KonsernDemo2025') {
            onDemoStart();
        } else {
            setDemoError("Feil demo-passord");
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 font-sans p-4 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-sky-900 blur-[100px]"></div>
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-slate-800 blur-[100px]"></div>
            </div>

            <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-8 z-10 relative animate-in zoom-in-95 duration-500">
                
                {/* Logo Section */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <img 
                            src="https://ucarecdn.com/b3e83749-8c8a-4382-b28b-fe1d988eff42/Attentioshlogo.png" 
                            alt="Attentio KK" 
                            className="h-20 w-auto object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Velkommen</h1>
                    <p className="text-slate-400 text-sm">Logg inn for å få tilgang til dashboard</p>
                </div>

                {/* MAIN LOGIN FORM */}
                {!showDemoInput ? (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase text-slate-400 ml-1">E-post</label>
                            <input 
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all disabled:opacity-50" 
                                type="email" 
                                placeholder="navn@selskap.no" 
                                required 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase text-slate-400 ml-1">Passord</label>
                            <input 
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all disabled:opacity-50" 
                                type="password" 
                                placeholder="••••••••" 
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        
                        {authError && (
                            <div className="text-rose-200 text-xs bg-rose-500/20 p-3 rounded-lg border border-rose-500/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={14} className="shrink-0" />
                                {authError}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading || !isMemberstackReady}
                            className={`w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-sky-900/20 transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center gap-2 ${isLoading || !isMemberstackReady ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                            {isLoading ? 'Logger inn...' : (!isMemberstackReady ? 'Laster system...' : 'Logg inn')}
                        </button>
                    </form>
                ) : (
                    /* DEMO FORM */
                    <form onSubmit={handleDemoSubmit} className="space-y-5">
                        <div className="text-center text-amber-400 text-sm font-medium mb-2">Demomodus</div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="password" 
                                required
                                className="w-full bg-slate-800/50 border border-amber-900/50 focus:ring-amber-500/50 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 outline-none transition-all"
                                placeholder="Demo Passord"
                                value={demoPwd}
                                onChange={e => setDemoPwd(e.target.value)}
                            />
                        </div>

                         {demoError && (
                            <div className="mb-4 bg-rose-500/20 border border-rose-500/50 rounded-lg p-3 text-rose-200 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <Bug size={16} />
                                {demoError}
                            </div>
                         )}

                        <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-all">Start Demo</button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <button onClick={() => { setShowDemoInput(!showDemoInput); setDemoError(''); setAuthError(''); }} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        {showDemoInput ? 'Tilbake til innlogging' : 'Har du en demo-kode?'}
                    </button>
                </div>
            </div>

            <div className="mt-4 text-slate-600 text-[10px]">
                Powered by Attentio KK
            </div>
        </div>
    );
};

export default LoginScreen;