import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  ScrollView,
  Platform
} from 'react-native';
import Svg, { Rect, G, Text as SvgText, Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  max?: number;
  color?: string;
}

export const BarChart = ({ data, height = 200, max = 100, color }: BarChartProps) => {
  const { colors: theme } = useTheme();
  if (!data || data.length === 0) return <View style={{ height: height + 40, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.textTertiary, fontSize: 12 }}>No data available</Text></View>;

  const screenWidth = Dimensions.get('window').width - spacing.lg * 4;
  const barWidth = (screenWidth / data.length) * 0.6;
  const gap = (screenWidth / data.length) * 0.4;
  const barColor = color || theme.primary;

  return (
    <View style={{ height: height + 40, width: '100%' }}>
      <Svg height={height + 40} width={screenWidth}>
        {data.map((item, i) => {
          const barHeight = (item.value / max) * height;
          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight;

          return (
            <G key={item.label}>
              {/* Bar */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx={4}
              />
              {/* Label */}
              <SvgText
                x={x + barWidth / 2}
                y={height + 20}
                fill={theme.textSecondary}
                fontSize="10"
                textAnchor="middle"
                fontWeight="700"
              >
                {item.label.length > 8 ? item.label.substring(0, 6) + '..' : item.label}
              </SvgText>
              {/* Value */}
              <SvgText
                x={x + barWidth / 2}
                y={y - 8}
                fill={theme.textPrimary}
                fontSize="10"
                textAnchor="middle"
                fontWeight="900"
              >
                {item.value}%
              </SvgText>
            </G>

          );
        })}
      </Svg>
    </View>
  );
};

export const HorizontalBarChart = ({ data, height = 200, max = 100, color }: BarChartProps) => {
  const { colors: theme } = useTheme();
  if (!data || data.length === 0) return <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.textTertiary, fontSize: 12 }}>No data available</Text></View>;

  const screenWidth = Dimensions.get('window').width - spacing.lg * 4;
  const rowHeight = 40;
  const labelWidth = 80;
  const chartWidth = screenWidth - labelWidth - 40;
  const barColor = color || theme.primary;

  return (
    <View style={{ height: data.length * rowHeight, width: '100%', marginTop: spacing.md }}>
      <Svg height={data.length * rowHeight} width={screenWidth}>
        {data.map((item, i) => {
          const barWidth = (item.value / max) * chartWidth;
          const y = i * rowHeight;

          return (
            <G key={item.label}>
              {/* Label */}
              <SvgText
                x={0}
                y={y + rowHeight / 2 + 4}
                fill={theme.textSecondary}
                fontSize="10"
                fontWeight="700"
              >
                {item.label.length > 12 ? item.label.substring(0, 10) + '..' : item.label}
              </SvgText>
              {/* Bar BG */}
              <Rect
                x={labelWidth}
                y={y + 10}
                width={chartWidth}
                height={20}
                fill={theme.border}
                rx={10}
                opacity={0.3}
              />
              {/* Bar */}
              <Rect
                x={labelWidth}
                y={y + 10}
                width={barWidth}
                height={20}
                fill={barColor}
                rx={10}
              />
              {/* Value */}
              <SvgText
                x={labelWidth + barWidth + 8}
                y={y + rowHeight / 2 + 4}
                fill={theme.textPrimary}
                fontSize="10"
                fontWeight="900"
              >
                {item.value}%
              </SvgText>
            </G>

          );
        })}
      </Svg>
    </View>
  );
};

interface DonutChartProps {
  data: { tag: string; count: number }[];
  size?: number;
  onPress?: (tag: string) => void;
  colors?: string[];
  centerLabel?: string;
  centerSubLabel?: string;
  legendMode?: 'below' | 'arc' | 'none';
  strokeWidth?: number;
}

interface PieChartProps {
  data: { tag: string; count: number }[];
  size?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  onPress?: (tag: string) => void;
  colors?: string[];
  centerLabel?: string;
  centerSubLabel?: string;
}

