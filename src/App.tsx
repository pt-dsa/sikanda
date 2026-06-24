import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Kendaraan from "@/pages/Kendaraan";
import AlatMesin from "@/pages/AlatMesin";
import Inventaris from "@/pages/Inventaris";
import PaguAnggaran from "@/pages/PaguAnggaran";
import PemeliharaanKendaraan from "@/pages/PemeliharaanKendaraan";
import Peminjaman from "@/pages/Peminjaman";
import Laporan from "@/pages/Laporan";

import PetaSebaran from "@/pages/PetaSebaran";

import PegawaiPage from "@/pages/Pegawai";

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
    <div className="text-2xl font-semibold text-gray-500">{title}</div>
    <p className="text-sm">Modul ini siap dikembangkan dengan arsitektur yang sama.</p>
  </div>
);

function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pegawai" element={<PegawaiPage />} />
                <Route path="/kendaraan" element={<Kendaraan />} />
                <Route path="/alat-mesin" element={<AlatMesin />} />
                <Route path="/inventaris" element={<Inventaris />} />
                <Route path="/pagu" element={<PaguAnggaran />} />
                <Route path="/pemeliharaan-kendaraan" element={<PemeliharaanKendaraan />} />
                <Route path="/peminjaman" element={<Peminjaman />} />
                <Route path="/peta" element={<PetaSebaran />} />
                <Route path="/laporan" element={<Laporan />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

