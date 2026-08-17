import { Inject, Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import * as schema from '../../../database/schema';
import {
  REPORT_MAX_PRICE,
  REPORT_MIN_PRICE,
} from '../../crowdsourcing/crowdsourcing.constants';
import type { FuelPriceCandidate, OcrLine, OcrResult } from '../ocr.types';

type FuelAliasEntry = {
  fuelTypeId: string;
  fuelCode: string;
  alias: string;
};

@Injectable()
export class FuelPriceExtractorService {
  private aliasCache: FuelAliasEntry[] | null = null;
  private aliasCacheLoadedAt = 0;
  private readonly aliasCacheTtlMs = 5 * 60 * 1000;
  private readonly aliasesOverride?: FuelAliasEntry[];

  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Optional() aliasesOverride?: FuelAliasEntry[],
  ) {
    this.aliasesOverride = aliasesOverride;
  }

  async extractCandidates(ocr: OcrResult): Promise<FuelPriceCandidate[]> {
    const aliases = await this.loadAliases();
    const priceTokens = this.extractPriceTokens(ocr);
    const labelTokens = this.extractLabelTokens(ocr, aliases);

    const candidates: FuelPriceCandidate[] = [];

    for (const label of labelTokens) {
      const nearestPrice = this.findNearestPrice(label, priceTokens);
      if (!nearestPrice) {
        continue;
      }

      const normalizedPrice = this.normalizePrice(nearestPrice.text);
      if (!normalizedPrice || !this.isPlausiblePrice(normalizedPrice)) {
        continue;
      }

      const confidence = this.computeCandidateConfidence(
        label,
        nearestPrice,
        normalizedPrice,
      );

      candidates.push({
        fuelCodeSuggestion: label.fuelCode,
        fuelTypeId: label.fuelTypeId,
        rawLabel: label.rawLabel,
        price: normalizedPrice,
        confidence,
      });
    }

    return this.deduplicateCandidates(candidates);
  }

  private async loadAliases(): Promise<FuelAliasEntry[]> {
    if (this.aliasesOverride) {
      return this.aliasesOverride;
    }

    const now = Date.now();
    if (
      this.aliasCache &&
      now - this.aliasCacheLoadedAt < this.aliasCacheTtlMs
    ) {
      return this.aliasCache;
    }

    const rows = await this.db
      .select({
        fuelTypeId: schema.fuelTypes.id,
        fuelCode: schema.fuelTypes.code,
        aliasCode: schema.fuelTypes.code,
        aliasName: schema.fuelAliases.externalName,
      })
      .from(schema.fuelTypes)
      .leftJoin(
        schema.fuelAliases,
        eq(schema.fuelAliases.fuelTypeId, schema.fuelTypes.id),
      )
      .where(eq(schema.fuelTypes.isActive, true));

    const entries: FuelAliasEntry[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const variants = [row.fuelCode, row.aliasName].filter(
        Boolean,
      ) as string[];
      for (const variant of variants) {
        const normalized = this.normalizeLabel(variant);
        const key = `${normalized}:${row.fuelTypeId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        entries.push({
          fuelTypeId: row.fuelTypeId,
          fuelCode: row.fuelCode.toUpperCase(),
          alias: normalized,
        });
      }
    }

    this.aliasCache = entries.sort((a, b) => b.alias.length - a.alias.length);
    if (entries.length > 0) {
      this.aliasCacheLoadedAt = now;
    }
    return this.aliasCache;
  }

  private extractPriceTokens(ocr: OcrResult) {
    const tokens: Array<{
      text: string;
      confidence: number;
      bbox: OcrLine['bbox'];
      lineText: string;
    }> = [];

    for (const line of ocr.lines) {
      for (const word of line.words) {
        if (this.looksLikePriceToken(word.text)) {
          tokens.push({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox,
            lineText: line.text,
          });
        }
      }

      const lineMatches = line.text.match(/\d[\d.,]{2,6}/g) ?? [];
      for (const match of lineMatches) {
        if (this.looksLikePriceToken(match)) {
          tokens.push({
            text: match,
            confidence: line.confidence,
            bbox: line.bbox,
            lineText: line.text,
          });
        }
      }
    }

    return tokens;
  }

  private extractLabelTokens(ocr: OcrResult, aliases: FuelAliasEntry[]) {
    const labels: Array<{
      fuelTypeId: string;
      fuelCode: string;
      rawLabel: string;
      confidence: number;
      bbox: OcrLine['bbox'];
      lineText: string;
    }> = [];

    for (const line of ocr.lines) {
      const normalizedLine = this.normalizeLabel(line.text);
      for (const alias of aliases) {
        if (normalizedLine.includes(alias.alias)) {
          labels.push({
            fuelTypeId: alias.fuelTypeId,
            fuelCode: alias.fuelCode,
            rawLabel: line.text.trim(),
            confidence: line.confidence,
            bbox: line.bbox,
            lineText: line.text,
          });
          break;
        }
      }

      for (const word of line.words) {
        const normalizedWord = this.normalizeLabel(word.text);
        const alias = aliases.find((entry) => entry.alias === normalizedWord);
        if (alias) {
          labels.push({
            fuelTypeId: alias.fuelTypeId,
            fuelCode: alias.fuelCode,
            rawLabel: word.text.trim(),
            confidence: word.confidence,
            bbox: word.bbox,
            lineText: line.text,
          });
        }
      }
    }

    return labels;
  }

  private findNearestPrice(
    label: { bbox: OcrLine['bbox']; lineText: string },
    prices: Array<{
      text: string;
      confidence: number;
      bbox: OcrLine['bbox'];
      lineText: string;
    }>,
  ) {
    let best: (typeof prices)[number] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const price of prices) {
      const sameLine = price.lineText === label.lineText;
      const centerDistance = this.bboxDistance(label.bbox, price.bbox);
      const score = sameLine ? centerDistance : centerDistance + 5000;

      if (score < bestScore) {
        bestScore = score;
        best = price;
      }
    }

    return best;
  }

  private bboxDistance(a: OcrLine['bbox'], b: OcrLine['bbox']): number {
    const ax = (a.x0 + a.x1) / 2;
    const ay = (a.y0 + a.y1) / 2;
    const bx = (b.x0 + b.x1) / 2;
    const by = (b.y0 + b.y1) / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  private looksLikePriceToken(text: string): boolean {
    const trimmed = text.trim();
    if (!/^\d[\d.,]{1,5}$/.test(trimmed)) {
      return false;
    }
    if (!/[.,]/.test(trimmed) && /^\d{4}$/.test(trimmed)) {
      return false;
    }
    if (/%/.test(trimmed)) {
      return false;
    }
    return true;
  }

  normalizePrice(raw: string): string | null {
    const cleaned = raw.trim().replace(/[^\d.,]/g, '');
    if (!cleaned) {
      return null;
    }

    const commaCount = (cleaned.match(/,/g) ?? []).length;
    const dotCount = (cleaned.match(/\./g) ?? []).length;

    let normalized = cleaned;

    if (commaCount === 1 && dotCount === 0) {
      normalized = cleaned.replace(',', '.');
    } else if (commaCount === 1 && dotCount >= 1) {
      normalized = cleaned.replace(/,/g, '');
    } else if (commaCount > 1 && dotCount === 0) {
      const parts = cleaned.split(',');
      normalized = `${parts.slice(0, -1).join('')}.${parts.at(-1)}`;
    }

    if (!/^\d+(\.\d{1,4})?$/.test(normalized)) {
      return null;
    }

    if (Number(normalized) > Number(REPORT_MAX_PRICE)) {
      return null;
    }

    return normalized;
  }

  private isPlausiblePrice(price: string): boolean {
    const numeric = Number(price);
    return (
      Number.isFinite(numeric) &&
      numeric > Number(REPORT_MIN_PRICE) &&
      numeric <= Number(REPORT_MAX_PRICE)
    );
  }

  private computeCandidateConfidence(
    label: { confidence: number },
    price: { confidence: number },
    normalizedPrice: string,
  ): number {
    let confidence = label.confidence * 0.45 + price.confidence * 0.35;
    if (/^\d\.\d{3}$/.test(normalizedPrice)) {
      confidence += 0.1;
    }
    if (label.confidence > 0 && price.confidence > 0) {
      confidence += 0.05;
    }
    return Math.max(0, Math.min(1, Number(confidence.toFixed(4))));
  }

  private deduplicateCandidates(
    candidates: FuelPriceCandidate[],
  ): FuelPriceCandidate[] {
    const map = new Map<string, FuelPriceCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.fuelTypeId ?? candidate.fuelCodeSuggestion}:${candidate.price}`;
      const existing = map.get(key);
      if (!existing || candidate.confidence > existing.confidence) {
        map.set(key, candidate);
      }
    }
    return [...map.values()].sort((a, b) => b.confidence - a.confidence);
  }

  private normalizeLabel(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9+]/g, '');
  }
}
