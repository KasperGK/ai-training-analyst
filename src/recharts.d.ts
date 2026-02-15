/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'recharts' {
  import type { ComponentType, ReactNode } from 'react'

  export const ResponsiveContainer: ComponentType<any>
  export const Area: ComponentType<any>
  export const AreaChart: ComponentType<any>
  export const Bar: ComponentType<any>
  export const BarChart: ComponentType<any>
  export const CartesianGrid: ComponentType<any>
  export const Cell: ComponentType<any>
  export const ComposedChart: ComponentType<any>
  export const Legend: ComponentType<any>
  export const Line: ComponentType<any>
  export const LineChart: ComponentType<any>
  export const Pie: ComponentType<any>
  export const PieChart: ComponentType<any>
  export const PolarAngleAxis: ComponentType<any>
  export const RadialBar: ComponentType<any>
  export const RadialBarChart: ComponentType<any>
  export const ReferenceArea: ComponentType<any>
  export const ReferenceLine: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export const XAxis: ComponentType<any>
  export const YAxis: ComponentType<any>

  export interface LegendProps {
    payload?: LegendPayload[]
    verticalAlign?: 'top' | 'middle' | 'bottom'
    align?: 'left' | 'center' | 'right'
    content?: any
  }

  export interface LegendPayload {
    value: string
    id?: string
    type?: string
    color?: string
    dataKey?: string | number
    formatter?: (value: any) => ReactNode
  }
}

declare module 'recharts/types/component/DefaultTooltipContent' {
  export type ValueType = string | number | (string | number)[]
  export type NameType = string | number
  export type Payload<TValue extends ValueType, TName extends NameType> = {
    type?: string
    color?: string
    formatter?: (value: TValue) => TValue
    name?: TName
    value?: TValue
    unit?: string
    dataKey?: string | number
    payload?: Record<string, unknown>
    chartType?: string
    stroke?: string
    strokeDasharray?: string | number
    strokeWidth?: number | string
    className?: string
    hide?: boolean
  }
}
