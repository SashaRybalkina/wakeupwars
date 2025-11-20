/**
 * @file AcceptGInvite.tsx
 * @description This file creates a page that allows users to accept a group invite.
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

const AcceptGInvite: React.FC<Props> = ({ navigation }) => {
  var friend = 'Dummy Friend';
  var groups = 'Group1, Group2, and Group3';
  const dummyProfiles = Array.from({ length: 10 });

  return (
    <View style={styles.background}>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
          <Ionicons name="close-outline" size={50} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>
          Your friend {friend} invited you to join groups {groups}
        </Text>
        <View style={styles.profileContainer}>
          {dummyProfiles.map((_, index) => (
            <View key={index} style={styles.profile} />
          ))}
        </View>
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
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 75,
    marginTop: 75,
    textAlign: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 100,
  },
  profile: {
    borderRadius: 100,
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    margin: 7,
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

export default AcceptGInvite;
