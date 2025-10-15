import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { endpoints } from '../../api';
import { getAccessToken } from '../../auth';

type Props = {
  navigation: NavigationProp<any>;
};

const SomeCategories: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { catType, categories, singOrMult, groupId, groupMembers, challId, challName, onGameSelected } = route.params as {
    catType: string;
    categories: { id: number; name: string }[];
    groupId: number;
    groupMembers: { id: number; name: string }[];
    singOrMult: string;
    onGameSelected: (game: { id: number; name: string }) => void;
    challId: number;
    challName: number;
  };

  console.log("SomeCategories route params:", route.params);

  const [cats, setCats] = useState<{ id: number; categoryName: string }[]>([]);
  
  useEffect(() => {
    const fetchCats = async () => {
      try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error("Not authenticated");
              }
        // fetch the categories for multiplayer/singleplayer (whatever was selected)
        const response = await fetch(endpoints.someCats(categories.map(c => c.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
        const data = await response.json();
        setCats(data); 
        console.log("Data: " + data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
  
    fetchCats();
  }, []);

  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
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
        <Text style={styles.title}>Categories</Text>
        <ScrollView 
          style={styles.scrollViewContainer}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {cats.map((cat, index) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryButton}
                  onPress={() => {
                    navigation.navigate("Games", {
                      catType: catType,
                      catName: cat.categoryName,
                      catId: cat.id,
                      categories: categories,
                      singOrMult: singOrMult,
                      onGameSelected,
                    })
                  }}
            >
              <Text style={styles.categoryButtonText}>{cat.categoryName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  scrollViewContainer: {
    width: '100%',
    maxWidth: 400,
  },
  scrollViewContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  categoryButton: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(80, 90, 140, 0.5)',
    borderRadius: 20,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryButtonText: {
    color: '#fff',
    fontSize: 28,
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

export default SomeCategories;