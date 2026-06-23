import React, { useState, useContext } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthContext } from "../components/layout/AppShell";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, user } = useContext(AuthContext);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Simple demo auth
    if (username === "admin" && password === "admin") {
      login();
    } else {
      setError("Username/Password tidak sesuai, mohon periksa kembali");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F7FB] dark:bg-gray-950 p-4 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/20 dark:bg-blue-800/10 blur-[100px]" />

      <div className="w-full max-w-md neuglass p-8 rounded-[32px] relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src={`${import.meta.env.BASE_URL}logo_kota_tangerang_selatan.png`} alt="SIMOSDA Logo" className="w-24 h-24 object-contain mb-4 drop-shadow-md" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center tracking-tight">Login SIMOSDA</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sistem Informasi Monitoring Aset Daerah</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm text-center border border-red-100 dark:border-red-800/50">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
              placeholder="Masukkan username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                placeholder="Masukkan password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full mt-6 bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium py-3 rounded-full transition-all shadow-[8px_8px_16px_rgba(11,87,208,0.2),-8px_-8px_16px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(11,87,208,0.1)] active:shadow-[inset_6px_6px_10px_rgba(0,0,0,0.2)] flex justify-center items-center gap-2"
          >
            Masuk ke Sistem
          </button>
        </form>
        
      </div>
    </div>
  );
}
