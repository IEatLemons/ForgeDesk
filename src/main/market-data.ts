import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type MarketPeriod = '1D' | '1W' | '1M' | '1Y'
export type MarketKey = 'cn' | 'us' | 'europe' | 'asia'
export type MacroKey = 'dxy' | 'us10y' | 'brent' | 'gold' | 'vix'
export type MarketDataKey = MarketKey | MacroKey

export type MarketSeriesPoint = {
  timestamp: number
  value: number
}

export type MarketQuote = {
  key: MarketDataKey
  name: string
  symbol: string
  value: number
  change: number
  changePercent: number
  previousClose: number | null
  currency: string | null
  volume: number | null
  marketState: string | null
  fetchedAt: string
}

export type MarketHistoryRow = {
  date: string
  values: Partial<Record<MarketDataKey, number>>
}

export type MarketDataSnapshot = {
  period: MarketPeriod
  fetchedAt: string
  source: 'Yahoo Finance chart'
  sourceUrl: string
  delayed: true
  quotes: Record<MarketKey, MarketQuote | null>
  macro: Record<MacroKey, MarketQuote | null>
  series: Record<MarketKey, MarketSeriesPoint[]>
  historical: MarketHistoryRow[]
  failures: Array<{ key: MarketDataKey; name: string; message: string }>
}

type Instrument = {
  key: MarketDataKey
  name: string
  symbol: string
  currency: string
  group: 'market' | 'macro'
}

const instruments: Instrument[] = [
  { key: 'cn', name: '沪深 300', symbol: '000300.SS', currency: 'CNY', group: 'market' },
  { key: 'us', name: '标普 500', symbol: '^GSPC', currency: 'USD', group: 'market' },
  { key: 'europe', name: '德国 DAX', symbol: '^GDAXI', currency: 'EUR', group: 'market' },
  { key: 'asia', name: '日经 225', symbol: '^N225', currency: 'JPY', group: 'market' },
  { key: 'dxy', name: '美元指数', symbol: 'DX-Y.NYB', currency: 'USD', group: 'macro' },
  { key: 'us10y', name: '美国 10 年期国债收益率', symbol: '^TNX', currency: '%', group: 'macro' },
  { key: 'brent', name: '布伦特原油', symbol: 'BZ=F', currency: 'USD', group: 'macro' },
  { key: 'gold', name: '黄金期货', symbol: 'GC=F', currency: 'USD', group: 'macro' },
  { key: 'vix', name: 'VIX 恐慌指数', symbol: '^VIX', currency: 'USD', group: 'macro' }
]

const SOURCE_URL = 'https://finance.yahoo.com/'
const CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const HISTORY_FILE = 'forgedesk-market-data-history.json'

type YahooChartPayload = {
  chart?: {
    error?: { description?: string | null } | null
    result?: Array<{
      meta?: {
        regularMarketPrice?: number | null
        previousClose?: number | null
        chartPreviousClose?: number | null
        regularMarketVolume?: number | null
        marketState?: string | null
        currency?: string | null
      }
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }> }
    } | null>
  }
}

type PeriodConfig = { range: string; interval: string }

const periodConfig: Record<MarketPeriod, PeriodConfig> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '1mo', interval: '30m' },
  '1M': { range: '3mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function getLastFinite(values: Array<number | null> | undefined): number | null {
  if (!values) return null
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (isFiniteNumber(value)) return value
  }
  return null
}

function getNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null
}

