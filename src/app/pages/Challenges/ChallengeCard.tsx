import type React from "react"
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

interface ChallengeCardProps {
  title: string
  icon: ImageSourcePropType
  daysComplete: number
  totalDays: number
  daysOfWeek: string[]
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ title, icon, daysComplete, totalDays, daysOfWeek }) => {
  // Map of day abbreviations
  const dayMap = ["M", "T", "W", "TH", "F", "S", "S"]

  // Calculate progress percentage
  const progressPercentage = (daysComplete / totalDays) * 100

  return (
    <LinearGradient colors={["#FFFFFF", "#F8F9FE"]} style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Image source={icon} style={styles.icon} />
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.daysContainer}>
            {dayMap.map((day, index) => (
              <View key={index} style={[styles.dayCircle, daysOfWeek.includes(day) ? styles.activeDayCircle : {}]}>
                <Text style={[styles.dayText, daysOfWeek.includes(day) ? styles.activeDayText : {}]}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {daysComplete}/{totalDays} Days Complete
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}

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
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  activeDayCircle: {
    backgroundColor: "#8A2BE2",
  },
  dayText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  activeDayText: {
    color: "#FFF",
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
})

export default ChallengeCard
