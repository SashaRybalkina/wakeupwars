import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const StartScreen: React.FC<Props> = ({ navigation }) => {
  const goToLogin = () => {
    navigation.navigate('Login');
  };

  const goToSignUp = () => {
    navigation.navigate('SignUp');
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
      source={require('../images/start.jpg')}
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
        <Text style={styles.subtitle}>
          Wake up on time, engaged, and motivated
        </Text>
        <Button style={styles.button} onPress={goToLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Button>
        <Button
          style={[styles.button, styles.signUpButton]}
          onPress={goToSignUp}
        >
          <Text style={[styles.buttonText, styles.signUpButtonText]}>
            Sign Up
          </Text>
        </Button>
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
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#DF3372',
    fontStyle: 'italic',
    marginTop: 5,
    marginBottom: 50,
  },
  button: {
    width: '90%',
    height: 55,
    marginVertical: 10,
    borderRadius: 10,
    borderColor: '#DF3372',
    borderWidth: 2,
    backgroundColor: '#FF7893',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 25,
    color: '#FFF',
  },
  signUpButton: {
    marginTop: 20,
    backgroundColor: '#FFF',
  },
  signUpButtonText: {
    color: '#FF7893',
  },
});

export default StartScreen;
