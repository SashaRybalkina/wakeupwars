import type React from "react"
import { createContext, useState, useContext, type ReactNode } from "react"

type User = {
  id: string | number
  name: string
  email: string
  username: string
} | null

type UserContextType = {
  user: User
  setUser: React.Dispatch<React.SetStateAction<User>>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(null)

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
