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
import { endpoints } from "../../api";

type Props = {
  navigation: NavigationProp<any>;
};

const CreatePublicChall1: React.FC<Props> = ({ navigation }) => {
  const [categories, setCategories] = useState<{ id: number; categoryName: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [singOrMult, setSingOrMult] = useState<"singleplayer" | "multiplayer" | null>(null);

  useEffect(() => {
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
  }, []);

  const handleNext = () => {
    if (!selectedCategory) {
      Alert.alert("Error", "Please select a category");
      return;
    }
    if (!singOrMult) {
      Alert.alert("Error", "Please select Singleplayer or Multiplayer");
      return;
    }

    navigation.navigate("CreatePublicChall2", {
      categoryId: selectedCategory,
      singOrMult, // TODO: check what this is set to
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
          {/* Category Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Choose Category</Text>
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
                    selectedCategory === cat.id && styles.choiceButtonSelected,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setSingOrMult(null); // reset game type when category changes
                  }}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      selectedCategory === cat.id && styles.choiceTextSelected,
                    ]}
                  >
                    {cat.categoryName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Singleplayer / Multiplayer choice (only shown after category is selected) */}
          {selectedCategory && (
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
                    onPress={() => setSingOrMult(type as any)}
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

export default CreatePublicChall1;