function getDateKey(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

async function fetchChart(instrument: Instrument, period: MarketPeriod): Promise<MarketQuote & { series: MarketSeriesPoint[] }> {
  const config = periodConfig[period]
  const url = `${CHART_ENDPOINT}${encodeURIComponent(instrument.symbol)}?range=${config.range}&interval=${config.interval}&includePrePost=true&events=div%2Csplits`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'ForgeDesk/1.1 market dashboard' },
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`行情源返回 HTTP ${response.status}`)

    const payload = (await response.json()) as YahooChartPayload
    const chart = payload.chart
    const result = chart?.result?.[0]
    if (!result) throw new Error(chart?.error?.description ?? '行情源没有返回结果')

    const timestamps = result.timestamp ?? []
    const closes = result.indicators?.quote?.[0]?.close ?? []
    const volumes = result.indicators?.quote?.[0]?.volume ?? []
    const series = timestamps
      .map((timestamp, index) => ({ timestamp, value: closes[index] }))
      .filter((point): point is MarketSeriesPoint => isFiniteNumber(point.timestamp) && isFiniteNumber(point.value))

    const meta = result.meta ?? {}
    const value = getNumber(meta.regularMarketPrice) ?? getLastFinite(closes)
    if (value === null) throw new Error('行情源没有返回有效点位')

    const previousClose = getNumber(meta.previousClose) ?? getNumber(meta.chartPreviousClose) ?? (series.length > 1 ? series[series.length - 2].value : null)
    const change = previousClose === null ? 0 : value - previousClose
    const changePercent = previousClose && previousClose !== 0 ? (change / previousClose) * 100 : 0
    const volume = getNumber(meta.regularMarketVolume) ?? getLastFinite(volumes)

    return {
      key: instrument.key,
      name: instrument.name,
      symbol: instrument.symbol,
      value,
      change,
      changePercent,
      previousClose,
      currency: meta.currency ?? instrument.currency,
      volume,
      marketState: meta.marketState ?? null,
      fetchedAt: new Date().toISOString(),
      series
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function readStoredHistory(userDataPath: string): Promise<MarketHistoryRow[]> {
  try {
    const content = await readFile(join(userDataPath, HISTORY_FILE), 'utf8')
    const rows = JSON.parse(content) as unknown
    if (!Array.isArray(rows)) return []
    return rows.filter((row): row is MarketHistoryRow => {
      if (!row || typeof row !== 'object') return false
      const candidate = row as Partial<MarketHistoryRow>
      return typeof candidate.date === 'string' && Boolean(candidate.values && typeof candidate.values === 'object')
    }).slice(-366)
  } catch {
    return []
  }
}

async function writeStoredHistory(userDataPath: string, rows: MarketHistoryRow[]): Promise<void> {
  await mkdir(userDataPath, { recursive: true })
  await writeFile(join(userDataPath, HISTORY_FILE), `${JSON.stringify(rows.slice(-366), null, 2)}\n`, { mode: 0o600 })
}

function mergeHistory(rows: MarketHistoryRow[], quotes: Array<MarketQuote & { series: MarketSeriesPoint[] }>): MarketHistoryRow[] {
  const merged = new Map(rows.map((row) => [row.date, { ...row, values: { ...row.values } }]))
  for (const quote of quotes) {
    for (const point of quote.series) {
      const date = getDateKey(point.timestamp)
      const row = merged.get(date) ?? { date, values: {} }
      row.values[quote.key] = point.value
      merged.set(date, row)
    }
    const today = getDateKey(Math.floor(Date.now() / 1000))
    const latest = merged.get(today) ?? { date: today, values: {} }
    latest.values[quote.key] = quote.value
    merged.set(today, latest)
  }
  return [...merged.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(-366)
}

export async function getMarketDataSnapshot(userDataPath: string, period: MarketPeriod = '1M'): Promise<MarketDataSnapshot> {
  type FetchResult = { instrument: Instrument; result: MarketQuote & { series: MarketSeriesPoint[] } } | { instrument: Instrument; error: string }
  const results: FetchResult[] = await Promise.all(instruments.map(async (instrument): Promise<FetchResult> => {
    try {
      return { instrument, result: await fetchChart(instrument, period) }
    } catch (error) {
      return { instrument, error: error instanceof Error ? error.message : String(error) }
    }
  }))

  const successful = results.filter((item): item is Extract<FetchResult, { result: MarketQuote & { series: MarketSeriesPoint[] } }> => 'result' in item).map((item) => item.result)
  const failures = results.filter((item): item is Extract<FetchResult, { error: string }> => 'error' in item).map((item) => ({ key: item.instrument.key, name: item.instrument.name, message: item.error }))
  const storedHistory = await readStoredHistory(userDataPath)
  const historical = mergeHistory(storedHistory, successful)
  await writeStoredHistory(userDataPath, historical)

  const quotes = Object.fromEntries(instruments.filter((instrument) => instrument.group === 'market').map((instrument) => {
    const result = successful.find((item) => item.key === instrument.key)
    return [instrument.key, result ?? null]
  })) as Record<MarketKey, MarketQuote | null>
  const macro = Object.fromEntries(instruments.filter((instrument) => instrument.group === 'macro').map((instrument) => {
    const result = successful.find((item) => item.key === instrument.key)
    return [instrument.key, result ?? null]
  })) as Record<MacroKey, MarketQuote | null>
  const series = Object.fromEntries(instruments.filter((instrument) => instrument.group === 'market').map((instrument) => {
    const result = successful.find((item) => item.key === instrument.key)
    return [instrument.key, result?.series ?? []]
  })) as Record<MarketKey, MarketSeriesPoint[]>

  return {
    period,
    fetchedAt: new Date().toISOString(),
    source: 'Yahoo Finance chart',
    sourceUrl: SOURCE_URL,
    delayed: true,
    quotes,
    macro,
    series,
    historical,
    failures
  }
}
