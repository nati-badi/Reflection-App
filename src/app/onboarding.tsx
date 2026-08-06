import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flame, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTranslation } from '../hooks/useTranslation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_STORAGE_KEY = '@has_seen_onboarding';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const slides = [
    {
      id: 'slide-1',
      title: t('onboardingSlide1Title'),
      desc: t('onboardingSlide1Desc'),
      icon: <Image source={require('../../assets/images/icon.png')} style={{ width: 120, height: 120, borderRadius: 28 }} />,
    },
    {
      id: 'slide-2',
      title: t('onboardingSlide2Title'),
      desc: t('onboardingSlide2Desc'),
      icon: (
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Flame size={54} color={theme.colors.streak} fill={theme.colors.streak} />
        </View>
      ),
    },
    {
      id: 'slide-3',
      title: t('onboardingSlide3Title'),
      desc: t('onboardingSlide3Desc'),
      icon: (
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ShieldCheck size={54} color={theme.colors.accent} />
        </View>
      ),
    },
    {
      id: 'slide-4',
      title: t('onboardingSlide4Title'),
      desc: t('onboardingSlide4Desc'),
      icon: (
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Sparkles size={54} color={theme.colors.accent} />
        </View>
      ),
    },
  ];

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (e) {
      console.error('Failed to save onboarding state:', e);
    }
    router.replace('/(auth)/login');
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const onScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={{ width: 60 }} />
        <Text style={[styles.appName, { color: theme.colors.textPrimary }]}>IKowMe</Text>
        <TouchableOpacity onPress={completeOnboarding} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>{t('onboardingSkip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconContainer}>{item.icon}</View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.desc, { color: theme.colors.textSecondary }]}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Bottom Footer Controls */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor: idx === currentIndex ? theme.colors.accent : theme.colors.border,
                  width: idx === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.nextButton, { backgroundColor: theme.colors.accent }]}
          activeOpacity={0.8}
        >
          <Text style={styles.nextText}>
            {currentIndex === slides.length - 1 ? t('onboardingGetStarted') : t('onboardingNext')}
          </Text>
          <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipButton: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  iconContainer: {
    marginBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  desc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    elevation: 3,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
