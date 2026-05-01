import { MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, Text, StyleSheet } from 'react-native';

export function AudioPlayer({ uri, label }: { uri: string; label: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status?.playing ?? false;

  const togglePlayback = async () => {
    if (isPlaying) {
      await player.pause();
      return;
    }
    if (status?.duration && status.currentTime >= status.duration) {
      await player.seekTo(0);
    }
    await player.play();
  };

  return (
    <Pressable style={styles.audioCard} onPress={togglePlayback}>
      <MaterialIcons
        name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
        size={20}
        color="#0f766e"
      />
      <Text style={styles.audioLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
