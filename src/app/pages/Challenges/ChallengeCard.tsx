/**
 * @file ChallengeCard.tsx
 * @description This file creates a reusable component for challenge cards.
 */

import type React from "react"
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { DayOfWeek, DayOfWeekLabels } from "./DayOfWeek"

interface ChallengeCardProps {
  title: string,
  icon: ImageSourcePropType,
  startDate: string
  endDate: string
  daysOfWeek: string[]
  daysCompleted: number
  totalDays: number
  isCompleted: boolean
  alarmSchedule?: { dayOfWeek: number; alarmTime: string; userName: string }[] // Add optional prop for alarm schedule
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

const ChallengeCard: React.FC<ChallengeCardProps> = ({ 
  title, 
  icon, 
  startDate,
  endDate,
  daysCompleted, 
  totalDays, 
  daysOfWeek,
  isCompleted,
  // alarmSchedule = [] // Default to empty array if not provided
}) => {
  
  const dayMap = orderedDayLabels();
  const progressPercentage = (daysCompleted / totalDays) * 100

  return (
    <LinearGradient colors={["#FFFFFF", "#F8F9FE"]} style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Image source={icon} style={styles.icon} />
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.daysContainer}>
            {dayMap.map((day, index) => {
              const isActive = daysOfWeek.includes(day);
              // const alarmItem = alarmSchedule.find(
              //   (item) => DayOfWeekLabels[item.dayOfWeek as DayOfWeek] === day
              // );
              // const hasAlarm = isActive && alarmItem?.alarmTime;
              
              return (
                <View key={index} style={styles.dayWrapper}>
                  <View style={[
                    styles.dayCircle, 
                    isActive ? styles.activeDayCircle : {}
                  ]}>
                    <Text style={[
                      styles.dayText, 
                      isActive ? styles.activeDayText : {}
                    ]}>
                      {day}
                    </Text>
                  </View>
                  
                  {/* Show alarm indicator if this day has an alarm */}
                  {isActive && (
                    <View style={styles.alarmIndicator}>
                      <Ionicons name="alarm" size={10} color="#FFD700" />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

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
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 10,
    color: "#EDE7F6",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 85,
    height: 85,
    borderRadius: 40,
    borderColor: 'rgba(251, 174, 51, 0.5)',
    borderWidth: 4,
    backgroundColor: "#D1C4E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  icon: {
    width: 80,
    height: 80,
    resizeMode: "cover",
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
})

export default ChallengeCard