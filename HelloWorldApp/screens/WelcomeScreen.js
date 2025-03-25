import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome! WakeUpWars</Text>
      <Button title="Sign In" onPress={() => navigation.navigate('SignIn')} />
      <View style={{ marginTop: 10 }} />
      <Button title="Sign Up" onPress={() => navigation.navigate('SignUp')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
});
