import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useLinkBuilder, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect } from 'react';
import DateTimePicker from "@react-native-community/datetimepicker"
import { useUser } from "../../context/UserContext"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Button,
  PanResponder,
  GestureResponderEvent,
  TouchableOpacity,
  ImageBackground,
  TextInput,
  Platform,
} from 'react-native';
import { BASE_URL, endpoints } from '../../api';
import { getAccessToken } from '../../auth';

type Props = { navigation: NavigationProp<any> } 


const PublicChallSearch1: React.FC<Props> = ({ navigation }) => { 
  const { user } = useUser()

  const [singOrMult, setSingOrMult] = useState<"singleplayer" | "multiplayer" | null>(null);
  const [categories, setCategories] = useState<{ id: number; categoryName: string }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<{ id: number; name: string }[]>([]);


    useEffect(() => {
      if (singOrMult) {
      const fetchCats = async () => {
        try {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                  throw new Error("Not authenticated");
                }
          // TODO: fetch only the categories for multiplayer/singleplayer (whatever was selected)
          const response = await fetch(endpoints.cats(), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
          const data = await response.json();
          setCategories(data);
          console.log("Data2: " + JSON.stringify(data));
        } catch (error) {
          console.error('Failed to fetch categories:', error);
        }
      };
    
      fetchCats();
      }
    }, [singOrMult]);



    const handleSubmit = async() => {
        if (!singOrMult) {
            Alert.alert("Error", "Please choose singleplayer or multiplayer")
            return
        }

        if (selectedCategories.length == 0) {
          Alert.alert("Error", "Please choose at least one category");
          return;
        }

        try {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                  throw new Error("Not authenticated");
                }
            console.log(selectedCategories)
            console.log(singOrMult)
        const res = await fetch(endpoints.getMatchingChallenges(Number(user?.id), selectedCategories.map(c => c.id), singOrMult === "singleplayer" ? "Singleplayer" : "Multiplayer"), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });


        const data = await res.json();
        console.log("DATA MATCHES:", JSON.stringify(data, null, 2));

        navigation.navigate("PublicChallSearch2", { matches: data.matches });

        } catch (err: any) {
            Alert.alert('Error', err.message);
        }

    }

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
          <ScrollView
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >

        <Text style={styles.pageTitle}>Public Challenge Search</Text>

        {/* Singleplayer / Multiplayer Choice */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Game Type</Text>
            <View style={styles.choiceRow}>
              {["singleplayer", "multiplayer"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.choiceButton,
                    singOrMult === type && styles.choiceButtonSelected,
                  ]}
                  onPress={() => {
                    setSingOrMult(type as any);
                  }}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      singOrMult === type && styles.choiceTextSelected,
                    ]}
                  >
                    {type === "singleplayer" ? "Singleplayer" : "Multiplayer"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Categories  */}
          {singOrMult && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Category</Text>

<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={styles.categoriesScroll}
>
  {categories.map((cat) => {
    const isSelected = selectedCategories.some(c => c.id === cat.id);

    return (
      <TouchableOpacity
        key={cat.id}
        style={[
          styles.choiceButton,
          isSelected && styles.choiceButtonSelected,
        ]}
        onPress={() => {
          setSelectedCategories((prev) => {
            if (isSelected) {
              // remove if already selected
              return prev.filter(c => c.id !== cat.id);
            } else {
              // add if not selected
              return [...prev, { id: cat.id, name: cat.categoryName }];
            }
          });
        }}
      >
        <Text
          style={[
            styles.choiceText,
            isSelected && styles.choiceTextSelected,
          ]}
        >
          {cat.categoryName}
        </Text>
      </TouchableOpacity>
    );
  })}
</ScrollView>
                          </View>
                        )}


          <TouchableOpacity style={styles.createButton} onPress={handleSubmit}>
            <LinearGradient
              colors={['#FFD700', '#FFC107']}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Search for Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>


      </ScrollView>
    </ImageBackground>
  )
}



const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  formSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dateDisplay: {
    color: '#FFD700',
    fontSize: 16,
    marginBottom: 10,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  doneButton: {
    backgroundColor: 'rgba(255,215,0,0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 60,
    height: 30,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    color: '#FFF',
    fontSize: 12,
  },
  interactiveCell: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selectedCell: {
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  createButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#FFF", marginBottom: 15 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap" },
  choiceButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  choiceButtonSelected: { backgroundColor: "rgba(255, 215, 0, 0.3)", borderColor: "#FFD700" },
  choiceText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  choiceTextSelected: { color: "#FFD700" },
  categoriesScroll: { paddingVertical: 5 },
})


export default PublicChallSearch1;