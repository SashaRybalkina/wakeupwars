import React, { useState } from "react";
import { 
  ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, 
  Platform, Alert 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NavigationProp, RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  navigation: NavigationProp<any>;
  route: RouteProp<any>;
};

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"];

const EditChallengeSharingFriends: React.FC<Props> = ({ navigation, route }) => {
  const { challenge } = route.params || {};

  const [startDate, setStartDate] = useState(new Date(challenge.startDate));
  const [endDate, setEndDate] = useState(new Date(challenge.endDate));

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // --- Android/iOS date handler ---
  const onDateChange = (
    picker: "start" | "end",
    event: any,
    date?: Date
  ) => {
    if (event?.type === "dismissed") {
      picker === "start" ? setShowStartPicker(false) : setShowEndPicker(false);
      return;
    }
    if (date) {
      picker === "start" ? setStartDate(date) : setEndDate(date);
      if (Platform.OS === "android") {
        picker === "start" ? setShowStartPicker(false) : setShowEndPicker(false);
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleSave = () => {
    const payload = {
      ...challenge,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };

    console.log("Duplicated challenge payload:", payload);
    Alert.alert("Saved", "Challenge duplicated successfully!");
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={require("../../images/secondary.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Share Challenge</Text>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Challenge Info */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Name</Text>
            <Text style={styles.readonlyText}>{challenge.name}</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Days & Alarm</Text>
            <View style={styles.daysContainer}>
              {challenge.daysOfWeek.map((day: number, idx: number) => (
                <View key={idx} style={styles.dayReadonly}>
                  <Text style={styles.dayText}>{DAYS[day - 1]}</Text>
                </View>
              ))}
            </View>
            {challenge.alarmSchedule?.map((alarm: any, idx: number) => (
              <Text key={idx} style={styles.readonlyText}>
                {`Day ${alarm.dayOfWeek}: ${alarm.alarmTime}`}
              </Text>
            ))}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Games</Text>
            {challenge.games?.length > 0 ? (
              challenge.games.map((g: any, idx: number) => (
                <Text key={idx} style={styles.readonlyText}>
                  {g.name}
                </Text>
              ))
            ) : (
              <Text style={styles.readonlyText}>No games</Text>
            )}
          </View>

          {/* Start / End Dates */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Start Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(startDate)}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowStartPicker(true)}
            >
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#FFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Select Start Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => onDateChange("start", event, date)}
              />
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(endDate)}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowEndPicker(true)}
            >
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#FFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Select End Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => onDateChange("end", event, date)}
              />
            )}
          </View>

          <TouchableOpacity style={styles.createButton} onPress={handleSave}>
            <LinearGradient colors={["#FFD700", "#FFC107"]} style={styles.createButtonGradient}>
              <Text style={styles.createButtonText}>Save Challenge</Text>
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center", alignItems: "center",
    marginLeft: 20, marginBottom: 10,
  },
  pageTitle: {
    fontSize: 28, fontWeight: "700", color: "#FFF",
    textAlign: "center", marginBottom: 20,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  formSection: {
    marginBottom: 25, backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16, padding: 20, borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#FFF", marginBottom: 15 },
  readonlyText: { fontSize: 16, color: "#FFF", marginBottom: 8 },
  daysContainer: { flexDirection: "row", flexWrap: "wrap" },
  dayReadonly: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
    marginRight: 8, marginBottom: 8,
  },
  dayText: { color: "#FFF", fontWeight: "600" },
  dateDisplay: { color: "#FFD700", fontSize: 18, marginBottom: 10 },
  actionButton: { borderRadius: 12, overflow: "hidden", marginTop: 10 },
  buttonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  createButton: { borderRadius: 12, overflow: "hidden", marginTop: 20, marginBottom: 30 },
  createButtonGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  createButtonText: { color: "#333", fontSize: 18, fontWeight: "700" },
});

export default EditChallengeSharingFriends;
