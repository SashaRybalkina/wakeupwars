import type React from "react"
import { createContext, useState, useContext, type ReactNode } from "react"

type User = {
  id: string | number
  name: string
  email: string
  username: string
} | null

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  csrfToken: string | null;
  setCsrfToken: (token: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined)

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
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
