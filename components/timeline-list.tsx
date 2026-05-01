import { Image } from 'expo-image';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/audio-player';
import { MediaVideoCover } from '@/components/media-viewers';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TimelineEntry, TimelineMedia } from '@/types/journey';

interface Props {
  entries: TimelineEntry[];
  onEditEntry: (entry: TimelineEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onPreviewMedia: (media: TimelineMedia) => void;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function mediaPreviewUri(media: TimelineMedia) {
  if (media.type === 'video') return media.thumbnailUri;
  if (media.type === 'audio') return undefined;
  return media.uri;
}

export function TimelineList({
  entries,
  onEditEntry,
  onDeleteEntry,
  onPreviewMedia,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const themedCard = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
  };
  const themedSectionTitle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedMuted = { color: isDark ? '#94a3b8' : '#64748b' };
  const themedDot = { backgroundColor: isDark ? '#22d3ee' : '#0f766e' };
  const themedLine = { backgroundColor: isDark ? '#475569' : '#cbd5e1' };
  const themedTime = { color: isDark ? '#94a3b8' : '#64748b' };
  const themedText = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedTagChip = { backgroundColor: isDark ? '#334155' : '#e0f2fe' };
  const themedTagChipText = { color: isDark ? '#e2e8f0' : '#0c4a6e' };
  const themedMediaBox = {
    borderColor: isDark ? '#334155' : '#e2e8f0',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  };
  const themedBadge = { color: isDark ? '#e2e8f0' : '#0f172a' };

  return (
    <View style={[styles.card, themedCard]}>
      <Text style={[styles.sectionTitle, themedSectionTitle]}>
        {t('journey.timelineTitle')}
      </Text>
      {entries.map((entry, index) => (
        <View key={entry.id} style={styles.timelineItem}>
          <View style={[styles.timelineDot, themedDot]} />
          <View style={styles.timelineContent}>
            <View style={styles.entryHeader}>
              <Text style={[styles.timelineTime, themedTime]}>
                {formatDateTime(entry.createdAt)}
              </Text>
              <View style={styles.inlineRow}>
                <Pressable onPress={() => onEditEntry(entry)}>
                  <Text style={styles.linkText}>{t('common.edit')}</Text>
                </Pressable>
                <Text style={[styles.mutedText, themedMuted]}> · </Text>
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      t('journey.alertDeleteEntryTitle'),
                      t('journey.alertDeleteEntryBody'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.delete'),
                          style: 'destructive',
                          onPress: () => onDeleteEntry(entry.id),
                        },
                      ]
                    )
                  }
                >
                  <Text style={styles.deleteText}>{t('common.delete')}</Text>
                </Pressable>
              </View>
            </View>
            {entry.text ? (
              <Text style={[styles.timelineText, themedText]}>
                {entry.text}
              </Text>
            ) : null}
            {entry.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {entry.tags.map((tag) => (
                  <View key={tag} style={[styles.tagChip, themedTagChip]}>
                    <Text style={[styles.tagChipText, themedTagChipText]}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {entry.location ? (
              <Text style={[styles.mutedText, themedMuted]}>
                📍
                {entry.location.placeName
                  ? ` ${entry.location.placeName} · `
                  : ' '}
                {entry.location.latitude.toFixed(5)},{' '}
                {entry.location.longitude.toFixed(5)}
              </Text>
            ) : null}
            {entry.media.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {entry.media.map((media) =>
                  media.type === 'audio' ? (
                    <View
                      key={media.id}
                      style={[styles.mediaPreviewBox, themedMediaBox]}
                    >
                      <AudioPlayer
                        uri={media.uri}
                        label={t('journey.audioBadge')}
                      />
                      <Text style={[styles.mediaBadge, themedBadge]}>
                        {t('journey.audioBadge')}
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      key={media.id}
                      style={[styles.mediaPreviewBox, themedMediaBox]}
                      onPress={() => onPreviewMedia(media)}
                    >
                      {mediaPreviewUri(media) ? (
                        <Image
                          source={{ uri: mediaPreviewUri(media) }}
                          style={styles.mediaPreview}
                          contentFit="cover"
                        />
                      ) : media.type === 'video' ? (
                        <MediaVideoCover uri={media.uri} />
                      ) : (
                        <View
                          style={[
                            styles.mediaPlaceholder,
                            {
                              backgroundColor: isDark ? '#334155' : '#0f172a',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.mediaPlaceholderText,
                              { color: '#ffffff' },
                            ]}
                          >
                            {t('journey.mediaBadgeVideo')}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.mediaBadge, themedBadge]}>
                        {media.type === 'video'
                          ? t('journey.mediaBadgeVideo')
                          : t('journey.mediaBadgePhoto')}
                      </Text>
                    </Pressable>
                  )
                )}
              </ScrollView>
            ) : null}
          </View>
          {index < entries.length - 1 ? (
            <View style={[styles.timelineLine, themedLine]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  timelineItem: {
    position: 'relative',
    paddingLeft: 18,
    paddingBottom: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0f766e',
    position: 'absolute',
    left: 0,
    top: 5,
  },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 16,
    bottom: -4,
    width: 2,
    backgroundColor: '#cbd5e1',
  },
  timelineContent: {
    gap: 6,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748b',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  linkText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  timelineText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e0f2fe',
  },
  tagChipText: {
    fontSize: 11,
    color: '#0c4a6e',
    fontWeight: '600',
  },
  mutedText: {
    color: '#64748b',
    fontSize: 12,
  },
  mediaPreviewBox: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 110,
  },
  mediaPreview: {
    width: 110,
    height: 80,
  },
  mediaPlaceholder: {
    width: 110,
    height: 80,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaBadge: {
    fontSize: 11,
    color: '#0f172a',
    padding: 4,
  },
});
