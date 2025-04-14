import React, { useState } from 'react';
import { endpoints } from '../api';
import { useUser } from '../context/UserContext';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { setUser } = useUser();
  const goToSignUp = () => {
    navigation.navigate('SignUp');
  };
  const handleLogin = async () => {
    try {
      const response = await fetch(endpoints.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
  
      const data = await response.json();

      if (response.ok && data.success) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          username: data.username,
        });
        navigation.navigate('Profile');
      } else {
        Alert.alert('Login Failed', data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error or server is down.');
    }
  };

  interface TextWithStrokeProps {
    text: string;
    strokeColor: string;
    strokeWidth: number;
    textColor: string;
    fontSize: number;
  }

  const TextWithStroke: React.FC<TextWithStrokeProps> = ({
    text,
    strokeColor,
    strokeWidth,
    textColor,
    fontSize,
  }) => (
    <View style={styles.textContainer}>
      {/* Text with Stroke (Outline) - slightly offset */}
      <Text
        style={[
          styles.title,
          {
            color: strokeColor,
            fontSize,
            position: 'absolute',
            zIndex: -1, // Behind the actual text
            textShadowOffset: { width: strokeWidth, height: strokeWidth },
            textShadowRadius: 0, // No blur
            textShadowColor: strokeColor,
          },
        ]}
      >
        {text}
      </Text>

      {/* Actual Text */}
      <Text style={[styles.title, { color: textColor, fontSize }]}>{text}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ImageBackground
        source={require('../images/login.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.container}>
          <TextWithStroke
            text="WakeUpWars"
            strokeColor="#FF7893"
            strokeWidth={2}
            textColor="#FFF"
            fontSize={55}
          />
          <View style={styles.gap}></View>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#CBCBCB"
            onChangeText={(text) => setUsername(text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#CBCBCB"
            secureTextEntry={true}
            onChangeText={(text) => setPassword(text)}
          />
          <Button style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </Button>
          <Text style={styles.signUpText}>
            New to the app?{' '}
            <Text style={styles.signUpLink} onPress={goToSignUp}>
              Sign Up
            </Text>{' '}
            to get started!
          </Text>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    maxWidth: 400,
    width: '80%',
    marginBottom: 80,
    marginTop: 80,
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
  },
  title: {
    color: '#FFF',
    fontFamily: 'Arvo-Regular',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gap: {
    marginVertical: 25,
  },
  input: {
    width: '80%',
    height: 50,
    color: 'black',
    backgroundColor: '#FFF',
    borderColor: '#919191',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 15,
    marginBottom: 10, // Reduced margin bottom to reduce gap
  },
  button: {
    width: '80%',
    height: 50,
    backgroundColor: '#FF7893',
    borderRadius: 10,
    borderColor: '#DF3372',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, // Adjusted to make it closer to the input fields
    marginBottom: 15,
  },
  buttonText: {
    fontFamily: 'Arvo-Bold',
    fontSize: 18,
    color: '#fff',
  },
  signUpText: {
    marginTop: 10,
    fontSize: 16,
    color: '#686868',
    textAlign: 'center',
  },
  signUpLink: {
    color: '#5E84F6',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
