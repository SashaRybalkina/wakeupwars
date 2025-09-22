import type React from "react"
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { DayOfWeek, DayOfWeekLabels } from "./DayOfWeek"

interface PublicChallengeCardProps {
  title: string,
  icon: ImageSourcePropType,
  startDate: string
  endDate: string
  daysOfWeek: string[]
  daysCompleted: number
  totalDays: number
  isCompleted: boolean
  categories: string[]
  averageSkillLevel: number
}

export const orderedDayLabels = (): string[] => [
  DayOfWeekLabels[1], // Monday
  DayOfWeekLabels[2], // Tuesday
  DayOfWeekLabels[3], // Wednesday
  DayOfWeekLabels[4], // Thursday
  DayOfWeekLabels[5], // Friday
  DayOfWeekLabels[6], // Saturday
  DayOfWeekLabels[7], // Sunday
];

const PublicChallengeCard: React.FC<PublicChallengeCardProps> = ({ 
  title, 
  icon, 
  startDate,
  endDate,
  daysOfWeek,
  daysCompleted,
  totalDays,
  isCompleted,
  categories,
  averageSkillLevel,
}) => {
  const dayMap = orderedDayLabels();
  const progressPercentage = (daysCompleted / totalDays) * 100

  return (
    <LinearGradient colors={["#FFFFFF", "#F8F9FE"]} style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Image source={icon} style={styles.icon} />
        </View>

        <View style={styles.detailsContainer}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Days of week */}
          <View style={styles.daysContainer}>
            {dayMap.map((day, index) => {
              const isActive = daysOfWeek.includes(day);
              return (
                <View key={index} style={styles.dayWrapper}>
                  <View style={[styles.dayCircle, isActive ? styles.activeDayCircle : {}]}>
                    <Text style={[styles.dayText, isActive ? styles.activeDayText : {}]}>
                      {day}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={styles.alarmIndicator}>
                      <Ionicons name="alarm" size={10} color="#FFD700" />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Categories */}
          <View style={styles.categoriesContainer}>
            {categories.map((cat, idx) => (
              <View key={idx} style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{cat}</Text>
              </View>
            ))}
          </View>

          {/* Average skill level */}
          <Text style={styles.skillLevelText}>Skill Level: {averageSkillLevel.toFixed(1)}</Text>

          {/* Enrollment progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {daysCompleted}/{totalDays} Days Complete
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 14,
    color: "#EDE7F6",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 65,
    height: 65,
    borderRadius: 30,
    backgroundColor: "rgba(138, 43, 226, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    width: 65,
    height: 65,
    resizeMode: "contain",
  },
  detailsContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  daysContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  dayWrapper: {
    alignItems: "center",
    marginRight: 4,
    position: "relative",
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  activeDayCircle: {
    backgroundColor: "#aaaaff",
  },
  dayText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  activeDayText: {
    color: "#FFF",
  },
  alarmIndicator: {
    position: "absolute",
    bottom: -5,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#D1C4E9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#7E57C2",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  categoriesContainer: {
  flexDirection: "row",
  flexWrap: "wrap",
  marginVertical: 4,
},
categoryBadge: {
  backgroundColor: "#E0E0FF",
  borderRadius: 8,
  paddingHorizontal: 6,
  paddingVertical: 2,
  marginRight: 4,
  marginBottom: 4,
},
categoryText: {
  fontSize: 12,
  color: "#333",
},
skillLevelText: {
  fontSize: 14,
  fontWeight: "500",
  marginBottom: 6,
},

})

export default PublicChallengeCard