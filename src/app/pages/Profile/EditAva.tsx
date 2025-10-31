import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, FlatList } from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { getAccessToken } from '../../auth';
import { useUser } from '../../context/UserContext';
import { BASE_URL, endpoints } from '../../api';


type Props = {
  navigation: NavigationProp<any>;
};

type Memoji = {
  id: number;
  imageUrl: string;
}
const EditAva: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { currentMemojiId } = route.params as { currentMemojiId: number | null };
  const { user } = useUser();

  const [avatars, setAvatars] = useState<Memoji[]>([]);
  const [selectedMemoji, setSelectedMemoji] = useState<number | null>(currentMemojiId);

  const fetchAvatars = async () => {
    if (!user) return;
    const access = await getAccessToken();
    const res = await fetch(endpoints.baseMemojies(), {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await res.json();
    setAvatars(data);
    console.log(avatars)
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchAvatars().catch((e) => console.error('Failed to fetch avatars', e));
    }, [user])
  );

  const handleNext = () => {
    if (!selectedMemoji) {
      Alert.alert("Error", "Please select a base avatar.");
      return;
    }

    navigation.navigate('EditAvatar2', {
      baseMemojiId: selectedMemoji,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Base Avatar</Text>

      <FlatList
        data={avatars}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.gridContainer}
        renderItem={({ item }) => {
          const isSelected = selectedMemoji === item.id;
          return (
            <TouchableOpacity
              style={[styles.avatarCard, isSelected && styles.selectedCard]}
              onPress={() => setSelectedMemoji(item.id)}
            >
              <Image
                source={{ uri: `${BASE_URL}${item.imageUrl}` }}
                style={styles.avatarImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  gridContainer: {
    justifyContent: 'center',
  },
  avatarCard: {
    backgroundColor: '#1E1E1E',
    margin: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
  },
  selectedCard: {
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarImage: {
    width: 100,
    height: 100,
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 30,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});


export default EditAva;
