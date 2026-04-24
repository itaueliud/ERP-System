// Auth
export { Login } from './auth/Login';
export type { LoginProps } from './auth/Login';
export { Register } from './auth/Register';
export type { RegisterProps } from './auth/Register';
export { PasswordReset } from './auth/PasswordReset';
export type { PasswordResetProps } from './auth/PasswordReset';
export { TwoFactorAuth } from './auth/TwoFactorAuth';
export type { TwoFactorAuthProps } from './auth/TwoFactorAuth';

// Layout
export { Header } from './layout/Header';
export type { HeaderProps, HeaderUser } from './layout/Header';
export { Sidebar } from './layout/Sidebar';
export type { SidebarProps, SidebarItem } from './layout/Sidebar';
export { Footer } from './layout/Footer';
export type { FooterProps, FooterLink } from './layout/Footer';
export { Navigation } from './layout/Navigation';
export type { NavigationProps, NavItem } from './layout/Navigation';

// Forms
export { Input } from './forms/Input';
export type { InputProps } from './forms/Input';
export { Select } from './forms/Select';
export type { SelectProps, SelectOption } from './forms/Select';
export { DatePicker } from './forms/DatePicker';
export type { DatePickerProps } from './forms/DatePicker';
export { FileUpload } from './forms/FileUpload';
export type { FileUploadProps } from './forms/FileUpload';
export { RichTextEditor } from './forms/RichTextEditor';
export type { RichTextEditorProps } from './forms/RichTextEditor';

// Data display
export { Table } from './data/Table';
export type { TableProps, TableColumn } from './data/Table';
export { Card } from './data/Card';
export type { CardProps } from './data/Card';
export { List } from './data/List';
export type { ListProps, ListItem } from './data/List';
export { Timeline } from './data/Timeline';
export type { TimelineProps, TimelineEvent } from './data/Timeline';
export { ActivityFeed } from './data/ActivityFeed';
export type { ActivityFeedProps, ActivityItem } from './data/ActivityFeed';

// Charts
export { LineChart } from './charts/LineChart';
export type { LineChartProps } from './charts/LineChart';
export { BarChart } from './charts/BarChart';
export type { BarChartProps } from './charts/BarChart';
export { PieChart } from './charts/PieChart';
export type { PieChartProps } from './charts/PieChart';
export { AreaChart } from './charts/AreaChart';
export type { AreaChartProps } from './charts/AreaChart';

// Modals
export { Modal } from './modals/Modal';
export type { ModalProps } from './modals/Modal';
export { Dialog } from './modals/Dialog';
export type { DialogProps } from './modals/Dialog';

// Notifications
export { Toast, ToastContainer } from './notifications/Toast';
export type { ToastProps, ToastContainerProps } from './notifications/Toast';
export { Alert } from './notifications/Alert';
export type { AlertProps } from './notifications/Alert';
export { Banner } from './notifications/Banner';
export type { BannerProps } from './notifications/Banner';

// Icons
export { Icon } from './icons/Icon';
export type { IconProps, IconSize } from './icons/Icon';
export {
  CheckIcon,
  XIcon,
  AlertIcon,
  InfoIcon,
  UserIcon,
  LockIcon,
  HomeIcon,
  MenuIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  BellIcon,
  SettingsIcon,
  LogoutIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  CalendarIcon,
  DocumentIcon,
  FolderIcon,
  ChartBarIcon,
  CurrencyIcon,
  BuildingIcon,
} from './icons/icons';
export { StatusIndicator } from './icons/StatusIndicator';
export type { StatusIndicatorProps, StatusType } from './icons/StatusIndicator';

// Accessibility
export { SkipLink } from './a11y/SkipLink';
export type { SkipLinkProps } from './a11y/SkipLink';
export { LiveRegion } from './a11y/LiveRegion';
export type { LiveRegionProps } from './a11y/LiveRegion';
export { VisuallyHidden } from './a11y/VisuallyHidden';
export type { VisuallyHiddenProps } from './a11y/VisuallyHidden';

// Existing
export { LazyImage } from './LazyImage';
export type { } from './LazyImage';

// Theme
export { ThemeToggle } from '../theme/ThemeToggle';
export type { ThemeToggleProps } from '../theme/ThemeToggle';
export { useTheme } from '../theme/ThemeContext';
export type { Theme } from '../theme/ThemeContext';
