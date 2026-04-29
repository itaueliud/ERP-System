import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export interface PieChartProps {
  data: ChartData<'pie'>;
  options?: ChartOptions<'pie'>;
  title?: string;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

export function PieChart({ data, options, title, height = 300, className = '', ariaLabel }: PieChartProps) {
  const mergedOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
      title: title ? { display: true, text: title } : { display: false },
    },
    ...options,
  };

  return (
    <div className={`relative ${className}`} style={{ height }} role="img" aria-label={ariaLabel ?? title ?? 'Pie chart'}>
      <Pie data={data} options={mergedOptions} />
    </div>
  );
}

export default PieChart;