export const PieChart = ({
  data,
  size = 220,
  canvasWidth,
  canvasHeight,
  onPress,
  colors: customColors,
  centerLabel,
  centerSubLabel,
}: PieChartProps) => {
  const { colors: themeColors } = useTheme();
  const total = data.reduce((acc, curr) => acc + curr.count, 0);
  const chartWidth = canvasWidth || size + 160;
  const chartHeight = canvasHeight || size + 120;
  const centerX = chartWidth / 2;
  const centerY = size / 2 + 46;
  const radius_val = Math.max(56, size / 2 - 22);
  const innerRadius = Math.max(34, radius_val * 0.42);
  const chartColors = customColors || [themeColors.primary, '#8a795d', '#d0b48a', '#c29b61', '#e0c097', themeColors.textTertiary];
  let currentAngle = -90;

  return (
    <View style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <View style={{ width: chartWidth, height: chartHeight }}>
        <Svg height={chartHeight} width={chartWidth}>
          {total === 0 ? (
            <Circle cx={centerX} cy={centerY} r={radius_val} fill={themeColors.border} />
          ) : (
            data.map((item, i) => {
              const percentage = item.count / total;
              const angle = percentage * 360;
              const startRadians = (Math.PI * currentAngle) / 180;
              const endRadians = (Math.PI * (currentAngle + angle)) / 180;
              const x1 = centerX + radius_val * Math.cos(startRadians);
              const y1 = centerY + radius_val * Math.sin(startRadians);
              const x2 = centerX + radius_val * Math.cos(endRadians);
              const y2 = centerY + radius_val * Math.sin(endRadians);
              const largeArcFlag = angle > 180 ? 1 : 0;
              const color = chartColors[i % chartColors.length];
              const midAngle = currentAngle + angle / 2;
              const labelRadians = (Math.PI * midAngle) / 180;
              const rawX = centerX + (radius_val + 14) * Math.cos(labelRadians);
              const labelX = Math.max(14, Math.min(chartWidth - 14, rawX));
              const labelY = centerY + (radius_val + 14) * Math.sin(labelRadians) + 4;
              const percent = Math.round(percentage * 100);
              const anchor = rawX >= centerX ? 'start' : 'end';
              const compactTag = item.tag.length > 14 ? `${item.tag.slice(0, 12)}..` : item.tag;
              const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius_val} ${radius_val} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
              currentAngle += angle;

              return (
                <G key={item.tag}>
                  <Path
                    d={path}
                    fill={color}
                    opacity={0.42}
                    transform="translate(0, 10)"
                  />
                  <Path d={path} fill={color} onPress={() => onPress && onPress(item.tag)} />
                  <Path
                    d={`M ${centerX + radius_val * 0.88 * Math.cos(labelRadians)} ${centerY + radius_val * 0.88 * Math.sin(labelRadians)} L ${labelX - (labelX >= centerX ? 6 : -6)} ${labelY - 3}`}
                    stroke={color}
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <SvgText
                    x={labelX}
                    y={labelY}
                    fill={themeColors.textPrimary}
                    fontSize="10"
                    textAnchor={anchor}
                    fontWeight="700"
                  >
                    {`${compactTag} ${item.count}(${percent}%)`}
                  </SvgText>
                </G>
              );
            })
          )}
          {total > 0 ? (
            <>
              <Circle cx={centerX} cy={centerY + 10} r={innerRadius} fill={themeColors.border} opacity={0.22} />
              <Circle cx={centerX} cy={centerY} r={innerRadius} fill={themeColors.surface} />
            </>
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFillObject, { width: chartWidth, height: chartHeight, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', paddingTop: 22 }]}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: themeColors.textPrimary }}>{centerLabel || total}</Text>
          <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.textSecondary }}>{centerSubLabel || 'TOTAL Qs'}</Text>
        </View>
      </View>
    </View>
  );
};

