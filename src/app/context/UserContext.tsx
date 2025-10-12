import React, { createContext, useState, useContext } from "react";

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
};

const UserContext = createContext<UserCtx | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | number | null>(null);

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
