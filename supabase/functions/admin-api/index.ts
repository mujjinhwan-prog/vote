// Voice of YUHAN 설문조사 — 관리자 전용 Edge Function
// 배포: supabase functions deploy admin-api
// 비밀번호 설정: supabase secrets set ADMIN_PASSCODE=원하는비밀번호
//
// 클라이언트(관리자 페이지)는 매 요청마다 { passcode, action, payload } 를 보내고,
// 이 함수는 Supabase 서비스 롤 키(브라우저에는 절대 노출되지 않음)로 DB를 읽고 씁니다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" });
  }

  const { passcode, action, payload } = body || {};
  const ADMIN_PASSCODE = Deno.env.get("ADMIN_PASSCODE");
  if (!ADMIN_PASSCODE) return json({ error: "server_not_configured" });
  if (!passcode || passcode !== ADMIN_PASSCODE) return json({ error: "invalid_passcode" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (action) {
      case "list_surveys": {
        const { data: surveys, error } = await supabase
          .from("surveys")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) return json({ error: "db_error", detail: error.message });

        const { data: counts, error: cErr } = await supabase
          .from("responses")
          .select("survey_id");
        if (cErr) return json({ error: "db_error", detail: cErr.message });
        const countMap: Record<string, number> = {};
        (counts || []).forEach((r: any) => { countMap[r.survey_id] = (countMap[r.survey_id] || 0) + 1; });

        return json({
          surveys: (surveys || []).map((s: any) => ({ ...s, response_count: countMap[s.id] || 0 })),
        });
      }

      case "create_survey": {
        const c = payload || {};
        const { data, error } = await supabase
          .from("surveys")
          .insert({
            title: c.title ?? "",
            choice_question_count: c.choiceQuestionCount ?? 0,
            choices_per_question: c.choicesPerQuestion ?? 2,
            text_question_count: c.textQuestionCount ?? 0,
            questions: c.questions ?? [],
            start_at: c.startAt || null,
            end_at: c.endAt || null,
            manual_status: c.manualStatus || "auto",
          })
          .select()
          .single();
        if (error) return json({ error: "db_error", detail: error.message });

        if (c.activateNow) {
          await supabase.from("surveys").update({ is_active: false }).neq("id", data.id);
          await supabase.from("surveys").update({ is_active: true }).eq("id", data.id);
          data.is_active = true;
        }
        return json({ survey: data });
      }

      case "save_survey": {
        const c = payload || {};
        if (!c.id) return json({ error: "missing_id" });
        const { data, error } = await supabase
          .from("surveys")
          .update({
            title: c.title ?? "",
            choice_question_count: c.choiceQuestionCount ?? 0,
            choices_per_question: c.choicesPerQuestion ?? 2,
            text_question_count: c.textQuestionCount ?? 0,
            questions: c.questions ?? [],
            start_at: c.startAt || null,
            end_at: c.endAt || null,
            manual_status: c.manualStatus || "auto",
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id)
          .select()
          .single();
        if (error) return json({ error: "db_error", detail: error.message });
        return json({ survey: data });
      }

      case "activate_survey": {
        const id = payload && payload.id;
        if (!id) return json({ error: "missing_id" });
        await supabase.from("surveys").update({ is_active: false }).neq("id", id);
        const { data, error } = await supabase
          .from("surveys").update({ is_active: true }).eq("id", id).select().single();
        if (error) return json({ error: "db_error", detail: error.message });
        return json({ survey: data });
      }

      case "deactivate_survey": {
        const id = payload && payload.id;
        if (!id) return json({ error: "missing_id" });
        const { data, error } = await supabase
          .from("surveys").update({ is_active: false }).eq("id", id).select().single();
        if (error) return json({ error: "db_error", detail: error.message });
        return json({ survey: data });
      }

      case "delete_survey": {
        const id = payload && payload.id;
        if (!id) return json({ error: "missing_id" });
        const { error } = await supabase.from("surveys").delete().eq("id", id);
        if (error) return json({ error: "db_error", detail: error.message });
        return json({ ok: true });
      }

      case "get_survey_results": {
        const id = payload && payload.id;
        if (!id) return json({ error: "missing_id" });
        const [{ data: survey, error: sErr }, { data: responses, error: rErr }, { data: draw, error: dErr }] =
          await Promise.all([
            supabase.from("surveys").select("*").eq("id", id).single(),
            supabase.from("responses").select("*").eq("survey_id", id).order("submitted_at", { ascending: true }),
            supabase.from("draws").select("*").eq("survey_id", id).maybeSingle(),
          ]);
        if (sErr) return json({ error: "db_error", detail: sErr.message });
        if (rErr) return json({ error: "db_error", detail: rErr.message });
        if (dErr) return json({ error: "db_error", detail: dErr.message });
        return json({ survey, responses, draw: draw || null });
      }

      case "delete_response": {
        const id = payload && payload.id;
        if (!id) return json({ error: "missing_id" });
        const { error } = await supabase.from("responses").delete().eq("id", id);
        if (error) return json({ error: "db_error", detail: error.message });
        return json({ ok: true });
      }

      case "reset_responses": {
        const surveyId = payload && payload.survey_id;
        if (!surveyId) return json({ error: "missing_survey_id" });
        const { error } = await supabase.from("responses").delete().eq("survey_id", surveyId);
        if (error) return json({ error: "db_error", detail: error.message });
        await supabase.from("draws").delete().eq("survey_id", surveyId);
        return json({ ok: true });
      }

      case "draw_winners": {
        const surveyId = payload && payload.survey_id;
        const count = Math.max(1, parseInt((payload && payload.count) || "1", 10));
        if (!surveyId) return json({ error: "missing_survey_id" });

        const { data: responses, error: rErr } = await supabase
          .from("responses").select("nickname").eq("survey_id", surveyId);
        if (rErr) return json({ error: "db_error", detail: rErr.message });

        const seen = new Set<string>();
        const pool: string[] = [];
        (responses || []).forEach((r: any) => {
          const key = String(r.nickname || "").trim();
          const lower = key.toLowerCase();
          if (key && !seen.has(lower)) { seen.add(lower); pool.push(key); }
        });

        const winners = shuffle(pool).slice(0, Math.min(count, pool.length));

        const { data, error } = await supabase
          .from("draws")
          .upsert(
            { survey_id: surveyId, winner_count: count, winners, drawn_at: new Date().toISOString() },
            { onConflict: "survey_id" },
          )
          .select()
          .single();
        if (error) return json({ error: "db_error", detail: error.message });
        return json({ draw: data, pool_size: pool.length });
      }

      default:
        return json({ error: "unknown_action" });
    }
  } catch (e) {
    return json({ error: "server_error", detail: String(e) });
  }
});
