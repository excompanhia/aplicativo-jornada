import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function addSeconds(baseIso: string, seconds: number) {
  const base = new Date(baseIso).getTime();
  return new Date(base + seconds * 1000).toISOString();
}

export async function POST(req: Request) {
  try {
    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return NextResponse.json(
        { ok: false, error: "MP_ACCESS_TOKEN ausente" },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({} as any));

    // Mercado Pago pode mandar id em lugares diferentes
    const url = new URL(req.url);
    const idFromQuery =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      url.searchParams.get("payment_id");

    const paymentId =
      body?.data?.id ||
      body?.data?.object?.id ||
      body?.id ||
      body?.payment_id ||
      idFromQuery;

    // Sem paymentId: ignora, mas responde 200
    if (!paymentId) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "Evento sem paymentId (ignorado)",
      });
    }

    // Busca o pagamento real no MP (fonte da verdade)
    const payRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const payment = await payRes.json().catch(() => null);

    // Se não achou payment, não falha “fatal” (timing do MP)
    if (!payRes.ok || !payment?.id) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "Payment ainda não disponível / não encontrado",
        mp_status: payRes.status,
        details: payment,
      });
    }

    const status: string = payment.status; // approved | pending | rejected | cancelled...
    const mpPaymentId = String(payment.id);

    const metadata = payment.metadata || {};
    const externalReference: string | undefined = payment.external_reference;

    // Dados da preference
    let userId: string | undefined = metadata.user_id;

    let seconds: number | undefined =
      typeof metadata.seconds === "number" ? metadata.seconds : undefined;

    if (!seconds && typeof metadata.seconds === "string") {
      const n = Number(metadata.seconds);
      if (Number.isFinite(n)) seconds = n;
    }

    // Fallback: jornada:${userId}:${plan}:${Date.now()}
    if (!userId && typeof externalReference === "string") {
      const parts = externalReference.split(":");
      if (parts.length >= 2 && parts[0] === "jornada") {
        userId = parts[1];
      }
    }

    const supabase = getSupabaseAdmin();

    // 1) Idempotência: se já existe passe com esse payment_id, não cria de novo
    const { data: existing, error: existErr } = await supabase
      .from("passes")
      .select("id, status, expires_at")
      .eq("payment_id", mpPaymentId)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao checar passe existente",
          details: existErr.message,
        },
        { status: 500 }
      );
    }

    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        status,
        alreadyProcessed: true,
        pass_id: existing.id,
        pass_status: existing.status,
        expires_at: existing.expires_at,
      });
    }

    // 2) Se não approved, não cria passe (mas retorna 200 com status)
    if (status !== "approved") {
      return NextResponse.json({ ok: true, status, createdPass: false });
    }

    // 3) approved → precisa do userId + seconds
    if (!userId || !seconds) {
      return NextResponse.json(
        {
          ok: true,
          status,
          createdPass: false,
          ignored: true,
          reason: "approved mas faltam dados (user_id/seconds) na metadata",
        },
        { status: 200 }
      );
    }

    // Momento da compra (melhor usar o que o MP informa)
    const purchasedAt: string =
      payment.date_approved || payment.date_created || new Date().toISOString();

    const expiresAt = addSeconds(purchasedAt, seconds);
    const durationMinutes = Math.round(seconds / 60);

    // ✅ Importante:
    // Mesmo que a gente insira "active", alguns setups no banco podem sobrescrever no INSERT.
    // Por isso vamos:
    // 1) inserir
    // 2) forçar UPDATE do novo id para status="active"
    // 3) expirar os outros (excluindo o novo id)
    const passInsert = {
      user_id: userId,
      status: "active",
      duration_minutes: durationMinutes,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      payment_provider: "mercadopago",
      payment_id: mpPaymentId,
    };

    // 4) Cria o passe novo
    const { data: inserted, error: insertErr } = await supabase
      .from("passes")
      .insert(passInsert)
      .select("id")
      .single();

    if (insertErr || !inserted?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao criar passe",
          details: insertErr?.message || "insert sem id",
        },
        { status: 500 }
      );
    }

    const newPassId = inserted.id as string;

    // ✅ 5) Força o status "active" no passe recém-criado (ganha de defaults/triggers de INSERT)
    const { data: fixed, error: fixErr } = await supabase
      .from("passes")
      .update({ status: "active" })
      .eq("id", newPassId)
      .select("id, status, expires_at")
      .single();

    if (fixErr) {
      // Não derruba o webhook; mas reporta para debug
      console.error("Erro ao forçar status active no novo passe:", fixErr);
    }

    // 🔒 6) Regra: apenas 1 passe ativo por usuário
    // Expira qualquer outro passe ativo anterior (exclui o passe novo)
    const { error: expireErr } = await supabase
      .from("passes")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("status", "active")
      .neq("id", newPassId);

    if (expireErr) {
      console.error("Erro ao expirar passes antigos:", expireErr);
    }

    return NextResponse.json({
      ok: true,
      status,
      createdPass: true,
      pass_id: newPassId,
      pass_status: fixed?.status || "active",
      expires_at: fixed?.expires_at || expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado no webhook",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
