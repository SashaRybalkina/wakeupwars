import React, { useEffect, useState } from 'react';
import * as SecureStore from "expo-secure-store";
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NavigationProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { BASE_URL, endpoints } from '../api';
import { useUser } from '../context/UserContext';

type Props = {
  navigation: NavigationProp<any>;
};

const { width } = Dimensions.get('window');
const inputWidth = Math.min(width * 0.85, 400);

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { user, setUser, setCsrfToken } = useUser();
  const route = useRoute();

  useEffect(() => {
    if (user?.id) {
      console.log("Logged in user ID:", user.id)
    }
  }, [user])  

  const goToSignUp = () => {
    navigation.navigate('SignUp');
  };

  // const handleLogin = async () => {
  //   if (!username || !password) {
  //     Alert.alert('Error', 'Please enter both username and password');
  //     return;
  //   }

  //   try {
  //     // Step 1: Get CSRF token and store in context
  //     console.log('here');
  //     const res = await fetch(`${BASE_URL}/api/csrf-token/`, {
  //       credentials: 'include',
  //     });
  //     const tokenData = await res.json();
  //     const csrfToken = tokenData.csrfToken;
  //     console.log('token in handleLogin: ' + csrfToken);
  //     // setCsrfToken(csrfToken); // Store token in context

  //     // Step 2: Use token to login
      // const response = await fetch(endpoints.login, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-CSRFToken': csrfToken,
      //   },
      //   credentials: 'include',
      //   body: JSON.stringify({ username, password }),
      // });

      // const data = await response.json();

      // // Step 3: Check response
      // if (response.ok && data.success) {
      //   setUser({
      //     id: data.id,
      //     name: data.name,
      //     email: data.email,
      //     username: data.username,
      //   });
  //       // If redirected here, go to intended screen
  //       if (route.params && route.params.redirectTo) {
  //         navigation.replace(
  //           route.params.redirectTo,
  //           route.params.redirectParams || {},
  //         );
  //       } else {
  //         navigation.navigate('Profile');
  //       }
  //     } else {
  //       Alert.alert('Login Failed', data.error || 'Login failed');
  //       console.log('response status:', response.status);
  //       console.log('response body:', data);
  //     }
  //   } catch (error) {
  //     console.error('Login error:', error);
  //     Alert.alert('Error', 'Network error or server is down.');
  //   }
  // };

  const handleLogin = async () => {
  try {
    // Step 1: exchange username+password for tokens
    const tokenRes = await fetch(endpoints.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!tokenRes.ok) throw new Error("Invalid credentials");

    const { access, refresh } = await tokenRes.json();

    // Step 2: save tokens securely (expo-secure-store recommended)
    await SecureStore.setItemAsync("access", access);
    await SecureStore.setItemAsync("refresh", refresh);

    // // Step 3: fetch user profile
    // const userRes = await fetch(endpoints.getUserInfo, {
    //   headers: { Authorization: `Bearer ${access}` },
    // });

    // if (!userRes.ok) throw new Error("Failed to fetch user info");

    // const userData = await userRes.json();

    // // Step 4: set user context
    // setUser({
    //   id: userData.id,
    //   name: userData.name,
    //   email: userData.email,
    //   username: userData.username,
    // });

      const response = await fetch(endpoints.login, {
        method: "GET",
        headers: { Authorization: `Bearer ${access}` },
      });

      const data = await response.json();
      console.log(data)

      // Step 3: Check response
      if (response.ok && data.success) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          username: data.username,
        });

        // // Step 5: navigate
        // console.log("why am i going to wordle")
        // navigation.navigate("Profile");
        // navigation.setParams({ screen: undefined, data: undefined });

        // navigation.reset({
        //   index: 0,
        //   routes: [{ name: "Profile" }],
        // });
        navigation.reset({
          index: 0,
          routes: [{ name: "Profile", params: {} }],
        });
      }
  } catch (err: any) {
    Alert.alert("Login Failed", err.message);
  }
};


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ImageBackground
        source={require('../images/cgpt3.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.contentContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../images/wakeupwars.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
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
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666"
                />
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 300,
    height: 70,
  },
  formContainer: {
    width: inputWidth,
    backgroundColor: 'rgba(255, 255, 240, 0.45)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,1)',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#333',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: 'rgba(50, 50, 60, 0.9)',
    fontSize: 14,
  },
  loginButton: {
    width: '100%',
    color: 'rgba(50, 50, 60, 0.5)',
    height: 55,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  loginButtonBackground: {
    backgroundColor: 'rgba(255, 255, 245, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'rgba(0, 0, 0, 0.8)',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245, 226, 186, 1)',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  appleButton: {
    backgroundColor: '#fff',
  },
  facebookButton: {
    backgroundColor: '#fff',
  },
  signupContainer: {
    flexDirection: 'row',
    marginTop: 30,
    alignItems: 'center',
  },
  signupText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: 'bold',
    marginRight: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  signupLink: {
    color: '#FFD700',
    fontSize: 19,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});

export default LoginScreen;
