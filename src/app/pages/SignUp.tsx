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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore/lite';
import { Button } from 'tamagui';

import { db } from '../firebase';

type Props = {
  navigation: NavigationProp<any>;
};

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  const handleSignUp = async () => {
    try {
      const usersCollectionRef = collection(db, 'allUsers');
      const querySnapshot = await getDocs(usersCollectionRef);
      let userExists = false;
      let emailExists = false;

      querySnapshot.forEach((doc) => {
        if (doc.data().username === username) {
          userExists = true;
        }
        if (doc.data().email === email) {
          emailExists = true;
        }
      });

      if (userExists) {
        Alert.alert('Username already exists. Log into your account.');
      } else if (emailExists) {
        Alert.alert(
          'Email already has a username attached. Log into your account.',
        );
      } else if (password != confirmPassword) {
        Alert.alert('Passwords do not match. Please try again.');
      } else {
        const docRef = await addDoc(usersCollectionRef, {
          username: username,
          password: password,
          email: email,
        });

        // Reference to collections and planner subcollections
        const collectionsRef = collection(
          usersCollectionRef,
          docRef.id,
          'collections',
        );
        const plannerRef = collection(usersCollectionRef, docRef.id, 'planner');

        // Set up 'collections' subcollection
        const historyRef = doc(collectionsRef, 'History');
        const favoritesRef = doc(collectionsRef, 'Favorites');
        await Promise.all([setDoc(historyRef, {}), setDoc(favoritesRef, {})]);

        // Set up 'planner' subcollection
        const dayRefs = [
          'Day 1',
          'Day 2',
          'Day 3',
          'Day 4',
          'Day 5',
          'Day 6',
          'Day 7',
        ];
        const dayDocRefs = dayRefs.map((day) => doc(plannerRef, day));
        await Promise.all(dayDocRefs.map((docRef) => setDoc(docRef, {})));

        // Navigate to the next screen after all operations are completed
        navigation.navigate('Registered', { userId: docRef.id });
      }
    } catch (error) {
      console.error('Error signing up:', error);
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
