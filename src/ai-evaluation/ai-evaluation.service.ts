import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValuateDeviceDto } from './dto/valuate-device.dto';
import { DevicePrice } from './entities/device-price.entity';

export interface AiValuationResult {
  condition_score: number;
  market_value_pen: number;
  resale_value_pen: number;
  max_loan_pen: number;
  depreciation_factors: string[];
  confidence: number;
  reasoning: string;
  visual_condition: string;
  device_match_valid: boolean;
  match_rejection_reason?: string;
}

@Injectable()
export class AiEvaluationService {
  private readonly logger = new Logger(AiEvaluationService.name);
  private readonly groqKey: string;
  private readonly isMock: boolean;
  private readonly meliClientId: string;
  private readonly meliClientSecret: string;
  /** Cached app token (client_credentials) + its expiry as epoch ms. */
  private meliAccessToken: string | null = null;
  private meliTokenExpiresAt = 0;

  constructor(
    @InjectRepository(DevicePrice) private readonly priceRepo: Repository<DevicePrice>,
  ) {
    this.groqKey = process.env.GROQ_API_KEY ?? '';
    this.isMock = !this.groqKey || this.groqKey.includes('REEMPLAZAR') || this.groqKey.trim() === '';
    this.meliClientId = process.env.MELI_CLIENT_ID ?? '';
    this.meliClientSecret = process.env.MELI_CLIENT_SECRET ?? '';
    if (this.isMock) {
      this.logger.warn('GROQ_API_KEY no configurada — la valuación con IA NO funcionará. Obtén una key gratis en console.groq.com');
    }
    if (!this.meliClientId || !this.meliClientSecret) {
      this.logger.warn('MELI_CLIENT_ID/SECRET no configurados — precios desde estimación LLM en vez de listings reales de MercadoLibre Perú');
    }
  }

  async valuateDevice(dto: ValuateDeviceDto): Promise<AiValuationResult> {
    if (this.isMock) {
      throw new Error('GROQ_API_KEY no configurada — la valuación con IA no está disponible.');
    }

    const webPrices = await this.fetchPricesViaWebSearch(dto);
    const photoKBs = dto.photos.map((p) => Math.round(p.length / 1024));
    this.logger.log(`AI valuate — ${dto.photos.length} fotos [${photoKBs.join(', ')} KB], web price ref: S/${Math.round(webPrices.min)}–${Math.round(webPrices.max)}, modelo: llama-4-scout (vision) / llama-3.3-70b (texto)`);

    // Attempt 1: with photos (vision)
    try {
      return await this.callGroq(dto, webPrices, dto.photos);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      // 429 = rate limit, 413 = payload too large (photos too heavy) → retry without photos
      if (status !== 429 && status !== 413) throw err;
      this.logger.warn(`Groq ${status} con fotos — reintentando sin imágenes`);
    }

    // Attempt 2: text-only (mark as fallback so device_match_valid isn't forced false)
    try {
      return await this.callGroq(dto, webPrices, [], true);
    } catch (err: unknown) {
      // No mock fallback on purpose: an invented price could massively over-value the
      // device (e.g. a S/600 item priced at S/3500) and cause real loss. If the AI
      // can't value it, the valuation fails — that's safer than a fabricated number.
      this.logger.warn('Groq valuation failed (no mock fallback) — surfacing the error');
      throw err;
    }
  }

  async ping(): Promise<{ ok: boolean; model: string; response?: string; error?: string }> {
    if (this.isMock) return { ok: false, model: 'mock', error: 'GROQ_API_KEY no configurada' };
    try {
      const res = await this.groqChat('llama-3.3-70b-versatile', [
        { role: 'user', content: 'Responde solo con la palabra: OK' },
      ]);
      return { ok: true, model: 'llama-3.3-70b-versatile', response: res.slice(0, 50) };
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      return { ok: false, model: 'llama-3.3-70b-versatile', error: `${e.status ?? '?'}: ${e.message ?? String(err)}` };
    }
  }

  // ── Groq call ────────────────────────────────────────────────────────────────

  private async callGroq(
    dto: ValuateDeviceDto,
    ml: { min: number; max: number; avg: number },
    photos: string[],
    /** True when this is a text-only retry after a rate-limited vision attempt */
    textOnlyFallback = false,
  ): Promise<AiValuationResult> {
    const specsText = this.buildSpecsText(dto, ml, photos.length);

    type ContentPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };

