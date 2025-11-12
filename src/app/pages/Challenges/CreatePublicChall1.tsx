import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavigationProp } from "@react-navigation/native";
import { BASE_URL, endpoints } from "../../api";
import { getAccessToken } from "../../auth";
import { useUser } from "../../context/UserContext";
import NavBar from "../Components/NavBar";

type Props = {
  navigation: NavigationProp<any>;
};

type Category = {
  id: number;
  categoryName: string;
};


const STATIC_CATEGORIES: Category[] = [
  {
    id: 12,
    categoryName: "Math",
  },
  {
    id: 14,
    categoryName: "Memory",
  },
  {
    id: 16,
    categoryName: "Misc",
  },
  {
    id: 17,
    categoryName: "Word",
  },
];


const CreatePublicChall: React.FC<Props> = ({ navigation }) => {
  const { logout } = useUser();
  const [singOrMult, setSingOrMult] = useState<"Singleplayer" | "Multiplayer" | null>(null);
  const [categories, setCategories] = useState<Category[]>(STATIC_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  // const [categories, setCategories] = useState<{ id: number; categoryName: string }[]>([]);
  // const [selectedCategories, setSelectedCategories] = useState<{ id: number; name: string }[]>([]);

  // useEffect(() => {
  //   if (singOrMult) {
  //   const fetchCats = async () => {
  //     try {
  //             const accessToken = await getAccessToken();
  //             if (!accessToken) {
  //                     await logout();
  //                     navigation.reset({
  //                       index: 0,
  //                       routes: [{ name: "Login" }],
  //                     });
  //             }
  //       // TODO: fetch only the categories for multiplayer/singleplayer (whatever was selected)
  //       const response = await fetch(endpoints.cats(), {
  //               headers: {
  //                 Authorization: `Bearer ${accessToken}`
  //               }
  //             });
  //       const data = await response.json();
  //       setCategories(data);
  //       console.log("Data2: " + JSON.stringify(data));
  //     } catch (error) {
  //       console.error('Failed to fetch categories:', error);
  //     }
  //   };
  
  //   fetchCats();
  //   }
  // }, [singOrMult]);

  const handleNext = () => {
    if (!singOrMult) {
      Alert.alert("Error", "Please choose Singleplayer or Multiplayer");
      return;
    }

    if (selectedCategories.length == 0) {
      Alert.alert("Error", "Please choose at least one category");
      return;
    }

    console.log("navigating with:")
    console.log(singOrMult)
    console.log(selectedCategories)
    navigation.navigate("CreatePublicChall2", {
      singOrMult: singOrMult,
      categories: selectedCategories,
    });
  };

  return (
    <ImageBackground
      source={require("../../images/cgpt.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Configure Public Challenge</Text>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {/* Singleplayer / Multiplayer Choice */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Game Type</Text>
            <View style={styles.choiceRow}>
              {["Singleplayer", "Multiplayer"].map((type) => (
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
                    {type === "Singleplayer" ? "Singleplayer" : "Multiplayer"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Categories  */}
          {singOrMult && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Category</Text>
              {/* <View style={styles.choiceRow}>
                <TouchableOpacity
                  style={[
                    styles.choiceButton,
                    miscSelected && styles.choiceButtonSelected,
                  ]}
                  onPress={() => {
                    setMiscSelected(true);
                    setSelectedCategory(null);
                  }}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      miscSelected && styles.choiceTextSelected,
                    ]}
                  >
                    Miscellaneous
                  </Text>
                </TouchableOpacity>
              </View> */}

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
              return [...prev, { id: cat.id, categoryName: cat.categoryName }];
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

          <TouchableOpacity style={styles.createButton} onPress={handleNext}>
            <LinearGradient
              colors={["#FFD700", "#FFC107"]}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Public"
      />

    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, paddingTop: 50 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 20,
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  formSection: {
    marginBottom: 25,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
  createButton: { borderRadius: 12, overflow: "hidden", marginTop: 20 },
  createButtonGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  createButtonText: { color: "#333", fontSize: 18, fontWeight: "700" },
});

export default CreatePublicChall;
