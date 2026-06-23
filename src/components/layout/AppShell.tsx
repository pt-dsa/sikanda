import React, { createContext, useContext, useState, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate, NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, CarFront, Wrench, Package, WalletCards, 
  Settings, LogOut, Menu, Map, FileText, CalendarClock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const AuthContext = createContext({ user: null as any, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("simosda_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = () => {
    const defaultUser = { name: "Administrator", role: "admin" };
    setUser(defaultUser);
    localStorage.setItem("simosda_user", JSON.stringify(defaultUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("simosda_user");
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: CarFront, label: "Data Kendaraan", href: "/kendaraan" },
  { icon: Wrench, label: "Alat & Mesin", href: "/alat-mesin" },
  { icon: Package, label: "Inventaris", href: "/inventaris" },
  { icon: WalletCards, label: "Pagu Anggaran", href: "/pagu" },
  { icon: Wrench, label: "Pemeliharaan Kendaraan", href: "/pemeliharaan-kendaraan" },
  { icon: CalendarClock, label: "Peminjaman", href: "/peminjaman" },
  { icon: Map, label: "Peta Sebaran", href: "/peta" },
  { icon: FileText, label: "Rekap Laporan", href: "/laporan" },
];

function Sidebar({ mobileOpen, desktopOpen, setMobileOpen }: { mobileOpen: boolean, desktopOpen: boolean, setMobileOpen: (v: boolean) => void }) {
  const location = useLocation();
  const { logout } = useContext(AuthContext);

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#e2e8f0]/40 dark:bg-[#1e293b]/40 backdrop-blur-2xl border-r border-white/60 dark:border-white/5 shadow-[8px_0_16px_rgba(163,177,198,0.2)] dark:shadow-[8px_0_16px_rgba(0,0,0,0.6)] transition-all duration-300",
      "w-64",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
      desktopOpen ? "md:translate-x-0 md:w-64" : "md:translate-x-0 md:w-20"
    )}>
      <div className={cn("flex h-16 items-center border-b border-gray-100/50 dark:border-gray-800/50 overflow-hidden", desktopOpen ? "px-6" : "md:px-0 md:justify-center px-6")}>
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-500 font-bold text-xl tracking-tight whitespace-nowrap">
          <img src={`${import.meta.env.BASE_URL}logo_kota_tangerang_selatan.png`} alt="SIMOSDA Logo" className="w-9 h-9 object-contain" />
          <span className={cn("transition-all duration-300 origin-left", desktopOpen ? "opacity-100 scale-100 w-auto" : "md:opacity-0 md:scale-0 md:w-0 opacity-100 scale-100 w-auto")}>SIMOSDA</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              title={!desktopOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap",
                desktopOpen ? "px-3 py-2.5" : "md:px-0 md:py-2.5 md:justify-center px-3 py-2.5",
                isActive 
                  ? "neuglass-pressed text-blue-700 dark:text-blue-400" 
                  : "text-gray-600 dark:text-gray-400 hover:neuglass hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <Icon size={18} className={cn("flex-shrink-0", isActive ? "text-blue-700 dark:text-blue-400" : "text-gray-400")} />
              <span className={cn("transition-all duration-300 origin-left", desktopOpen ? "opacity-100 scale-100 w-auto" : "md:opacity-0 md:scale-0 md:w-0 opacity-100 scale-100 w-auto")}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
      <div className="p-4 border-t border-gray-100/50 dark:border-gray-800/50 overflow-hidden">
        <button 
          onClick={logout}
          title={!desktopOpen ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:neuglass transition-colors whitespace-nowrap",
            desktopOpen ? "w-full px-3 py-2" : "md:w-auto md:p-2.5 md:justify-center w-full px-3 py-2"
          )}
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className={cn("transition-all duration-300 origin-left", desktopOpen ? "opacity-100 scale-100 w-auto" : "md:opacity-0 md:scale-0 md:w-0 opacity-100 scale-100 w-auto")}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="hidden lg:block text-sm text-gray-600 dark:text-gray-300 bg-white/40 dark:bg-gray-800/40 px-3 py-1.5 rounded-full border border-gray-200/50 dark:border-gray-700/50">
      {formatter.format(time)} WIB
    </div>
  );
}

function Topbar({ setMobileSidebarOpen, desktopSidebarOpen, setDesktopSidebarOpen }: { setMobileSidebarOpen: (v: boolean) => void, desktopSidebarOpen: boolean, setDesktopSidebarOpen: (v: boolean) => void }) {
  const { user } = useContext(AuthContext);

  const getGreeting = () => {
    const hour = parseInt(new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hour12: false
    }).format(new Date()), 10);
    
    if (hour >= 5 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-[#e2e8f0]/40 dark:bg-[#1e293b]/40 backdrop-blur-xl border-b border-white/60 dark:border-white/5 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-none px-4 md:px-6">
      <div className="flex items-center gap-4">
        <button 
          className="md:hidden p-2 -ml-2 rounded-full hover:neuglass text-gray-600 dark:text-gray-300"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
        <button 
          className="hidden md:block p-2 -ml-2 rounded-full hover:neuglass text-gray-600 dark:text-gray-300"
          onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
        >
          <Menu size={20} />
        </button>
        <span className="font-semibold text-lg text-gray-800 dark:text-gray-100 hidden sm:block">
          Command Center Aset Daerah
        </span>
      </div>
      <div className="flex items-center gap-4">
        <LiveClock />
        <ThemeToggle />
        <div className="flex items-center gap-3 ml-2">
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{getGreeting()}, {user?.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white flex items-center justify-center font-bold shadow-sm cursor-pointer">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const { user } = useContext(AuthContext);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#e2e8f0] dark:bg-[#1e293b] text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-200 dark:selection:bg-blue-900">
      <Sidebar 
        mobileOpen={mobileSidebarOpen} 
        desktopOpen={desktopSidebarOpen}
        setMobileOpen={setMobileSidebarOpen} 
      />
      
      {/* Backdrop for mobile sidebar */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/20 dark:bg-gray-950/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300",
        desktopSidebarOpen ? "md:pl-64" : "md:pl-20"
      )}>
        <Topbar 
          setMobileSidebarOpen={setMobileSidebarOpen} 
          desktopSidebarOpen={desktopSidebarOpen}
          setDesktopSidebarOpen={setDesktopSidebarOpen}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
