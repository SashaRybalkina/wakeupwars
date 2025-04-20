import React, { createContext, useContext, useState } from 'react';

type User = {
  id: number;
  name?: string;
  email?: string;
  username?: string;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  csrfToken: string | null;
  setCsrfToken: (token: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  return (
    <UserContext.Provider value={{ user, setUser, csrfToken, setCsrfToken }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};
