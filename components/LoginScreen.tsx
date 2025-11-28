import React, { useEffect, useState } from 'react';
import { Lock, Bug } from 'lucide-react';

interface LoginScreenProps {
    onLoginSuccess: () => void;
    onDemoStart: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onDemoStart }) => {
    const [showDemoInput, setShowDemoInput] = useState(false);
    const [demoPwd, setDemoPwd] = useState('');
    const [statusMsg, setStatusMsg] = useState('Venter på input...');

    // --- Poll for Token (The "Check if I'm logged in" loop) ---
    useEffect(() => {
        const interval = setInterval(() => {
            const token = localStorage.getItem("_ms-mid");
            if (token) {
                setStatusMsg("Token funnet! Logger inn...");
                clearInterval(interval);
                // Give a tiny delay for localstorage write to settle
                setTimeout(() => {
                    onLoginSuccess();
                }, 500);
            }
        }, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, [onLoginSuccess]);

    const handleDemoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (demoPwd === 'KonsernDemo2025') {
            onDemoStart();
        } else {
            alert("Feil passord");
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

                {/* MAIN LOGIN FORM - Controlled by Memberstack */}
                {!showDemoInput ? (
                    <div className="w-form">
                        <form 
                            data-ms-form="login"
                            className="space-y-4"
                        >
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-slate-400 ml-1">E-post</label>
                                <input 
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all" 
                                    type="email" 
                                    data-ms-member="email" 
                                    placeholder="navn@selskap.no" 
                                    required 
                                />
                            </div>
                            
                            <div className="space-y-1">
                                <div className="flex justify-between ml-1">
                                    <label className="text-xs font-bold uppercase text-slate-400">Passord</label>
                                    <a href="#" data-ms-modal="forgot-password" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">Glemt passord?</a>
                                </div>
                                <input 
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all" 
                                    type="password" 
                                    data-ms-member="password" 
                                    placeholder="••••••••" 
                                    required 
                                />
                            </div>

                            <button 
                                type="submit" 
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-sky-900/20 transition-all transform active:scale-95 flex justify-center gap-2 mt-4"
                            >
                                Logg inn
                            </button>
                            
                            {/* Memberstack Error/Success Containers (Hidden by default, shown by script) */}
                            <div className="mt-4 text-center">
                                <div data-ms-message="error" className="text-rose-400 text-sm bg-rose-900/20 p-2 rounded hidden"></div>
                                <div data-ms-message="success" className="text-emerald-400 text-sm bg-emerald-900/20 p-2 rounded hidden">Innlogging vellykket! Sender deg videre...</div>
                            </div>
                        </form>
                    </div>
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
                        <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-all">Start Demo</button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <button onClick={() => setShowDemoInput(!showDemoInput)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        {showDemoInput ? 'Tilbake til innlogging' : 'Har du en demo-kode?'}
                    </button>
                </div>
            </div>

            {/* Status Bar */}
            <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-mono">
                 <Bug size={12} /> Status: <span className="text-slate-400">{statusMsg}</span>
            </div>
            
            <div className="mt-2 text-slate-600 text-[10px]">
                Powered by Attentio KK
            </div>
        </div>
    );
};

export default LoginScreen;