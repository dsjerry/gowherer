import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PreviewVideo } from '@/components/media-viewers';
import { TimelineMedia } from '@/types/journey';

interface Props {
  previewMedia: TimelineMedia | null;
  onClose: () => void;
}

export function MediaPreviewModal({ previewMedia, onClose }: Props) {
  return (
    <Modal
      visible={Boolean(previewMedia)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.previewOverlay}>
        <Pressable style={styles.previewClose} onPress={onClose}>
          <Text style={styles.previewCloseText}>Close</Text>
        </Pressable>
        {previewMedia?.type === 'video' ? (
          <PreviewVideo uri={previewMedia.uri} />
        ) : previewMedia ? (
          <Image
            source={{ uri: previewMedia.uri }}
            style={styles.previewMedia}
            contentFit="contain"
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  previewMedia: {
    width: '100%',
    height: '78%',
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCloseText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
