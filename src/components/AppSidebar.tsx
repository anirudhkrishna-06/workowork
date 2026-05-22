import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { acknowledgeGeminiSidebarAlert, hasGeminiSidebarAlert, subscribeToGeminiErrorChanges } from '../services/geminiAlerts';

const MENU_WIDTH = 264;
const INK = '#0D0D0D';
const WHITE = '#FFFFFF';
const MUTED = '#8A8A82';
const BORDER = '#EBEBEA';

type AppRoute = 'Home' | 'Dashboard' | 'Report' | 'Tasks' | 'Timeline' | 'Settings';

const items: { label: string; route: AppRoute }[] = [
  { label: 'Home', route: 'Home' },
  { label: 'Dashboard', route: 'Dashboard' },
  { label: 'Reports', route: 'Report' },
  { label: 'Tasks', route: 'Tasks' },
  { label: 'Timeline', route: 'Timeline' },
  { label: 'Settings', route: 'Settings' },
];

export default function AppSidebar({ children }: PropsWithChildren) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasAlert, setHasAlert] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      setHasAlert(await hasGeminiSidebarAlert());
    };

    refresh();

    const unsubscribe = subscribeToGeminiErrorChanges(() => {
      if (active) {
        refresh();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const setMenuOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    Animated.spring(progress, {
      toValue: nextOpen ? 1 : 0,
      damping: 22,
      mass: 0.8,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  };

  const sidebarTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [MENU_WIDTH + 28, 0],
  });
  const sidebarOpacity = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.72, 1],
  });
  const sidebarScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });
  const scrimOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const topLine = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });
  const bottomLine = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-45deg'],
  });
  const middleLineOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const navigateTo = (nextRoute: AppRoute) => {
    setMenuOpen(false);
    if (nextRoute === 'Settings') {
      acknowledgeGeminiSidebarAlert();
      setHasAlert(false);
    }
    navigation.navigate(nextRoute);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
  };

  return (
    <View style={styles.shell}>
      {children}

      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.scrimWrap, { opacity: scrimOpacity }]}>
        <Pressable
          accessibilityLabel="Close sidebar"
          onPress={() => setMenuOpen(false)}
          style={styles.scrim}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          {
            opacity: sidebarOpacity,
            transform: [{ translateX: sidebarTranslate }, { scale: sidebarScale }],
          },
        ]}
      >
        <Image
          accessibilityLabel="WorkoWork"
          resizeMode="contain"
          source={require('../../assets/images/icon.png')}
          style={styles.sidebarLogo}
        />
        <View style={styles.menuList}>
          {items.map((item, index) => {
            const active = route.name === item.route;
            const itemTranslate = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [18 + index * 3, 0],
            });
            const itemOpacity = progress.interpolate({
              inputRange: [0, 0.28 + index * 0.08, 1],
              outputRange: [0, 0, 1],
            });
            return (
              <Animated.View key={item.label} style={{ opacity: itemOpacity, transform: [{ translateX: itemTranslate }] }}>
                <Pressable
                  onPress={() => navigateTo(item.route)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    active && styles.menuItemActive,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Text style={[styles.menuText, active && styles.menuTextActive]}>{item.label}</Text>
                  {item.route === 'Settings' && hasAlert && <View style={styles.menuAlertDot} />}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        <View style={styles.sidebarFooter}>
          <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logout, pressed && styles.menuItemPressed]}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Pressable
        accessibilityLabel={open ? 'Close navigation menu' : 'Open navigation menu'}
        onPress={() => setMenuOpen(!open)}
        style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
      >
        <Animated.View style={[styles.menuLine, styles.menuLineTop, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }, { rotate: topLine }] }]} />
        <Animated.View style={[styles.menuLine, { opacity: middleLineOpacity }]} />
        <Animated.View style={[styles.menuLine, styles.menuLineBottom, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { rotate: bottomLine }] }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  scrimWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.24)',
  },
  menuButton: {
    position: 'absolute',
    right: 20,
    top: 52,
    width: 44,
    height: 44,
    borderRadius: 42,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 40,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuButtonPressed: {
    opacity: 0.82,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: WHITE,
  },
  menuLineTop: {
    position: 'relative',
  },
  menuLineBottom: {
    position: 'relative',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: WHITE,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    paddingTop: 112,
    paddingHorizontal: 18,
    paddingBottom: 28,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: -6, height: 0 },
    elevation: 8,
  },
  sidebarLogo: {
    alignSelf: 'center',
    height: 184,
    marginBottom: 0,
    marginTop: -50,
    width: 184,
  },
  menuList: {
    gap: 4,
  },
  menuItem: {
    borderRadius: 36,
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: '#F7F6F2',
    borderWidth: 1,
    borderColor: BORDER,
  },
  menuItemPressed: {
    opacity: 0.72,
  },
  menuText: {
    color: MUTED,
    fontSize: 16,
    fontWeight: '500',
  },
  menuTextActive: {
    color: INK,
  },
  menuAlertDot: {
    backgroundColor: '#D94A4A',
    borderRadius: 5,
    height: 10,
    position: 'absolute',
    right: 14,
    top: 16,
    width: 10,
  },
  sidebarFooter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logout: {
    alignSelf: 'center',
    backgroundColor: INK,
    borderRadius: 38,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: INK,
    width: 172,
  },
  logoutText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '400',
  },
});
