import type React from "react"
import * as SecureStore from "expo-secure-store";
import { useState } from "react"
import { BASE_URL, endpoints } from "../api"

import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ImageBackground,
  Image,
} from "react-native"
import type { NavigationProp } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { useUser } from '../context/UserContext';

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")
const inputWidth = Math.min(width * 0.85, 400)

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { user, setUser, setCsrfToken } = useUser();

  const goToLogin = () => {
    navigation.navigate("Login")
  }

  const handleSignUp = async () => {
  if (!username || !password || !confirmPassword || !name) {
    Alert.alert("Error", "Please fill out all fields.");
    return;
  }

  if (password !== confirmPassword) {
    Alert.alert("Error", "Passwords do not match.");
    return;
  }

  try {
    // 1. Create user
    const res = await fetch(endpoints.register, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to sign up.");
    }

    // 2. Optionally auto-login after signup
    const tokenRes = await fetch(endpoints.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!tokenRes.ok) {
      throw new Error("Signup succeeded but auto-login failed.");
    }

    const { access, refresh } = await tokenRes.json();

    // Step 2: save tokens securely (expo-secure-store recommended)
    await SecureStore.setItemAsync("access", access);
    await SecureStore.setItemAsync("refresh", refresh);

      const userRes = await fetch(endpoints.login, {
        method: "GET",
        headers: { Authorization: `Bearer ${access}` },
      });

    if (!userRes.ok) throw new Error("Failed to fetch user info");

    const userData = await userRes.json();

    // Step 4: set user context
    setUser({
      id: userData.id,
      name: userData.name,
      username: userData.username,
    });

    // Navigate to profile or intended screen
    navigation.navigate("Profile");

  } catch (err: any) {
    Alert.alert("Error", err.message);
  }
};


  return (
    // <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ImageBackground source={require("../images/cgpt3.png")} style={styles.backgroundImage} resizeMode="cover">
        <View style={styles.contentContainer}>
          <TouchableOpacity style={styles.backButton} onPress={goToLogin}>
            <Ionicons name="arrow-back" size={34} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Image source={require("../images/wuw3.png")} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="at" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.signupButton, styles.signupButtonBackground]}
              onPress={handleSignUp}
              activeOpacity={0.8}
            >
              <Text style={styles.signupButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={goToLogin}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    // </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
contentContainer: {
  width: '100%',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingTop: 50,   // same as your working screen
},
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 70,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 100,
  },
  logoImage: {
    width: 220,
    height: 100,
    marginBottom: 10,
  },
  subHeaderText: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.9,
    marginTop: 5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  formContainer: {
    width: inputWidth,
    backgroundColor: "rgba(255, 255, 240, 0.45)",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#333",
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  signupButton: {
    width: "100%",
    height: 55,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
  },
  buttonGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  signupButtonText: {
    color: "rgba(0, 0, 0, 0.8)",
    fontSize: 18,
    fontWeight: "600",
  },
  termsContainer: {
    marginTop: 15,
    alignItems: "center",
  },
  termsText: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  termsLink: {
    color: "#3498db",
    fontWeight: "500",
  },
  loginContainer: {
    flexDirection: "row",
    marginTop: 30,
    alignItems: "center",
  },
  loginText: {
    color: "#fff",
    fontSize: 16,
    marginRight: 5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loginLink: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
    textDecorationLine: "underline",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  signupButtonBackground: {
    backgroundColor: "rgba(255, 255, 245, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
})

export default SignUpScreen
