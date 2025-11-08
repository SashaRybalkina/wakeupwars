// GroupsContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getAccessToken } from "../auth";
import { endpoints } from "../api";
import { useUser } from "./UserContext";

type Group = {
  id: number;
  name: string;
};

type GroupsContextType = {
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  refreshGroups: () => Promise<void>;
  invalid: boolean;
  invalidateGroups: () => void;
  isLoading: boolean;
};

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) throw new Error("useGroups must be used within GroupsProvider");
  return context;
};

export const GroupsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
//   const [inviteCount, setInviteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [invalid, setInvalid] = useState(true);
  const { user } = useUser();

  const refreshGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not authenticated");

        const groupsRes = await fetch(endpoints.groups(Number(user?.id)), { headers: { Authorization: `Bearer ${accessToken}` } })


      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setGroups(groupsData);
      }
    } catch (err) {
      console.error("Failed to refresh groups:", err);
    } finally {
      setIsLoading(false);
      setInvalid(false);
    }
  }, [user?.id]);

  
  useEffect(() => {
  if (user?.id) {
    setGroups([]);
    // setInviteCount(0);
    refreshGroups();
  }
}, [user?.id, refreshGroups]);

  const invalidateGroups = () => setInvalid(true);

  return (
    <GroupsContext.Provider value={{ groups, setGroups, refreshGroups, invalid, invalidateGroups, isLoading }}>
      {children}
    </GroupsContext.Provider>
  );
};
