import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET")!;

// Agent IDs for routing logic
const BATCH_CALL_AGENT_ID = Deno.env.get("ELEVEN_AGENT_ID")!;
const IN_APP_CALL_AGENT_ID = Deno.env.get("ELEVEN_AGENT_ID_IN_APP")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
const tsecEq = (a: string, b: string) => a.length === b.length && [...a].reduce((v, ch, i) => v | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

// Robust mood score coercion: accept number/string, round & clamp to 1..5 range
const toIntScore1to5 = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);            // 4.5 → 5
  return r >= 1 && r <= 5 ? r : null; // honor DB CHECK (1..5)
};

// Normalize ElevenLabs status to our enum values - focus on call connection status only
function normalizeOutcome(
  s: string | null | undefined
): "answered" | "failed" | "missed" | "busy" {
  const v = (s ?? "").toLowerCase();

  // If call was completed/done, it means phone was answered regardless of criteria evaluation
  if (["done", "success", "successful", "completed", "ok"].includes(v)) {
    return "answered";
  }

  if (["cancelled", "canceled", "hangup", "hang-up", "no_answer"].includes(v)) return "missed";
  if (["busy"].includes(v)) return "busy";
  // "error","failed","timeout", etc. → treat as connection failed
  return "failed";
}

// Calculate criteria evaluation score separately
function calculateCriteriaScore(evaluationResults: any): { score: number, total: number, passed: string[], failed: string[] } {
  if (!evaluationResults || typeof evaluationResults !== 'object') {
    return { score: 0, total: 0, passed: [], failed: [] };
  }

  const passed: string[] = [];
  const failed: string[] = [];

  Object.entries(evaluationResults).forEach(([criterion, result]: [string, any]) => {
    if (result && typeof result === 'object') {
      if (result.result === 'success') {
        passed.push(criterion);
      } else if (result.result === 'failure') {
        failed.push(criterion);
      }
    }
  });

  return {
    score: passed.length,
    total: passed.length + failed.length,
    passed,
    failed
  };
}

