import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callOpenRouter(question: string, history: any[], systemPrompt: string) {
  const messages = [
    { role: "system", content: systemPrompt },
    // Ambil maksimal 5 history terakhir agar tidak kepenuhan
    ...history.slice(-5).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: question },
  ];

  // Cari model gratis dari katalog OpenRouter
  const modelsRes = await fetch("https://openrouter.ai/api/v1/models");
  const modelsData = await modelsRes.json();
  const freeModels = modelsData.data
    .filter((m: any) => m.pricing.prompt === "0" && m.pricing.completion === "0")
    .map((m: any) => m.id);

  const models = freeModels.slice(0, 3);
  let lastError = null;

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://sikanda.app", 
          "X-Title": "SIKANDA"
        },
        body: JSON.stringify({
          model,
          messages
        })
      });

      if (!res.ok) {
        throw new Error(`OpenRouter Error: ${res.status}`);
      }

      const data = await res.json();
      return data.choices[0].message.content; // Langsung kembalikan jawaban natural AI
    } catch (err) {
      console.error(`Gagal dengan model ${model}:`, err);
      lastError = err;
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, history, dataContext } = await req.json();

    // Waktu saat ini di zona WIB (Waktu Indonesia Barat)
    const nowWIB = new Date().toLocaleString("id-ID", { 
      timeZone: "Asia/Jakarta", 
      dateStyle: "full", 
      timeStyle: "long" 
    });

    const SYSTEM_PROMPT = `Kamu adalah SIKANDA (Sistem Informasi Kepegawaian dan Aset Daerah), asisten virtual cerdas yang hangat dan humanis.
Gunakan sapaan "Sobat SIKANDA" untuk memanggil pengguna. Jawab pertanyaan pengguna HANYA berdasarkan referensi data JSON berikut.
Jika informasi tidak ada di data, katakan dengan sopan bahwa datanya belum tersedia.
PENTING: Hari ini adalah ${nowWIB}. Gunakan kalender ini sebagai acuan saat ditanya "minggu ini", "bulan depan", dsb.

Data Pegawai dan Jadwal Notifikasi (JSON):
${dataContext}`;

    // Panggil AI dengan konteks data
    const aiAnswer = await callOpenRouter(question, history || [], SYSTEM_PROMPT);

    return new Response(JSON.stringify({ ok: true, answer: aiAnswer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
