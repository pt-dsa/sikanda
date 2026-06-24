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
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images_landingpage.png), url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop)` }}
    >
      {/* Dark overlay with slight blur */}
      <div className="absolute inset-0 bg-black/10 dark:bg-black/40 backdrop-blur-[2px]"></div>

      <div className="w-full max-w-lg bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl shadow-2xl border border-white/50 dark:border-gray-700/50 p-6 sm:p-10 rounded-[32px] relative z-10 transition-all duration-300 mx-4 mt-8 sm:-mt-16">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src={`${import.meta.env.BASE_URL}logo_kota_tangerang_selatan.png`} alt="SIMOSDA Logo" className="w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] object-contain mb-5 drop-shadow-md" />
          <h1 className="text-2xl sm:text-[27px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Selamat Datang di SIKANDA</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-[17px] font-[system-ui] leading-snug mt-2 font-medium max-w-sm">Sistem Informasi Kepegawaian dan Pengelolaan Aset Daerah</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 flex flex-col items-center w-full max-w-[400px] mx-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center border border-red-100 dark:border-red-800/50 w-full">
              {error}
            </div>
          )}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 ml-4">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-5 py-3.5 text-base rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
              placeholder="Masukkan username"
            />
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 ml-4">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 text-base pr-12 rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
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
            className="w-full sm:w-[319px] mt-6 text-base bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium py-3.5 rounded-full transition-all shadow-[6px_6px_12px_rgba(11,87,208,0.2),-6px_-6px_12px_rgba(255,255,255,0.8)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.6),-6px_-6px_12px_rgba(11,87,208,0.1)] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)] flex justify-center items-center gap-2"
          >
            Login
          </button>
        </form>
        
      </div>
    </div>
  );
}