async function validSignature(raw: string, sigHeader: string | null) {
  if (!sigHeader) return false;
  const m = sigHeader.match(/t=(\d+),\s*v0=([a-f0-9]+)/i);
  if (!m) return false;
  const ts = Number(m[1]);
  const supplied = `v0=${m[2]}`.toLowerCase();

  // reject stale (>30m)
  const now = Math.floor(Date.now()/1000);
  if (ts < now - 1800) return false;

  const key = await crypto.subtle.importKey("raw", enc.encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`));
  const expected = `v0=${toHex(mac)}`;
  return tsecEq(supplied, expected);
}

Deno.serve(async (req) => {
  const sig = req.headers.get("elevenlabs-signature");
  const rawText = await req.text();

  try {
    if (!(await validSignature(rawText, sig))) {
      return new Response("unauthorized", { status: 401 });
    }

    const payload = JSON.parse(rawText);
    const data = payload?.data ?? {};
    const meta = data?.metadata ?? {};
    const analysis = data?.analysis ?? {};
    const dc = analysis?.data_collection_results ?? {};
    const evaln = analysis?.evaluation_criteria_results ?? {};

    const provider_call_id: string | null = data?.conversation_id ?? null;
    const agent_id: string | null = data?.agent_id ?? null;
    const rawStatus = data?.status ?? null;
    const call_status = normalizeOutcome(rawStatus);
    const duration_secs: number | null = meta?.call_duration_secs ?? null;

    // ============== ROUTING LOGIC: One Webhook, Two Paths ==============
    // Determine if this is a batch call or in-app call based on agent_id
    const isBatchCall = agent_id === BATCH_CALL_AGENT_ID;
    const isInAppCall = agent_id === IN_APP_CALL_AGENT_ID;

    console.info("Webhook routing:", {
      agent_id,
      isBatchCall,
      isInAppCall,
      batch_agent_id: BATCH_CALL_AGENT_ID,
      in_app_agent_id: IN_APP_CALL_AGENT_ID
    });

    // Dynamic variables (may contain secrets)
    const dyn = data?.conversation_initiation_client_data?.dynamic_variables ?? {};
    let household_id: string | null =
      dyn["secret__household_id"] ?? dyn["secret__family_id"] ?? null;
    let relative_id: string | null =
      dyn["secret__relative_id"] ?? dyn["secret__elder_id"] ?? null;

    // For in-app calls, we may have session_id in dynamic variables instead
    const session_id = dyn["session_id"] ?? null;

    // Get phone number and potential batch ID from various possible locations
    let callee_phone: string | null =
      meta?.called_number ?? // For batch calls, ElevenLabs sends called_number
      meta?.callee_phone ??
      dyn["system__called_number"] ??
      data?.phone_number ??
      data?.recipient?.phone_number ??
      null;

    // Try to get batch ID for secure resolution - check multiple locations
    const batch_id = data?.batch_id ??
                     meta?.batch_id ??
                     data?.conversation_initiation_client_data?.batch_id ??
                     null;

    console.info("Webhook data extraction:", {
      provider_call_id,
      batch_id,
      called_number: meta?.called_number,
      callee_phone: meta?.callee_phone,
      has_dynamic_vars: Object.keys(dyn).length > 0,
      final_phone: callee_phone,
      raw_data_keys: Object.keys(data),
      raw_meta_keys: Object.keys(meta),
      call_status: data?.status || "unknown"
    });

    // ============== HANDLE FULL_AUDIO WEBHOOK (no metadata) ==============
    // ElevenLabs sends a separate webhook with only full_audio after call completion
    const isFullAudioWebhook = data?.full_audio && 
                               Object.keys(meta).length === 0 && 
                               !data?.status;
    
    if (isFullAudioWebhook && provider_call_id) {
      console.info("📼 FULL_AUDIO webhook detected - updating existing call log only:", {
        provider_call_id,
        has_audio: !!data.full_audio
      });

      // Determine provider for audio-only webhook (check agent_id if available)
      const audioWebhookProvider = (agent_id === IN_APP_CALL_AGENT_ID) ? "webrtc" : "elevenlabs";
      
      // Always insert raw audit
      await sb.from("webhook_events").insert({
        provider: audioWebhookProvider,
        provider_call_id,
        household_id: null,
        payload,
        signature: sig ?? null,
      });

      // Try to find and update existing call log with audio data
      const { data: existingLog } = await sb.from("call_logs")
        .select("id, household_id, relative_id")
        .eq("provider_call_id", provider_call_id)
        .maybeSingle();

      if (existingLog) {
        const audioBase64 = data.full_audio;
        
        // Update call_logs with audio if available
        if (audioBase64) {
          await sb.from("call_logs")
            .update({ audio_base64: audioBase64 })
            .eq("id", existingLog.id);

          console.info("✅ Updated call_logs with full_audio:", {
            call_log_id: existingLog.id,
            provider_call_id
          });
        }

        // Update call_summaries with audio if available
        if (audioBase64) {
          await sb.from("call_summaries")
            .update({ full_audio_base64: audioBase64 })
            .eq("provider_call_id", provider_call_id);

          console.info("✅ Updated call_summaries with full_audio:", {
            provider_call_id
          });
        }
      } else {
        console.warn("⚠️ FULL_AUDIO webhook but no existing call_logs found - ignoring:", {
          provider_call_id
        });
      }

      // Return success - this is a legitimate webhook type
      return new Response("ok-audio-only", { status: 200 });
    }

    // DUPLICATE WEBHOOK PROTECTION: Check if this call was already processed successfully
    if (!household_id && !relative_id && provider_call_id) {
      const { data: existingLog } = await sb.from("call_logs")
        .select("id, household_id, relative_id")
        .eq("provider_call_id", provider_call_id)
        .not("household_id", "is", null)
        .not("relative_id", "is", null)
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        console.info("✅ DUPLICATE PROTECTION: Using existing call log data:", {
          provider_call_id,
          existing_household_id: existingLog[0].household_id,
          existing_relative_id: existingLog[0].relative_id
        });
        household_id = existingLog[0].household_id;
        relative_id = existingLog[0].relative_id;
      }
    }

    // ============== RESOLUTION LOGIC: Route by Call Type ==============
    // For in-app calls: try session-based resolution first
    if (isInAppCall && !household_id && !relative_id) {
      console.info("🔍 IN-APP CALL: Attempting resolution via conversation_id lookup");
      
      // CRITICAL: elevenlabs-device-call stores conversation_id in provider_call_id field with provider='webrtc'
      // So we lookup using provider_call_id field with webrtc provider
      
      if (provider_call_id) {
        const { data: existingCallLog } = await sb.from("call_logs")
          .select("household_id, relative_id, session_id")
          .eq("provider_call_id", provider_call_id) // 👈 Changed from conversation_id to provider_call_id
          .eq("provider", "webrtc") // Match the provider set by elevenlabs-device-call
          .eq("call_type", "in_app_call")
          .maybeSingle();

        if (existingCallLog) {
          household_id = existingCallLog.household_id;
          relative_id = existingCallLog.relative_id;
          console.info("✅ IN-APP: Found existing call log via conversation_id:", {
            conversation_id: provider_call_id,
            household_id,
            relative_id,
            session_id: existingCallLog.session_id
          });
        } else {
          console.warn("⚠️ IN-APP: No call_logs found for conversation_id:", provider_call_id);
        }
      }
      
      // Fallback: Try to extract session_id from conversation_id pattern
      if (!household_id && !relative_id) {
        const extracted_session_id = session_id ||
          (provider_call_id && provider_call_id.includes('session_') ?
           provider_call_id.split('session_')[1]?.split('_')[0] : null);

        if (extracted_session_id) {
          console.info("Attempting session-based resolution for in-app call:", {
            session_id: extracted_session_id,
            provider_call_id
          });

          const { data: sessionData } = await sb.from("call_sessions")
            .select("household_id, relative_id")
            .eq("id", extracted_session_id)
            .maybeSingle();

          if (sessionData) {
            household_id = sessionData.household_id;
            relative_id = sessionData.relative_id;
            console.info("✅ IN-APP: Session resolved successfully:", {
              session_id: extracted_session_id,
              relative_id,
              household_id,
              provider_call_id
            });
          } else {
            console.warn("No session found for in-app call:", {
              session_id: extracted_session_id,
              provider_call_id
            });
          }
        } else {
          // Final fallback: try to find recent in-app session without session_id
          console.info("No session_id found, attempting recent session fallback for in-app call");

          const { data: recentSessions } = await sb.from("call_sessions")
            .select("household_id, relative_id, id")
            .eq("provider", "webrtc")
            .eq("call_type", "in_app_call")
            .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
            .order("created_at", { ascending: false })
            .limit(1);

          if (recentSessions && recentSessions.length > 0) {
            const recentSession = recentSessions[0];
            household_id = recentSession.household_id;
            relative_id = recentSession.relative_id;
            console.info("✅ IN-APP FALLBACK: Recent session resolved:", {
              session_id: recentSession.id,
              relative_id,
              household_id,
              provider_call_id
            });
          }
        }
      }
    }

    // SECURE RESOLUTION: First try batch mapping (most secure) - for batch calls
    if (isBatchCall && !household_id && !relative_id && batch_id && callee_phone) {
      console.info("Attempting secure batch mapping resolution:", { batch_id, callee_phone });

      const { data: batchMapping } = await sb.from("batch_call_mappings")
        .select("household_id, relative_id, phone_number")
        .eq("batch_id", batch_id)
        .eq("phone_number", callee_phone)
        .maybeSingle();

      if (batchMapping) {
        household_id = batchMapping.household_id;
        relative_id = batchMapping.relative_id;

        // Update mapping with resolved provider_call_id
        await sb.from("batch_call_mappings")
          .update({
            provider_call_id,
            resolved_at: new Date().toISOString()
          })
          .eq("batch_id", batch_id)
          .eq("phone_number", callee_phone);

        console.info("✅ SECURE: Batch mapping resolved successfully:", {
          relative_id,
          household_id,
          batch_id,
          callee_phone
        });
      } else {
        console.warn("No batch mapping found for:", { batch_id, callee_phone });
      }
    }

    // ENHANCED RESOLUTION: Try to match provider_call_id pattern with batch_id - for batch calls only
    if (isBatchCall && !household_id && !relative_id && provider_call_id && callee_phone) {
      console.info("Attempting provider_call_id pattern matching:", { provider_call_id, callee_phone });

      // Look for recent batch mappings for this phone that don't have provider_call_id yet
      const { data: pendingMappings } = await sb.from("batch_call_mappings")
        .select("batch_id, household_id, relative_id, phone_number")
        .eq("phone_number", callee_phone)
        .is("provider_call_id", null)
        .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingMappings && pendingMappings.length > 0) {
        // Use the most recent mapping for this phone number
        const mapping = pendingMappings[0];
        household_id = mapping.household_id;
        relative_id = mapping.relative_id;

        // Update the mapping with this provider_call_id
        await sb.from("batch_call_mappings")
          .update({
            provider_call_id,
            resolved_at: new Date().toISOString()
          })
          .eq("batch_id", mapping.batch_id)
          .eq("phone_number", callee_phone);

        console.info("✅ PATTERN MATCH: Recent batch mapping resolved:", {
          relative_id,
          household_id,
          matched_batch_id: mapping.batch_id,
          callee_phone
        });
      } else {
        console.warn("No recent pending batch mappings found for phone:", { callee_phone });
      }
    }

    // FALLBACK: Phone number resolution (with improved handling) - primarily for batch calls
    if (isBatchCall && !household_id && !relative_id && callee_phone) {
      console.info("Fallback: Resolving via phone number:", { callee_phone });

      // Check for duplicate phone numbers across households
      const { data: allMatches, error: searchErr } = await sb.from("relatives")
        .select("id, household_id, first_name, last_name")
        .eq("phone_e164", callee_phone);

      if (searchErr) {
        console.error("Error searching for phone number:", searchErr);
      } else if (!allMatches || allMatches.length === 0) {
        console.error("Could not resolve phone number to any relative:", { callee_phone });
      } else if (allMatches.length > 1) {
        // Multiple households have same phone number
        const households = [...new Set(allMatches.map(r => r.household_id))];
        console.warn("⚠️ Phone number exists in multiple households:", {
          callee_phone,
          matching_relatives: allMatches.map(r => ({
            relative_id: r.id,
            household_id: r.household_id,
            name: `${r.first_name} ${r.last_name}`
          })),
          affected_households: households,
          count: allMatches.length,
          has_batch_context: !!batch_id
        });

        // For batch calls, use the first match (scheduled calls are typically legitimate)
        // For non-batch calls without context, we can still proceed but log the ambiguity
        if (batch_id || call_status === "answered") {
          const rel = allMatches[0]; // Use first match for batch or answered calls
          relative_id = rel.id;
          household_id = rel.household_id;
          console.warn("⚠️ PROCEEDING WITH AMBIGUOUS PHONE: Using first match for batch/answered call:", {
            relative_id,
            household_id,
            relative_name: `${rel.first_name} ${rel.last_name}`,
            reason: batch_id ? "batch_call" : "answered_call"
          });
        } else {
          console.error("❌ AMBIGUOUS PHONE: Multiple households and no batch context - storing audit only");
        }
      } else {
        // Safe: exactly one match found
        const rel = allMatches[0];
        relative_id = rel.id;
        household_id = rel.household_id;
        console.info("✅ FALLBACK: Phone number safely resolved to single match:", {
          relative_id,
          household_id,
          relative_name: `${rel.first_name} ${rel.last_name}`
        });
      }
    }

    // Observability: log status normalization
    console.info("EL status raw→normalized", rawStatus, "→", call_status);

    console.info("EL parsed", {
      conv: provider_call_id,
      status: call_status,
      hasDC: !!dc && Object.keys(dc).length > 0,
      hasEval: !!evaln && Object.keys(evaln).length > 0,
      duration: duration_secs
    });

    // Determine provider based on call type
    const webhookProvider = isInAppCall ? "webrtc" : "elevenlabs";
    
    // 1) Always insert raw audit first (non-blocking)
    await sb.from("webhook_events").insert({
      provider: webhookProvider,
      provider_call_id,
      household_id,
      payload,
      signature: sig ?? null,
    });

    // Guard: skip call_logs/call_summaries if essential data is missing
    if (!provider_call_id) {
      console.warn("No provider_call_id found, skipping call_logs/call_summaries upserts");
      return new Response("ok", { status: 200 });
    }

    if (!relative_id || !household_id) {
      console.error("SECURITY: Missing relative_id or household_id - cannot safely store call data", {
        provider_call_id,
        relative_id,
        household_id,
        callee_phone,
        dynamic_variables: dyn
      });
      // Return 200 OK to prevent webhook retries, but don't store call data
      return new Response("missing-identifiers", { status: 200 });
    }

    // Log successful identification for audit
    console.info("Call data will be stored for:", {
      provider_call_id,
      relative_id,
      household_id,
      source: dyn["secret__relative_id"] ? "dynamic_variables" : "phone_fallback"
    });

    // Extract audio data if available (need this before call_logs upsert)
    const audioUrl = data?.audio_url ?? meta?.audio_url ?? null;
    const audioBase64 = data?.audio_base64 ?? data?.full_audio ?? null;

    // 2) upsert call_logs with composite conflict resolution
    const occurred_at =
      typeof meta?.start_time_unix_secs === "number"
        ? new Date(meta.start_time_unix_secs * 1000).toISOString()
        : new Date().toISOString();

    // Use webrtc provider for in-app calls to match elevenlabs-device-call
    const logProvider = webhookProvider; // webrtc for in-app, elevenlabs for batch
    const callType = isInAppCall ? "in_app_call" : "batch_call";

    const { data: upLog, error: logErr } = await sb.from("call_logs")
      .upsert({
        provider: logProvider,
        provider_call_id,
        user_id: relative_id, // Now guaranteed to be non-null
        household_id: household_id, // Now guaranteed to be non-null
        relative_id: relative_id, // Now guaranteed to be non-null
        call_type: callType,
        call_outcome: call_status,
        call_duration: duration_secs,
        emergency_flag: !!dc?.emergency_flag,
        health_concerns_detected: !!(dc?.flag_fall_risk || dc?.flag_low_appetite || dc?.flag_confused),
        audio_recording_url: audioUrl,
        session_id: isInAppCall ? session_id : null,
        // 👈 Removed conversation_id field to avoid schema cache error
        timestamp: occurred_at
      }, { onConflict: "provider,provider_call_id" })
      .select("id")
      .single();
    if (logErr) console.error("call_logs upsert error", logErr);

    // 3) upsert summaries with provider_call_id conflict resolution
    const coerced = toIntScore1to5(dc?.mood_score);
    if (coerced === null && dc?.mood_score != null) {
      console.info("EL mood_score coerced→null (out of range / NaN)", dc?.mood_score);
    }
    const moodScore = coerced;

    // Extract detailed summary from ElevenLabs analysis (following ElevenLabs docs)
    const detailedSummary = data?.summary ?? analysis?.summary ?? null;
    const tlDr = analysis?.transcript_summary ?? detailedSummary ?? null;
    const transcriptUrl = meta?.transcript_url ?? null;
    
    // Extract call success status from ElevenLabs analysis
    const callSuccessful = analysis?.call_successful ?? null;

    // Extract notes and highlights from data collection
    const notes = dc?.notes ?? null;
    const highlight = dc?.highlight_one_line ?? null;

    // Calculate criteria evaluation score
    const criteriaEval = calculateCriteriaScore(evaln);

    // Determine mood text based on score or extract from flags
    let moodText = null;
    if (moodScore) {
      if (moodScore >= 4) moodText = 'positive';
      else if (moodScore >= 3) moodText = 'neutral';
      else moodText = 'concerning';
    } else if (dc?.flag_lonely || dc?.flag_confused || dc?.flag_fall_risk || dc?.flag_low_appetite) {
      moodText = 'concerning';
    }

    console.info("Summary data extracted:", {
      detailedSummary: !!detailedSummary,
      tlDr: !!tlDr,
      transcriptUrl: !!transcriptUrl,
      callSuccessful: callSuccessful,
      notes: !!notes,
      highlight: !!highlight,
      moodText,
      moodScore,
      criteriaScore: `${criteriaEval.score}/${criteriaEval.total}`
    });

    const { error: sumErr } = await sb.from("call_summaries")
      .upsert({
        provider: logProvider, // Use same provider as call_logs
        provider_call_id,
        call_log_id: upLog?.id ?? null,
        household_id: household_id ?? null,
        relative_id: relative_id ?? null,
        mood: moodText,
        mood_score: moodScore,
        key_points: {
          call_type: callType,
          agent_id: agent_id,
          session_id: isInAppCall ? session_id : null,
          data_collection: dc,
          evaluation: evaln,
          criteria_evaluation: {
            score: criteriaEval.score,
            total: criteriaEval.total,
            passed_criteria: criteriaEval.passed,
            failed_criteria: criteriaEval.failed,
            quality_rating: criteriaEval.total > 0 ? `${criteriaEval.score}/${criteriaEval.total}` : 'N/A'
          },
          notes,
          highlight,
          detailed_summary: detailedSummary,
          call_successful: callSuccessful, // 👈 Add ElevenLabs call success status
          audio_url: audioUrl,
          audio_base64: audioBase64
        },
        transcript_url: transcriptUrl,
        tl_dr: tlDr,
      }, { onConflict: "provider_call_id" });
    if (sumErr) console.error("call_summaries upsert error", sumErr);

    // Fast ACK: return 200 OK even if downstream inserts warn
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("elevenlabs-webhook error", e);
    // Fast ACK: return 200 OK even on errors to avoid excessive vendor retries
    return new Response("ok", { status: 200 });
  }
});
