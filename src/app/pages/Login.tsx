import React, { useState } from 'react';
import { BASE_URL, endpoints } from '../api';
import { useUser } from '../context/UserContext';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  ImageBackground,
  Image,
} from "react-native"
import type { NavigationProp } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")
const inputWidth = Math.min(width * 0.85, 400)

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const { setUser, setCsrfToken } = useUser()

  const goToSignUp = () => {
    navigation.navigate('SignUp');
  };


  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter both username and password")
      return
    }

    try {
      // Step 1: Get CSRF token and store in context
      const res = await fetch(`${BASE_URL}/api/csrf-token/`, {
        credentials: 'include',
      });
      const tokenData = await res.json();
      const csrfToken = tokenData.csrfToken;
      console.log("token in handleLogin: " + csrfToken);
      // setCsrfToken(csrfToken); // 🔐 Store token in context
  
      // Step 2: Use token to login
      const response = await fetch(endpoints.login, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
  
      const data = await response.json();
  
      // Step 3: Check response
      if (response.ok && data.success) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          username: data.username,
        })
        navigation.navigate("Profile")
      } else {
        Alert.alert('Login Failed', data.error || 'Login failed');
        console.log('response status:', response.status);
        console.log('response body:', data);
      }
    } catch (error) {
      console.error("Login error:", error)
      Alert.alert("Error", "Network error or server is down.")
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ImageBackground source={require("../images/cgpt3.png")} style={styles.backgroundImage} resizeMode="cover">
        <View style={styles.contentContainer}>
          <View style={styles.logoContainer}>
            <Image source={require("../images/wakeupwars.png")} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
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

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.loginButton, styles.loginButtonBackground]} 
              onPress={handleLogin} 
              activeOpacity={0.9}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity style={[styles.socialButton, styles.googleButton]}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialButton, styles.appleButton]}>
                <Ionicons name="logo-apple" size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialButton, styles.facebookButton]}>
                <Ionicons name="logo-facebook" size={20} color="#4267B2" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>New to the app?</Text>
            <TouchableOpacity onPress={goToSignUp}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoImage: {
    width: 300,
    height: 70,
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
    elevation: 5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,1)",
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: "rgba(50, 50, 60, 0.9)",
    fontSize: 14,
  },
  loginButton: {
    width: "100%",
    color: "rgba(50, 50, 60, 0.5)",
    height: 55,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  loginButtonBackground: {
    backgroundColor: "rgba(255, 255, 245, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonText: {
    color: "rgba(0, 0, 0, 0.8)",
    fontSize: 18,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(245, 226, 186, 1)",
  },
  dividerText: {
    color: "#666",
    paddingHorizontal: 10,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButton: {
    backgroundColor: "#fff",
  },
  appleButton: {
    backgroundColor: "#fff",
  },
  facebookButton: {
    backgroundColor: "#fff",
  },
  signupContainer: {
    flexDirection: "row",
    marginTop: 30,
    alignItems: "center",
  },
  signupText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "bold",
    marginRight: 5,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  signupLink: {
    color: "#FFD700",
    fontSize: 19,
    fontWeight: "bold",
    textDecorationLine: "underline",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
})

export default LoginScreen
