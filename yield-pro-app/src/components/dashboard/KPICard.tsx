import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatNumber, formatCurrency } from '../../utils/formatters'

interface KPICardProps {
  title: string
  value: number
  unit?: string
  currency?: boolean
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red'
  sparklineData?: number[]
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  red: 'bg-red-50 text-red-600 border-red-200',
}

const iconBgClasses = {
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  purple: 'bg-purple-100',
  orange: 'bg-orange-100',
  red: 'bg-red-100',
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  currency = false,
  change,
  changeLabel,
  icon,
  color,
  sparklineData,
}) => {
  const displayValue = currency ? formatCurrency(value) : formatNumber(value) + (unit ? ` ${unit}` : '')
  
  const getTrendIcon = () => {
    if (change === undefined) return null
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  // Simple SVG sparkline
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null
    
    const width = 100
    const height = 30
    const max = Math.max(...sparklineData)
    const min = Math.min(...sparklineData)
    const range = max - min || 1
    
    const points = sparklineData.map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    }).join(' ')

    return (
      <svg width={width} height={height} className="opacity-50">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
    )
  }

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]} bg-white`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{displayValue}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {getTrendIcon()}
              <span className={`text-sm font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="text-sm text-gray-500">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconBgClasses[color]}`}>
          {icon}
        </div>
      </div>
      {sparklineData && (
        <div className="mt-4 text-gray-400">
          {renderSparkline()}
        </div>
      )}
    </div>
  )
}
