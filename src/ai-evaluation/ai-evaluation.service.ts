import { Injectable, Logger } from '@nestjs/common';
import { ValuateDeviceDto } from './dto/valuate-device.dto';

export interface AiValuationResult {
  condition_score: number;
  market_value_pen: number;
  resale_value_pen: number;
  max_loan_pen: number;
  depreciation_factors: string[];
  confidence: number;
  reasoning: string;
  visual_condition: string;
}

@Injectable()
export class AiEvaluationService {
  private readonly logger = new Logger(AiEvaluationService.name);
  private readonly groqKey: string;
  private readonly isMock: boolean;

  constructor() {
    this.groqKey = process.env.GROQ_API_KEY ?? '';
    this.isMock = !this.groqKey || this.groqKey.includes('REEMPLAZAR') || this.groqKey.trim() === '';
    if (this.isMock) {
      this.logger.warn('GROQ_API_KEY no configurada — usando modo simulación. Obtén una key gratis en console.groq.com');
    }
  }

  async valuateDevice(dto: ValuateDeviceDto): Promise<AiValuationResult> {
    if (this.isMock) return this.mockValuation(dto);

    const webPrices = await this.fetchPricesViaWebSearch(dto);
    const photoKBs = dto.photos.map((p) => Math.round(p.length / 1024));
    this.logger.log(`AI valuate — ${dto.photos.length} fotos [${photoKBs.join(', ')} KB], web price ref: S/${Math.round(webPrices.min)}–${Math.round(webPrices.max)}, modelo: llama-4-scout (vision) / llama-3.3-70b (texto)`);

    // Attempt 1: with photos (vision)
    try {
      return await this.callGroq(dto, webPrices, dto.photos);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status !== 429) throw err;
      this.logger.warn('Groq 429 con fotos — reintentando sin imágenes');
    }

