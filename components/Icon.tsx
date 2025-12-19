import React from 'react';
import {
  Wallet,
  LayoutDashboard,
  Upload,
  Receipt,
  FileCheck,
  Trash2,
  Pencil,
  Plus,
  Play,
  GripVertical,
  HelpCircle,
  ShoppingCart,
  Car,
  UtensilsCrossed,
  Repeat,
  ArrowLeftRight,
  Download,
  Settings,
  FolderCog,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconProps {
  name: string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  logo: Wallet,
  dashboard: LayoutDashboard,
  upload: Upload,
  transactions: Receipt,
  rules: FileCheck,
  trash: Trash2,
  edit: Pencil,
  plus: Plus,
  play: Play,
  drag: GripVertical,
  question: HelpCircle,
  shoppingCart: ShoppingCart,
  car: Car,
  dining: UtensilsCrossed,
  subscription: Repeat,
  income: ArrowLeftRight,
  download: Download,
  settings: Settings,
  categories: FolderCog,
  search: Search,
  close: X,
};

const Icon: React.FC<IconProps> = ({ name, className }) => {
  const IconComponent = iconMap[name] || HelpCircle;
  return <IconComponent className={cn(className)} />;
};

export default Icon;
