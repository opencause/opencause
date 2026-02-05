// Centralized Heroicons for Guild AI
// Using outline style for consistency
import {
  ComputerDesktopIcon,
  UserIcon,
  StarIcon,
  WrenchScrewdriverIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  EyeIcon,
  RocketLaunchIcon,
  ChatBubbleLeftIcon,
  ChartBarIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CalendarIcon,
  TrophyIcon,
  DocumentTextIcon,
  CpuChipIcon,
  UserGroupIcon,
  ArrowRightIcon,
  PlusIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  BeakerIcon,
  AcademicCapIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

import {
  StarIcon as StarIconSolid,
  CheckIcon as CheckIconSolid,
} from '@heroicons/react/24/solid';

// Re-export with friendly names
export {
  // Agents & Users
  ComputerDesktopIcon as AgentIcon,
  CpuChipIcon as RobotIcon,
  UserIcon,
  UserGroupIcon,
  
  // Stars & Awards
  StarIcon,
  StarIconSolid,
  TrophyIcon,
  SparklesIcon,
  
  // Actions
  CheckIcon,
  CheckIconSolid,
  CheckCircleIcon,
  XMarkIcon,
  XCircleIcon,
  PlusIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon as CopyIcon,
  
  // Warnings & Info
  ExclamationTriangleIcon as WarningIcon,
  InformationCircleIcon as InfoIcon,
  QuestionMarkCircleIcon as HelpIcon,
  
  // Money & Bounties
  CurrencyDollarIcon as MoneyIcon,
  BanknotesIcon as BountyIcon,
  
  // Security
  LockClosedIcon as LockIcon,
  ShieldCheckIcon as ShieldIcon,
  EyeIcon,
  
  // Navigation & Discovery
  MagnifyingGlassIcon as SearchIcon,
  LinkIcon,
  RocketLaunchIcon as LaunchIcon,
  
  // Content
  LightBulbIcon as IdeaIcon,
  DocumentTextIcon as DocumentIcon,
  BookOpenIcon,
  BeakerIcon as ExperimentIcon,
  AcademicCapIcon as LearnIcon,
  
  // Communication
  ChatBubbleLeftIcon as ChatIcon,
  
  // Data & Stats
  ChartBarIcon as StatsIcon,
  ArrowTrendingUpIcon as TrendIcon,
  
  // Time
  ClockIcon,
  CalendarIcon,
  
  // Settings
  WrenchScrewdriverIcon as ToolIcon,
  Cog6ToothIcon as SettingsIcon,
  
  // Misc
  FireIcon,
};

// Pre-styled icon components for common use cases
export function BountyBadge({ amount, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <CurrencyDollarIcon className="w-4 h-4" />
      ${(amount / 100).toLocaleString()}
    </span>
  );
}

export function StarBadge({ count, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <StarIconSolid className="w-4 h-4 text-yellow-400" />
      {count}
    </span>
  );
}

export function ValidationIcon({ status, className = 'w-4 h-4' }) {
  switch (status) {
    case 'validated':
      return <CheckIcon className={`${className} text-[var(--color-success)]`} />;
    case 'rejected':
      return <XMarkIcon className={`${className} text-[var(--color-danger)]`} />;
    case 'flagged_hallucination':
      return <ExclamationTriangleIcon className={`${className} text-[var(--color-danger)]`} />;
    default:
      return <ClockIcon className={`${className} text-[var(--color-text-muted)]`} />;
  }
}

export function AgentAvatar({ url, className = 'w-10 h-10' }) {
  if (url) {
    return <img src={url} alt="" className={`${className} rounded-full object-cover`} />;
  }
  return (
    <div className={`${className} rounded-full bg-[var(--color-bg-emphasis)] flex items-center justify-center`}>
      <ComputerDesktopIcon className="w-1/2 h-1/2 text-[var(--color-text-muted)]" />
    </div>
  );
}

export function UserAvatar({ url, className = 'w-10 h-10' }) {
  if (url) {
    return <img src={url} alt="" className={`${className} rounded-full object-cover`} />;
  }
  return (
    <div className={`${className} rounded-full bg-[var(--color-bg-emphasis)] flex items-center justify-center`}>
      <UserIcon className="w-1/2 h-1/2 text-[var(--color-text-muted)]" />
    </div>
  );
}
