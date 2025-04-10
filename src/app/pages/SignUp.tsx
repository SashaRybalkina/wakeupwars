import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
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

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('https://29f7-136-38-171-186.ngrok-free.app/api/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
          name,
        }),        
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Account created!');
        navigation.navigate('Login');
      } else {
        Alert.alert(data.error || 'Failed to sign up.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Signup failed. Try again later.');
    }
  };

  return (
    <ImageBackground
      source={require('../images/login.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>WakeUpWars</Text>
        <View style={styles.gap}></View>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#CBCBCB"
          onChangeText={(text) => setName(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#CBCBCB"
          onChangeText={(text) => setUsername(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#CBCBCB"
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={(text) => setEmail(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#CBCBCB"
          secureTextEntry={true}
          onChangeText={(text) => setPassword(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#CBCBCB"
          secureTextEntry={true}
          onChangeText={(text) => setConfirmPassword(text)}
        />
        <Button style={styles.button} onPress={handleSignUp}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </Button>
        <Text style={styles.loginText}>
          Already have an account?{' '}
          <Text style={styles.loginLink} onPress={goToLogin}>
            Log In
          </Text>
        </Text>
      </View>
    </ImageBackground>
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
  title: {
    color: '#FFF',
    fontFamily: 'Arvo-Regular',
    fontWeight: 'bold',
    fontSize: 55,
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
    marginBottom: 10,
  },
  button: {
    width: '80%',
    height: 50,
    backgroundColor: '#FF7893',
    borderRadius: 10,
    borderColor: '#DF3372',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  buttonText: {
    fontFamily: 'Arvo-Bold',
    fontSize: 18,
    color: '#fff',
  },
  loginText: {
    marginTop: 10,
    fontSize: 16,
    color: '#686868',
    textAlign: 'center',
  },
  loginLink: {
    color: '#5E84F6',
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen;
