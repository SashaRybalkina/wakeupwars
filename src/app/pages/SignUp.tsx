import type React from "react"
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

type Props = {
  navigation: NavigationProp<any>
}

const { width } = Dimensions.get("window")
const inputWidth = Math.min(width * 0.85, 400)

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const goToLogin = () => {
    navigation.navigate("Login")
  }

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword || !name) {
      Alert.alert("Error", "Please fill out all fields.")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.")
      return
    }

    try {
      const res = await fetch(`${BASE_URL}/api/csrf-token/`, {
        credentials: 'include',
      });
      const tokenData = await res.json();
      const csrfToken = tokenData.csrfToken;

      const response = await fetch(endpoints.register, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          username,
          email,
          password,
          name,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        Alert.alert("Success", "Account created successfully!", [
          { text: "Login", onPress: () => navigation.navigate("Login") },
        ])
      } else {
        Alert.alert("Error", data.error || "Failed to sign up.")
      }
    } catch (error) {
      console.error("Signup error:", error)
      Alert.alert("Error", "Signup failed. Try again later.")
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ImageBackground source={require("../images/cgpt3.png")} style={styles.backgroundImage} resizeMode="cover">
        <View style={styles.contentContainer}>
          <TouchableOpacity style={styles.backButton} onPress={goToLogin}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Image source={require("../images/wakeupwars.png")} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.subHeaderText}>Join the challenge</Text>
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
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
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

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By signing up, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={goToLogin}>
              <Text style={styles.loginLink}>Log In</Text>
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
    paddingTop: 40,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 60,
  },
  logoImage: {
    width: 220,
    height: 90,
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
    elevation: 5,
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