    // Attempt 2: text-only
    try {
      return await this.callGroq(dto, webPrices, []);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status !== 429) throw err;
      this.logger.warn('Groq 429 texto — cayendo a mock');
      return this.mockValuation(dto);
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
  ): Promise<AiValuationResult> {
    const specsText = this.buildSpecsText(dto, ml, photos.length);

    type ContentPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };

    const content: ContentPart[] = [{ type: 'text', text: specsText }];
    for (const photo of photos) {
      content.push({ type: 'image_url', image_url: { url: photo } });
    }

    const model = photos.length > 0 ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';
    const raw = await this.groqChat(model, [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content },
    ]);

    const json = JSON.parse(raw) as Partial<AiValuationResult>;

    let resale  = Math.max(0, Number(json.resale_value_pen)  || 0);
    let market  = Math.max(0, Number(json.market_value_pen)  || 0);

    // Hard price cap: if we have a web reference, the AI cannot value above
    // the cheapest price found + 5% tolerance (condition adjustments go DOWN, not up)
    if (ml.min > 0) {
      resale  = Math.min(resale,  Math.round(ml.min * 1.05));
      market  = Math.min(market,  Math.round(ml.min * 1.25));
      this.logger.log(`Price cap applied — web min: S/${Math.round(ml.min)}, capped resale: S/${resale}, market: S/${market}`);
    }

    return {
      condition_score:      Math.min(10, Math.max(0, Number(json.condition_score) || 7)),
      market_value_pen:     market,
      resale_value_pen:     resale,
      max_loan_pen:         Math.round(resale * 0.8),
      depreciation_factors: Array.isArray(json.depreciation_factors)
        ? (json.depreciation_factors as string[]).slice(0, 5)
        : [],
      confidence:           Math.min(1, Math.max(0, Number(json.confidence) || 0.7)),
      reasoning:            String(json.reasoning || ''),
      visual_condition:     String(json.visual_condition || dto.condition),
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
        temperature: 0.2,
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

  // Plain chat (no json_object format — used for compound-beta web search)
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
      body: JSON.stringify({ model, messages, max_tokens: 256, temperature: 0.1 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }

  // ── Web price search (Groq compound-beta) ────────────────────────────────────

  private async fetchPricesViaWebSearch(
    dto: ValuateDeviceDto,
  ): Promise<{ min: number; max: number; avg: number }> {
    // Step 1: live web search via compound-beta
    const webResult = await this.searchWebCheapestPrice(dto);
    if (webResult.min > 0) return webResult;

    // Step 2: fallback — ask llama-3.3-70b for its training-data knowledge of typical Peruvian prices
    return this.estimatePriceFromKnowledge(dto);
  }

  private async searchWebCheapestPrice(
    dto: ValuateDeviceDto,
  ): Promise<{ min: number; max: number; avg: number }> {
    try {
      const specs = `${dto.brand} ${dto.model} ${dto.manufacture_year} ${dto.ram} ${dto.storage}`;
      const raw = await this.groqChatRaw('compound-beta', [
        {
          role: 'user',
          content:
            `Busca en Google el precio MÁS BARATO de "${specs}" usado en Perú ahora mismo. ` +
            `Revisa OLX Perú, Mercado Libre Perú, Facebook Marketplace Perú, Juntoz, Linio. ` +
            `Necesito el precio MÍNIMO encontrado en listados activos. ` +
            `Responde SOLO con este JSON sin markdown:\n` +
            `{"min_price_pen":número_entero,"max_price_pen":número_entero,"avg_price_pen":número_entero}\n` +
            `Valores en soles peruanos (PEN). USD × 3.75 = PEN.`,
        },
      ]);
      const match = raw.match(/\{[^{}]+\}/);
      if (!match) return { min: 0, max: 0, avg: 0 };
      const json = JSON.parse(match[0]) as { min_price_pen?: unknown; max_price_pen?: unknown; avg_price_pen?: unknown };
      const min = Math.max(0, Number(json.min_price_pen) || 0);
      const max = Math.max(0, Number(json.max_price_pen) || 0);
      const avg = Math.max(0, Number(json.avg_price_pen) || 0);
      if (min === 0 && max === 0 && avg === 0) return { min: 0, max: 0, avg: 0 };
      this.logger.log(`compound-beta web price — S/ ${min}–${max} avg ${avg}`);
      return { min, max, avg };
    } catch (err) {
      this.logger.warn(`compound-beta search failed: ${String(err).slice(0, 100)}`);
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
            `¿Cuál es el precio más barato y el precio promedio de un "${specs}" usado en Perú (segunda mano)? ` +
            `Sé conservador y usa el precio más bajo posible del mercado peruano informal (OLX, Facebook, ML). ` +
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

REGLA CRÍTICA: El campo "resale_value_pen" debe ser igual o MENOR al precio mínimo web proporcionado. \
Si el dispositivo tiene desgaste o daños en fotos, reduce el precio proporcionalmente.

RESPONDE ÚNICAMENTE con JSON válido sin markdown, con estas claves:
{
  "condition_score": número del 0 al 10,
  "market_value_pen": número entero en soles (precio típico mercado peruano segunda mano),
  "resale_value_pen": número entero (precio más bajo posible — igual o menor al precio mínimo web),
  "depreciation_factors": array de strings con factores que reducen el valor (máximo 5, en español),
  "confidence": número del 0 al 1,
  "reasoning": string de máximo 2 oraciones,
  "visual_condition": "excelente" | "bueno" | "regular" | "malo"
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
- Almacenamiento: ${dto.storage}${dto.battery_health ? `\n- Salud batería: ${dto.battery_health}%` : ''}${dto.screen_size ? `\n- Pantalla: ${dto.screen_size}` : ''}
- Condición declarada: ${dto.condition}
- Reacondicionado: ${dto.is_reconditioned ? 'Sí' : 'No'}

REFERENCIA DE MERCADO:
${mlLine}

${photoCount > 0 ? `Se adjuntan ${photoCount} foto(s) del dispositivo. Analiza daños físicos, desgaste y consistencia con la condición declarada. Usa el precio web como referencia para resale_value_pen.` : 'Sin fotos — valúa basándote en especificaciones y referencia web de precio.'}`;
  }

  // ── Mock ─────────────────────────────────────────────────────────────────────

  private mockValuation(dto: ValuateDeviceDto): AiValuationResult {
    const base: Record<string, number> = {
      laptop: 3500, smartphone: 1200, tablet: 900,
      desktop: 1800, consola: 800, smartwatch: 400,
    };
    const baseVal = base[dto.device_category] ?? 1500;
    const condMult = dto.condition === 'excelente' ? 1.0 : dto.condition === 'bueno' ? 0.8 : 0.6;
    const market = Math.round(baseVal * condMult * (dto.is_reconditioned ? 0.85 : 1.0));
    const resale = Math.round(market * 0.9);
    return {
      condition_score: condMult === 1.0 ? 9 : condMult === 0.8 ? 7 : 5,
      market_value_pen: market,
      resale_value_pen: resale,
      max_loan_pen: Math.round(resale * 0.8),
      depreciation_factors: ['Modo simulación — configure GROQ_API_KEY para análisis real'],
      confidence: 0.5,
      reasoning: 'Valuación simulada. Activa la IA configurando GROQ_API_KEY en server/.env (gratis en console.groq.com).',
      visual_condition: dto.condition,
    };
  }
}
