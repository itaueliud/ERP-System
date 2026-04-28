import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface BarChartProps {
  data: ChartData<'bar'>;
  options?: ChartOptions<'bar'>;
  title?: string;
  height?: number;
  horizontal?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function BarChart({ data, options, title, height = 300, horizontal, className = '', ariaLabel }: BarChartProps) {
  const mergedOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { position: 'top' },
      title: title ? { display: true, text: title } : { display: false },
    },
    ...options,
  };

  return (
    <div className={`relative ${className}`} style={{ height }} role="img" aria-label={ariaLabel ?? title ?? 'Bar chart'}>
      <Bar data={data} options={mergedOptions} />
    </div>
  );
}

export default BarChart;
