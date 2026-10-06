import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useEffect, useState } from 'react';

const videoThumbCache = new Map<string, string>();

// Videos render as generated thumbnails with a play badge; the actual player
// only runs inside the full-screen preview modal.
export function VideoThumbCover({ uri }: { uri: string }) {
  const [thumbnail, setThumbnail] = useState<string | null>(videoThumbCache.get(uri) ?? null);

  useEffect(() => {
    if (thumbnail) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: 500 });
        videoThumbCache.set(uri, thumbnailUri);
        if (active) {
          setThumbnail(thumbnailUri);
        }
      } catch {
        // Keep the loading placeholder on failure.
      }
    })();
    return () => {
      active = false;
    };
  }, [uri, thumbnail]);

  return (
    <View style={styles.wrap}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.placeholder, styles.wrap, { backgroundColor: '#0f172a' }]}>
          <ActivityIndicator size="small" color="#94a3b8" />
        </View>
      )}
      <View style={styles.playBadge} pointerEvents="none">
        <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 110,
    height: 80,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
});
