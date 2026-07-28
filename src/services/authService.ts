import { supabase } from "@/lib/supabaseClient";
import type { AppUser } from "@/lib/rbac";
import { apiService } from "./apiService";

export type CaptchaPurpose = "login" | "register";
export interface CaptchaProof {
  challengeId: string;
  position: number;
  elapsedMs: number;
  track: number[];
}

export interface CaptchaChallenge {
  ok: true;
  challengeId: string;
  target: number;
  vertical: number;
  expiresIn: number;
}

export const authService = {
  challenge: async (purpose: CaptchaPurpose, clientKey: string): Promise<CaptchaChallenge> => {
    return { ok: true, challengeId: "dummy", target: 50, vertical: 50, expiresIn: 300 };
  },
  
  login: async (nip: string, password: string, captcha: CaptchaProof, clientKey: string) => {
    // SIKANDA uses NIP for login, but Supabase Auth requires an email.
    // We call a public RPC function to safely map NIP to Email.
    const { data: userData, error: rpcError } = await supabase.from('user_emails').select('email').eq('nip', nip).maybeSingle();
    const email = userData?.email;
    
    if (rpcError || !email) {
       console.error("RPC Error:", rpcError, "Email:", email);
       throw new Error(`Akun SIKANDA dengan NIP tersebut tidak ditemukan. (Details: ${rpcError?.message || 'Empty response'})`);
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw new Error(error.message);
    
    const user = await apiService.whoami();
    return { user, requiresLogin: false };
  },

  register: async (nip: string, email: string, password: string, captcha: CaptchaProof, clientKey: string): Promise<{ requiresLogin: boolean; message?: string; user?: any }> => {
    // Check if the given NIP exists in app_access and retrieve the registered email via RPC.
    const { data: userData, error: rpcError } = await supabase.from('user_emails').select('email').eq('nip', nip).maybeSingle();
    const dbEmail = userData?.email;
    
    if (rpcError || !dbEmail) {
       console.error("RPC Error:", rpcError, "Email:", dbEmail);
       throw new Error(`Akun SIKANDA dengan NIP tersebut tidak ditemukan. (Details: ${rpcError?.message || 'Empty response'})`);
    }
    
    if (dbEmail.toLowerCase() !== email.toLowerCase()) {
       throw new Error("Email tidak sesuai dengan yang didaftarkan Administrator.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    
    return { requiresLogin: true, message: "Registrasi berhasil. Silakan masuk menggunakan NIP dan password Anda." };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },
};
