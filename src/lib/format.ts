const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
})

export function formatUsd(value: number) {
  if (value > 0 && value < 0.01) return usdPrecise.format(value)
  return usd.format(value)
}

export function formatCompact(value: number) {
  return compact.format(value)
}

export function formatUsdCompact(value: number) {
  return `$${compact.format(value)}`
}

export function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatFloor(value: number, symbol: string) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${symbol}`
}
