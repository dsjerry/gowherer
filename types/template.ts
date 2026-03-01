import { JourneyKind } from '@/types/journey';

export type EntryTemplate = {
  id: string;
  label: string;
  text: string;
  tags: string[];
};

export type EntryTemplateConfig = Record<JourneyKind, EntryTemplate[]>;
