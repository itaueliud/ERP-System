import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

export interface AreaChartProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  title?: string;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

/** Area chart is a Line chart with `fill: true` on each dataset. */
export function AreaChart({ data, options, title, height = 300, className = '', ariaLabel }: AreaChartProps) {
  const filledData: ChartData<'line'> = {
    ...data,
    datasets: data.datasets.map((ds) => ({ fill: true, ...ds })),
  };

  const mergedOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: title ? { display: true, text: title } : { display: false },
    },
    elements: { line: { tension: 0.4 } },
    ...options,
  };

  return (
    <div className={`relative ${className}`} style={{ height }} role="img" aria-label={ariaLabel ?? title ?? 'Area chart'}>
      <Line data={filledData} options={mergedOptions} />
    </div>
  );
}

export default AreaChart;
