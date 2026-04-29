import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export interface LineChartProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  title?: string;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

export function LineChart({ data, options, title, height = 300, className = '', ariaLabel }: LineChartProps) {
  const mergedOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: title ? { display: true, text: title } : { display: false },
    },
    ...options,
  };

  return (
    <div className={`relative ${className}`} style={{ height }} role="img" aria-label={ariaLabel ?? title ?? 'Line chart'}>
      <Line data={data} options={mergedOptions} />
    </div>
  );
}

export default LineChart;
