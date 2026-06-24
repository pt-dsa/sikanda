import React, { useState, useContext } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthContext } from "../components/layout/AppShell";
import { motion } from "motion/react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useContext(AuthContext);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Simple demo auth
    if (username === "admin" && password === "admin") {
      setIsLoading(true);
      setTimeout(() => {
        login();
      }, 2500);
    } else {
      setError("Username/Password tidak sesuai, mohon periksa kembali");
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat bg-gray-900"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images_landingpage.png)` }}
    >
      {/* Dark overlay with slight blur */}
      <div className="absolute inset-0 bg-black/10 dark:bg-black/40 backdrop-blur-[2px]"></div>

      <div className="w-full max-w-lg bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl shadow-2xl border border-white/50 dark:border-gray-700/50 p-6 sm:p-10 rounded-[32px] relative z-10 transition-all duration-300 mx-4 mt-8 sm:-mt-16">
        <div className="flex flex-col items-center text-center w-[450px] h-[198.734px] mb-[31px] ml-0 max-w-full">
          <img src={`${import.meta.env.BASE_URL}logo_kota_tangerang_selatan.png`} alt="SIKANDA Logo" className="w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] object-contain mb-5 drop-shadow-md" />
          <h1 className="text-2xl sm:text-[27px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Selamat Datang di SIKANDA</h1>
          <p className="text-gray-700 dark:text-gray-300 text-[15px] w-[800px] max-w-full font-bold leading-[22.375px] font-[system-ui] mt-[6px] -ml-[6px] px-0">Sistem Informasi Kepegawaian dan Pengelolaan Aset Daerah</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center w-full max-w-[400px] mx-auto py-10 space-y-6">
            <p className="text-gray-700 dark:text-gray-300 font-bold text-center text-lg animate-pulse">Mohon tunggu.. SIKANDA sedang bersiap..</p>
            <div className="w-full h-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden shadow-inner border border-gray-300/30 dark:border-gray-600/30">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
              />
            </div>
          </div>
        ) : (
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
        )}
        
      </div>
    </div>
  );
}
