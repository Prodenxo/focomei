import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { View, StyleSheet, PanResponder, BackHandler } from "react-native";
import { useThemeStore } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { getTheme } from "../lib/theme";
import { APP_BRAND_NAME } from "../lib/appBrand";
import SideDrawer, { DrawerItem } from "../components/SideDrawer";
import ImpersonationBanner from "../components/ImpersonationBanner";
import {
  NavigationContext,
  type AppScreenName,
} from "../lib/navigationContext";

import SettingsScreen from "../screens/SettingsScreen";
import MeiScreen from "../screens/MeiScreen";

const ALL_ITEMS: DrawerItem<AppScreenName>[] = [
  {
    name: "MeuMei",
    icon: "briefcase-outline",
    activeIcon: "briefcase",
    label: "Meu MEI",
  },
  {
    name: "Configuracoes",
    icon: "settings-outline",
    activeIcon: "settings",
    label: "Configurações",
  },
];

export default function SimpleNavigator() {
  const [currentScreen, setCurrentScreen] =
    useState<AppScreenName>("MeuMei");
  const [screenHistory, setScreenHistory] = useState<AppScreenName[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(), []);

  const drawerItems = ALL_ITEMS;

  const navigateTo = useCallback((screen: AppScreenName) => {
    setScreenHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
    setDrawerOpen(false);
  }, [currentScreen]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  const navContext = useMemo(
    () => ({
      openDrawer,
      navigateTo,
      hasGlobalNav: false,
      shellLocked: false,
      requestSignOut: () => {},
    }),
    [openDrawer, navigateTo],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (screenHistory.length > 0) {
        const prev = screenHistory[screenHistory.length - 1];
        setScreenHistory((h) => h.slice(0, -1));
        setCurrentScreen(prev);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [drawerOpen, screenHistory]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy, x0 }) =>
        x0 < 30 && dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderRelease: (_, { dx, x0 }) => {
        if (x0 < 30 && dx > 50) setDrawerOpen(true);
      },
    }),
  ).current;

  const renderScreen = () => {
    switch (currentScreen) {
      case "Configuracoes":
        return <SettingsScreen />;
      case "MeuMei":
      default:
        return <MeiScreen />;
    }
  };

  return (
    <NavigationContext.Provider value={navContext}>
      <View style={styles.root} {...panResponder.panHandlers}>
        <ImpersonationBanner />
        {renderScreen()}
        <SideDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={drawerItems}
          current={currentScreen}
          onSelect={(name) => navigateTo(name)}
          theme={theme}
          headerLabel={APP_BRAND_NAME}
        />
      </View>
    </NavigationContext.Provider>
  );
}

const createStyles = () =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
  });
