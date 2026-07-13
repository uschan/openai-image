import type { LucideIcon } from 'lucide-react';
import {
  Apple, Archive, Bird, BookOpen, Bookmark, Brush, Bug, CakeSlice, Camera, Cat,
  Cherry, CircleHelp, Clock3, Coffee, Dog, Droplets, Film, Fish, Flag, FlaskConical,
  Flower2, Folder, Globe2, Heart, Image, Inbox, Layers, Leaf, MapPin, Microscope,
  Mountain, Package, Palette, PawPrint, PenTool, Rabbit, Shapes, Shell, Soup,
  Sparkles, Sprout, Star, Sun, Tags, Telescope, TreePine, TriangleAlert, Utensils,
  UsersRound, Waves,
} from 'lucide-react';

export interface CategoryIconOption {
  name: string;
  Icon: LucideIcon;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { name: 'Layers', Icon: Layers },
  { name: 'Folder', Icon: Folder },
  { name: 'Inbox', Icon: Inbox },
  { name: 'Archive', Icon: Archive },
  { name: 'Package', Icon: Package },
  { name: 'Tags', Icon: Tags },
  { name: 'Bookmark', Icon: Bookmark },
  { name: 'Star', Icon: Star },
  { name: 'Flower2', Icon: Flower2 },
  { name: 'Leaf', Icon: Leaf },
  { name: 'Sprout', Icon: Sprout },
  { name: 'TreePine', Icon: TreePine },
  { name: 'Mountain', Icon: Mountain },
  { name: 'Waves', Icon: Waves },
  { name: 'Droplets', Icon: Droplets },
  { name: 'Sun', Icon: Sun },
  { name: 'Bug', Icon: Bug },
  { name: 'Bird', Icon: Bird },
  { name: 'Fish', Icon: Fish },
  { name: 'Dog', Icon: Dog },
  { name: 'Cat', Icon: Cat },
  { name: 'Rabbit', Icon: Rabbit },
  { name: 'PawPrint', Icon: PawPrint },
  { name: 'Shell', Icon: Shell },
  { name: 'Apple', Icon: Apple },
  { name: 'Cherry', Icon: Cherry },
  { name: 'Coffee', Icon: Coffee },
  { name: 'Utensils', Icon: Utensils },
  { name: 'Soup', Icon: Soup },
  { name: 'CakeSlice', Icon: CakeSlice },
  { name: 'Camera', Icon: Camera },
  { name: 'Image', Icon: Image },
  { name: 'Film', Icon: Film },
  { name: 'Palette', Icon: Palette },
  { name: 'Brush', Icon: Brush },
  { name: 'PenTool', Icon: PenTool },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Shapes', Icon: Shapes },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'Microscope', Icon: Microscope },
  { name: 'FlaskConical', Icon: FlaskConical },
  { name: 'Telescope', Icon: Telescope },
  { name: 'Globe2', Icon: Globe2 },
  { name: 'MapPin', Icon: MapPin },
  { name: 'UsersRound', Icon: UsersRound },
  { name: 'Clock3', Icon: Clock3 },
  { name: 'Heart', Icon: Heart },
  { name: 'Flag', Icon: Flag },
  { name: 'CircleHelp', Icon: CircleHelp },
  { name: 'TriangleAlert', Icon: TriangleAlert },
];

const CATEGORY_ICON_MAP = new Map(CATEGORY_ICON_OPTIONS.map(option => [option.name, option.Icon]));

export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = CATEGORY_ICON_MAP.get(name || '') || Layers;
  return <Icon className={className} />;
}
