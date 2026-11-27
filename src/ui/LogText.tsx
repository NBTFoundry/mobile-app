// SPDX-License-Identifier: MPL-2.0
/**
 * A log in a scrolling box, oldest line first, kept scrolled to the newest line as lines
 * arrive, unless the reader has scrolled up. The text is not selectable: on Android a
 * selectable Text swallows the swipe that scrolls the box. Share gives the whole text. The
 * scrollbar stays visible (Android hides an idle one).
 *
 * On the emulator the newest line was drawn half below the box's end. Against that: the
 * border is on a frame, not the ScrollView (Android does not subtract a ScrollView's own
 * border from its content's width, so wrapped text is measured short), the font is the
 * default one with its own line height, and the end has a line's worth of room.
 */
import { useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useColors, useStyles } from './kit';

/** Within this many pixels of the end counts as at the end. */
const END_SLACK = 24;

export function LogText({ text }: { text: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const box = useRef<ComponentRef<typeof ScrollView>>(null);
  const following = useRef(true);
  // Only the reader's own drags decide: Android also reports a scroll, at the old
  // position, when the text grows, which would look like scrolling up.
  const settled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    following.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - END_SLACK;
  };
  return (
    <View style={styles.frame}>
      <ScrollView ref={box} style={styles.box} contentContainerStyle={styles.content} nestedScrollEnabled
        onScrollEndDrag={settled} onMomentumScrollEnd={settled}
        persistentScrollbar showsVerticalScrollIndicator indicatorStyle={colors.isDark ? 'white' : 'black'}
        onContentSizeChange={() => {
          // A frame later, once the grown text is laid out.
          if (following.current) requestAnimationFrame(() => box.current?.scrollToEnd({ animated: false }));
        }}>
        <Text style={styles.text}>{text}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  frame: { borderWidth: 1, borderColor: colors.line, borderRadius: Math.min(colors.corner, 8), overflow: 'hidden' },
  box: { maxHeight: 360 },
  // Padding on the content, not the box, or scrolling to the end stops short of it.
  content: { padding: 10, paddingBottom: 30 },
  text: { color: colors.text, fontSize: 12 },
});
