import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { getAccessToken } from '../../auth';
import { useUser } from '../../context/UserContext';
import { BASE_URL, endpoints } from '../../api';

type Memoji = {
  id: number;
  imageUrl: string;
  purchased: boolean;
  price: number;
};

type Props = {
  navigation: NavigationProp<any>;
};

const EditAvatar2: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { baseMemojiId } = route.params as { baseMemojiId: number };

  const [avatars, setAvatars] = useState<Memoji[]>([]);
  const [selectedMemoji, setSelectedMemoji] = useState<Memoji | null>(null);
  const [numCoins, setNumCoins] = useState<number>(0);
  const { user } = useUser();

  const fetchAvatars = async () => {
    if (!user) return;
    const access = await getAccessToken();
    const res = await fetch(endpoints.extraMemojies(Number(user.id), baseMemojiId), {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await res.json();
    setAvatars(data.avatars);
    setNumCoins(data.numCoins);
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchAvatars().catch((e) => console.error('Failed to fetch avatars', e));
    }, [user])
  );

  const handlePurchase = async (memojiId: number, price: number) => {
    if (numCoins < price) return;

    const access = await getAccessToken();
    const res = await fetch(endpoints.purchaseMemoji(Number(user?.id), memojiId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
      },
    });

    if (res.ok) {
      await fetchAvatars(); // refresh
    }
  };

  const handleDone = async () => {
    if (!selectedMemoji) {
      Alert.alert("Error", "Please select an avatar.");
      return;
    }

    const access = await getAccessToken();
    await fetch(endpoints.setCurrentMemoji(Number(user?.id)), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ memojiId: selectedMemoji.id }),
    });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.coinsText}>💰 Coins: {numCoins}</Text>


      <View style={styles.previewContainer}>
        <View style={styles.previewFrame}>
          {selectedMemoji ? (
            <Image
              source={{ uri: `${BASE_URL}${selectedMemoji.imageUrl}` }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.emptyFrame}>
              <Text style={styles.emptyFrameText}>Select an avatar</Text>
            </View>
          )}
        </View>
      </View>


      {/* Horizontal scroll of memojies */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollContainer}>
        {avatars.map((m) => (
          <View key={m.id} style={styles.avatarCard}>
            <TouchableOpacity onPress={() => setSelectedMemoji(m)}>
              <Image
                source={{ uri: `${BASE_URL}${m.imageUrl}` }}
                style={[
                  styles.avatar,
                  selectedMemoji?.id === m.id && styles.selectedAvatar,
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {!m.purchased ? (
              <TouchableOpacity
                style={[
                  styles.purchaseButton,
                  numCoins < m.price && styles.disabledButton,
                ]}
                disabled={numCoins < m.price}
                onPress={() => handlePurchase(m.id, m.price)}
              >
                <Text style={styles.purchaseText}>Buy ({m.price})</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.purchasedLabel}>Owned</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Done button */}
      <TouchableOpacity
        style={[
          styles.doneButton,
          !selectedMemoji?.purchased && styles.disabledButton,
        ]}
        disabled={!selectedMemoji?.purchased}
        onPress={handleDone}
      >
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 16,
  },
  coinsText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  previewFrame: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  emptyFrame: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFrameText: {
    color: '#888',
    fontSize: 16,
  },
  preview: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 20,
  },
  scrollContainer: {
    maxHeight: 180,
    marginBottom: 30,
  },
  avatarCard: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#fff',
  },
  selectedAvatar: {
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  purchaseText: {
    color: '#fff',
    fontWeight: '600',
  },
  purchasedLabel: {
    color: '#ccc',
    marginTop: 5,
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: '#32CD32',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 15,
  },
  doneText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});


export default EditAvatar2;