    const PHOTO_LABELS = ['Vista frontal del dispositivo', 'Vista trasera del dispositivo', 'Vista general del dispositivo'];
    const content: ContentPart[] = [{ type: 'text', text: specsText }];
    for (let i = 0; i < photos.length; i++) {
      content.push({ type: 'text', text: `--- ${PHOTO_LABELS[i] ?? `Foto ${i + 1}`} ---` });
      content.push({ type: 'image_url', image_url: { url: photos[i] } });
    }

    const model = photos.length > 0 ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';
    const raw = await this.groqChat(model, [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content },
    ]);

    const json = JSON.parse(raw) as Partial<AiValuationResult>;

    let resale  = Math.max(0, Number(json.resale_value_pen)  || 0);
    let market  = Math.max(0, Number(json.market_value_pen)  || 0);

    // Market = the representative real price (the median on MercadoLibre). The
    // absolute-cheapest listing is often bait or a typo, so the median is more honest
    // than the floor. Resale is ALWAYS a fraction of market by condition (a quick-sale
    // recovery value), so even "excelente" stays below market. The resale share uses
    // the WORSE of the user-declared condition and the one the AI sees — anti-overvaluation.
    // Shares: excelente 70% / bueno 55% / regular 40% / malo 30%.
    if (ml.min > 0) {
      const rank = (c: string): number =>
        ({ excelente: 4, bueno: 3, regular: 2, malo: 1 } as Record<string, number>)[c] ?? 0;
      const detected = String(json.visual_condition || '').toLowerCase();
      // Use the AI-detected condition only when it's valid AND worse than declared.
      const effectiveCondition =
        rank(detected) > 0 && rank(detected) < rank(dto.condition) ? detected : dto.condition;
      const condFactor = effectiveCondition === 'excelente' ? 0.70
        : effectiveCondition === 'bueno'    ? 0.55
        : effectiveCondition === 'regular'  ? 0.40
        : 0.30; // malo
      // C — low AI confidence → extra conservative discount (we trust the photos less).
      const confidence = Math.min(1, Math.max(0, Number(json.confidence) || 0.7));
      const confidenceFactor = confidence < 0.6 ? 0.90 : 1.0;
      // D — each detected depreciation factor shaves a bit off the resale, capped at -10%.
      const depCount = Array.isArray(json.depreciation_factors) ? json.depreciation_factors.length : 0;
      const depFactor = Math.max(0.90, 1 - depCount * 0.02);

      market = Math.round(ml.avg > 0 ? ml.avg : ml.min); // representative price (median on MercadoLibre)
      resale = Math.round(market * condFactor * confidenceFactor * depFactor); // quick-sale recovery value
      this.logger.log(`Price cap — market S/${market} (avg of S/${Math.round(ml.min)}–${Math.round(ml.max)}), cond ${effectiveCondition} ${Math.round(condFactor * 100)}%, conf ${confidence.toFixed(2)}→×${confidenceFactor}, dep ${depCount}→×${depFactor.toFixed(2)} → resale S/${resale}`);
    }

    return {
      condition_score:      Math.min(10, Math.max(0, Number(json.condition_score) || 7)),
      market_value_pen:     market,
      resale_value_pen:     resale,
      // Max loan = full resale value: that's what we could recover by reselling
      // the device, so it's the most attractive offer we can responsibly make.
      max_loan_pen:         Math.round(resale),
      depreciation_factors: Array.isArray(json.depreciation_factors)
        ? (json.depreciation_factors as string[]).slice(0, 5)
        : [],
      confidence:           Math.min(1, Math.max(0, Number(json.confidence) || 0.7)),
      reasoning:            String(json.reasoning || ''),
      visual_condition:     String(json.visual_condition || dto.condition),
      // In text-only fallback the AI can't see photos → don't penalise the user
      // for a rate-limit retry; treat identity as unverifiable rather than invalid.
      device_match_valid: textOnlyFallback && dto.photos.length > 0
        ? true
        : json.device_match_valid === true,
      match_rejection_reason: (!textOnlyFallback || dto.photos.length === 0) && !json.device_match_valid
        ? (json.match_rejection_reason ? String(json.match_rejection_reason) : undefined)
        : undefined,
    };
  }

  private async groqChat(
    model: string,
    messages: { role: string; content: unknown }[],
  ): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.groqKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 1024,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Groq ${res.status}: ${body.slice(0, 200)}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '{}';
  }

  // Plain chat (no json_object format — used for the knowledge price estimate)
  private async groqChatRaw(
    model: string,
    messages: { role: string; content: unknown }[],
  ): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.groqKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 256, temperature: 0 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }

  // ── Market price (MercadoLibre + LLM knowledge fallback) + per-model cache ───

  /** Normalized cache key for a device's market price. */
  private priceCacheKey(dto: ValuateDeviceDto): string {
    return [dto.brand, dto.model, dto.manufacture_year, dto.ram, dto.storage]
      .map((s) => String(s ?? '').trim().toLowerCase())
      .join('|');
  }

  /** Lazy per-model price cache: reuse a stored market price (within TTL) before
   *  hitting Groq, so the same device always values consistently and we save calls.
   *  Only the market reference is cached — photo/condition analysis runs per device. */
  private async fetchPricesViaWebSearch(
    dto: ValuateDeviceDto,
  ): Promise<{ min: number; max: number; avg: number }> {
    const PRICE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
    const key = this.priceCacheKey(dto);

    let existing: DevicePrice | null = null;
    try {
      existing = await this.priceRepo.findOne({ where: { cache_key: key } });
      if (existing) {
        const age = Date.now() - new Date(existing.updated_at).getTime();
        if (age < PRICE_TTL_MS) {
          const cached = { min: Number(existing.min_pen), max: Number(existing.max_pen), avg: Number(existing.avg_pen) };
          this.logger.log(`price cache HIT — ${key} → S/${cached.min}–${cached.max} avg ${cached.avg}`);
          return cached;
        }
      }
    } catch {
      // Cache read failed (e.g. table not ready) — fall through to a live fetch.
    }

    const live = await this.computeLivePrices(dto);

    if (live.min > 0) {
      try {
        await this.priceRepo.save({
          ...(existing ? { id: existing.id } : {}),
          cache_key: key,
          min_pen: live.min,
          max_pen: live.max,
          avg_pen: live.avg,
        });
        this.logger.log(`price cache STORE — ${key} → S/${live.min}–${live.max} avg ${live.avg}`);
      } catch {
        // Cache write failed — non-fatal, the valuation still proceeds.
      }
    }
    return live;
  }

  /** Real Peruvian market price. Prefers actual MercadoLibre listings; falls back to
   *  the LLM's knowledge estimate (biased conservative) when MELI isn't available. */
  private async computeLivePrices(
    dto: ValuateDeviceDto,
  ): Promise<{ min: number; max: number; avg: number }> {
    // 1. Real listings from MercadoLibre Perú — the source of truth when available.
    const meli = await this.searchMercadoLibrePrice(dto);
    if (meli.min > 0) return meli;

    // 2. Fallback — the LLM's training-data estimate. (The agentic web search was
    // removed: it was inconsistent and routinely 413'd, adding latency for nothing.)
    const knowledge = await this.estimatePriceFromKnowledge(dto);
    if (knowledge.min <= 0 && knowledge.avg <= 0) return knowledge; // nothing usable

    const min = knowledge.min > 0 ? knowledge.min : knowledge.avg;
    const max = knowledge.max > 0 ? knowledge.max : Math.max(min, knowledge.avg);
    const baseAvg = knowledge.avg > 0 ? knowledge.avg : (min + max) / 2;
    // The LLM tends to overestimate, so the headline market value = midpoint between
    // the low end and the average (conservative). MELI, when available, uses its real median.
    const avg = Math.round((min + baseAvg) / 2);

    this.logger.log(`price (LLM) — knowledge S/${Math.round(min)}–${Math.round(max)} avg S/${Math.round(baseAvg)} → market S/${avg}`);
    return { min: Math.round(min), max: Math.round(max), avg };
  }

  /** Returns a valid MercadoLibre app token via client_credentials, cached in memory
   *  until it nears expiry. Renewed automatically — no refresh token needed.
   *  Returns null if credentials aren't configured. */
  private async getMeliAccessToken(): Promise<string | null> {
    if (!this.meliClientId || !this.meliClientSecret) return null;
    const now = Date.now();
    if (this.meliAccessToken && this.meliTokenExpiresAt > now + 60_000) return this.meliAccessToken;
    try {
      const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.meliClientId,
          client_secret: this.meliClientSecret,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`MELI token ${res.status} — revisa MELI_CLIENT_ID/SECRET`);
        return null;
      }
      const data = (await res.json()) as { access_token: string; expires_in?: number };
      this.meliAccessToken = data.access_token;
      this.meliTokenExpiresAt = now + (data.expires_in ?? 21600) * 1000;
      this.logger.log('MELI access token obtained (client_credentials)');
      return this.meliAccessToken;
    } catch (err) {
      this.logger.warn(`MELI token request failed: ${String(err).slice(0, 100)}`);
      return null;
    }
  }

  /** Real Peruvian prices from MercadoLibre (site MPE). Returns {0,0,0} if unavailable,
   *  so the caller falls back to the LLM estimate. Uses the MEDIAN of real used-item
   *  listings as the representative price. */
  private async searchMercadoLibrePrice(
    dto: ValuateDeviceDto,
  ): Promise<{ min: number; max: number; avg: number }> {
    const token = await this.getMeliAccessToken();
    if (!token) return { min: 0, max: 0, avg: 0 };
    try {
      const q = encodeURIComponent(`${dto.brand} ${dto.model} ${dto.ram} ${dto.storage}`.replace(/\s+/g, ' ').trim());
      const url = `https://api.mercadolibre.com/sites/MPE/search?q=${q}&condition=used&limit=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        this.logger.debug(`MercadoLibre ${res.status} — falling back to LLM pricing`);
        return { min: 0, max: 0, avg: 0 };
      }
      const data = (await res.json()) as { results?: { price?: number; currency_id?: string }[] };
      const prices = (data.results ?? [])
        .filter((r) => (r.currency_id ?? 'PEN') === 'PEN')
        .map((r) => Number(r.price))
        .filter((p) => p > 0)
        .sort((a, b) => a - b);
      if (prices.length < 3) return { min: 0, max: 0, avg: 0 }; // too few listings to trust
      const at = (qt: number) => prices[Math.min(prices.length - 1, Math.floor(prices.length * qt))];
      const min = Math.round(at(0.10)); // low but realistic (skip absolute-bottom outliers)
      const avg = Math.round(at(0.50)); // median
      const max = Math.round(at(0.90));
      this.logger.log(`MercadoLibre MPE (${prices.length} listings) — S/${min}–${max} avg ${avg}`);
      return { min, max, avg };
    } catch (err) {
      this.logger.debug(`MercadoLibre fetch failed: ${String(err).slice(0, 100)}`);
      return { min: 0, max: 0, avg: 0 };
    }
  }

  private async estimatePriceFromKnowledge(
    dto: ValuateDeviceDto,
  ): Promise<{ min: number; max: number; avg: number }> {
    try {
      const specs = `${dto.brand} ${dto.model} ${dto.manufacture_year} ${dto.ram} ${dto.storage}`;
      const raw = await this.groqChatRaw('llama-3.3-70b-versatile', [
        {
          role: 'user',
          content:
            `Estima el precio de un "${specs}" USADO y funcional, en buen estado, en el mercado de segunda mano de Perú. ` +
            `Es exactamente esta configuración (${dto.ram} de RAM, ${dto.storage}): no asumas variantes con más RAM o almacenamiento, que son más caras. ` +
            `Considera una unidad COMPLETA (no repuestos, no dañados, no nueva sellada). El precio usado en Perú es MUCHO menor al precio nuevo o internacional: aplica una depreciación fuerte y, ante la duda, SUBESTIMA antes que sobreestimar. ` +
            `Responde SOLO con este JSON sin markdown:\n` +
            `{"min_price_pen":número_entero,"max_price_pen":número_entero,"avg_price_pen":número_entero}`,
        },
      ]);
      const match = raw.match(/\{[^{}]+\}/);
      if (!match) return { min: 0, max: 0, avg: 0 };
      const json = JSON.parse(match[0]) as { min_price_pen?: unknown; max_price_pen?: unknown; avg_price_pen?: unknown };
      const min = Math.max(0, Number(json.min_price_pen) || 0);
      const max = Math.max(0, Number(json.max_price_pen) || 0);
      const avg = Math.max(0, Number(json.avg_price_pen) || 0);
      if (min > 0) this.logger.log(`LLM knowledge price — S/ ${min}–${max} avg ${avg}`);
      return { min, max, avg };
    } catch {
      return { min: 0, max: 0, avg: 0 };
    }
  }

  // ── Prompts ──────────────────────────────────────────────────────────────────

  private systemPrompt(): string {
    return `Eres un auditor técnico experto en valuación de dispositivos electrónicos para Jemacash, \
una fintech peruana que otorga préstamos con garantía tecnológica.

Tu objetivo es estimar el precio MÁS CONSERVADOR posible basándote en el precio más barato \
disponible en el mercado peruano de segunda mano (OLX, Facebook Marketplace, Mercado Libre). \
NUNCA sobrevalores un dispositivo: si hay duda, usa el precio más bajo.

REGLA CRÍTICA DE PRECIO POR CONDICIÓN (obligatoria):
- Condición "excelente": resale_value_pen puede estar cerca del precio mínimo web.
- Condición "bueno": resale_value_pen debe ser un 25-35% MENOR al precio mínimo web.
- Condición "regular": resale_value_pen debe ser un 45-55% MENOR al precio mínimo web.
El sistema aplica un techo automático por condición; si no hay referencia web, aplica el mismo descuento sobre tu estimación base.
NUNCA devuelvas el mismo precio para condiciones distintas.

VALIDACIÓN DE IDENTIDAD DEL DISPOSITIVO (obligatoria):
- Analiza CADA foto etiquetada y verifica que el dispositivo mostrado corresponde a la marca y modelo declarados.
- La foto "Vista frontal" debe mostrar el dispositivo desde el frente. Verifica que el diseño coincide con el modelo declarado.
- La foto "Vista trasera" debe mostrar la parte trasera. Verifica logotipos y forma física.
- La foto "Vista general" debe mostrar el dispositivo completo. Confirma que es el mismo dispositivo.
- Si las fotos muestran claramente un dispositivo DIFERENTE al declarado, o si las fotos son de baja calidad y NO permiten verificar el modelo, establece "device_match_valid": false y explica la razón.
- Si las fotos son consistentes con el dispositivo declarado, establece "device_match_valid": true.
- Sin fotos: "device_match_valid" debe ser false.

RESPONDE ÚNICAMENTE con JSON válido sin markdown, con estas claves:
{
  "condition_score": número del 0 al 10,
  "market_value_pen": número entero en soles (precio típico mercado peruano segunda mano),
  "resale_value_pen": número entero (precio más bajo posible — igual o menor al precio mínimo web),
  "depreciation_factors": array de strings con factores que reducen el valor (máximo 5, en español),
  "confidence": número del 0 al 1,
  "reasoning": string de máximo 2 oraciones,
  "visual_condition": "excelente" | "bueno" | "regular" | "malo",
  "device_match_valid": true o false,
  "match_rejection_reason": string con la razón si device_match_valid es false, o null si es true
}`;
  }

  private buildSpecsText(
    dto: ValuateDeviceDto,
    ml: { min: number; max: number; avg: number },
    photoCount: number,
  ): string {
    const mlLine = ml.min > 0
      ? `PRECIO WEB (referencia obligatoria):
  - Precio MÁS BARATO encontrado: S/ ${Math.round(ml.min)} ← usa esto como techo para resale_value_pen
  - Precio típico: S/ ${Math.round(ml.max)} (promedio S/ ${Math.round(ml.avg)})
  - RESTRICCIÓN: resale_value_pen NO puede superar S/ ${Math.round(ml.min)}`
      : 'Sin referencia web — estima de forma muy conservadora usando el mercado informal peruano.';

    return `Analiza este dispositivo para valuación de garantía de préstamo:

ESPECIFICACIONES:
- Categoría: ${dto.device_category}
- Marca / Modelo: ${dto.brand} ${dto.model}
- Año: ${dto.manufacture_year}
- Procesador: ${dto.processor}
- RAM: ${dto.ram}
- Almacenamiento: ${dto.storage}${dto.battery_health ? `\n- Salud batería: ${dto.battery_health}%` : ''}
- Condición declarada: ${dto.condition}
- Reacondicionado: ${dto.is_reconditioned ? 'Sí' : 'No'}

REFERENCIA DE MERCADO:
${mlLine}

${photoCount > 0
  ? `Se adjuntan ${photoCount} foto(s) etiquetadas del dispositivo (frontal, trasera, general). VERIFICA que cada foto muestra el mismo ${dto.brand} ${dto.model} declarado. Analiza daños físicos, desgaste y consistencia con la condición declarada.`
  : 'Sin fotos — valúa basándote en especificaciones y referencia web de precio. device_match_valid debe ser false porque no se puede verificar visualmente el dispositivo.'}`;
  }

}
