import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  LineChartOutlined,
  ReadOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StockOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, Segmented, Select, Space, Tag, Tooltip, Typography, message } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'

type NewsFilter = '全部' | '宏观' | '政策' | '公司' | '商品'

const marketDefinitions: Array<{ key: MarketKey; region: string; name: string; index: string }> = [
  { key: 'cn', region: '中国内地', name: '沪深 300', index: 'CSI 300' },
  { key: 'us', region: '美国', name: '标普 500', index: 'S&P 500' },
  { key: 'europe', region: '欧洲', name: '德国 DAX', index: 'DAX' },
  { key: 'asia', region: '亚太', name: '日经 225', index: 'Nikkei 225' }
]

const marketOptions = marketDefinitions.map((market) => ({ label: market.name, value: market.key }))
const periodLabels: Record<MarketPeriod, string> = { '1D': '日内', '1W': '近一周', '1M': '近一月', '1Y': '近一年' }
const macroDefinitions: Array<{ key: MacroKey; label: string; color: string; detail: string }> = [
  { key: 'dxy', label: '美元指数', color: '#2563eb', detail: '美元强弱参考' },
  { key: 'us10y', label: '美国 10 年期国债收益率', color: '#7c3aed', detail: '利率水平参考' },
  { key: 'brent', label: '布伦特原油', color: '#d97706', detail: '能源价格参考' },
  { key: 'gold', label: '黄金期货', color: '#ca8a04', detail: '贵金属价格参考' }
]

type NewsItem = OverviewNewsItem & { id: string; categoryLabel: string; tone: string }

