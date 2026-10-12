"use client";

import React, { useState } from "react";

interface AreaChartProps {
  data: Array<{ date: string; Ciro: number; NetKar: number }>;
  categories?: string[];
  colors?: string[];
  className?: string;
}

export function AreaChart({ data, className = "" }: AreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 15, bottom: 25, left: 35 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.Ciro, d.NetKar)), 100) * 1.15;

  const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - (val / maxVal) * chartHeight;

  // Build SVG path for smooth line
  const makePath = (key: "Ciro" | "NetKar") => {
    return data.reduce((acc, point, i) => {
      const x = getX(i);
      const y = getY(point[key]);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = getX(i - 1);
      const prevY = getY(data[i - 1][key]);
      const cpX1 = prevX + (x - prevX) / 2;
      const cpX2 = prevX + (x - prevX) / 2;
      return `${acc} C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
    }, "");
  };

  const ciroPath = makePath("Ciro");
  const karPath = makePath("NetKar");

  const ciroArea = `${ciroPath} L ${getX(data.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${
    padding.top + chartHeight
  } Z`;

  const karArea = `${karPath} L ${getX(data.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${
    padding.top + chartHeight
  } Z`;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 mb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
          <span className="text-muted-foreground">Ciro (₺)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand" />
          <span className="text-muted-foreground">Net Kâr (₺)</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="ciroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="karGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = padding.top + chartHeight * pct;
          return (
            <line
              key={i}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Areas */}
        <path d={ciroArea} fill="url(#ciroGrad)" />
        <path d={karArea} fill="url(#karGrad)" />

        {/* Lines */}
        <path d={ciroPath} fill="none" stroke="var(--muted-foreground)" strokeWidth="2.5" />
        <path d={karPath} fill="none" stroke="var(--brand)" strokeWidth="2.5" />

        {/* Dots & Hit areas */}
        {data.map((d, i) => {
          const x = getX(i);
          const yCiro = getY(d.Ciro);
          const yKar = getY(d.NetKar);
          const isHover = hoverIndex === i;

          return (
            <g key={i}>
              {/* X Axis Label */}
              <text
                x={x}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted-foreground)"
                className="font-mono"
              >
                {d.date}
              </text>

              {/* Data points */}
              <circle
                cx={x}
                cy={yCiro}
                r={isHover ? 5 : 3}
                fill="var(--muted-foreground)"
                stroke="var(--background)"
                strokeWidth="2"
              />
              <circle
                cx={x}
                cy={yKar}
                r={isHover ? 5 : 3}
                fill="var(--brand)"
                stroke="var(--background)"
                strokeWidth="2"
              />

              {/* Invisible touch/hover area */}
              <rect
                x={x - 15}
                y={padding.top}
                width={30}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onTouchStart={() => setHoverIndex(i)}
                className="cursor-pointer"
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div
          className="absolute -top-3 transform -translate-x-1/2 bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-xl text-[11px] pointer-events-none z-20 backdrop-blur-md"
          style={{
            left: `${((hoverIndex / (data.length - 1)) * (chartWidth / width) + padding.left / width) * 100}%`,
          }}
        >
          <div className="font-medium text-foreground/80">{data[hoverIndex].date}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-foreground/90 font-mono">₺{data[hoverIndex].Ciro}</span>
            <span className="text-muted-foreground/80">|</span>
            <span className="text-brand font-mono font-semibold">₺{data[hoverIndex].NetKar} net</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface DonutChartProps {
  data: Array<{ name: string; count: number; revenue?: number }>;
  className?: string;
}

export function DonutChart({ data, className = "" }: DonutChartProps) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.count, 0) || 1;
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

  const size = 160;
  const center = size / 2;
  const radius = 55;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${className}`}>
      {/* SVG Donut */}
      <div className="relative w-[150px] h-[150px] shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90 transform">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
          />
          {data.map((item, idx) => {
            const ratio = item.count / total;
            const strokeDasharray = `${ratio * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += ratio * circumference;
            const color = colors[idx % colors.length];

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold font-mono text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground font-medium">Toplam İşlem</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
        {data.map((item, idx) => {
          const pct = Math.round((item.count / total) * 100);
          const color = colors[idx % colors.length];

          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-foreground/80 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-muted-foreground">
                <span>{item.count}</span>
                <span className="text-muted-foreground/80">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
