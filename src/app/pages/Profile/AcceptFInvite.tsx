/**
 * @file AcceptFInvite.tsx
 * @description This file creates a page that allows users to accept a friend invite.
 */

import React from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const AcceptFInvite: React.FC<Props> = ({ navigation }) => {
  var friend = 'Dummy Friend';
  return (
    <View style={styles.background}>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
          <Ionicons name="close-outline" size={50} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>{friend} sent you a friend invitation!</Text>
        <View style={styles.profile}></View>
        <TouchableOpacity style={styles.acceptInviteButton}>
          <Text style={styles.acceptInviteText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f03c84',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 75,
    left: 25,
    zIndex: 10,
  },
  container: {
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 80,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 75,
    marginTop: 75,
    textAlign: 'center',
  },
  profile: {
    borderRadius: 100,
    width: 175,
    height: 175,
    marginBottom: 125,
    backgroundColor: '#fff',
  },
  acceptInviteButton: {
    backgroundColor: '#AA55FF',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 300,
    height: 65,
    marginTop: 15,
  },
  acceptInviteText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 35,
    textAlign: 'center',
  },
});

export default AcceptFInvite;