function numberText(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function percentText(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function valueColor(value: number | null | undefined): string {
  return value === undefined || value === null || value === 0 ? '#667085' : value > 0 ? '#cf1322' : '#16803c'
}

function valueClass(value: number | null | undefined): string {
  return value === undefined || value === null || value === 0 ? '' : value > 0 ? 'is-up' : 'is-down'
}

function statusLabel(marketState: string | null | undefined): string {
  if (!marketState) return '无数据'
  if (marketState === 'REGULAR') return '交易中'
  if (marketState === 'PRE') return '盘前'
  if (marketState === 'POST') return '盘后'
  return '已收盘'
}

function relativeTime(publishedAt: string): string {
  const timestamp = new Date(publishedAt).getTime()
  if (!Number.isFinite(timestamp)) return publishedAt || '时间未知'
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} 小时前`
  return `${Math.round(minutes / (24 * 60))} 天前`
}

function normalizeNews(report: OverviewNewsReport | null | undefined): NewsItem[] {
  return (report?.items ?? []).map((item, index) => ({
    ...item,
    id: `${report?.generatedAt ?? 'news'}-${index}-${item.url}`,
    categoryLabel: item.category || '未分类',
    tone: item.category === '政策' ? 'purple' : item.category === '公司' ? 'cyan' : item.category === '商品' ? 'gold' : 'blue'
  }))
}

function normalizedSeries(points: MarketSeriesPoint[]): Array<[number, number]> {
  const first = points.find((point) => Number.isFinite(point.value) && point.value !== 0)?.value
  if (!first) return []
  return points.filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value)).map((point) => [point.timestamp * 1000, (point.value / first) * 100])
}

function historicalChange(rows: MarketHistoryRow[], index: number, key: MarketDataKey): number | null {
  const current = rows[index]?.values[key]
  const previous = rows[index - 1]?.values[key]
  if (current === undefined || previous === undefined || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function formatChartTime(value: number, period: MarketPeriod): string {
  const date = new Date(value)
  return period === '1D'
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function MarketNewsDashboard(): JSX.Element {
  const [selectedMarket, setSelectedMarket] = useState<MarketKey>('cn')
  const [period, setPeriod] = useState<MarketPeriod>('1M')
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('全部')
  const [snapshot, setSnapshot] = useState<MarketDataSnapshot | null>(null)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const market = marketDefinitions.find((item) => item.key === selectedMarket) ?? marketDefinitions[0]
  const quote = snapshot?.quotes[selectedMarket] ?? null
  const compareKey: MarketKey = selectedMarket === 'cn' ? 'us' : 'cn'
  const compareMarket = marketDefinitions.find((item) => item.key === compareKey) ?? marketDefinitions[0]
  const filteredNews = newsFilter === '全部' ? newsItems : newsItems.filter((item) => item.categoryLabel === newsFilter)
  const successfulQuotes = marketDefinitions.map((item) => snapshot?.quotes[item.key]).filter((item): item is MarketQuote => Boolean(item))
  const upCount = successfulQuotes.filter((item) => item.changePercent > 0).length
  const downCount = successfulQuotes.filter((item) => item.changePercent < 0).length
  const flatCount = successfulQuotes.length - upCount - downCount

  async function loadNews(): Promise<void> {
    try {
      const stored = await window.forgeDesk.getOverviewSnapshot()
      setNewsItems(normalizeNews(stored.newsHistory?.[0]))
    } catch {
      setNewsItems([])
    }
  }

  async function loadMarketData(nextPeriod: MarketPeriod): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const nextSnapshot = await window.forgeDesk.getMarketDataSnapshot(nextPeriod)
      setSnapshot(nextSnapshot)
      if (nextSnapshot.failures.length === 9 && nextSnapshot.failures.length > 0) setError('行情源未返回有效数据，请检查网络连接或行情源限制。')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMarketData(period)
  }, [period])

  useEffect(() => {
    void loadNews()
  }, [])

  async function refreshDashboard(): Promise<void> {
    setRefreshing(true)
    try {
      const [nextSnapshot, newsReport] = await Promise.all([
        window.forgeDesk.getMarketDataSnapshot(period),
        window.forgeDesk.refreshOverviewNews().catch(() => null)
      ])
      setSnapshot(nextSnapshot)
      if (newsReport) setNewsItems(normalizeNews(newsReport))
      if (nextSnapshot.failures.length > 0) message.warning(`已更新，但有 ${nextSnapshot.failures.length} 项数据源失败`)
      else message.success('真实行情数据已更新')
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
      message.error('行情更新失败，页面未使用旧的假数据替代')
    } finally {
      setRefreshing(false)
    }
  }

  const chartOption = useMemo(() => {
    const selectedSeries = normalizedSeries(snapshot?.series[selectedMarket] ?? [])
    const compareSeries = normalizedSeries(snapshot?.series[compareKey] ?? [])
    return {
      animationDuration: 350,
      grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${Number(value).toFixed(2)}` },
      legend: { top: 0, right: 6, itemWidth: 8, itemHeight: 8, textStyle: { color: '#667085', fontSize: 12 }, data: [market.index, compareMarket.index] },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#e5e7eb' } }, axisTick: { show: false }, axisLabel: { color: '#98a2b3', fontSize: 11, formatter: (value: number) => formatChartTime(value, period) } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: '#98a2b3', fontSize: 11, formatter: '{value}' }, splitLine: { lineStyle: { color: '#eef1f5', type: 'dashed' } }, axisLine: { show: false } },
      series: [
        { name: market.index, type: 'line', smooth: false, symbol: 'none', data: selectedSeries, lineStyle: { width: 2.5, color: '#2563eb' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(37,99,235,0.20)' }, { offset: 1, color: 'rgba(37,99,235,0.01)' }] } } },
        { name: compareMarket.index, type: 'line', smooth: false, symbol: 'none', data: compareSeries, lineStyle: { width: 1.5, color: '#a8b2c1', type: 'dashed' } }
      ]
    }
  }, [compareKey, compareMarket.index, market.index, period, selectedMarket, snapshot])

  const breadthOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}：{c} 个（{d}%）' },
    series: [{ type: 'pie', radius: ['58%', '78%'], center: ['50%', '50%'], itemStyle: { borderColor: 'var(--panel-bg)', borderWidth: 3 }, label: { show: false }, data: [{ value: upCount, name: '上涨', itemStyle: { color: '#cf1322' } }, { value: downCount, name: '下跌', itemStyle: { color: '#16803c' } }, { value: flatCount, name: '持平/无变化', itemStyle: { color: '#98a2b3' } }] }]
  }), [downCount, flatCount, upCount])

  const historicalRows = snapshot?.historical.slice(-8).reverse() ?? []

  return (
    <section className="workspace-section market-news-dashboard">
      <div className="section-heading market-news-hero">
        <div>
          <Typography.Text type="secondary">全球市场 · 宏观参数 · 真实行情</Typography.Text>
          <Typography.Title level={2}>资讯</Typography.Title>
          <Typography.Text type="secondary">仅展示行情源实际返回的数据；网络失败时显示无数据，不用占位曲线。</Typography.Text>
        </div>
        <Space wrap className="market-news-toolbar">
          <span className="market-news-updated"><span className="market-live-dot" /> {snapshot ? `抓取于 ${new Date(snapshot.fetchedAt).toLocaleString('zh-CN')}` : '正在连接行情源'}</span>
          <Button icon={<ReloadOutlined />} loading={refreshing || loading} onClick={() => void refreshDashboard()}>刷新数据</Button>
        </Space>
      </div>

      {snapshot?.delayed ? <Alert type="info" showIcon message="公开行情源：数据可能存在延迟，不作为交易执行依据。当前页面不保证实时行情或交易所授权数据。" description={<a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">数据来源：Yahoo Finance</a>} /> : null}
      {error ? <Alert className="market-news-alert" type="error" showIcon message="行情数据不可用" description={error} /> : null}
      {snapshot && snapshot.failures.length > 0 ? <Alert className="market-news-alert" type="warning" showIcon message={`有 ${snapshot.failures.length} 项数据没有返回`} description={snapshot.failures.map((failure) => `${failure.name}：${failure.message}`).join('；')} /> : null}

      <div className="market-news-metrics">
        <div className="market-news-metric metric-emphasis"><span className="metric-label">样本涨跌比</span><strong>{successfulQuotes.length ? `${upCount} 涨 / ${downCount} 跌` : '暂无数据'}</strong><span className="metric-detail">仅统计已返回的 4 个主要股指</span></div>
        <div className="market-news-metric"><span className="metric-label">数据覆盖</span><strong>{successfulQuotes.length} / 4</strong><span className="metric-detail">主要股指返回数量</span></div>
        <div className="market-news-metric"><span className="metric-label">VIX 恐慌指数</span><strong>{numberText(snapshot?.macro.vix?.value)}</strong><span className={`metric-detail ${valueClass(snapshot?.macro.vix?.changePercent)}`}>{percentText(snapshot?.macro.vix?.changePercent)}</span></div>
        <div className="market-news-metric"><span className="metric-label">美元指数</span><strong>{numberText(snapshot?.macro.dxy?.value)}</strong><span className={`metric-detail ${valueClass(snapshot?.macro.dxy?.changePercent)}`}>{percentText(snapshot?.macro.dxy?.changePercent)}</span></div>
        <div className="market-news-metric"><span className="metric-label">最后抓取</span><strong>{snapshot ? new Date(snapshot.fetchedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}</strong><span className="metric-detail">公开源可能延迟</span></div>
      </div>

      <div className="market-news-layout">
        <main className="market-news-main-column">
          <Card className="market-news-card market-overview-card" bordered={false}>
            <div className="market-news-card-heading">
              <div><Typography.Title level={4}><GlobalOutlined /> 全球主要市场</Typography.Title><Typography.Text type="secondary">主要股指当前点位与涨跌幅</Typography.Text></div>
              <Tag color="blue">公开延迟源</Tag>
            </div>
            <div className="market-board-grid">
              {marketDefinitions.map((item) => {
                const itemQuote = snapshot?.quotes[item.key] ?? null
                return <button className={`market-board-item${selectedMarket === item.key ? ' is-selected' : ''}`} key={item.key} type="button" onClick={() => setSelectedMarket(item.key)}>
                  <div className="market-board-topline"><span className="market-region">{item.region}</span><span className={`market-status market-status-${itemQuote?.marketState === 'REGULAR' ? 'live' : 'muted'}`}>{statusLabel(itemQuote?.marketState)}</span></div>
                  <div className="market-board-name"><strong>{item.name}</strong><span>{item.index}</span></div>
                  <div className="market-board-value">{itemQuote ? numberText(itemQuote.value) : '暂无数据'}</div>
                  <div className="market-board-change" style={{ color: valueColor(itemQuote?.changePercent) }}>{itemQuote && itemQuote.changePercent !== 0 ? (itemQuote.changePercent > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />) : null} {itemQuote ? `${numberText(itemQuote.change)} ${percentText(itemQuote.changePercent)}` : '—'}</div>
                  <div className="market-board-volume">成交量 {itemQuote?.volume === null || itemQuote?.volume === undefined ? '—' : numberText(itemQuote.volume, 0)}</div>
                </button>
              })}
            </div>
          </Card>

          <Card className="market-news-card market-trend-card" bordered={false}>
            <div className="market-news-card-heading market-trend-heading">
              <div><Typography.Title level={4}><LineChartOutlined /> 全球主要指数走势</Typography.Title><Typography.Text type="secondary">使用行情源返回的历史点位归一化，便于横向比较</Typography.Text></div>
              <Space wrap><Select size="small" value={selectedMarket} options={marketOptions} onChange={setSelectedMarket} /><Segmented size="small" value={period} options={Object.keys(periodLabels).map((key) => ({ label: periodLabels[key as MarketPeriod], value: key }))} onChange={(value) => setPeriod(value as MarketPeriod)} /></Space>
            </div>
            <div className="market-trend-summary"><div><span>当前指数</span><strong>{quote ? numberText(quote.value) : '暂无数据'}</strong><em className={valueClass(quote?.changePercent)}>{percentText(quote?.changePercent)}</em></div><span className="trend-summary-note">对比指数：{compareMarket.index} · 区间 {periodLabels[period]}</span></div>
            {normalizedSeries(snapshot?.series[selectedMarket] ?? []).length > 0 ? <ReactECharts option={chartOption} style={{ height: 310, width: '100%' }} notMerge lazyUpdate /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '正在读取真实历史数据…' : '行情源没有返回该区间的历史数据'} />}
          </Card>

          <div className="market-bottom-grid">
            <Card className="market-news-card sector-card" bordered={false}>
              <div className="market-news-card-heading"><div><Typography.Title level={4}><StockOutlined /> 市场方向占比</Typography.Title><Typography.Text type="secondary">当前已返回的主要股指样本</Typography.Text></div><Tooltip title="这是 4 个主要股指的涨跌方向统计，不是全球行业权重"><SafetyCertificateOutlined className="muted-icon" /></Tooltip></div>
              {successfulQuotes.length > 0 ? <div className="sector-chart-wrap"><ReactECharts option={breadthOption} style={{ height: 190, width: '54%' }} notMerge lazyUpdate /><div className="sector-legend">{[{ label: '上涨', value: upCount, color: '#cf1322' }, { label: '下跌', value: downCount, color: '#16803c' }, { label: '持平/无变化', value: flatCount, color: '#98a2b3' }].map((item) => <div className="sector-legend-row" key={item.label}><span className="sector-dot" style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{item.value} 个</strong></div>)}</div></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无真实数据" />}
            </Card>
            <Card className="market-news-card macro-card" bordered={false}>
              <div className="market-news-card-heading"><div><Typography.Title level={4}><ThunderboltOutlined /> 关键影响因子</Typography.Title><Typography.Text type="secondary">只展示行情源返回的参数，不自动编写方向结论</Typography.Text></div><Tag color="blue">{macroDefinitions.length} 项跟踪中</Tag></div>
              <div className="macro-factor-list">{macroDefinitions.map((factor) => { const factorQuote = snapshot?.macro[factor.key] ?? null; return <div className="macro-factor-row" key={factor.key}><span className="macro-factor-icon" style={{ color: factor.color }}><LineChartOutlined /></span><span className="macro-factor-copy"><strong>{factor.label}</strong><small>{factorQuote?.symbol ?? '未返回'} · {factor.detail}</small></span><span className="macro-factor-value"><b>{factorQuote ? `${numberText(factorQuote.value)}${factor.key === 'us10y' ? '%' : ''}` : '—'}</b><em className={valueClass(factorQuote?.changePercent)}>{percentText(factorQuote?.changePercent)}</em></span></div> })}</div>
            </Card>
          </div>
        </main>

        <aside className="market-news-side-column">
          <Card className="market-news-card focus-news-card" bordered={false}>
            <div className="market-news-card-heading"><div><Typography.Title level={4}><ReadOutlined /> 今日焦点</Typography.Title><Typography.Text type="secondary">来自已配置资讯源的原始报告</Typography.Text></div><Button type="text" icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refreshDashboard()} /></div>
            <Segmented block size="small" value={newsFilter} options={['全部', '宏观', '政策', '公司', '商品']} onChange={(value) => setNewsFilter(value as NewsFilter)} />
            <div className="focus-news-list">{filteredNews.map((item) => <button className="focus-news-item" key={item.id} type="button" onClick={() => item.url && window.open(item.url, '_blank')}><span className="focus-news-meta"><Tag color={item.tone}>{item.categoryLabel}</Tag><span>{item.source}</span><span><ClockCircleOutlined /> {relativeTime(item.publishedAt)}</span></span><strong>{item.title}</strong><span>{item.summary}</span></button>)}</div>
            {filteredNews.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已配置的真实资讯" /> : null}
          </Card>

          <Card className="market-news-card historical-card" bordered={false}>
            <div className="market-news-card-heading"><div><Typography.Title level={4}><ClockCircleOutlined /> 历史数据</Typography.Title><Typography.Text type="secondary">行情源历史点位计算的日变化</Typography.Text></div><Tag>{historicalRows.length} 日</Tag></div>
            <div className="historical-table-wrap"><table className="historical-table"><thead><tr><th>日期</th><th>沪深300</th><th>标普500</th><th>日经225</th></tr></thead><tbody>{historicalRows.map((row, index) => { const originalIndex = (snapshot?.historical.length ?? 0) - 1 - index; return <tr key={row.date}><td>{row.date.slice(5)}</td><td className={valueClass(historicalChange(snapshot?.historical ?? [], originalIndex, 'cn'))}>{percentText(historicalChange(snapshot?.historical ?? [], originalIndex, 'cn'))}</td><td className={valueClass(historicalChange(snapshot?.historical ?? [], originalIndex, 'us'))}>{percentText(historicalChange(snapshot?.historical ?? [], originalIndex, 'us'))}</td><td className={valueClass(historicalChange(snapshot?.historical ?? [], originalIndex, 'asia'))}>{percentText(historicalChange(snapshot?.historical ?? [], originalIndex, 'asia'))}</td></tr> })}</tbody></table></div>
            <div className="historical-note"><SafetyCertificateOutlined /> 数据写入本地用户目录，仅保留行情源返回的历史记录。</div>
          </Card>

          <Card className="market-news-card market-watch-card" bordered={false}>
            <div className="watch-card-copy"><div className="watch-card-icon"><GlobalOutlined /></div><div><Typography.Title level={4}>全球市场观察</Typography.Title><Typography.Text type="secondary">当前已接入 {successfulQuotes.length} / 4 个主要股指；观察结论请以源数据和时间戳为准。</Typography.Text></div></div>
            <Button block type="primary" ghost onClick={() => message.info('观察清单功能待接入持久化配置')}>加入今日观察</Button>
          </Card>
        </aside>
      </div>
    </section>
  )
}