export const DonutChart = ({
  data,
  size = 180,
  onPress,
  colors: customColors,
  centerLabel,
  centerSubLabel,
  legendMode = 'below',
  strokeWidth = 20,
}: DonutChartProps) => {
  const { colors: themeColors } = useTheme();
  const total = data.reduce((acc, curr) => acc + curr.count, 0);
  const radius_val = size / 2 - strokeWidth - 8;
  const center = size / 2;
  const chartColors = customColors || [themeColors.primary, '#8a795d', '#d0b48a', '#c29b61', '#e0c097', themeColors.textTertiary];

  let currentAngle = 0;
  const labelRadius = radius_val + strokeWidth / 2 + 10;
  const slices: Array<{ item: { tag: string; count: number }; color: string; midAngle: number }> = [];

  return (
    <View style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <View style={{ width: size, height: legendMode === 'arc' ? size + 80 : size }}>
      <Svg height={legendMode === 'arc' ? size + 80 : size} width={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {total === 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius_val}
              stroke={themeColors.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
          ) : (
            data.map((item, i) => {
              const percentage = item.count / total;
              const angle = percentage * 360;
              const color = chartColors[i % chartColors.length];
              const midAngle = currentAngle + angle / 2;
              
              // Ensure we don't have gaps if there's only one segment
              if (percentage === 1) {
                slices.push({ item, color, midAngle: 180 });
                return (
                  <Circle
                    key={item.tag}
                    cx={center}
                    cy={center}
                    r={radius_val}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    onPress={() => onPress && onPress(item.tag)}
                  />
                );
              }

              const x1 = center + radius_val * Math.cos((Math.PI * currentAngle) / 180);
              const y1 = center + radius_val * Math.sin((Math.PI * currentAngle) / 180);
              const x2 = center + radius_val * Math.cos((Math.PI * (currentAngle + angle)) / 180);
              const y2 = center + radius_val * Math.sin((Math.PI * (currentAngle + angle)) / 180);

              const largeArcFlag = angle > 180 ? 1 : 0;
              const d = `M ${x1} ${y1} A ${radius_val} ${radius_val} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
              slices.push({ item, color, midAngle });

              const path = (
                <Path
                  key={item.tag}
                  d={d}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  onPress={() => onPress && onPress(item.tag)}
                />
              );

              currentAngle += angle;
              return path;
            })
          )}
        </G>
        {legendMode === 'arc' && total > 0 && slices.slice(0, 6).map(({ item, color, midAngle }) => {
          const radians = ((midAngle - 90) * Math.PI) / 180;
          const rawX = center + labelRadius * Math.cos(radians);
          const x = Math.max(14, Math.min(size - 14, rawX));
          const y = center + labelRadius * Math.sin(radians) + 4;
          const percent = Math.round((item.count / total) * 100);
          const anchor = rawX >= center ? 'start' : 'end';
          const compactTag = item.tag.length > 14 ? `${item.tag.slice(0, 12)}..` : item.tag;
          const label = `${compactTag} ${item.count}(${percent}%)`;

          return (
            <G key={`label-${item.tag}`}>
              <Path
                d={`M ${center + (radius_val + strokeWidth / 2) * Math.cos(radians)} ${center + (radius_val + strokeWidth / 2) * Math.sin(radians)} L ${x - (x >= center ? 6 : -6)} ${y - 4}`}
                stroke={color}
                strokeWidth="1.5"
                fill="none"
              />
              <SvgText
                x={x}
                y={y}
                fill={themeColors.textPrimary}
                fontSize="10"
                textAnchor={anchor}
                fontWeight="700"
              >
                {label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, { width: size, height: size, alignItems: 'center', justifyContent: 'center' }]}>
           <Text style={{ fontSize: 24, fontWeight: '900', color: themeColors.primary }}>{centerLabel || total}</Text>
           <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.textTertiary }}>{centerSubLabel || 'TOTAL Qs'}</Text>
      </View>
      </View>
      
      {legendMode === 'below' && (
        <View style={{ width: '100%', marginTop: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {data.map((item, i) => (
              <TouchableOpacity 
                key={item.tag} 
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: themeColors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: themeColors.border }}
                onPress={() => onPress && onPress(item.tag)}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: chartColors[i % chartColors.length] }} />
                <Text style={{ fontSize: 12, color: themeColors.textPrimary, fontWeight: '700' }}>
                  {item.tag}
                </Text>
                <Text style={{ fontSize: 10, color: themeColors.textTertiary, fontWeight: '800' }}>
                  {total > 0 ? Math.round((item.count/total)*100) : 0}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export const ProgressRing = ({ value, progress, label = '', size = 120 }: { value?: number, progress?: number, label?: string, size?: number }) => {
  const { colors } = useTheme();
  const actualValue = value ?? progress ?? 0;
  const radius_val = size / 2 - 10;
  const circumference = 2 * Math.PI * radius_val;
  const strokeDashoffset = circumference - (actualValue / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius_val}
          stroke={colors.border}
          strokeWidth="10"
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius_val}
          stroke={colors.primary}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <G>
          <SvgText
            x={size / 2}
            y={label ? size / 2 - 5 : size / 2 + 8}
            fill={colors.textPrimary}
            fontSize="24"
            fontWeight="900"
            textAnchor="middle"
          >
            {actualValue}%
          </SvgText>
          {label ? (
            <SvgText
              x={size / 2}
              y={size / 2 + 15}
              fill={colors.textSecondary}
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
            >
              {label.toUpperCase()}
            </SvgText>
          ) : null}
        </G>
      </Svg>
    </View>
  );
};
export const LineChart = ({
  data,
  height = 220,
  labels,
  colors: seriesColors,
  width,
  topInset = 24,
}: {
  data: { label: string, values: number[] }[],
  height?: number,
  labels: string[],
  colors?: string[],
  width?: number,
  topInset?: number,
}) => {
  const { colors: theme } = useTheme();
  const screenWidth = width || (Dimensions.get('window').width - spacing.lg * 4);
  const paddingLeft = 40;
  const paddingBottom = 30;
  const paddingRight = 20;
  const chartWidth = screenWidth - paddingLeft;
  const chartHeight = height - paddingBottom - topInset;
  
  const allValues = data.flatMap(d => d.values);
  const maxValue = allValues.length > 0 ? Math.max(1, ...allValues) : 1;
  const palette = seriesColors || ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <View style={{ height, width: '100%', marginTop: spacing.md }}>
      <Svg height={height} width={screenWidth}>
        {/* Y Axis Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <G key={i}>
            <Path
              d={`M ${paddingLeft} ${topInset + chartHeight * (1 - p)} L ${screenWidth - paddingRight} ${topInset + chartHeight * (1 - p)}`}
              stroke={theme.border}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <SvgText
              x={paddingLeft - 10}
              y={topInset + chartHeight * (1 - p) + 4}
              fill={theme.textSecondary}
              fontSize="10"
              textAnchor="end"
              fontWeight="600"
            >
              {Math.round(maxValue * p)}
            </SvgText>
          </G>
        ))}

        {/* X Axis Labels */}
        {labels.map((label, i) => {
          const x = paddingLeft + (i / (labels.length - 1 || 1)) * (chartWidth - paddingRight - 10) + 10;
          const y = height - 10;
          return (
            <SvgText
              key={i}
              x={x}
              y={y}
              fill={theme.textSecondary}
              fontSize="9"
              textAnchor="end"
              fontWeight="700"
              transform={`rotate(-30, ${x}, ${y})`}
            >
              {label}
            </SvgText>
          );
        })}

        {/* Lines */}
        {data.map((series, seriesIndex) => {
          let pathData = "";
          series.values.forEach((val, i) => {
            const x = paddingLeft + (i / (labels.length - 1 || 1)) * (chartWidth - paddingRight - 10) + 10;
            const y = topInset + chartHeight - (val / maxValue) * chartHeight;
            if (i === 0) pathData += `M ${x} ${y}`;
            else pathData += ` L ${x} ${y}`;
          });

          return (
            <G key={series.label}>
              <Path
                d={pathData}
                fill="none"
                stroke={palette[seriesIndex % palette.length]}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Points */}
              {series.values.map((val, i) => {
                const x = paddingLeft + (i / (labels.length - 1 || 1)) * (chartWidth - paddingRight - 10) + 10;
                const y = topInset + chartHeight - (val / maxValue) * chartHeight;
                return (
                  <Circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={palette[seriesIndex % palette.length]}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                );
              })}
            </G>
          );
        })}
      </Svg>
    </View>
  );
};

interface RadarChartProps {
  data: { label: string; value: number }[];
  size?: number;
  max?: number;
}

export const RadarChart = ({ data, size = 200, max = 100 }: RadarChartProps) => {
  const { colors: theme } = useTheme();
  const center = size / 2;
  const radius = size / 2 - 20;
  const angleStep = (Math.PI * 2) / data.length;

  const points = data.map((item, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (item.value / max) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md }}>
      <Svg height={size} width={size}>
        {/* Grid Circles */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((p, i) => (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius * p}
            fill="none"
            stroke={theme.border}
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Axes */}
        {data.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <Path
              key={i}
              d={`M ${center} ${center} L ${x} ${y}`}
              stroke={theme.border}
              strokeWidth="1"
            />
          );
        })}

        {/* Data Path */}
        <Path
          d={pathData}
          fill={theme.primary + '30'}
          stroke={theme.primary}
          strokeWidth="2"
        />

        {/* Labels */}
        {data.map((item, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + (radius + 15) * Math.cos(angle);
          const y = center + (radius + 15) * Math.sin(angle);
          return (
            <SvgText
              key={i}
              x={x}
              y={y}
              fill={theme.textSecondary}
              fontSize="10"
              fontWeight="800"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {item.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

interface ScatterPlotProps {
  data: { x: number; y: number }[];
  height?: number;
}

export const ScatterPlot = ({ data, height = 220 }: ScatterPlotProps) => {
  const { colors: theme } = useTheme();
  const screenWidth = Dimensions.get('window').width - spacing.lg * 4;
  const paddingLeft = 40;
  const paddingBottom = 30;
  const chartWidth = screenWidth - paddingLeft;
  const chartHeight = height - paddingBottom;
  
  if (!data || data.length === 0) return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.textTertiary, fontSize: 12 }}>No data available</Text></View>;

  const maxX = Math.max(100, ...data.map(d => d.x));
  const minX = Math.min(0, ...data.map(d => d.x));
  const maxY = Math.max(200, ...data.map(d => d.y)); // Assuming 200 is max score
  const minY = Math.min(0, ...data.map(d => d.y));

  return (
    <View style={{ height, width: '100%', marginTop: spacing.md }}>
      <Svg height={height} width={screenWidth}>
        {/* Y Axis Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <G key={`y-${i}`}>
            <Path
              d={`M ${paddingLeft} ${chartHeight * (1 - p)} L ${screenWidth} ${chartHeight * (1 - p)}`}
              stroke={theme.border}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <SvgText
              x={paddingLeft - 10}
              y={chartHeight * (1 - p) + 4}
              fill={theme.textSecondary}
              fontSize="10"
              textAnchor="end"
              fontWeight="600"
            >
              {Math.round(minY + (maxY - minY) * p)}
            </SvgText>
          </G>
        ))}

        {/* X Axis Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <SvgText
            key={`x-${i}`}
            x={paddingLeft + (chartWidth * p)}
            y={height - 10}
            fill={theme.textSecondary}
            fontSize="10"
            textAnchor="middle"
            fontWeight="700"
          >
            {Math.round(minX + (maxX - minX) * p)}
          </SvgText>
        ))}

        {/* Dots */}
        {data.map((point, i) => {
          const x = paddingLeft + ((point.x - minX) / (maxX - minX || 1)) * chartWidth;
          const y = chartHeight - ((point.y - minY) / (maxY - minY || 1)) * chartHeight;
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={6}
              fill={theme.primary}
              opacity={0.8}
            />
          );
        })}
      </Svg>
    </View>
  );
};
