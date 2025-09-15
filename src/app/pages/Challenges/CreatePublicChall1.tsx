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

type Props = {
  navigation: NavigationProp<any>;
};

const CreatePublicChall: React.FC<Props> = ({ navigation }) => {
  const [singOrMult, setSingOrMult] = useState<"singleplayer" | "multiplayer" | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<{ id: number; name: string } | null>();
  const [miscSelected, setMiscSelected] = useState(false);

  useEffect(() => {
    if (singOrMult) {
    const fetchCats = async () => {
      try {
        // fetch the categories for multiplayer/singleplayer (whatever was selected)
        const response = await fetch(endpoints.cats());
        const data = await response.json();
        setCategories(data); 
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
  
    fetchCats();
    }
  }, [singOrMult]);

  const handleNext = () => {
    if (!singOrMult) {
      Alert.alert("Error", "Please choose Singleplayer or Multiplayer");
      return;
    }

    if (!miscSelected && singOrMult === "singleplayer" && !selectedCategory) {
      Alert.alert("Error", "Please choose a category or select Miscellaneous");
      return;
    }

    navigation.navigate("CreatePublicChall2", {
      singOrMult,
      category: miscSelected ? null : selectedCategory,
      isMiscellaneous: miscSelected,
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
              {["singleplayer", "multiplayer"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.choiceButton,
                    singOrMult === type && styles.choiceButtonSelected,
                  ]}
                  onPress={() => {
                    setSingOrMult(type as any);
                    setSelectedCategory(null);
                    setMiscSelected(false);
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
              <View style={styles.choiceRow}>
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
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesScroll}
              >
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.choiceButton,
                      selectedCategory?.id === cat.id && styles.choiceButtonSelected,
                    ]}
                    onPress={() => {
                      setSelectedCategory({id: cat.id, name: cat.name});
                      setMiscSelected(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        selectedCategory?.id === cat.id && styles.choiceTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
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
