import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, StackActions, useRoute } from '@react-navigation/native';
import { getGameMeta } from './NewGamesManagement';

type Props = {
  navigation: NavigationProp<any>;
};



const GameExpanded: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  console.log("Route params:", route.params);

  const { catType, catId, catName, categories, singOrMult, gameId, gameName, groupId, groupMembers, onGameSelected, challId, challName, friendId } = route.params as {
    catType: string;
    catId: number;
    catName: string;
    categories: { id: number; name: string }[];
    singOrMult: string;
    gameId: number;
    gameName: string;
    groupId: number;
    groupMembers: { id: number; name: string }[];
    onGameSelected: (game: { id: number; name: string }) => void;
    challId: number;
    challName: number;
    friendId?: number;
  };

  // Here we use our new mapping system to get the correct image and description.
  const meta = getGameMeta(gameId, gameName);

  const selectPressed = () => {
    if (onGameSelected) {
      onGameSelected({ id: gameId, name: gameName });
    }
    if (catType == 'Personal') navigation.navigate('PersChall2');
    else if (catType == 'Group') navigation.navigate('GroupChall2', { groupId, groupMembers });
    else if (catType === 'Public') {
      // navigation.navigate('CreatePublicChall2', { 
      //   singOrMult: singOrMult,
      //   categories: categories,
      // });
      navigation.dispatch(StackActions.pop(3));
    }
    else if (catType == 'Schedule') navigation.navigate('ChallSchedule', { challId, challName });
    else if (catType == 'Friend') navigation.navigate('CreateChallengeForFriend', { friendId }); // here, groupId is actually friendId
  };

  return (
    <ImageBackground
      source={require('../../images/secondary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Decorative elements */}
      <View style={[styles.decorativeStar, { top: '15%', left: '15%' }]} />
      <View style={[styles.decorativeStar, { top: '30%', right: '15%' }]} />
      <View style={[styles.decorativeDot, { top: '5%', right: '15%' }]} />
      <View style={[styles.decorativeDot, { bottom: '25%', right: '20%' }]} />
      <View style={[styles.decorativeDot, { bottom: '15%', left: '10%' }]} />
      <View style={[styles.decorativeDot, { top: '45%', left: '5%' }]} />
      
      <View style={styles.backButtonContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.container}>
        <Text style={styles.title}>{gameName}</Text>
        <ImageBackground
          source={meta.image}
          style={styles.gameImg}
          imageStyle={styles.gameImgStyle}
        />
        <Text style={styles.desc}>{meta.desc}</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={selectPressed}
        >
          <Text style={styles.selectButtonText}>Select Game</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    // Gradient is handled by the background image
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  gameImg: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  gameImgStyle: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  desc: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 40,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  selectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Decorative elements
  decorativeStar: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    transform: [{ rotate: '45deg' }],
  },
  decorativeDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 6,
  },
});

export default GameExpanded;