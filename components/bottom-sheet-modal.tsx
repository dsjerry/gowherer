import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

const SLIDE_DISTANCE = 400;
const SLIDE_DURATION = 260;

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 固定在弹窗底部的内容（如合计行），位于可滚动 children 之外 */
  footer?: ReactNode;
};

/**
 * 底部滑出弹窗。Modal 本体只做 fade（遮罩淡入淡出），面板的升/降由
 * reanimated 驱动——animationType="slide" 会把半透明遮罩一起从底部推上来，
 * 视觉很怪。关闭时先滑下，动画结束后再卸载 Modal。
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  footer,
}: BottomSheetModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // visible=false 后面板要先滑完再真正卸载，所以用内部 mounted 控制 Modal
  const [mounted, setMounted] = useState(visible);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const translateY = useSharedValue(SLIDE_DISTANCE);

  useEffect(() => {
    if (visible) {
      // 打开前先取消上一周期的收起动画与兜底定时器
      cancelAnimation(translateY);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = undefined;
      }
      setMounted(true);
      translateY.value = SLIDE_DISTANCE;
      translateY.value = withTiming(0, { duration: SLIDE_DURATION });
    }
  }, [visible, translateY]);

  useEffect(() => {
    if (!visible && mounted) {
      cancelAnimation(translateY);
      translateY.value = withTiming(SLIDE_DISTANCE, { duration: SLIDE_DURATION });
      // 卸载由定时器驱动：withTiming 的完成回调在真机上（列表挂着多个 AMap
      // 实例时）可能永远不触发，导致 sheet 卡在半路吞掉后续所有点击。
      // 动画只是视觉层，卸载不依赖它。
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = undefined;
        setMounted(false);
      }, SLIDE_DURATION + 60);
    }
  }, [visible, mounted, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="fade" onRequestClose={onClose}>
      {/* 收起动画期间不再拦截底层屏幕的点击 */}
      <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[styles.panel, isDark ? styles.panelDark : styles.panelLight, animatedStyle]}
        >
          <View style={isDark ? styles.grabberDark : styles.grabber} />
          {title ? <Text style={[styles.title, themedTitle(isDark)]}>{title}</Text> : null}
          {children}
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

function themedTitle(isDark: boolean) {
  return { color: isDark ? '#e2e8f0' : '#0f172a' };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  panelDark: {
    backgroundColor: '#1e293b',
  },
  panelLight: {
    backgroundColor: '#ffffff',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
  },
  grabberDark: {
    backgroundColor: '#475569',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
});
