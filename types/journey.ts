export type JourneyStatus = 'active' | 'completed';
export type MediaType = 'photo' | 'video';
export type JourneyKind = 'travel' | 'commute';

export type TimelineLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  placeName?: string;
};

export type TimelineMedia = {
  id: string;
  type: MediaType;
  uri: string;
  thumbnailUri?: string;
};

export type TimelineEntry = {
  id: string;
  createdAt: string;
  text: string;
  location?: TimelineLocation;
  media: TimelineMedia[];
  tags: string[];
};

export type Journey = {
  id: string;
  title: string;
  kind: JourneyKind;
  createdAt: string;
  endedAt?: string;
  status: JourneyStatus;
  tags: string[];
  entries: TimelineEntry[];
};
