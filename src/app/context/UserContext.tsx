import { NavigationProp, useNavigation } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useState, useContext } from "react";
import { Alert, NativeModules } from 'react-native';
const { AlarmModule } = NativeModules;

export type SkillLevel = {
  category: { categoryName: string };
  totalEarned: number;
  totalPossible: number;
};

type User = { id: string | number; name: string; email: string; username: string } | null;

type UserCtx = {
  user: User;
  setUser: (u: User) => void;
  csrfToken: string | null;
  setCsrfToken: (t: string | null) => void;
  skillLevels: SkillLevel[];
  setSkillLevels: (l: SkillLevel[]) => void;
  activeConversationId: string | number | null;
  setActiveConversationId: (id: string | number | null) => void;
  activeGroupId: string | number | null;
  setActiveGroupId: (id: string | number | null) => void;

  logout: () => Promise<void>;
};

const UserContext = createContext<UserCtx | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | number | null>(null);

  // const navigation = useNavigation<NavigationProp<any>>();

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync("access");
      await SecureStore.deleteItemAsync("refresh");
      setUser(null);
      await AlarmModule.clearLaunchIntent();
    } catch (err: any) {
      console.error("Logout failed", err);
      Alert.alert("Error", "Failed to log out. Try again.");
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        csrfToken,
        setCsrfToken,
        skillLevels,
        setSkillLevels,
        activeConversationId,
        setActiveConversationId,
        activeGroupId,
        setActiveGroupId,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
};
